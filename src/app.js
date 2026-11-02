(function (root) {
  'use strict';
  const MATE = root.MATE;
  const data = MATE.data;
  const screens = MATE.screens;
  const analytics = MATE.analytics;
  const matt = MATE.matt;
  const appState = { page: 'welcome', taskFilter: 'open', statsPeriod: 'weekly', welcomeGreeting: '', homeGreeting: '', habitWeekOffset: 0, selectedHabitDate: '' };
  let taskSubmitting = false;
  let pendingDeleteHabit = null;
  let installPrompt = null;
  let observedHabitDate = data.habitDateKey();

  function toast(message, kind = 'success') {
    const region = document.getElementById('toast-region');
    const node = document.createElement('div'); node.className = `toast ${kind}`; node.textContent = message;
    region.appendChild(node); root.setTimeout(() => node.remove(), 3600);
  }
  function render() { screens.render(appState.page, appState); screens.updateCloudAccount(); }
  function navigate(page) {
    if (page === 'home') appState.homeGreeting = matt.homeGreeting();
    let habitChoice = null;
    if (page === 'habits') {
      appState.habitWeekOffset = 0;
      appState.selectedHabitDate = data.habitDateKey();
      habitChoice = data.prepareHabitDay();
    }
    appState.page = page; render();
    if (habitChoice) openModal(screens.habitDayChoice(habitChoice));
    if (page === 'task-form') root.setTimeout(() => document.getElementById('task-name')?.focus(), 0);
  }
  function openModal(markup) {
    document.getElementById('modal-root').innerHTML = markup;
    root.setTimeout(() => document.querySelector('#modal-root input:not([type="hidden"]), #modal-root button')?.focus(), 0);
  }
  function closeModal() { document.getElementById('modal-root').innerHTML = ''; pendingDeleteHabit = null; }
  function showTimerResolution() {
    const timer = data.getState().activeTimer; if (!timer) return;
    const task = data.findTask(timer.taskId);
    const end = timer.stoppedAt || new Date().toISOString();
    const elapsed = Math.max(0, new Date(end).getTime() - new Date(timer.startedAt).getTime());
    openModal(screens.timerResolution(task, elapsed, !!timer.nextTaskId));
  }
  function startTimer(taskId) {
    const state = data.getState(); const active = state.activeTimer;
    if (!active) { data.setActiveTimer(taskId); render(); toast(matt.message('timerStarted', { task: (data.findTask(taskId) || {}).name || '' })); return; }
    if (active.stoppedAt) {
      if (active.taskId !== taskId) data.queueNextTimer(taskId);
      showTimerResolution(); return;
    }
    if (active.taskId === taskId) {
      data.stopTimer(); showTimerResolution(); render(); return;
    }
    const target = data.findTask(taskId);
    if (!target) return;
    openModal(screens.switchTimer(target));
  }
  function resolveTimer(markDone) {
    const resolved = data.resolveTimer(markDone);
    closeModal();
    let congratulations = '';
    if (resolved && resolved.task) {
      if (resolved.nextTaskId && data.findTask(resolved.nextTaskId)) data.setActiveTimer(resolved.nextTaskId);
      if (markDone) {
        appState.homeGreeting = matt.homeGreeting();
        congratulations = matt.message('taskCongratulations', { task: resolved.task.name });
      } else toast(matt.message('timerSaved', { task: resolved.task.name }));
    }
    render();
    if (congratulations) openModal(screens.mattCongratulations(congratulations));
  }
  function exportPdf() {
    if (typeof root.print !== 'function') {
      toast('PDF export is not supported by this browser.', 'error');
      return;
    }
    const summary = analytics.summarize(appState.statsPeriod);
    const originalTitle = document.title;
    document.title = 'MATE-stats-' + appState.statsPeriod + '-' + summary.range.start + '-to-' + summary.range.end;
    const restoreTitle = function () {
      document.title = originalTitle;
      root.removeEventListener('afterprint', restoreTitle);
    };
    root.addEventListener('afterprint', restoreTitle, { once: true });
    try {
      root.print();
    } catch (error) {
      restoreTitle();
      toast('Could not open the PDF print dialog.', 'error');
    }
  }
  async function installApp() {
    if (!installPrompt) { toast(matt.message('installInstructions')); return; }
    const prompt = installPrompt;
    installPrompt = null;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      appState.installAvailable = false;
      render();
      toast(matt.message(choice && choice.outcome === 'accepted' ? 'installAccepted' : 'installDeclined'));
    } catch (error) {
      appState.installAvailable = false;
      render();
      toast(matt.message('installFallback'));
    }
  }
  function saveHabitCategoryForm(form) {
    if (!form) return;
    const fields = new FormData(form);
    const error = document.getElementById('habit-category-error');
    const originalName = String(fields.get('originalName') || '');
    try {
      const name = originalName ? data.editCategory(originalName, fields.get('name')) : data.addCategory(fields.get('name'));
      closeModal();
      appState.page = 'habit-categories';
      render();
      toast(matt.message(originalName ? 'categoryUpdated' : 'categoryAdded', { name: name }));
    } catch (err) {
      if (error) error.textContent = err.message;
      document.getElementById('habit-category-name')?.focus();
    }
  }
  function saveHabitForm(form) {
    if (!form) return;
    const fields = new FormData(form);
    const error = document.getElementById('habit-form-error');
    const id = String(fields.get('id') || '');
    try {
      if (id) data.editHabit(id, fields.get('name'), fields.get('category'), fields.get('newCategory'));
      else data.addHabit(fields.get('name'), fields.get('category'), fields.get('newCategory'));
      if (!id) {
        appState.page = 'habits';
        appState.habitWeekOffset = 0;
        appState.selectedHabitDate = data.habitDateKey();
      }
      closeModal();
      render();
      toast(matt.message(id ? 'habitUpdated' : 'habitAdded'));
    } catch (err) {
      if (error) error.textContent = err.message;
      document.getElementById('habit-name')?.focus();
    }
  }

  function updateMattSettingsView(preferences, statusText) {
    ['humor','firmness'].forEach(key => {
      const input = document.getElementById('matt-' + key);
      const output = document.getElementById('matt-' + key + '-value');
      if (input) input.value = preferences[key];
      if (output) output.textContent = preferences[key] + '%';
    });
    const preview = document.getElementById('matt-tone-preview');
    const status = document.getElementById('matt-tone-status');
    if (preview) preview.textContent = matt.preview(preferences);
    if (status && statusText) status.textContent = statusText;
  }

  document.addEventListener('input', event => {
    const target = event.target;
    const key = target && target.dataset && target.dataset.mattPreference;
    if (key !== 'humor' && key !== 'firmness') return;
    const preferences = matt.getPreferences();
    preferences[key] = Number(target.value);
    updateMattSettingsView(preferences, 'Release the slider to save this setting.');
  });
  document.addEventListener('click', event => {
    const target = event.target.closest('button,[data-nav],[data-action]'); if (!target) return;
    if (target.dataset.nav) { navigate(target.dataset.nav); return; }
    const action = target.dataset.action;
    if (!action) return;
    switch (action) {
      case 'welcome': event.preventDefault(); appState.welcomeGreeting = matt.welcomeGreeting(); appState.page = 'welcome'; render(); break;
      case 'enter-home': navigate('home'); break;
      case 'add-task': appState.page = 'task-form'; render(); root.setTimeout(()=>document.getElementById('task-name')?.focus(),0); break;
      case 'add-another': closeModal(); appState.page = 'task-form'; render(); root.setTimeout(()=>document.getElementById('task-name')?.focus(),0); break;
      case 'confirmation-done': appState.taskFilter = 'open'; navigate('tasks'); break;
      case 'toggle-task': {
        const id = target.dataset.id; const task = data.findTask(id); if (!task) break;
        let congratulations = '';
        if (task.status === 'done') { data.reopenTask(id); toast(matt.message('taskReopened', { task: task.name })); }
        else if (data.getState().activeTimer?.taskId === id) { data.stopTimer(); showTimerResolution(); }
        else {
          data.completeTask(id);
          appState.homeGreeting = matt.homeGreeting();
          congratulations = matt.message('taskCongratulations', { task: task.name });
        }
        render();
        if (congratulations) openModal(screens.mattCongratulations(congratulations));
        break;
      }
      case 'start-timer': startTimer(target.dataset.id); break;
      case 'stop-timer': data.stopTimer(); showTimerResolution(); render(); break;
      case 'resolve-pending': showTimerResolution(); break;
      case 'switch-timer': {
        const taskId = target.dataset.id; const active = data.getState().activeTimer;
        if (!active || active.stoppedAt) break;
        data.stopTimer(taskId); showTimerResolution(); render(); break;
      }
      case 'resolve-timer': resolveTimer(target.dataset.done === 'true'); break;
      case 'task-filter': appState.taskFilter = target.dataset.taskFilter; render(); break;
      case 'copy-habit-day': {
        const copied = data.copyHabitDay(target.dataset.date, data.habitDateKey());
        closeModal();
        appState.page = 'habits';
        appState.habitWeekOffset = 0;
        appState.selectedHabitDate = data.habitDateKey();
        render();
        toast(matt.message(copied ? 'habitCopied' : 'habitCopyAlreadySet'), copied ? 'success' : 'error');
        break;
      }
      case 'decline-habit-copy':
        data.declineHabitDay(data.habitDateKey());
        closeModal();
        appState.page = 'habits';
        appState.habitWeekOffset = 0;
        appState.selectedHabitDate = data.habitDateKey();
        render();
        toast(matt.message('habitFresh'));
        break;
      case 'manage-habit-categories': appState.page = 'habit-categories'; render(); break;
      case 'add-habit-category': openModal(screens.habitCategoryForm(null)); break;
      case 'edit-habit-category': openModal(screens.habitCategoryForm(target.dataset.category)); break;
      case 'delete-habit-category': openModal(screens.confirmDeleteHabitCategory(target.dataset.category)); break;
      case 'confirm-delete-habit-category': {
        try {
          const fallback = data.deleteCategory(target.dataset.category);
          closeModal();
          appState.page = 'habit-categories';
          render();
          toast(matt.message('categoryRemoved', { fallback: fallback }));
        } catch (err) { toast(err.message, 'error'); }
        break;
      }
      case 'save-habit-category': event.preventDefault(); saveHabitCategoryForm(document.getElementById('habit-category-form')); break;
      case 'new-habit': openModal(screens.habitForm(null)); break;
      case 'edit-habit': {
        const habit = data.getState().habits.find(h=>h.id===target.dataset.id&&!h.deletedAt);
        if (habit) openModal(screens.habitForm(habit)); break;
      }
      case 'delete-habit': {
        const habit = data.getState().habits.find(h=>h.id===target.dataset.id&&!h.deletedAt);
        if (habit) { pendingDeleteHabit = habit.id; openModal(screens.confirmDeleteHabit(habit)); } break;
      }
      case 'confirm-delete-habit': {
        const id = pendingDeleteHabit || target.dataset.id; const habit = data.getState().habits.find(h=>h.id===id);
        data.deleteHabit(id); closeModal(); render();
        if (habit) toast(matt.message('habitRemoved', { habit: habit.name }));
        break;
      }
      case 'toggle-habit': {
        const id = target.dataset.id;
        const date = target.dataset.date || data.habitDateKey();
        const day = data.getDay(date);
        const wasChecked = day.completedHabitIds.includes(id);
        const habit = day.habits.find(item => item.id === id);
        data.toggleHabit(id, date);
        render();
        if (wasChecked) toast(matt.message('habitUnchecked', { habit: habit ? habit.name : '' }));
        else openModal(screens.mattCongratulations(matt.message('habitCongratulations', { habit: habit ? habit.name : '' })));
        break;
      }
      case 'select-habit-date':
        if (target.dataset.date && target.dataset.date <= data.habitDateKey()) { appState.selectedHabitDate = target.dataset.date; render(); }
        break;
      case 'previous-habit-week':
        appState.habitWeekOffset = Math.min(0, Number(appState.habitWeekOffset) || 0) - 1;
        appState.selectedHabitDate = data.dateKey(analytics.shiftDay(analytics.startOfWeek(data.dayDate(data.habitDateKey())), appState.habitWeekOffset * 7));
        render(); break;
      case 'next-habit-week':
        if ((Number(appState.habitWeekOffset) || 0) < 0) {
          appState.habitWeekOffset += 1;
          appState.selectedHabitDate = appState.habitWeekOffset === 0
            ? data.habitDateKey()
            : data.dateKey(analytics.shiftDay(analytics.startOfWeek(data.dayDate(data.habitDateKey())), appState.habitWeekOffset * 7));
          render();
        }
        break;
      case 'dismiss-matt-congrats': closeModal(); break;
      case 'reset-matt-settings': { const preferences = matt.resetPreferences(); updateMattSettingsView(preferences, "Reset to Matt's defaults."); break; }
      case 'close-modal': closeModal(); break;
      case 'modal-backdrop': if (event.target === target) closeModal(); break;
      case 'cloud-sign-in': {
        const cloud = MATE.cloudSync.state();
        if (cloud.privacyReady && !cloud.cloudConsentGranted) openModal(screens.privacyAcknowledgement());
        else MATE.cloudSync.signInWithGoogle().catch(error => toast(error.message || 'Google sign-in failed.', 'error'));
        break;
      }
      case 'cloud-diagnostics':
        openModal(screens.cloudDiagnostics());
        break;
      case 'run-cloud-diagnostics': {
        target.disabled = true;
        MATE.cloudSync.runDiagnostics().then(() => {
          document.getElementById('modal-root').innerHTML = screens.cloudDiagnostics();
        }).catch(error => {
          toast(error.message || 'Could not run sync diagnostics.', 'error');
          target.disabled = false;
        });
        break;
      }
      case 'copy-cloud-diagnostics': {
        const report = MATE.cloudSync.diagnosticReport();
        const copy = root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText
          ? root.navigator.clipboard.writeText(report)
          : Promise.reject(new Error('Clipboard access is unavailable.'));
        copy.then(() => toast('Diagnostic report copied.'))
          .catch(() => {
            const field = document.getElementById('sync-diagnostic-report');
            if (field) { field.focus(); field.select(); }
            toast('Report selected. Copy it with Ctrl+C.', 'error');
          });
        break;
      }
      case 'review-privacy': openModal(screens.privacyAcknowledgement()); break;
      case 'export-local-data':
        try { data.downloadLocalData(); toast('Your local MATE data copy is ready.'); }
        catch (error) { toast(error.message || 'Could not export your local data.', 'error'); }
        break;
      case 'delete-local-data': openModal(screens.deleteLocalDataConfirmation()); break;
      case 'confirm-delete-local-data': {
        const cloud = MATE.cloudSync ? MATE.cloudSync.state() : { user: null, cloudConsentGranted: false };
        if (cloud.user || cloud.cloudConsentGranted) {
          closeModal();
          toast('Withdraw cloud consent or delete the cloud account before clearing this browser copy.', 'error');
          break;
        }
        target.disabled = true;
        try {
          data.clearLocalData();
          root.location.reload();
        } catch (error) {
          target.disabled = false;
          toast(error.message || 'Could not delete the local data.', 'error');
        }
        break;
      }
      case 'grant-cloud-consent': {
        if (!document.getElementById('privacy-consent-checkbox')?.checked) break;
        target.disabled = true;
        MATE.cloudSync.grantCloudConsent().then(() => {
          closeModal();
          render();
          if (!MATE.cloudSync.state().user) toast('Consent saved. Choose Sign in with Google in the header to connect your account.');
        }).catch(error => {
          target.disabled = false;
          toast(error.message || 'Could not continue.', 'error');
        });
        break;
      }
      case 'cloud-export-data':
        try { MATE.cloudSync.exportData(); toast('Your MATE data export is ready.'); }
        catch (error) { toast(error.message || 'Could not export your data.', 'error'); }
        break;
      case 'withdraw-cloud-consent': openModal(screens.withdrawCloudConsentConfirmation()); break;
      case 'confirm-withdraw-cloud-consent':
        target.disabled = true;
        MATE.cloudSync.withdrawCloudConsent().then(result => {
          closeModal();
          render();
          toast(result && result.pendingDeletion
            ? 'Reconnect to the previously linked Google account to finish deleting cloud data. Local data stays here.'
            : 'Cloud consent withdrawn. Local MATE data remains on this device.');
        }).catch(error => {
          target.disabled = false;
          toast(error.message || 'Could not complete cloud data deletion.', 'error');
        });
        break;
      case 'delete-cloud-account': openModal(screens.deleteCloudAccountConfirmation()); break;
      case 'confirm-delete-cloud-account':
        target.disabled = true;
        MATE.cloudSync.deleteAccount().then(() => {
          closeModal();
          appState.page = 'welcome';
          render();
          toast("Your cloud account and this browser's MATE data were deleted.");
        }).catch(error => {
          target.disabled = false;
          toast(error.message || 'Could not delete the account.', 'error');
        });
        break;
      case 'cloud-sign-out':
        MATE.cloudSync.signOut().catch(error => toast(error.message || 'Could not sign out.', 'error'));
        break;
      case 'export-pdf': exportPdf(); break;
      case 'save-habit': event.preventDefault(); saveHabitForm(document.getElementById('habit-form')); break;
      case 'install-app': installApp(); break;
    }
  });

  document.addEventListener('submit', event => {
    const form = event.target;
    if (form.id === 'task-form') {
      event.preventDefault(); if (taskSubmitting) return;
      const fields = new FormData(form); const name = String(fields.get('name') || '').trim();
      const input = document.getElementById('task-name'); const error = document.getElementById('task-name-error');
      if (!name) { error.textContent = 'Give the task a name before saving.'; input?.focus(); return; }
      taskSubmitting = true; const button = document.getElementById('save-task'); if (button) button.disabled = true;
      try {
        data.addTask({ name, category: fields.get('category'), priority: fields.get('priority'), dueDate: fields.get('dueDate'), project: fields.get('project'), notes: fields.get('notes') });
        taskSubmitting = false; appState.page = 'task-confirmation'; render();
        toast(matt.message('taskAdded'));
      } catch (err) {
        taskSubmitting = false; if (button) button.disabled = false; error.textContent = err.message; input?.focus();
      }
    } else if (form.id === 'habit-form') {
      event.preventDefault(); saveHabitForm(form);
    } else if (form.id === 'habit-category-form') {
      event.preventDefault(); saveHabitCategoryForm(form);
    }
  });

  document.addEventListener('change', event => {
    if (event.target.id === 'privacy-consent-checkbox') {
      const button = document.getElementById('privacy-continue');
      if (button) button.disabled = !event.target.checked;
    }
    if (event.target.id === 'habit-category') {
      const field = document.getElementById('habit-new-category-field');
      const input = document.getElementById('habit-new-category');
      const creatingCategory = event.target.value === data.NEW_CATEGORY_VALUE;
      if (field) field.hidden = !creatingCategory;
      if (input) {
        input.required = creatingCategory;
        if (creatingCategory) input.focus();
        else input.value = '';
      }
    }
    const toneKey = event.target && event.target.dataset && event.target.dataset.mattPreference;
    if (toneKey === 'humor' || toneKey === 'firmness') {
      const preferences = matt.setPreferences({ [toneKey]: Number(event.target.value) });
      updateMattSettingsView(preferences, 'Saved on this device.');
    }
    if (event.target.name === 'statsPeriod') {
      appState.statsPeriod = event.target.value;
      render();
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.getElementById('modal-root').innerHTML) closeModal();
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); appState.page = 'task-form'; render(); root.setTimeout(()=>document.getElementById('task-name')?.focus(),0); }
  });

  function updateClock() {
    const currentHabitDate = data.habitDateKey();
    if (currentHabitDate !== observedHabitDate) {
      observedHabitDate = currentHabitDate;
      if (appState.page === 'habits') {
        appState.habitWeekOffset = 0;
        appState.selectedHabitDate = currentHabitDate;
        const habitChoice = data.prepareHabitDay();
        render();
        if (habitChoice && !document.getElementById('modal-root').innerHTML) openModal(screens.habitDayChoice(habitChoice));
      }
    }
    const timer = data.getState().activeTimer; if (!timer || timer.stoppedAt) return;
    const ms = Math.max(0, Date.now() - new Date(timer.startedAt).getTime());
    const total = Math.floor(ms/1000); const clock = [Math.floor(total/3600),Math.floor(total%3600/60),total%60].map(n=>String(n).padStart(2,'0')).join(':');
    document.querySelectorAll('[data-timer-elapsed]').forEach(node=>{ if (node.dataset.timerElapsed === timer.taskId) node.textContent=clock; });
    if (appState.page === 'home') {
      const focusCard = document.querySelector('.stat-card:nth-child(3) .stat-number');
      if (focusCard) {
        const today = analytics.dashboard(); focusCard.textContent = screens.helpers.fmtDuration(today.focusMs);
      }
    }
  }

  appState.welcomeGreeting = matt.welcomeGreeting();
  appState.selectedHabitDate = data.habitDateKey();
  render();
  if (MATE.cloudSync) MATE.cloudSync.subscribe(detail => {
    screens.updateCloudAccount();
    if (detail && detail.dataChanged) render();
  });
  if (data.getState().activeTimer?.stoppedAt) showTimerResolution();
  root.setInterval(updateClock, 1000);

  if (root.addEventListener) {
    root.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      installPrompt = event;
      appState.installAvailable = true;
      render();
    });
    root.addEventListener('appinstalled', () => {
      installPrompt = null;
      appState.installAvailable = false;
      render();
      toast(matt.message('installAccepted'));
    });
  }
  if (root.navigator && root.navigator.serviceWorker && root.location && root.location.protocol !== 'file:') {
    root.navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
  }
})(window);
