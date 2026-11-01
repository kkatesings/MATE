(function (root) {
  'use strict';
  const MATE = root.MATE = root.MATE || {};
  const { dateKey, dayDate, getState, getDay } = MATE.data;

  function startOfWeek(date) { const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; }
  function shiftDay(date, amount) { const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12); d.setDate(d.getDate() + amount); return d; }
  function periodRange(period, customStart, customEnd) {
    const today = new Date(); const endToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
    let start;
    if (period === 'daily') start = endToday;
    else if (period === 'weekly') start = startOfWeek(endToday);
    else if (period === 'monthly') start = new Date(today.getFullYear(), today.getMonth(), 1, 12);
    else if (period === 'yearly') start = new Date(today.getFullYear(), 0, 1, 12);
    else if (period === 'custom') start = customStart ? dayDate(customStart) : startOfWeek(endToday);
    else start = startOfWeek(endToday);
    let end = period === 'custom' && customEnd ? dayDate(customEnd) : endToday;
    if (period === 'weekly') end = shiftDay(start, 6);
    if (period === 'monthly') end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 12);
    if (period === 'yearly') end = new Date(today.getFullYear(), 11, 31, 12);
    return { start: dateKey(start), end: dateKey(end < start ? start : end) };
  }
  function inRange(key, range) { return key >= range.start && key <= range.end; }
  function durationOnDate(session, key) {
    const from = session.startedAt ? new Date(session.startedAt).getTime() : NaN;
    const to = session.endedAt ? new Date(session.endedAt).getTime() : NaN;
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return session.date === key ? Math.max(0, Number(session.duration) || 0) : 0;
    const start = dayDate(key); start.setHours(0,0,0,0);
    const next = new Date(start); next.setDate(next.getDate()+1);
    return Math.max(0, Math.min(to,next.getTime()) - Math.max(from,start.getTime()));
  }
  function sessionInRange(session, range) {
    const from = session.startedAt ? new Date(session.startedAt).getTime() : NaN;
    const to = session.endedAt ? new Date(session.endedAt).getTime() : NaN;
    if (!Number.isFinite(from) || !Number.isFinite(to)) return inRange(session.date || dateKey(session.startedAt), range);
    const rangeStart = dayDate(range.start); rangeStart.setHours(0,0,0,0);
    const rangeEnd = dayDate(range.end); rangeEnd.setHours(24,0,0,0);
    return to > rangeStart.getTime() && from < rangeEnd.getTime();
  }
  function durationInRange(session, range) {
    if (!session.startedAt || !session.endedAt) return inRange(session.date || dateKey(session.startedAt), range) ? Math.max(0,Number(session.duration)||0) : 0;
    const from = new Date(session.startedAt).getTime(); const to = new Date(session.endedAt).getTime();
    const rangeStart = dayDate(range.start); rangeStart.setHours(0,0,0,0);
    const rangeEnd = dayDate(range.end); rangeEnd.setHours(24,0,0,0);
    return Math.max(0,Math.min(to,rangeEnd.getTime())-Math.max(from,rangeStart.getTime()));
  }
  function taskDate(task) { return task.dueDate || dateKey(task.createdAt); }
  function habitStats(key) {
    const day = getDay(key);
    const ids = new Set(day.habits.map(h => h.id));
    const completed = day.completedHabitIds.filter(id => ids.has(id)).length;
    return { date: key, completed, total: ids.size, percent: ids.size ? Math.round(completed / ids.size * 100) : null };
  }
  function weekHabits(anchor = new Date()) {
    const monday = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => habitStats(dateKey(shiftDay(monday, i))));
  }
  function summarize(period, customStart, customEnd) {
    const range = periodRange(period, customStart, customEnd);
    const state = getState();
    const sessions = state.sessions.filter(s => sessionInRange(s, range));
    const assignedTasks = state.tasks.filter(t => inRange(taskDate(t), range));
    const completedTasks = state.tasks.filter(t => t.status === 'done' && t.completedAt && inRange(dateKey(t.completedAt), range));
    const tasks = Array.from(new Map([...assignedTasks, ...completedTasks].map(t => [t.id, t])).values());
    const completed = completedTasks.length;
    const focusMs = sessions.reduce((sum, s) => sum + durationInRange(s,range), 0);
    const byCategory = new Map(); const byTask = new Map();
    for (const session of sessions) {
      const category = session.category || 'Personal';
      byCategory.set(category, (byCategory.get(category) || 0) + durationInRange(session,range));
      const label = session.taskName || (state.tasks.find(t => t.id === session.taskId) || {}).name || 'Deleted task';
      byTask.set(label, (byTask.get(label) || 0) + durationInRange(session,range));
    }
    const habits = [];
    let habitCursor = dayDate(range.start); const habitLast = dayDate(range.end);
    while (habitCursor <= habitLast && habits.length < 400) { habits.push(habitStats(dateKey(habitCursor))); habitCursor = shiftDay(habitCursor, 1); }
    const habitCompleted = habits.reduce((sum, d) => sum + d.completed, 0);
    const habitTotal = habits.reduce((sum, d) => sum + d.total, 0);
    const days = [];
    let cursor = dayDate(range.start); const last = dayDate(range.end);
    while (cursor <= last && days.length < 400) {
      const key = dateKey(cursor);
      const dayTasks = state.tasks.filter(t => taskDate(t) === key || (t.status === 'done' && t.completedAt && dateKey(t.completedAt) === key));
      const done = dayTasks.filter(t => t.status === 'done' && t.completedAt && dateKey(t.completedAt) === key).length;
      const dayFocus = sessions.reduce((sum,s) => sum + durationOnDate(s,key), 0);
      days.push({ date: key, done, assigned: dayTasks.length, focus: dayFocus, percent: dayTasks.length ? Math.round(done/dayTasks.length*100) : null });
      cursor = shiftDay(cursor, 1);
    }
    return {
      range, sessions, completed, totalTasks: tasks.length, completionPercent: tasks.length ? Math.round(completed / tasks.length * 100) : null,
      focusMs, byCategory: Array.from(byCategory, ([name, value]) => ({ name, value })).sort((a,b) => b.value-a.value),
      byTask: Array.from(byTask, ([name, value]) => ({ name, value })).sort((a,b) => b.value-a.value),
      habits: { completed: habitCompleted, total: habitTotal, percent: habitTotal ? Math.round(habitCompleted/habitTotal*100) : null, days }, days
    };
  }
  function dashboard() {
    const today = dateKey(); const state = getState();
    const completedToday = state.tasks.filter(t => t.status === 'done' && t.completedAt && dateKey(t.completedAt) === today);
    const dueToday = state.tasks.filter(t => t.dueDate === today);
    const todays = Array.from(new Map([...dueToday, ...completedToday].map(t => [t.id,t])).values());
    const completed = completedToday.length;
    const open = dueToday.filter(t => t.status === 'open').length;
    const progressDone = todays.filter(t => t.status === 'done').length;
    const habit = habitStats(today);
    const focusMs = state.sessions.reduce((sum,s) => sum + durationOnDate(s,today), 0);
    const active = state.activeTimer;
    const activeMs = active ? durationOnDate({ startedAt: active.startedAt, endedAt: active.stoppedAt || new Date().toISOString(), date: dateKey(active.startedAt) },today) : 0;
    return { completed, progressDone, open, percent: todays.length ? Math.min(100,Math.round(progressDone/todays.length*100)) : null, focusMs: focusMs + activeMs, habit, tasks: todays, overdue: state.tasks.filter(t => t.status === 'open' && t.dueDate && t.dueDate < today) };
  }
  MATE.analytics = { startOfWeek, shiftDay, periodRange, habitStats, weekHabits, summarize, dashboard, durationOnDate, durationInRange };
})(window);
