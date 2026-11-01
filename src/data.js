/* MATE's single local-first source of truth. Keep migrations additive. */
(function (root) {
  'use strict';
  const MATE = root.MATE = root.MATE || {};
  const STORAGE_KEY = 'mate.accountability.data';
  const SCHEMA_VERSION = 1;
  const CATEGORIES = ['Music', 'Business', 'Reading', 'Fitness', 'Meditation', 'Personal'];
  const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

  function dateKey(value) {
    let d;
    if (value instanceof Date) d = value;
    else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-').map(Number); d = new Date(year, month - 1, day, 12, 0, 0, 0);
    } else d = new Date(value || Date.now());
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
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
    const state = { schemaVersion: SCHEMA_VERSION, tasks: [], sessions: [], habits, habitDays: {}, activeTimer: null, lastGreeting: '', settings: { language: 'en' } };
    state.habitDays[dateKey()] = { date: dateKey(), habits: habits.map(snapshotHabit), completedHabitIds: [] };
    return state;
  }
  function snapshotHabit(habit) { return { id: habit.id, name: habit.name, category: habit.category }; }
  function normalizeHabit(habit) {
    if (!habit || typeof habit !== 'object' || typeof habit.id !== 'string') return null;
    const now = new Date().toISOString();
    return { ...habit, name: typeof habit.name === 'string' ? habit.name : 'Untitled habit', category: CATEGORIES.includes(habit.category) ? habit.category : 'Personal', createdAt: habit.createdAt || now, deletedAt: habit.deletedAt || null };
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
    return normalizeState(migrated);
  }
  function normalizeState(parsed) {
    // Keep unknown fields intact so a future migration never drops unrelated user data.
    const state = { ...parsed };
    state.schemaVersion = Math.max(SCHEMA_VERSION, Number(parsed.schemaVersion) || 0);
    state.tasks = Array.isArray(parsed.tasks) ? parsed.tasks.filter(t => t && typeof t.id === 'string').map(t => ({
      ...t,
      name: typeof t.name === 'string' ? t.name : 'Untitled task',
      category: CATEGORIES.includes(t.category) ? t.category : 'Personal',
      priority: PRIORITIES.includes(t.priority) ? t.priority : 'Medium',
      status: t.status === 'done' || t.status === 'completed' ? 'done' : 'open',
      createdAt: t.createdAt || new Date().toISOString(),
      totalFocusTime: Number.isFinite(t.totalFocusTime) ? Math.max(0, t.totalFocusTime) : 0
    })) : [];
    state.sessions = Array.isArray(parsed.sessions) ? parsed.sessions.filter(s => s && typeof s.id === 'string' && typeof s.taskId === 'string').map(s => ({
      ...s, duration: Number.isFinite(s.duration) ? Math.max(0, s.duration) : 0,
      date: s.date || dateKey(s.startedAt || s.endedAt)
    })) : [];
    state.habits = Array.isArray(parsed.habits) ? parsed.habits.map(normalizeHabit).filter(Boolean) : [];
    state.habitDays = parsed.habitDays && typeof parsed.habitDays === 'object' && !Array.isArray(parsed.habitDays) ? parsed.habitDays : {};
    for (const [key, oldDay] of Object.entries(state.habitDays)) {
      if (!oldDay || typeof oldDay !== 'object') { delete state.habitDays[key]; continue; }
      const oldHabits = Array.isArray(oldDay.habits) ? oldDay.habits : Array.isArray(oldDay.habitIds) ? oldDay.habitIds : [];
      state.habitDays[key] = {
        date: oldDay.date || key,
        habits: oldHabits.map(item => typeof item === 'string' ? state.habits.find(h => h.id === item) : item).filter(Boolean).map(h => ({ id: h.id, name: String(h.name || 'Habit'), category: CATEGORIES.includes(h.category) ? h.category : 'Personal' })),
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
  let persistence = 'local';
  let persistenceMessage = '';
  let readOnlyNewerSchema = false;
  try {
    const raw = root.localStorage.getItem(STORAGE_KEY);
    if (!raw) state = seedState();
    else {
      try { state = migrateState(JSON.parse(raw)); }
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
    try {
      root.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      persistence = 'local';
      return true;
    } catch (error) {
      persistence = 'memory';
      persistenceMessage = 'Browser storage is unavailable or full; changes are currently held in memory.';
      return false;
    }
  }
  function activeHabitsForDate(key) {
    return state.habits.filter(h => dateKey(h.createdAt) <= key && (!h.deletedAt || dateKey(h.deletedAt) > key)).map(snapshotHabit);
  }
  function ensureDay(key) {
    const current = state.habitDays[key];
    if (!current) state.habitDays[key] = { date: key, habits: activeHabitsForDate(key), completedHabitIds: [] };
    else if (key === dateKey()) {
      const currentIds = new Set(current.habits.map(h => h.id));
      const active = activeHabitsForDate(key);
      current.habits = current.habits.filter(h => active.some(a => a.id === h.id)).map(h => active.find(a => a.id === h.id) || h);
      for (const habit of active) if (!currentIds.has(habit.id)) current.habits.push(habit);
    }
    return state.habitDays[key];
  }
  function getDay(key) {
    // Analytics reads must not manufacture stored snapshots for dates that have not happened.
    return state.habitDays[key] || { date: key, habits: activeHabitsForDate(key), completedHabitIds: [] };
  }
  function getState() { return state; }
  function currentPersistence() { return { mode: persistence, message: persistenceMessage }; }
  function persist() { save(); }

  function addTask(input) {
    const name = String(input.name || '').trim();
    if (!name) throw new Error('Give the task a name first. MATE cannot check off a blank space.');
    const now = new Date().toISOString();
    const task = {
      id: uid(), name, category: CATEGORIES.includes(input.category) ? input.category : 'Personal',
      priority: PRIORITIES.includes(input.priority) ? input.priority : 'Medium',
      dueDate: input.dueDate || '', project: String(input.project || '').trim(), notes: String(input.notes || '').trim(),
      status: 'open', createdAt: now, completedAt: null, totalFocusTime: 0
    };
    state.tasks.unshift(task); save(); return task;
  }
  function findTask(taskId) { return state.tasks.find(task => task.id === taskId) || null; }
  function completeTask(taskId) {
    const task = findTask(taskId); if (!task) return false;
    task.status = 'done'; task.completedAt = task.completedAt || new Date().toISOString(); save(); return true;
  }
  function reopenTask(taskId) {
    const task = findTask(taskId); if (!task) return false;
    task.status = 'open'; task.completedAt = null; save(); return true;
  }
  function setActiveTimer(taskId, nextTaskId) {
    if (!findTask(taskId)) throw new Error('That task is no longer in your list.');
    state.activeTimer = { taskId, startedAt: new Date().toISOString(), stoppedAt: null, nextTaskId: nextTaskId || null };
    save();
  }
  function stopTimer(nextTaskId) {
    if (!state.activeTimer || state.activeTimer.stoppedAt) return false;
    state.activeTimer.stoppedAt = new Date().toISOString();
    if (nextTaskId) state.activeTimer.nextTaskId = nextTaskId;
    save(); return true;
  }
  function queueNextTimer(taskId) {
    if (!state.activeTimer || !state.activeTimer.stoppedAt || !findTask(taskId)) return false;
    state.activeTimer.nextTaskId = taskId; save(); return true;
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
      task.totalFocusTime = (Number(task.totalFocusTime) || 0) + duration;
      if (markDone) { task.status = 'done'; task.completedAt = endedAt; }
    }
    const nextTaskId = timer.nextTaskId || null;
    state.activeTimer = null;
    save();
    return { task, duration, nextTaskId };
  }
  function toggleHabit(habitId, key) {
    const day = ensureDay(key || dateKey());
    if (!day.habits.some(h => h.id === habitId)) return false;
    const checked = new Set(day.completedHabitIds);
    if (checked.has(habitId)) checked.delete(habitId); else checked.add(habitId);
    day.completedHabitIds = Array.from(checked); save(); return true;
  }
  function addHabit(name, category) {
    const cleanName = String(name || '').trim();
    if (!cleanName) throw new Error('A habit needs a name.');
    if (!CATEGORIES.includes(category)) throw new Error('Choose a category for this habit.');
    if (state.habits.some(h => !h.deletedAt && h.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase())) throw new Error('That habit is already on the list.');
    const habit = makeHabit(cleanName, category); state.habits.push(habit);
    const day = ensureDay(dateKey());
    if (!day.habits.some(item => item.id === habit.id)) day.habits.push(snapshotHabit(habit));
    save(); return habit;
  }
  function editHabit(habitId, name, category) {
    const habit = state.habits.find(h => h.id === habitId && !h.deletedAt);
    const cleanName = String(name || '').trim();
    if (!habit) throw new Error('That habit is no longer active.');
    if (!cleanName) throw new Error('A habit needs a name.');
    if (!CATEGORIES.includes(category)) throw new Error('Choose a category for this habit.');
    if (state.habits.some(h => h.id !== habitId && !h.deletedAt && h.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase())) throw new Error('That habit is already on the list.');
    habit.name = cleanName; habit.category = category; habit.updatedAt = new Date().toISOString();
    const day = ensureDay(dateKey());
    day.habits = day.habits.map(h => h.id === habitId ? snapshotHabit(habit) : h); save(); return habit;
  }
  function deleteHabit(habitId) {
    const habit = state.habits.find(h => h.id === habitId && !h.deletedAt); if (!habit) return false;
    habit.deletedAt = new Date().toISOString();
    const day = ensureDay(dateKey()); day.habits = day.habits.filter(h => h.id !== habitId);
    // Keep completedHabitIds and every earlier daily snapshot as historical records.
    save(); return true;
  }
  function greeting() {
    const completed = state.tasks.filter(t => t.status === 'done' && t.completedAt && dateKey(t.completedAt) === dateKey()).length;
    const openToday = state.tasks.filter(t => t.status === 'open' && t.dueDate === dateKey()).length;
    const overdue = state.tasks.filter(t => t.status === 'open' && t.dueDate && t.dueDate < dateKey()).length;
    let library = completed ? ['Look at you, closing loops. Try not to make it a habit. Actually, do.','One more thing handled. Your future self is mildly impressed.','Progress logged. I’ll update my expectations accordingly.']
      : overdue ? ['The overdue list has started a small support group. Let’s disappoint it.','Those dates are not decorative. Pick one and make a dent.']
      : openToday ? ['Today has a plan. Bold move. Let’s see it through.','Your tasks are ready. They have been waiting very patiently.']
      : ['A clean slate. Suspiciously full of potential.','Ready when you are. The task list is trying to look intimidating.','You showed up. That is inconvenient for procrastination.'];
    let pick = library[Math.floor(Math.random() * library.length)];
    if (library.length > 1 && pick === state.lastGreeting) pick = library[(library.indexOf(pick) + 1) % library.length];
    state.lastGreeting = pick; save(); return pick;
  }

  // Create today's schedule once on startup; snapshots for other dates are never rewritten.
  ensureDay(dateKey()); save();
  MATE.data = { STORAGE_KEY, SCHEMA_VERSION, CATEGORIES, PRIORITIES, dateKey, dayDate, uid, clone, getState, getDay, currentPersistence, persist, addTask, findTask, completeTask, reopenTask, setActiveTimer, stopTimer, queueNextTimer, resolveTimer, toggleHabit, addHabit, editHabit, deleteHabit, greeting };
})(window);
