(function (root) {
  'use strict';
  const MATE = root.MATE = root.MATE || {};
  const data = MATE.data;
  const config = root.MATE_FIREBASE_CONFIG || {};
  const callbacks = new Set();
  const groups = ['profile', 'tasks', 'sessions', 'habits', 'habitDays'];
  const cache = { profile: null, tasks: {}, sessions: {}, habits: {}, habitDays: {} };
  const ownerKey = 'mate.accountability.cloud-owner';
  const pendingCloudDeletionKey = 'mate.accountability.pending-cloud-deletion';
  const userBackupPrefix = data.STORAGE_KEY + '.account.';
  let auth = null;
  let db = null;
  let firebaseSdkPromise = null;
  let initializationPromise = null;
  let authStateUnsubscribe = null;
  let currentUser = null;
  let refs = null;
  let stops = [];
  let waitingFor = new Set();
  let initialized = false;
  let applyingRemote = false;
  let syncing = false;
  let remotePending = false;
  let pendingState = null;
  let knownDocuments = new Map();
  let status = configReady() ? 'checking' : 'setup';
  let statusMessage = '';
  let initialSignInError = '';

  function configReady() {
    return ['apiKey', 'authDomain', 'projectId', 'appId'].every(key => {
      const value = String(config[key] || '');
      return value && !value.includes('PASTE_') && !value.includes('YOUR_PROJECT_ID');
    });
  }
  function privacyInfo() { return root.MATE_PRIVACY_NOTICE || {}; }
  function privacyReady() {
    const notice = privacyInfo();
    return notice.ready === true && notice.legalBasis === 'consent' && !!notice.version && !!notice.href;
  }
  function privacyConsentKey() { return 'mate.privacy.consent.' + String(privacyInfo().version || ''); }
  function readCloudConsent() {
    try {
      const value = JSON.parse(storageGet(privacyConsentKey()) || 'null');
      return value && value.version === privacyInfo().version && typeof value.consentedAt === 'string' && Array.isArray(value.purposes) && value.purposes.includes('account-and-sync') ? value : null;
    } catch (_) { return null; }
  }
  function state() {
    return {
      configured: configReady(),
      ready: !!auth,
      user: currentUser ? { uid: currentUser.uid, email: currentUser.email || '', displayName: currentUser.displayName || '', photoURL: currentUser.photoURL || '' } : null,
      cloudAccountLinked: !!storageGet(ownerKey),
      status,
      message: statusMessage,
      error: initialSignInError,
      privacyReady: privacyReady(),
      cloudConsentGranted: !!readCloudConsent(),
      privacyHref: privacyInfo().href || './privacy.html'
    };
  }
  function emit(detail) { callbacks.forEach(callback => { try { callback(detail || {}); } catch (_) {} }); }
  function setStatus(next, message) {
    status = next;
    statusMessage = message || '';
    emit({ dataChanged: false });
  }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function stable(value) {
    if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}';
    return JSON.stringify(value);
  }
  function clean(value) { return JSON.parse(JSON.stringify(value)); }
  function makeRefs(uid) {
    const userRef = db.collection('users').doc(uid);
    return {
      profile: userRef.collection('profile').doc('state'),
      tasks: userRef.collection('tasks'),
      sessions: userRef.collection('sessions'),
      habits: userRef.collection('habits'),
      habitDays: userRef.collection('habitDays')
    };
  }
  function mapFromCache() {
    const docs = new Map();
    if (cache.profile) docs.set('profile/state', clean(cache.profile));
    ['tasks', 'sessions', 'habits', 'habitDays'].forEach(group => {
      Object.keys(cache[group]).forEach(id => docs.set(group + '/' + id, clean(cache[group][id])));
    });
    return docs;
  }
  function stateToDocuments(appState) {
    const docs = new Map();
    const consent = readCloudConsent();
    docs.set('profile/state', clean({
      schemaVersion: appState.schemaVersion || data.SCHEMA_VERSION,
      categories: appState.categories || data.CATEGORIES,
      categoriesUpdatedAt: appState.categoriesUpdatedAt || '',
      activeTimer: appState.activeTimer || null,
      activeTimerUpdatedAt: appState.activeTimerUpdatedAt || '',
      lastGreeting: appState.lastGreeting || '',
      settings: appState.settings || { language: 'en' },
      cloudConsentVersion: consent ? consent.version : '',
      cloudConsentGrantedAt: consent ? consent.consentedAt : '',
      cloudConsentPurposes: consent ? consent.purposes : []
    }));
    ['tasks', 'sessions', 'habits'].forEach(group => {
      (Array.isArray(appState[group]) ? appState[group] : []).forEach(item => {
        if (item && item.id) docs.set(group + '/' + item.id, clean(item));
      });
    });
    Object.keys(appState.habitDays || {}).forEach(date => {
      docs.set('habitDays/' + date, clean(appState.habitDays[date]));
    });
    return docs;
  }
  function refForPath(path) {
    const parts = path.split('/');
    return parts[0] === 'profile' ? refs.profile : refs[parts[0]].doc(parts[1]);
  }
  async function commitOperations(operations) {
    for (let start = 0; start < operations.length; start += 400) {
      const batch = db.batch();
      operations.slice(start, start + 400).forEach(operation => {
        if (operation.remove) batch.delete(refForPath(operation.path));
        else batch.set(refForPath(operation.path), operation.value);
      });
      await batch.commit();
    }
  }
  async function writeState(nextState) {
    if (!readCloudConsent()) throw new Error('Cloud consent is required before syncing.');
    const nextDocs = stateToDocuments(nextState);
    const operations = [];
    nextDocs.forEach((value, path) => {
      if (!knownDocuments.has(path) || stable(knownDocuments.get(path)) !== stable(value)) operations.push({ path, value });
    });
    knownDocuments.forEach((_, path) => {
      if (!nextDocs.has(path)) operations.push({ path, remove: true });
    });
    if (operations.length) await commitOperations(operations);
    knownDocuments = nextDocs;
  }
  function materialize() {
    const profile = cache.profile || {};
    const habitDays = {};
    Object.keys(cache.habitDays).forEach(date => { habitDays[date] = cache.habitDays[date]; });
    return {
      schemaVersion: Number(profile.schemaVersion) || data.SCHEMA_VERSION,
      tasks: Object.keys(cache.tasks).map(id => ({ ...cache.tasks[id], id })),
      sessions: Object.keys(cache.sessions).map(id => ({ ...cache.sessions[id], id })),
      habits: Object.keys(cache.habits).map(id => ({ ...cache.habits[id], id })),
      categories: Array.isArray(profile.categories) ? profile.categories : data.CATEGORIES.slice(),
      categoriesUpdatedAt: profile.categoriesUpdatedAt || '',
      habitDays,
      activeTimer: profile.activeTimer || null,
      activeTimerUpdatedAt: profile.activeTimerUpdatedAt || '',
      lastGreeting: profile.lastGreeting || '',
      settings: profile.settings || { language: 'en' }
    };
  }
  function meaningfulState(value) {
    if (value.tasks.length || value.sessions.length) return true;
    if (Object.values(value.habitDays).some(day => day.completedHabitIds && day.completedHabitIds.length)) return true;
    if (stable(value.categories) !== stable(data.CATEGORIES)) return true;
    const defaults = [['Vocal Practice','Music'],['Reading','Reading'],['Meditation','Meditation'],['Workout','Fitness'],['Songwriting','Music']];
    if (value.habits.length !== defaults.length) return true;
    return value.habits.some(habit => habit.deletedAt || !defaults.some(([name, category]) => habit.name === name && habit.category === category));
  }
  function mergeRows(localRows, remoteRows) {
    const merged = new Map(remoteRows.map(row => [row.id, row]));
    localRows.forEach(local => {
      const remote = merged.get(local.id);
      if (!remote) { merged.set(local.id, local); return; }
      const localTime = Date.parse(local.updatedAt || local.completedAt || local.createdAt || 0) || 0;
      const remoteTime = Date.parse(remote.updatedAt || remote.completedAt || remote.createdAt || 0) || 0;
      if (localTime > remoteTime) merged.set(local.id, local);
    });
    return Array.from(merged.values());
  }
  function mergeStates(local, remote) {
    const days = { ...remote.habitDays };
    Object.keys(local.habitDays).forEach(date => {
      const localDay = local.habitDays[date];
      const remoteDay = days[date];
      if (!remoteDay) { days[date] = localDay; return; }
      const localTime = Date.parse(localDay.updatedAt || (localDay.date + 'T12:00:00.000Z')) || 0;
      const remoteTime = Date.parse(remoteDay.updatedAt || (remoteDay.date + 'T12:00:00.000Z')) || 0;
      if (localTime > remoteTime) days[date] = localDay;
    });
    const localCategoryTime = Date.parse(local.categoriesUpdatedAt || 0) || 0;
    const remoteCategoryTime = Date.parse(remote.categoriesUpdatedAt || 0) || 0;
    const localTimerTime = Date.parse(local.activeTimerUpdatedAt || 0) || 0;
    const remoteTimerTime = Date.parse(remote.activeTimerUpdatedAt || 0) || 0;
    return {
      schemaVersion: Math.max(local.schemaVersion || 0, remote.schemaVersion || 0),
      tasks: mergeRows(local.tasks, remote.tasks),
      sessions: mergeRows(local.sessions, remote.sessions),
      habits: mergeRows(local.habits, remote.habits),
      categories: localCategoryTime > remoteCategoryTime ? local.categories.slice() : remote.categories.slice(),
      categoriesUpdatedAt: localCategoryTime > remoteCategoryTime ? local.categoriesUpdatedAt : remote.categoriesUpdatedAt,
      habitDays: days,
      activeTimer: localTimerTime > remoteTimerTime ? local.activeTimer : remote.activeTimer,
      activeTimerUpdatedAt: localTimerTime > remoteTimerTime ? local.activeTimerUpdatedAt : remote.activeTimerUpdatedAt,
      lastGreeting: remote.lastGreeting || local.lastGreeting || '',
      settings: { ...(local.settings || {}), ...(remote.settings || {}) }
    };
  }
  function storageGet(key) { try { return root.localStorage.getItem(key); } catch (_) { return null; } }
  function storageSet(key, value) { try { root.localStorage.setItem(key, value); } catch (_) {} }
  function storageRemove(key) { try { root.localStorage.removeItem(key); } catch (_) {} }
  async function bootstrap(uid) {
    if (!readCloudConsent() || !currentUser || currentUser.uid !== uid) return;
    setStatus('syncing', 'Preparing this account on this device.');
    let local = pendingState || clone(data.getState());
    pendingState = null;
    const previousOwner = storageGet(ownerKey);
    if (previousOwner && previousOwner !== uid) {
      storageSet(userBackupPrefix + previousOwner, JSON.stringify(local));
      const accountBackup = storageGet(userBackupPrefix + uid);
      local = accountBackup ? JSON.parse(accountBackup) : data.freshStateForCloud();
      data.replaceStateFromCloud(local);
      local = clone(data.getState());
    }
    const remote = materialize();
    const remoteDocs = mapFromCache();
    const hasRemote = remoteDocs.size > 0;
    const merged = !hasRemote ? local : meaningfulState(local) ? mergeStates(local, remote) : remote;
    data.replaceStateFromCloud(merged);
    local = clone(data.getState());
    storageSet(ownerKey, uid);
    knownDocuments = remoteDocs;
    initialized = true;
    syncing = true;
    try {
      await writeState(local);
      setStatus('synced', 'Changes are saved to this Google account.');
    } catch (error) {
      pendingState = local;
      setStatus('offline', 'Saved on this device. Cloud sync will retry when online.');
    } finally {
      syncing = false;
      remotePending = false;
    }
    if (pendingState) flushQueue();
    emit({ dataChanged: true });
  }
  function applyRemoteCache() {
    if (!readCloudConsent() || !initialized || !currentUser) return;
    applyingRemote = true;
    try {
      const remote = materialize();
      knownDocuments = mapFromCache();
      data.replaceStateFromCloud(remote);
      emit({ dataChanged: true });
    } finally { applyingRemote = false; }
  }
  function receive(group, snapshot) {
    if (!readCloudConsent()) return;
    if (group === 'profile') cache.profile = snapshot.exists ? snapshot.data() : null;
    else {
      const next = {};
      snapshot.forEach(document => { next[document.id] = document.data(); });
      cache[group] = next;
    }
    if (!initialized) {
      waitingFor.delete(group);
      if (!waitingFor.size) bootstrap(currentUser.uid).catch(error => setStatus('error', error.message || 'Could not prepare cloud sync.'));
      return;
    }
    if (syncing) { remotePending = true; return; }
    applyRemoteCache();
  }
  function stopSync() {
    stops.forEach(stop => { try { stop(); } catch (_) {} });
    stops = [];
    refs = null;
    initialized = false;
    waitingFor = new Set();
    knownDocuments = new Map();
    pendingState = null;
    syncing = false;
    remotePending = false;
    cache.profile = null;
    ['tasks', 'sessions', 'habits', 'habitDays'].forEach(group => { cache[group] = {}; });
  }
  function beginSync(user) {
    stopSync();
    currentUser = user;
    if (!privacyReady() || !readCloudConsent()) { setStatus('privacy', 'Give consent before cloud sync.'); return; }
    refs = makeRefs(user.uid);
    waitingFor = new Set(groups);
    setStatus('syncing', 'Loading your saved data.');
    stops.push(refs.profile.onSnapshot(snapshot => receive('profile', snapshot), error => setStatus('offline', error.message || 'Cloud sync is unavailable.')));
    ['tasks', 'sessions', 'habits', 'habitDays'].forEach(group => {
      stops.push(refs[group].onSnapshot(snapshot => receive(group, snapshot), error => setStatus('offline', error.message || 'Cloud sync is unavailable.')));
    });
  }
  async function flushQueue() {
    if (syncing || !initialized || !currentUser || !readCloudConsent()) return;
    syncing = true;
    try {
      while (pendingState) {
        const next = pendingState;
        pendingState = null;
        try { await writeState(next); }
        catch (error) {
          pendingState = next;
          setStatus('offline', 'Saved on this device. Cloud sync will retry when online.');
          break;
        }
      }
      if (!pendingState) setStatus('synced', 'Changes are saved to this Google account.');
    } finally {
      syncing = false;
      if (remotePending) { remotePending = false; applyRemoteCache(); }
    }
  }
  function onLocalSave(nextState) {
    if (applyingRemote || !currentUser || !readCloudConsent()) return;
    pendingState = nextState;
    if (initialized) flushQueue();
  }
  function subscribe(callback) {
    callbacks.add(callback);
    callback({ dataChanged: false });
    return () => callbacks.delete(callback);
  }
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = root.document.querySelector('script[data-mate-firebase-src="' + src + '"]');
      if (existing && existing.dataset.loaded === 'true') { resolve(); return; }
      const script = existing || root.document.createElement('script');
      script.async = true;
      script.src = src;
      script.dataset.mateFirebaseSrc = src;
      script.onload = () => { script.dataset.loaded = 'true'; resolve(); };
      script.onerror = () => {
        if (script.parentNode) script.remove();
        reject(new Error('Firebase SDK could not load. Check the internet connection and reload.'));
      };
      if (!existing) root.document.head.appendChild(script);
    });
  }
  function loadFirebaseSdk() {
    if (root.firebase && root.firebase.auth && root.firebase.firestore) return Promise.resolve();
    if (firebaseSdkPromise) return firebaseSdkPromise;
    const base = 'https://www.gstatic.com/firebasejs/12.19.0/';
    firebaseSdkPromise = loadScript(base + 'firebase-app-compat.js')
      .then(() => loadScript(base + 'firebase-auth-compat.js'))
      .then(() => loadScript(base + 'firebase-firestore-compat.js'))
      .then(() => {
        if (!root.firebase || !root.firebase.auth || !root.firebase.firestore) {
          throw new Error('Firebase SDK loaded incompletely. Reload and try again.');
        }
      })
      .catch(error => { firebaseSdkPromise = null; throw error; });
    return firebaseSdkPromise;
  }
  function signInWithGoogle() {
    if (!privacyReady()) return Promise.reject(new Error('Cloud sync is disabled until the privacy notice is completed.'));
    if (!readCloudConsent()) return Promise.reject(new Error('Give consent before signing in.'));
    if (!configReady()) return Promise.reject(new Error('Firebase has not been configured for this app yet.'));
    return initialize().then(() => {
      if (!auth) throw new Error('Firebase sign-in is not available yet.');
      initialSignInError = '';
      const provider = new root.firebase.auth.GoogleAuthProvider();
      // The SDK is loaded on demand, so a popup after the network request may
      // be blocked by browsers. Redirect sign-in works consistently on web and PWA.
      return auth.signInWithRedirect(provider);
    });
  }
  function grantCloudConsent() {
    if (!privacyReady()) return Promise.reject(new Error('The privacy notice is still a draft.'));
    storageSet(privacyConsentKey(), JSON.stringify({
      version: privacyInfo().version,
      consentedAt: new Date().toISOString(),
      purposes: ['account-and-sync']
    }));
    emit({ dataChanged: false });
    return initialize().then(() => {
      if (currentUser) {
        if (!refs) beginSync(currentUser);
        return;
      }
      return signInWithGoogle();
    });
  }
  function exportData() {
    if (!currentUser) throw new Error('Sign in before exporting account data.');
    const payload = {
      exportedAt: new Date().toISOString(),
      account: { email: currentUser.email || '', displayName: currentUser.displayName || '' },
      data: clone(data.getState())
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = root.URL.createObjectURL(blob);
    const link = root.document.createElement('a');
    link.href = url;
    link.download = 'mate-data-' + data.dateKey() + '.json';
    root.document.body.appendChild(link);
    link.click();
    link.remove();
    root.setTimeout(() => root.URL.revokeObjectURL(url), 1000);
  }
  async function deleteAccount() {
    const user = currentUser;
    if (!user || !db) throw new Error('Sign in before deleting the account.');
    const provider = new root.firebase.auth.GoogleAuthProvider();
    await user.reauthenticateWithPopup(provider);
    stopSync();
    const userRefs = makeRefs(user.uid);
    try {
      for (const group of ['tasks', 'sessions', 'habits', 'habitDays']) {
        const snapshot = await userRefs[group].get();
        for (let offset = 0; offset < snapshot.docs.length; offset += 400) {
          const batch = db.batch();
          snapshot.docs.slice(offset, offset + 400).forEach(document => batch.delete(document.ref));
          await batch.commit();
        }
      }
      await userRefs.profile.delete();
      await user.delete();
      storageRemove(ownerKey);
      storageRemove(userBackupPrefix + user.uid);
      storageRemove(privacyConsentKey());
      storageRemove('mate.matt.recent.v1');
      data.replaceStateFromCloud(data.freshStateForCloud());
    } catch (error) {
      if (auth.currentUser && auth.currentUser.uid === user.uid) beginSync(auth.currentUser);
      throw error;
    }
  }
  async function withdrawCloudConsent() {
    const user = currentUser;
    if (!user) {
      if (storageGet(ownerKey)) {
        await initialize();
        if (currentUser) return withdrawCloudConsent();
        if (!privacyReady() || !readCloudConsent()) {
          throw new Error('Reconnect to the previously linked Google account before withdrawing consent and deleting its cloud data.');
        }
        storageSet(pendingCloudDeletionKey, 'true');
        try {
          await signInWithGoogle();
          return { pendingDeletion: true };
        } catch (error) {
          storageRemove(pendingCloudDeletionKey);
          throw error;
        }
      }
      storageRemove(privacyConsentKey());
      stopSync();
      setStatus('local', 'Cloud consent withdrawn. MATE remains local-only.');
      return { pendingDeletion: false };
    }
    if (!db) throw new Error('Cloud services are unavailable. Reconnect before withdrawing consent and deleting cloud data.');
    const localState = clone(data.getState());
    storageRemove(privacyConsentKey());
    stopSync();
    setStatus('privacy', 'Consent withdrawn. Finish deleting your cloud account and data.');
    const userRefs = makeRefs(user.uid);
    try {
      const provider = new root.firebase.auth.GoogleAuthProvider();
      await user.reauthenticateWithPopup(provider);
      for (const group of ['tasks', 'sessions', 'habits', 'habitDays']) {
        const snapshot = await userRefs[group].get();
        for (let offset = 0; offset < snapshot.docs.length; offset += 400) {
          const batch = db.batch();
          snapshot.docs.slice(offset, offset + 400).forEach(document => batch.delete(document.ref));
          await batch.commit();
        }
      }
      await userRefs.profile.delete();
      await user.delete();
      currentUser = null;
      storageRemove(ownerKey);
      storageRemove(userBackupPrefix + user.uid);
      data.replaceStateFromCloud(localState);
      setStatus('local', 'Cloud data deleted. Your local data remains on this device.');
      return { pendingDeletion: false };
    } catch (error) {
      currentUser = auth.currentUser && auth.currentUser.uid === user.uid ? auth.currentUser : null;
      data.replaceStateFromCloud(localState);
      setStatus(currentUser ? 'privacy' : 'local', currentUser ? 'Consent withdrawn. Retry cloud account deletion to finish.' : 'Your local data remains on this device.');
      throw error;
    }
  }
  async function finishPendingCloudDeletion(user) {
    const expectedUid = storageGet(ownerKey);
    if (!expectedUid || expectedUid !== user.uid) {
      storageRemove(pendingCloudDeletionKey);
      currentUser = null;
      await auth.signOut().catch(() => {});
      setStatus('error', 'This is not the Google account previously linked to this browser. Sign in to the correct account to delete its cloud data.');
      return;
    }
    const localState = clone(data.getState());
    storageRemove(pendingCloudDeletionKey);
    storageRemove(privacyConsentKey());
    stopSync();
    currentUser = user;
    setStatus('privacy', 'Deleting the previously linked cloud account and data.');
    const userRefs = makeRefs(user.uid);
    try {
      for (const group of ['tasks', 'sessions', 'habits', 'habitDays']) {
        const snapshot = await userRefs[group].get();
        for (let offset = 0; offset < snapshot.docs.length; offset += 400) {
          const batch = db.batch();
          snapshot.docs.slice(offset, offset + 400).forEach(document => batch.delete(document.ref));
          await batch.commit();
        }
      }
      await userRefs.profile.delete();
      await user.delete();
      currentUser = null;
      storageRemove(ownerKey);
      storageRemove(userBackupPrefix + user.uid);
      data.replaceStateFromCloud(localState);
      setStatus('local', 'Cloud data deleted. Your local data remains on this device.');
    } catch (error) {
      currentUser = auth.currentUser && auth.currentUser.uid === user.uid ? auth.currentUser : null;
      data.replaceStateFromCloud(localState);
      setStatus(currentUser ? 'privacy' : 'local', currentUser ? 'Consent withdrawn. Retry cloud account deletion to finish.' : 'Your local data remains on this device.');
      throw error;
    }
  }
  async function signOut() {
    if (pendingState && initialized) await flushQueue();
    if (!auth) throw new Error('Firebase has not been configured for this app yet.');
    return auth.signOut();
  }
  function initialize() {
    if (!configReady()) { setStatus('setup', 'Firebase configuration is needed before cloud sync can start.'); return Promise.resolve(); }
    if (!storageGet(ownerKey) && (!privacyReady() || !readCloudConsent())) {
      setStatus('local', 'MATE is staying in local-only mode.');
      return Promise.resolve();
    }
    if (auth && db && authStateUnsubscribe) return Promise.resolve();
    if (initializationPromise) return initializationPromise;
    setStatus('checking', 'Preparing cloud account controls.');
    initializationPromise = loadFirebaseSdk().then(async () => {
      const app = root.firebase.apps.length ? root.firebase.app() : root.firebase.initializeApp(config);
      auth = app.auth();
      db = app.firestore();
      await auth.setPersistence(root.firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
      await new Promise((resolve, reject) => {
        let firstState = true;
        authStateUnsubscribe = auth.onAuthStateChanged(user => {
          if (user) {
            stopSync();
            currentUser = user;
            if (storageGet(pendingCloudDeletionKey) === 'true') {
              setStatus('checking', 'Confirming the account for cloud data deletion.');
            } else if (!privacyReady() || !readCloudConsent()) {
              setStatus('privacy', 'Give consent before cloud sync.');
            } else {
              beginSync(user);
            }
          } else {
            stopSync();
            currentUser = null;
            setStatus('local', 'Data is stored on this device until you sign in.');
          }
          if (firstState) { firstState = false; resolve(); }
        }, error => {
          setStatus('error', error.message || 'Could not check your Google account.');
          if (firstState) { firstState = false; reject(error); }
        });
      });
      const pendingDeletion = storageGet(pendingCloudDeletionKey) === 'true';
      try {
        const redirectResult = await auth.getRedirectResult();
        if (pendingDeletion && redirectResult && redirectResult.user) await finishPendingCloudDeletion(redirectResult.user);
        else if (pendingDeletion) storageRemove(pendingCloudDeletionKey);
      } catch (error) {
        if (pendingDeletion) storageRemove(pendingCloudDeletionKey);
        initialSignInError = error.message || 'Could not complete Google sign-in.';
        setStatus('error', initialSignInError);
      }
    }).catch(error => {
      setStatus('error', error.message || 'Could not initialize Firebase.');
      if (!authStateUnsubscribe) { auth = null; db = null; }
      throw error;
    }).finally(() => { initializationPromise = null; });
    return initializationPromise;
  }
  root.addEventListener('online', () => {
    if (currentUser && initialized) { pendingState = clone(data.getState()); flushQueue(); }
  });
  MATE.cloudSync = { state, subscribe, signInWithGoogle, grantCloudConsent, withdrawCloudConsent, exportData, deleteAccount, signOut, onLocalSave, initialize };
  // Firebase's SDK contacts Google's CDN. Load it only for a previously linked
  // account or after the user has accepted cloud-sync consent.
  if (storageGet(ownerKey) || (privacyReady() && readCloudConsent())) initialize().catch(() => {});
})(window);
