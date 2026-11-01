/* MATE's single local-first source of truth. Keep migrations additive. */
(function (root) {
  'use strict';
  const MATE = root.MATE = root.MATE || {};
  const STORAGE_KEY = 'mate.accountability.data';
  const SCHEMA_VERSION = 2;
  const CATEGORIES = ['Music', 'Business', 'Reading', 'Fitness', 'Meditation', 'Personal'];
  const NEW_CATEGORY_VALUE = '__new_category__';
  const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

  function dateKey(value) {
    let d;
    if (value instanceof Date) d = value;
    else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-').map(Number); d = new Date(year, month - 1, day, 12, 0, 0, 0);
    } else d = new Date(value || Date.now());
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  }
  function habitDateKey(value) {
    const dateOnly = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
    const d = value instanceof Date ? new Date(value.getTime()) : dateOnly ? dayDate(value) : new Date(value || Date.now());
    if (!dateOnly && d.getHours() < 4) d.setDate(d.getDate() - 1);
    return dateKey(d);
  }
  function dayDate(key) {
    const [y, m, d] = String(key).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
  }
  function uid() {
    return root.crypto && typeof root.crypto.randomUUID === 'function'
      ? root.crypto.randomUUID()
      : 'mate-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 11);
  }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function makeHabit(name, category) {
    const now = new Date().toISOString();
    return { id: uid(), name, category, createdAt: now, deletedAt: null, updatedAt: now };
  }
  function seedState() {
    const habits = [
      makeHabit('Vocal Practice', 'Music'), makeHabit('Reading', 'Reading'),
      makeHabit('Meditation', 'Meditation'), makeHabit('Workout', 'Fitness'),
      makeHabit('Songwriting', 'Music')
    ];
    const state = { schemaVersion: SCHEMA_VERSION, tasks: [], sessions: [], habits, categories: CATEGORIES.slice(), categoriesUpdatedAt: new Date().toISOString(), habitDays: {}, activeTimer: null, activeTimerUpdatedAt: new Date().toISOString(), lastGreeting: '', settings: { language: 'en' } };
    const today = habitDateKey();
    state.habitDays[today] = { date: today, updatedAt: new Date().toISOString(), habits: habits.map(snapshotHabit), completedHabitIds: [] };
    return state;
  }
  function snapshotHabit(habit) { return { id: habit.id, name: habit.name, category: habit.category }; }
  function normalizeHabit(habit, categories = CATEGORIES) {
    if (!habit || typeof habit !== 'object' || typeof habit.id !== 'string') return null;
    const now = new Date().toISOString();
    const fallbackCategory = categories.includes('Personal') ? 'Personal' : categories[0];
    return { ...habit, name: typeof habit.name === 'string' ? habit.name : 'Untitled habit', category: categories.includes(habit.category) ? habit.category : fallbackCategory, createdAt: habit.createdAt || now, deletedAt: habit.deletedAt || null };
  }
  function migrateState(parsed) {
    const source = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? { ...parsed } : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Stored MATE data must be an object.');
    const version = Number.isInteger(source.schemaVersion) ? source.schemaVersion : 0;
    if (version > SCHEMA_VERSION) {
      readOnlyNewerSchema = true;
      persistence = 'read-only';
      persistenceMessage = `This browser has MATE data from a newer schema (v${version}). The app is showing a compatible view; avoid saving changes until the app is updated.`;
    }
    let migrated = source;
    // v0 was the unversioned prototype shape. Its task/session/habit arrays are preserved;
    // normalizeState below supplies missing fields and converts legacy status/snapshot values.
    if (version < 1) migrated = { ...migrated, schemaVersion: 1 };
    if (version < 2) migrated = { ...migrated, schemaVersion: 2, categories: Array.isArray(migrated.categories) ? migrated.categories : CATEGORIES.slice() };
    return normalizeState(migrated);
  }
  function normalizeState(parsed) {
    // Keep unknown fields intact so a future migration never drops unrelated user data.
    const state = { ...parsed };
    state.schemaVersion = Math.max(SCHEMA_VERSION, Number(parsed.schemaVersion) || 0);
    const storedCategories = Array.isArray(parsed.categories) ? parsed.categories : CATEGORIES;
    state.categories = [];
    state.categoriesUpdatedAt = parsed.categoriesUpdatedAt || new Date().toISOString();
    state.activeTimerUpdatedAt = parsed.activeTimerUpdatedAt || new Date().toISOString();
    for (const rawCategory of storedCategories) {
      const category = String(rawCategory || '').trim().slice(0, 40);
      if (category && !state.categories.some(existing => existing.toLocaleLowerCase() === category.toLocaleLowerCase())) state.categories.push(category);
    }
    if (!state.categories.length) state.categories = CATEGORIES.slice();
    state.tasks = Array.isArray(parsed.tasks) ? parsed.tasks.filter(t => t && typeof t.id === 'string').map(t => ({
      ...t,
      name: typeof t.name === 'string' ? t.name : 'Untitled task',
      category: typeof t.category === 'string' && t.category.trim() ? t.category : (state.categories.includes('Personal') ? 'Personal' : state.categories[0]),
      priority: PRIORITIES.includes(t.priority) ? t.priority : 'Medium',
      status: t.status === 'done' || t.status === 'completed' ? 'done' : 'open',
      createdAt: t.createdAt || new Date().toISOString(),
      updatedAt: t.updatedAt || t.completedAt || t.createdAt || new Date().toISOString(),
      totalFocusTime: Number.isFinite(t.totalFocusTime) ? Math.max(0, t.totalFocusTime) : 0
    })) : [];
    state.sessions = Array.isArray(parsed.sessions) ? parsed.sessions.filter(s => s && typeof s.id === 'string' && typeof s.taskId === 'string').map(s => ({
      ...s, duration: Number.isFinite(s.duration) ? Math.max(0, s.duration) : 0,
      date: s.date || dateKey(s.startedAt || s.endedAt)
    })) : [];
    state.habits = Array.isArray(parsed.habits) ? parsed.habits.map(habit => normalizeHabit(habit, state.categories)).filter(Boolean) : [];
    state.habitDays = parsed.habitDays && typeof parsed.habitDays === 'object' && !Array.isArray(parsed.habitDays) ? parsed.habitDays : {};
    for (const [key, oldDay] of Object.entries(state.habitDays)) {
      if (!oldDay || typeof oldDay !== 'object') { delete state.habitDays[key]; continue; }
      const oldHabits = Array.isArray(oldDay.habits) ? oldDay.habits : Array.isArray(oldDay.habitIds) ? oldDay.habitIds : [];
      state.habitDays[key] = {
        date: oldDay.date || key,
        updatedAt: oldDay.updatedAt || new Date((oldDay.date || key) + 'T12:00:00.000Z').toISOString(),
        habits: oldHabits.map(item => typeof item === 'string' ? state.habits.find(h => h.id === item) : item).filter(Boolean).map(h => ({ id: h.id, name: String(h.name || 'Habit'), category: String(h.category || (state.categories.includes('Personal') ? 'Personal' : state.categories[0])) })),
        completedHabitIds: Array.isArray(oldDay.completedHabitIds) ? oldDay.completedHabitIds.filter(id => typeof id === 'string') : []
      };
    }
    const timer = parsed.activeTimer;
    state.activeTimer = timer && typeof timer.taskId === 'string' && timer.startedAt ? { ...timer } : null;
    const settings = parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {};
    state.settings = { ...settings, language: typeof settings.language === 'string' ? settings.language : 'en' };
    state.lastGreeting = typeof parsed.lastGreeting === 'string' ? parsed.lastGreeting : '';
    return state;
  }

  let state;
  let lastWelcomeQuote = '';
  let persistence = 'local';
  let persistenceMessage = '';
  let readOnlyNewerSchema = false;
  let loadedStoredState = false;
  try {
    const raw = root.localStorage.getItem(STORAGE_KEY);
    if (!raw) state = seedState();
    else {
      try { state = migrateState(JSON.parse(raw)); loadedStoredState = true; }
      catch (error) {
        // Preserve malformed input before starting a clean store; never overwrite the only copy.
        try { root.localStorage.setItem(STORAGE_KEY + '.recovery.' + Date.now(), raw); } catch (_) {}
        state = seedState();
        persistenceMessage = 'Stored data was malformed. A recovery copy was kept in this browser.';
      }
    }
  } catch (error) {
    state = seedState();
    persistence = 'memory';
    persistenceMessage = 'Browser storage is unavailable; changes will last only until this tab closes.';
  }

  function save() {
    if (readOnlyNewerSchema) { persistence = 'read-only'; return false; }
    let savedLocally = false;
    try {
      root.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      persistence = 'local';
      savedLocally = true;
    } catch (error) {
      persistence = 'memory';
      persistenceMessage = 'Browser storage is unavailable or full; changes are currently held in memory.';
    }
    if (MATE.cloudSync && typeof MATE.cloudSync.onLocalSave === 'function') {
      try { MATE.cloudSync.onLocalSave(clone(state)); } catch (_) {}
    }
    return savedLocally;
  }
  function activeHabitsForDate(key) {
    return state.habits.filter(h => habitDateKey(h.createdAt) <= key && (!h.deletedAt || habitDateKey(h.deletedAt) > key)).map(snapshotHabit);
  }
  function ensureDay(key = habitDateKey()) {
    if (!state.habitDays[key]) {
      const habits = key === habitDateKey() ? [] : activeHabitsForDate(key);
      state.habitDays[key] = { date: key, updatedAt: new Date().toISOString(), habits, completedHabitIds: [] };
    }
    return state.habitDays[key];
  }
  function getDay(key) {
    // A pending current-day choice stays empty until the user copies or declines.
    return state.habitDays[key] || { date: key, habits: key === habitDateKey() ? [] : activeHabitsForDate(key), completedHabitIds: [] };
  }
  function prepareHabitDay(key = habitDateKey()) {
    if (state.habitDays[key]) return null;
    const previousDate = Object.keys(state.habitDays).filter(date => date < key).sort().pop();
    const previous = previousDate && state.habitDays[previousDate];
    if (previous && previous.habits.length) return { previousDate, habitCount: previous.habits.length };
    state.habitDays[key] = { date: key, updatedAt: new Date().toISOString(), habits: [], completedHabitIds: [] };
    save();
    return null;
  }
  function copyHabitDay(sourceKey, targetKey = habitDateKey()) {
    if (state.habitDays[targetKey]) return false;
    const source = state.habitDays[sourceKey];
    if (!source || !source.habits.length) return false;
    const habits = source.habits.map(snapshot => {
      const existing = state.habits.find(h => h.id === snapshot.id && !h.deletedAt);
      if (existing) return snapshotHabit(existing);
      const restored = makeHabit(snapshot.name, snapshot.category);
      state.habits.push(restored);
      return snapshotHabit(restored);
    });
    state.habitDays[targetKey] = { date: targetKey, updatedAt: new Date().toISOString(), habits, completedHabitIds: [] };
    save();
    return true;
  }
  function declineHabitDay(key = habitDateKey()) {
    if (state.habitDays[key]) return false;
    state.habitDays[key] = { date: key, updatedAt: new Date().toISOString(), habits: [], completedHabitIds: [] };
    save();
    return true;
  }
  function getState() { return state; }
  function freshStateForCloud() { return clone(seedState()); }
  function hasMeaningfulData() {
    if (state.tasks.length || state.sessions.length) return true;
    if (Object.values(state.habitDays).some(day => day.completedHabitIds.length)) return true;
    if (JSON.stringify(state.categories) !== JSON.stringify(CATEGORIES)) return true;
    const defaults = [['Vocal Practice','Music'],['Reading','Reading'],['Meditation','Meditation'],['Workout','Fitness'],['Songwriting','Music']];
    if (state.habits.length !== defaults.length) return true;
    return state.habits.some(habit => habit.deletedAt || !defaults.some(([name, category]) => habit.name === name && habit.category === category));
  }
  function replaceStateFromCloud(next) {
    const normalized = migrateState(next);
    state = normalized;
    try {
      root.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      persistence = 'local';
      persistenceMessage = '';
    } catch (_) {
      persistence = 'memory';
      persistenceMessage = 'Browser storage is unavailable or full; changes are currently held in memory.';
    }
    return clone(state);
  }
  function getCategories() { return state.categories.slice(); }
  function cleanCategoryName(value) {
    const clean = String(value || '').trim();
    if (!clean) throw new Error('Give the category a name.');
    if (clean.length > 40) throw new Error('Category names can be up to 40 characters.');
    if (clean === NEW_CATEGORY_VALUE) throw new Error('Choose a different category name.');
    return clean;
  }
  function resolveCategory(category, newCategoryName) {
    if (category !== NEW_CATEGORY_VALUE) {
      if (!state.categories.includes(category)) throw new Error('Choose a category for this item.');
      return { value: category, isNew: false };
    }
    const clean = cleanCategoryName(newCategoryName);
    const existing = state.categories.find(item => item.toLocaleLowerCase() === clean.toLocaleLowerCase());
    return { value: existing || clean, isNew: !existing };
  }
  function saveCategoryChoice(choice) {
    if (choice.isNew) { state.categories.push(choice.value); state.categoriesUpdatedAt = new Date().toISOString(); }
    return choice.value;
  }
  function addCategory(name) {
    const clean = cleanCategoryName(name);
    if (state.categories.some(item => item.toLocaleLowerCase() === clean.toLocaleLowerCase())) throw new Error('That category already exists.');
    state.categories.push(clean);
    state.categoriesUpdatedAt = new Date().toISOString();
    save();
    return clean;
  }
  function editCategory(oldName, newName) {
    const index = state.categories.indexOf(oldName);
    if (index < 0) throw new Error('That category is no longer in the list.');
    const clean = cleanCategoryName(newName);
    if (state.categories.some(item => item !== oldName && item.toLocaleLowerCase() === clean.toLocaleLowerCase())) throw new Error('That category already exists.');
    if (clean === oldName) return oldName;
    state.categories[index] = clean;
    const now = new Date().toISOString();
    state.categoriesUpdatedAt = now;
    for (const habit of state.habits) if (habit.category === oldName) { habit.category = clean; habit.updatedAt = now; }
    for (const task of state.tasks) if (task.category === oldName && task.status === 'open') { task.category = clean; task.updatedAt = now; }
    const today = state.habitDays[habitDateKey()];
    if (today) {
      const completed = new Set(today.completedHabitIds);
      today.habits = today.habits.map(habit => habit.category === oldName && !completed.has(habit.id) ? { ...habit, category: clean } : habit);
      today.updatedAt = now;
    }
    save();
    return clean;
  }
  function deleteCategory(name) {
    const index = state.categories.indexOf(name);
    if (index < 0) throw new Error('That category is no longer in the list.');
    if (state.categories.length <= 1) throw new Error('Keep at least one category on the list.');
    const fallback = state.categories.find(category => category !== name);
    state.categories.splice(index, 1);
    const now = new Date().toISOString();
    state.categoriesUpdatedAt = now;
    for (const habit of state.habits) if (habit.category === name) { habit.category = fallback; habit.updatedAt = now; }
    for (const task of state.tasks) if (task.category === name && task.status === 'open') { task.category = fallback; task.updatedAt = now; }
    const today = state.habitDays[habitDateKey()];
    if (today) {
      const completed = new Set(today.completedHabitIds);
      today.habits = today.habits.map(habit => habit.category === name && !completed.has(habit.id) ? { ...habit, category: fallback } : habit);
      today.updatedAt = now;
    }
    save();
    return fallback;
  }
  function currentPersistence() { return { mode: persistence, message: persistenceMessage }; }
  function persist() { save(); }
  function downloadLocalData() {
    const payload = { exportedAt: new Date().toISOString(), storage: 'this browser only', data: clone(state) };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = root.URL.createObjectURL(blob);
    const link = root.document.createElement('a');
    link.href = url;
    link.download = 'mate-local-data-' + dateKey() + '.json';
    root.document.body.appendChild(link);
    link.click();
    link.remove();
    root.setTimeout(() => root.URL.revokeObjectURL(url), 1000);
  }
  function clearLocalData() {
    const keys = [];
    for (let index = 0; index < root.localStorage.length; index += 1) {
      const key = root.localStorage.key(index);
      if (key && (key === STORAGE_KEY || key.startsWith(STORAGE_KEY + '.') || key === 'mate.matt.recent.v1' || key === 'mate.accountability.cloud-owner' || key === 'mate.accountability.pending-cloud-deletion')) keys.push(key);
    }
    keys.forEach(key => root.localStorage.removeItem(key));
  }

  function addTask(input) {
    const name = String(input.name || '').trim();
    if (!name) throw new Error('Give the task a name first.');
    const now = new Date().toISOString();
    const task = {
      id: uid(), name, category: state.categories.includes(input.category) ? input.category : (state.categories.includes('Personal') ? 'Personal' : state.categories[0]),
      priority: PRIORITIES.includes(input.priority) ? input.priority : 'Medium',
      dueDate: input.dueDate || '', project: String(input.project || '').trim(), notes: String(input.notes || '').trim(),
      status: 'open', createdAt: now, updatedAt: now, completedAt: null, totalFocusTime: 0
    };
    state.tasks.unshift(task); save(); return task;
  }
  function findTask(taskId) { return state.tasks.find(task => task.id === taskId) || null; }
  function completeTask(taskId) {
    const task = findTask(taskId); if (!task) return false;
    task.status = 'done'; task.completedAt = task.completedAt || new Date().toISOString(); task.updatedAt = new Date().toISOString(); save(); return true;
  }
  function reopenTask(taskId) {
    const task = findTask(taskId); if (!task) return false;
    task.status = 'open'; task.completedAt = null; task.updatedAt = new Date().toISOString(); save(); return true;
  }
  function setActiveTimer(taskId, nextTaskId) {
    if (!findTask(taskId)) throw new Error('That task is no longer in your list.');
    state.activeTimer = { taskId, startedAt: new Date().toISOString(), stoppedAt: null, nextTaskId: nextTaskId || null };
    state.activeTimerUpdatedAt = new Date().toISOString();
    save();
  }
  function stopTimer(nextTaskId) {
    if (!state.activeTimer || state.activeTimer.stoppedAt) return false;
    state.activeTimer.stoppedAt = new Date().toISOString();
    if (nextTaskId) state.activeTimer.nextTaskId = nextTaskId;
    state.activeTimerUpdatedAt = new Date().toISOString();
    save(); return true;
  }
  function queueNextTimer(taskId) {
    if (!state.activeTimer || !state.activeTimer.stoppedAt || !findTask(taskId)) return false;
    state.activeTimer.nextTaskId = taskId; state.activeTimerUpdatedAt = new Date().toISOString(); save(); return true;
  }
  function resolveTimer(markDone) {
    const timer = state.activeTimer; if (!timer) return null;
    const endedAt = timer.stoppedAt || new Date().toISOString();
    const startedAt = new Date(timer.startedAt);
    const duration = Math.max(0, new Date(endedAt).getTime() - startedAt.getTime());
    const task = findTask(timer.taskId);
    if (task) {
      const session = { id: uid(), taskId: task.id, taskName: task.name, category: task.category, startedAt: timer.startedAt, endedAt, duration, date: dateKey(timer.startedAt) };
      state.sessions.push(session);
      task.totalFocusTime = (Number(task.totalFocusTime) || 0) + duration; task.updatedAt = endedAt;
      if (markDone) { task.status = 'done'; task.completedAt = endedAt; }
    }
    const nextTaskId = timer.nextTaskId || null;
    state.activeTimer = null;
    state.activeTimerUpdatedAt = new Date().toISOString();
    save();
    return { task, duration, nextTaskId };
  }
  function toggleHabit(habitId, key) {
    const day = ensureDay(key || habitDateKey());
    if (!day.habits.some(h => h.id === habitId)) return false;
    const checked = new Set(day.completedHabitIds);
    if (checked.has(habitId)) checked.delete(habitId); else checked.add(habitId);
    day.completedHabitIds = Array.from(checked); day.updatedAt = new Date().toISOString(); save(); return true;
  }
  function addHabit(name, category, newCategoryName) {
    const cleanName = String(name || '').trim();
    if (!cleanName) throw new Error('A habit needs a name.');
    const day = ensureDay(habitDateKey());
    const existing = state.habits.find(h => !h.deletedAt && h.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase());
    if (existing && day.habits.some(item => item.id === existing.id)) throw new Error("That habit is already on today's list.");
    const categoryChoice = resolveCategory(category, newCategoryName);
    const finalCategory = saveCategoryChoice(categoryChoice);
    if (existing) {
      existing.category = finalCategory;
      existing.updatedAt = new Date().toISOString();
      day.habits.push(snapshotHabit(existing));
      day.updatedAt = new Date().toISOString();
      save();
      return existing;
    }
    const habit = makeHabit(cleanName, finalCategory);
    state.habits.push(habit);
    day.habits.push(snapshotHabit(habit));
    day.updatedAt = new Date().toISOString();
    save();
    return habit;
  }
  function editHabit(habitId, name, category, newCategoryName) {
    const habit = state.habits.find(h => h.id === habitId && !h.deletedAt);
    const cleanName = String(name || '').trim();
    if (!habit) throw new Error('That habit is no longer active.');
    if (!cleanName) throw new Error('A habit needs a name.');
    if (state.habits.some(h => h.id !== habitId && !h.deletedAt && h.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase())) throw new Error('That habit is already on the list.');
    const categoryChoice = resolveCategory(category, newCategoryName);
    const finalCategory = saveCategoryChoice(categoryChoice);
    habit.name = cleanName; habit.category = finalCategory; habit.updatedAt = new Date().toISOString();
    const day = ensureDay(habitDateKey());
    day.habits = day.habits.map(h => h.id === habitId ? snapshotHabit(habit) : h); day.updatedAt = new Date().toISOString(); save(); return habit;
  }
  function deleteHabit(habitId) {
    const habit = state.habits.find(h => h.id === habitId && !h.deletedAt); if (!habit) return false;
    habit.deletedAt = new Date().toISOString(); habit.updatedAt = habit.deletedAt;
    const day = ensureDay(habitDateKey()); day.habits = day.habits.filter(h => h.id !== habitId); day.updatedAt = new Date().toISOString();
    // Keep completedHabitIds and every earlier daily snapshot as historical records.
    save(); return true;
  }
  // Persist schema migrations for existing data, but do not write a fresh seed record
  // merely because someone opened the app. A user's first action will save it.
  if (loadedStoredState) save();
  MATE.data = { STORAGE_KEY, SCHEMA_VERSION, CATEGORIES, NEW_CATEGORY_VALUE, PRIORITIES, dateKey, habitDateKey, dayDate, uid, clone, getState, freshStateForCloud, hasMeaningfulData, replaceStateFromCloud, getCategories, addCategory, editCategory, deleteCategory, getDay, prepareHabitDay, copyHabitDay, declineHabitDay, currentPersistence, persist, downloadLocalData, clearLocalData, addTask, findTask, completeTask, reopenTask, setActiveTimer, stopTimer, queueNextTimer, resolveTimer, toggleHabit, addHabit, editHabit, deleteHabit };
})(window);
