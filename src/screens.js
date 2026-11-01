(function (root) {
  'use strict';
  const MATE = root.MATE = root.MATE || {};
  const { CATEGORIES, NEW_CATEGORY_VALUE, PRIORITIES, dateKey, habitDateKey, dayDate, getState, getCategories, getDay, currentPersistence, findTask } = MATE.data;
  const { dashboard, habitStats, weekHabits, summarize, durationInRange, startOfWeek, shiftDay, previousPeriodDate } = MATE.analytics;
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const fmtDate = (key, options = { month: 'short', day: 'numeric' }) => key ? new Intl.DateTimeFormat(MATE.i18n.locale(), options).format(new Date(key + 'T12:00:00')) : '';
  const fmtLongDate = date => new Intl.DateTimeFormat(MATE.i18n.locale(), { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(date);
  const fmtDuration = ms => {
    const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
    const h = Math.floor(total / 3600); const m = Math.floor((total % 3600) / 60); const s = total % 60;
    return h ? `${h}h ${String(m).padStart(2,'0')}m` : `${m}m ${String(s).padStart(2,'0')}s`;
  };
  const fmtClock = ms => {
    const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
    return [Math.floor(total/3600), Math.floor(total%3600/60), total%60].map(x => String(x).padStart(2,'0')).join(':');
  };
  const options = (items, selected) => items.map(item => `<option value="${esc(item)}" ${item === selected ? 'selected' : ''}>${esc(MATE.i18n.label(item))}</option>`).join('');
  const categoryOptions = selected => `${options(getCategories(), selected)}<option value="${NEW_CATEGORY_VALUE}">New category</option>`;
  const topbar = () => `<header class="topbar"><a class="brand" href="#" data-action="welcome" aria-label="MATE home"><span class="brand-mark">M</span><span class="brand-name">MATE</span></a><time class="top-date">${fmtLongDate(new Date())}</time><button class="icon-button tone-settings-link" type="button" data-nav="matt-settings" aria-label="Matt settings" title="Matt settings">⚙</button></header>`;
  const heading = (title, eyebrow, subtitle = '', action = '') => `<div class="page-heading"><div><span class="eyebrow">${esc(eyebrow)}</span><h1>${esc(title)}</h1>${subtitle ? `<p class="subheading">${esc(subtitle)}</p>` : ''}</div>${action}</div>`;
  const statCard = (label, value, note, icon, trend = null) => {
    const mark = trend
      ? `<span class="stat-icon ${trend.className}" role="img" aria-label="${esc(trend.label)}" title="${esc(trend.label)}">${trend.symbol}</span>`
      : `<span class="stat-icon" aria-hidden="true">${icon}</span>`;
    return `<article class="glass stat-card">${mark}<div class="stat-label">${esc(label)}</div><div class="stat-number">${esc(value)}</div><div class="stat-note">${esc(note)}</div></article>`;
  };
  const emptyState = (title, copy, button = '') => `<div class="empty-state"><div class="empty-symbol" aria-hidden="true">✦</div><strong>${esc(title)}</strong><p>${esc(copy)}</p>${button}</div>`;
  const persistenceNote = () => {
    const p = currentPersistence();
    return p.message ? `<div class="note" role="status">${esc(p.message)}</div>` : '';
  };

  function taskCard(task, compact = false) {
    const state = getState(); const active = state.activeTimer && state.activeTimer.taskId === task.id;
    const timerMs = active ? (state.activeTimer.stoppedAt ? new Date(state.activeTimer.stoppedAt) : new Date()).getTime() - new Date(state.activeTimer.startedAt).getTime() : 0;
    const due = task.dueDate ? `<span class="badge ${task.status === 'open' && task.dueDate < dateKey() ? 'priority-urgent' : ''}">◷ ${esc(task.dueDate === dateKey() ? 'Today' : fmtDate(task.dueDate))}</span>` : '';
    const project = task.project ? `<span class="badge">▦ ${esc(task.project)}</span>` : '';
    return `<article class="task-card ${task.status === 'done' ? 'completed' : ''}" data-task-id="${esc(task.id)}">
      <button class="task-check" type="button" data-action="toggle-task" data-id="${esc(task.id)}" aria-label="${task.status === 'done' ? 'Reopen' : 'Complete'} ${esc(task.name)}">${task.status === 'done' ? '✓' : '✓'}</button>
      <div class="task-main"><p class="task-name">${esc(task.name)}</p><div class="task-meta">
        ${task.status === 'done' ? '<span class="badge green">✓ COMPLETED</span>' : ''}
        <span class="badge aqua">${esc(MATE.i18n.label(task.category))}</span><span class="badge priority-${esc(task.priority.toLowerCase())}">${esc(MATE.i18n.label(task.priority))}</span>${due}${project}
        ${task.totalFocusTime ? `<span class="badge">◷ ${fmtDuration(task.totalFocusTime)}</span>` : '<span class="badge">No focus time yet</span>'}
      </div></div>
      ${!compact ? `<div class="task-actions">${active ? `<span class="timer-active" data-timer-elapsed="${esc(task.id)}">${fmtClock(timerMs)}</span><button class="button small-button" type="button" data-action="stop-timer" data-id="${esc(task.id)}">Stop</button>` : task.status === 'open' ? `<button class="button small-button" type="button" data-action="start-timer" data-id="${esc(task.id)}" aria-label="Start timer for ${esc(task.name)}">▶ Timer</button>` : `<button class="button small-button" type="button" data-action="toggle-task" data-id="${esc(task.id)}">Reopen</button>`}</div>` : ''}
    </article>`;
  }
  const habitHeadingActions = () => '<div class="habit-heading-actions"><button class="button" type="button" data-action="manage-habit-categories">New category</button><button class="button primary" type="button" data-action="new-habit">+ New habit</button></div>';
  function activeTimerBanner() {
    const timer = getState().activeTimer; if (!timer) return '';
    const task = findTask(timer.taskId); if (!task) return '';
    const elapsed = timer.stoppedAt ? new Date(timer.stoppedAt).getTime() - new Date(timer.startedAt).getTime() : Date.now() - new Date(timer.startedAt).getTime();
    return `<div class="glass panel" style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:17px;padding:13px 17px"><div><span class="eyebrow" style="margin-bottom:4px">${timer.stoppedAt ? 'SESSION READY TO SAVE' : 'FOCUSING NOW'}</span><strong style="font-size:12px">${esc(task.name)}</strong></div><div style="display:flex;align-items:center;gap:11px"><span class="timer-active" data-timer-elapsed="${esc(task.id)}">${fmtClock(elapsed)}</span>${timer.stoppedAt ? `<button class="button small-button" type="button" data-action="resolve-pending">Choose what’s next</button>` : `<button class="button small-button" type="button" data-action="stop-timer" data-id="${esc(task.id)}">Stop</button>`}</div></div>`;
  }

  function welcome(pageState) {
    const greeting = pageState.welcomeGreeting;
    return `${topbar()}<section class="welcome"><div class="welcome-orbit" aria-hidden="true"><div class="atom-scene"><span class="atom-nucleus"><i></i><i></i><i></i><i></i></span><span class="atom-orbit orbit-one"><i></i></span><span class="atom-orbit orbit-two"><i></i></span><span class="atom-orbit orbit-three"><i></i></span></div></div><h1>MATE</h1><p class="welcome-name">Personal Accountability System</p><p class="tagline">Check-MATE to your to-do list.</p><p class="welcome-greeting">${esc(greeting)}</p><div class="welcome-actions"><button class="button primary" type="button" data-action="enter-home">Let's get to it <span aria-hidden="true">→</span></button>${pageState.installAvailable ? '<button class="button" type="button" data-action="install-app">Install MATE <span aria-hidden="true">↓</span></button>' : ''}</div></section>`;
  }

  function home(greeting) {
    const d = dashboard(); const state = getState(); const percent = d.percent == null ? 0 : d.percent;
    const todayList = d.tasks.length ? d.tasks : state.tasks.filter(t => t.status === 'open').slice(0, 3);
    const listLabel = d.tasks.length ? 'Due today' : 'A few open loops';
    const habitPercent = d.habit.percent == null ? 0 : d.habit.percent;
    return `${topbar()}${activeTimerBanner()}<section class="glass greeting-card"><span class="eyebrow">Your daily check-in</span><p class="greeting-copy">${esc(greeting)}</p><span class="tagline">Less planning. More doing. Honest feedback.</span></section>
      <div class="grid grid-4" style="margin-top:16px">${statCard(MATE.i18n.t('completedToday'), String(d.completed), d.completed === 1 ? 'One less thing hanging over you.' : 'Counted from actual completion times.', '✓')}${statCard(MATE.i18n.t('openToday'), String(d.open), 'Tasks with today on the calendar.', '○')}${statCard(MATE.i18n.t('focusTimeToday'), fmtDuration(d.focusMs), d.focusMs ? 'Saved timer sessions plus the active timer.' : 'Start a task timer when you begin.', '◷')}${statCard(MATE.i18n.t('habitsChecked'), d.habit.total ? `${d.habit.completed} / ${d.habit.total}` : '—', d.habit.percent == null ? 'No habits scheduled today.' : `${d.habit.percent}% of today’s habit list.`, '✓')}</div>
      <div class="grid dashboard-grid" style="margin-top:16px"><section class="glass panel"><div class="panel-title"><div><span class="eyebrow">Daily progress</span><h2>${d.percent == null ? 'No tasks on today’s calendar' : `${percent}% of today’s tasks complete`}</h2></div><span class="circle-progress" style="--progress:${percent}%"><span>${d.percent == null ? '—' : `${percent}%`}</span></span></div><div class="progress-track"><div class="progress-fill ${d.percent === 100 ? 'green' : ''}" style="width:${percent}%"></div></div><div class="progress-meta"><span>${d.progressDone} completed</span><span>${d.open} still open</span></div>${d.overdue.length ? `<p class="note" style="margin:16px 0 0">${d.overdue.length} overdue ${d.overdue.length === 1 ? 'task is' : 'tasks are'} still on the board. No lecture.</p>` : ''}</section>
        <section class="glass panel"><div class="panel-title"><div><span class="eyebrow">Habit rhythm</span><h2>${d.habit.percent == null ? 'Build a small routine' : `${d.habit.percent}% checked today`}</h2></div><button class="link-button" type="button" data-nav="habits">Open habits →</button></div>${d.habit.total ? `<div class="progress-track"><div class="progress-fill green" style="width:${habitPercent}%"></div></div><div class="progress-meta"><span>${d.habit.completed} of ${d.habit.total} done</span><span>Today</span></div>` : emptyState('Nothing scheduled yet',MATE.matt.message('emptyHabits'),'<button class="button small-button" type="button" data-nav="habits">Set up habits</button>')}</section></div>
      <section class="glass panel" style="margin-top:16px"><div class="panel-title"><div><span class="eyebrow">${esc(listLabel)}</span><h2>${d.tasks.length ? 'Selected tasks for today' : 'Your next moves'}</h2></div><button class="button small-button" type="button" data-nav="tasks">All tasks →</button></div>${todayList.length ? `<div class="task-list">${todayList.slice(0,4).map(t => taskCard(t,true)).join('')}</div>` : emptyState('A suspiciously clear day',"I know you're hiding something. Now get your shit together and add those tasks here!",'<button class="button primary small-button" type="button" data-action="add-task">+ Add a task</button>')}</section>${persistenceNote()}`;
  }

  function tasks(pageState) {
    const state = getState(); const filter = pageState.taskFilter || 'open';
    const list = state.tasks.filter(t => filter === 'all' || (filter === 'completed' ? t.status === 'done' : t.status === 'open'));
    const tabs = ['open','completed','all'].map(tab => `<button type="button" class="filter-chip ${filter === tab ? 'active' : ''}" data-action="task-filter" data-task-filter="${tab}" aria-pressed="${filter === tab}">${esc(MATE.i18n.label(tab))} <span class="mono">${state.tasks.filter(t => tab === 'all' || (tab === 'completed' ? t.status === 'done' : t.status === 'open')).length}</span></button>`).join('');
    const overdue = state.tasks.filter(t => t.status === 'open' && t.dueDate && t.dueDate < dateKey()).length;
    return `${topbar()}${activeTimerBanner()}${heading('Tasks','The board',overdue ? `${overdue} overdue. They’re not going to reschedule themselves.` : 'A clear list, a running timer, and fewer places to hide.','<button class="button primary" type="button" data-action="add-task">+ Add task</button>')}
      <section class="glass panel"><div class="stats-toolbar"><div class="filter-row" role="group" aria-label="Filter tasks">${tabs}</div><span class="muted small">${state.tasks.length} total ${state.tasks.length === 1 ? 'task' : 'tasks'}</span></div>${list.length ? `<div class="task-list">${list.map(task => taskCard(task)).join('')}</div>` : emptyState(filter === 'completed' ? 'No completed tasks yet' : filter === 'all' ? 'The board is empty' : 'Nothing open right now',filter === 'completed' ? MATE.matt.message('emptyTasksCompleted') : MATE.matt.message(filter === 'all' ? 'emptyTasksAll' : 'emptyTasksOpen'),filter !== 'completed' ? '<button class="button primary small-button" type="button" data-action="add-task">+ Add a task</button>' : '')}</section>${persistenceNote()}`;
  }

  function taskForm() {
    return `${topbar()}${heading('Add a task','One clear next step','Give it a name. The rest can be filled in later if you are in a hurry.')}
      <section class="glass panel" style="max-width:760px"><form id="task-form" novalidate><div class="form-grid"><div class="field full"><label for="task-name">Task name <span aria-hidden="true">*</span></label><input id="task-name" name="name" type="text" maxlength="160" required autofocus placeholder="What needs doing?" autocomplete="off" /><p class="form-error" id="task-name-error" aria-live="polite"></p></div>
        <div class="field"><label for="task-category">Category</label><select id="task-category" name="category">${options(getCategories(),'Personal')}</select></div><div class="field"><label for="task-priority">Priority</label><select id="task-priority" name="priority">${options(PRIORITIES,'Medium')}</select></div>
        <div class="field"><label for="task-due">Due date</label><input id="task-due" name="dueDate" type="date" /></div><div class="field"><label for="task-project">Project <span class="muted">(optional)</span></label><input id="task-project" name="project" type="text" maxlength="100" placeholder="A bigger thing this belongs to" /></div>
        <div class="field full"><label for="task-notes">Notes <span class="muted">(optional)</span></label><textarea id="task-notes" name="notes" maxlength="2000" placeholder="Any details worth keeping nearby?"></textarea></div></div><div class="form-actions"><button type="button" class="button" data-nav="tasks">Cancel</button><button type="submit" class="button primary" id="save-task">Save task <span aria-hidden="true">→</span></button></div></form></section>${persistenceNote()}`;
  }
  function taskConfirmation() {
    const state = getState(); const task = state.tasks[0];
    const title = task ? esc(task.name) : 'Another move on the board.';
    return topbar() + '<section class="glass confirm-card"><div class="confirm-icon" aria-hidden="true">✓</div><span class="eyebrow">Task saved</span><h1>' + title + '</h1><p class="muted">' + esc(MATE.matt.message('taskConfirmation')) + '</p><div class="actions"><button type="button" class="button" data-action="confirmation-done">I’m done</button><button type="button" class="button primary" data-action="add-another">Add another</button></div></section>';
  }

  function weeklyHabitChart() {
    const week = weekHabits(); const labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']; const today = dateKey();
    return `<section class="glass panel"><div class="panel-title"><div><span class="eyebrow">The last seven days</span><h2>Habit consistency</h2></div><span class="badge aqua">Monday → Sunday</span></div><div class="weekly-chart" role="img" aria-label="Weekly habit completion chart">${week.map((day,i) => {
      const label = labels[i]; const pct = day.percent == null ? 0 : day.percent;
      const tooltip = day.percent == null ? `${label}: no habits scheduled` : `${label}: ${day.percent}% · ${day.completed} of ${day.total} habits`;
      return `<div class="week-day tooltip-wrap ${day.date === today ? 'today' : ''}" tabindex="0" data-tooltip="${esc(tooltip)}"><div class="bar-track"><div class="bar-fill" style="height:${pct}%"></div></div><span class="day-percent">${day.percent == null ? '—' : `${day.percent}%`}</span><span class="day-label">${label}</span></div>`;
    }).join('')}</div></section>`;
  }
  function habits() {
    const state = getState(); const day = getDay(habitDateKey()); const completed = new Set(day.completedHabitIds); const active = state.habits.filter(h => !h.deletedAt);
    const rows = day.habits.map(snapshot => {
      const habit = state.habits.find(h => h.id === snapshot.id) || snapshot; const checked = completed.has(snapshot.id);
      return `<article class="habit-row ${checked ? 'is-checked' : ''}"><button class="habit-check ${checked ? 'checked' : ''}" type="button" data-action="toggle-habit" data-id="${esc(snapshot.id)}" aria-label="${checked ? 'Uncheck' : 'Check'} ${esc(snapshot.name)}" aria-pressed="${checked}">✓</button><span class="habit-name">${esc(snapshot.name)}</span><span class="badge aqua">${esc(MATE.i18n.label(snapshot.category))}</span><button class="icon-button" type="button" data-action="edit-habit" data-id="${esc(habit.id)}" aria-label="Edit ${esc(snapshot.name)}" title="Edit habit">✎</button><button class="icon-button" type="button" data-action="delete-habit" data-id="${esc(habit.id)}" aria-label="Delete ${esc(snapshot.name)}" title="Delete habit">×</button></article>`;
    }).join('');
    return `${topbar()}${activeTimerBanner()}${heading('Habits','Small promises, kept','No gold stars. Just a more honest record of what you actually did.',habitHeadingActions())}
      ${weeklyHabitChart()}<section class="glass panel" style="margin-top:16px"><div class="panel-title"><div><span class="eyebrow">${fmtLongDate(new Date())}</span><h2>Today’s checklist</h2></div><span class="badge ${day.habits.length && day.habits.every(h => completed.has(h.id)) ? 'green' : 'aqua'}">${day.habits.length ? `${day.habits.filter(h => completed.has(h.id)).length} / ${day.habits.length} done` : 'No habits today'}</span></div>${rows ? `<div class="habit-list">${rows}</div>` : emptyState(active.length ? 'No habits active today':'Start a habit list',MATE.matt.message('emptyHabits'),'<button class="button primary small-button" type="button" data-action="new-habit">+ New habit</button>')}</section>${persistenceNote()}`;
  }

  function historyWeekChart(pageState) {
    const offset = Math.min(0, Number(pageState.habitWeekOffset) || 0);
    const anchor = dayDate(habitDateKey()); anchor.setDate(anchor.getDate() + offset * 7);
    const week = weekHabits(anchor); const labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const today = habitDateKey(); const selectedDate = pageState.selectedHabitDate || today;
    const sameYear = week[0].date.slice(0,4) === week[6].date.slice(0,4);
    const startOptions = sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' };
    const weekLabel = `${fmtDate(week[0].date, startOptions)} – ${fmtDate(week[6].date, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    return `<section class="glass panel"><div class="panel-title"><div><span class="eyebrow">Habit history</span><h2>Weekly consistency</h2></div><div class="habit-week-controls"><button class="button small-button" type="button" data-action="previous-habit-week" aria-label="Previous week">←</button><span class="badge aqua">${esc(weekLabel)}</span><button class="button small-button" type="button" data-action="next-habit-week" aria-label="Next week" ${offset === 0 ? 'disabled' : ''}>→</button></div></div><p class="history-hint">Select a day to review or update its checklist.</p><div class="weekly-chart" role="group" aria-label="Habit history by day">${week.map((day,i) => {
      const label = labels[i]; const pct = day.percent == null ? 0 : day.percent; const future = day.date > today;
      const tooltip = day.percent == null ? `${label}, ${day.date}: no habits scheduled` : `${label}, ${day.date}: ${day.percent}% · ${day.completed} of ${day.total} habits`;
      return `<button class="week-day tooltip-wrap ${day.date === today ? 'today' : ''} ${day.date === selectedDate ? 'selected' : ''}" type="button" data-action="select-habit-date" data-date="${esc(day.date)}" aria-label="Review ${esc(fmtLongDate(dayDate(day.date)))}: ${day.completed} of ${day.total} habits complete" aria-pressed="${day.date === selectedDate}" data-tooltip="${esc(tooltip)}" ${future ? 'disabled aria-disabled="true"' : ''}><span class="bar-track"><span class="bar-fill" style="height:${pct}%"></span></span><span class="day-percent">${day.percent == null ? '—' : `${day.percent}%`}</span><span class="day-label">${label}</span><span class="day-number">${fmtDate(day.date, { day: 'numeric' })}</span></button>`;
    }).join('')}</div></section>`;
  }
  function habitHistory(pageState) {
    const state = getState(); const today = habitDateKey();
    const selectedDate = pageState.selectedHabitDate && pageState.selectedHabitDate <= today ? pageState.selectedHabitDate : today;
    const isToday = selectedDate === today; const day = getDay(selectedDate);
    const completed = new Set(day.completedHabitIds); const active = state.habits.filter(h => !h.deletedAt);
    const rows = day.habits.map(snapshot => {
      const habit = state.habits.find(h => h.id === snapshot.id) || snapshot; const checked = completed.has(snapshot.id);
      const manageButtons = isToday ? `<button class="icon-button" type="button" data-action="edit-habit" data-id="${esc(habit.id)}" aria-label="Edit ${esc(snapshot.name)}" title="Edit habit">✎</button><button class="icon-button" type="button" data-action="delete-habit" data-id="${esc(snapshot.id)}" aria-label="Delete ${esc(snapshot.name)}" title="Delete habit">×</button>` : '';
      return `<article class="habit-row ${checked ? 'is-checked' : ''}"><button class="habit-check ${checked ? 'checked' : ''}" type="button" data-action="toggle-habit" data-date="${esc(selectedDate)}" data-id="${esc(snapshot.id)}" aria-label="${checked ? 'Uncheck' : 'Check'} ${esc(snapshot.name)} for ${esc(fmtDate(selectedDate,{month:'short',day:'numeric'}))}" aria-pressed="${checked}">✓</button><span class="habit-name">${esc(snapshot.name)}</span><span class="badge aqua">${esc(MATE.i18n.label(snapshot.category))}</span>${manageButtons}</article>`;
    }).join('');
    const done = day.habits.filter(h => completed.has(h.id)).length;
    const emptyTitle = isToday && active.length ? 'No habits active today' : 'No habits scheduled this day';
    const emptyCopy = isToday ? MATE.matt.message('emptyHabits') : MATE.matt.message('emptyHabitHistory');
    return `${topbar()}${activeTimerBanner()}${heading('Habits','Small promises, kept','No gold stars. Just a more honest record of what you actually did.',habitHeadingActions())}
      ${historyWeekChart(pageState)}<section class="glass panel habit-history-checklist" style="margin-top:16px"><div class="panel-title"><div><span class="eyebrow">${isToday ? 'Today' : 'Habit history'}</span><h2>${isToday ? 'Today’s checklist' : 'Checklist for this day'}</h2><p class="history-date">${fmtLongDate(dayDate(selectedDate))}</p></div><span class="badge ${day.habits.length && done === day.habits.length ? 'green' : 'aqua'}">${day.habits.length ? `${done} / ${day.habits.length} done` : 'No habits scheduled'}</span></div>${rows ? `<div class="habit-list">${rows}</div>` : emptyState(emptyTitle,emptyCopy)}</section>${persistenceNote()}`;
  }

  function habitCategories() {
    const state = getState();
    const categories = getCategories();
    const rows = categories.map(category => {
      const count = state.habits.filter(habit => !habit.deletedAt && habit.category === category).length;
      return `<article class="category-row"><div class="category-copy"><strong>${esc(category)}</strong><span class="muted small">${count} active habit${count === 1 ? '' : 's'}</span></div><div class="actions"><button class="button small-button" type="button" data-action="edit-habit-category" data-category="${esc(category)}">Edit</button><button class="button danger small-button" type="button" data-action="delete-habit-category" data-category="${esc(category)}" ${categories.length <= 1 ? 'disabled' : ''}>Delete</button></div></article>`;
    }).join('');
    const actions = '<div class="habit-heading-actions"><button class="button" type="button" data-nav="habits">Back to habits</button><button class="button primary" type="button" data-action="add-habit-category">+ New category</button></div>';
    return `${topbar()}${heading('Habit categories','Organize your habits','Rename or remove labels. Saved check-ins keep the category name they had at the time.',actions)}<section class="glass panel"><div class="category-list">${rows}</div></section>${persistenceNote()}`;
  }

  function msHours(ms) { const hours = (Number(ms)||0)/3600000; return hours >= 10 ? `${hours.toFixed(0)}h` : `${hours.toFixed(1)}h`; }
  function breakdown(rows) {
    if (!rows.length) return emptyState('No focus sessions in this range',MATE.matt.message('emptyFocus'));
    const max = Math.max(...rows.map(r=>r.value),1);
    return `<div class="breakdown-list">${rows.slice(0,8).map(row => `<div class="breakdown-row"><span title="${esc(row.name)}">${esc(row.name)}</span><span class="breakdown-track"><span style="width:${Math.max(2,row.value/max*100)}%"></span></span><strong>${msHours(row.value)}</strong></div>`).join('')}</div>`;
  }
  function statsChart(summary, period) {
    if (period === 'daily') {
      const sessions = summary.sessions.map(session => ({ session, duration: durationInRange(session, summary.range) }))
        .filter(item => item.duration > 0)
        .sort((a,b) => new Date(a.session.startedAt).getTime() - new Date(b.session.startedAt).getTime());
      if (!sessions.length) return emptyState('No focus sessions today',MATE.matt.message('emptyFocusToday'));
      const rangeStart = dayDate(summary.range.start); rangeStart.setHours(0,0,0,0);
      const rangeEnd = dayDate(summary.range.end); rangeEnd.setHours(24,0,0,0);
      const time = value => new Intl.DateTimeFormat(MATE.i18n.locale(),{hour:'numeric',minute:'2-digit'}).format(value);
      return `<ol class="day-focus-list" aria-label="Today's focus sessions">${sessions.map(({session,duration}) => {
        const task = MATE.data.getState().tasks.find(item => item.id === session.taskId);
        const taskName = session.taskName || (task && task.name) || 'Task';
        const category = session.category || (task && task.category) || 'Personal';
        const started = new Date(session.startedAt).getTime(); const ended = new Date(session.endedAt).getTime();
        const timeRange = Number.isFinite(started) && Number.isFinite(ended)
          ? `${time(new Date(Math.max(started,rangeStart.getTime())))} – ${time(new Date(Math.min(ended,rangeEnd.getTime())))}`
          : 'Time unavailable';
        return `<li class="day-focus-row"><span class="day-focus-meta"><strong>${esc(taskName)}</strong><span>${esc(MATE.i18n.label(category))} · ${esc(timeRange)}</span></span><strong class="day-focus-duration">${fmtDuration(duration)}</strong></li>`;
      }).join('')}</ol>`;
    }
    if (period === 'monthly') {
      const weeks = []; const sessions = MATE.data.getState().sessions;
      let weekStart = startOfWeek(dayDate(summary.range.start));
      const monthEnd = dayDate(summary.range.end);
      while (weekStart <= monthEnd) {
        const weekEnd = shiftDay(weekStart, 6);
        const range = { start: dateKey(weekStart), end: dateKey(weekEnd) };
        const label = `${fmtDate(range.start,{month:'short',day:'numeric'})} – ${fmtDate(range.end,{month:'short',day:'numeric'})}`;
        const focus = sessions.reduce((total,session) => total + durationInRange(session, range), 0);
        weeks.push({ label, focus });
        weekStart = shiftDay(weekStart, 7);
      }
      const max = Math.max(...weeks.map(week => week.focus), 1);
      return `<div class="monthly-chart-scroll"><div class="chart-bars chart-bars-monthly" role="img" aria-label="Monthly focus time by Monday-to-Sunday weeks">${weeks.map(week => `<div class="chart-column tooltip-wrap" tabindex="0" data-tooltip="${esc(week.label)}: ${esc(msHours(week.focus))} focus"><div class="chart-bar" style="height:${Math.max(week.focus?4:2,week.focus/max*100)}%"></div><span class="chart-label" title="${esc(week.label)}">${esc(week.label)}</span></div>`).join('')}</div></div>`;
    }
    let bins;
    if (period === 'yearly') {
      bins = Array.from({length:12},(_,m)=>({label:new Intl.DateTimeFormat(MATE.i18n.locale(),{month:'short'}).format(new Date(2020,m,1)), focus:summary.days.filter(d=>new Date(d.date+'T12:00:00').getMonth()===m).reduce((a,d)=>a+d.focus,0), done:summary.days.filter(d=>new Date(d.date+'T12:00:00').getMonth()===m).reduce((a,d)=>a+d.done,0)}));
    } else bins = summary.days.map(d=>({label:period === 'daily' ? 'Today' : new Intl.DateTimeFormat(MATE.i18n.locale(),{weekday:'short'}).format(new Date(d.date+'T12:00:00')),focus:d.focus,done:d.done}));
    const max = Math.max(...bins.map(b=>b.focus), 1);
    return bins.length ? `<div class="chart-bars" role="img" aria-label="Focus time trend">${bins.map(bin=>`<div class="chart-column tooltip-wrap" tabindex="0" data-tooltip="${esc(bin.label)}: ${esc(msHours(bin.focus))} focus"><div class="chart-bar" style="height:${Math.max(bin.focus?4:2,bin.focus/max*100)}%"></div><span class="chart-label">${esc(bin.label)}</span></div>`).join('')}</div>` : emptyState('No daily records',MATE.matt.message('emptyRecords'));
  }
  function comparison(current, previous, period) {
    if (!Number.isFinite(current) || !Number.isFinite(previous)) return { symbol: '&mdash;', className: 'trend-na', label: `No comparison with the previous ${period}.` };
    if (current > previous) return { symbol: '&#8593;', className: 'trend-up', label: `Improved versus the previous ${period}.` };
    if (current < previous) return { symbol: '&#8595;', className: 'trend-down', label: `Lower than the previous ${period}.` };
    return { symbol: '&#10003;', className: 'trend-same', label: `Same as the previous ${period}.` };
  }
  function stats(pageState) {
    const period = pageState.statsPeriod || 'weekly'; const summary = summarize(period);
    const previousSummary = summarize(period, undefined, undefined, previousPeriodDate(period));
    const state = getState(); const completedInRange = state.tasks.filter(t=>t.status==='done'&&t.completedAt&&dateKey(t.completedAt)>=summary.range.start&&dateKey(t.completedAt)<=summary.range.end).length;
    const pct = summary.completionPercent == null ? '—' : `${summary.completionPercent}%`;
    const rangeLabel = `${fmtDate(summary.range.start,{month:'short',day:'numeric',year:'numeric'})} – ${fmtDate(summary.range.end,{month:'short',day:'numeric',year:'numeric'})}`;
    return `${topbar()}${activeTimerBanner()}${heading('Stats','Receipts, not vibes',MATE.matt.statsReflection(summary,period,completedInRange))}
      <div class="stats-toolbar"><div class="date-controls"><label class="small muted" for="stats-period">Range</label><select id="stats-period" name="statsPeriod">${options(['daily','weekly','monthly','yearly'],period)}</select><span class="muted small">${rangeLabel}</span></div><button type="button" class="button small-button" data-action="export-pdf">↓ Export PDF</button></div>
      <div class="grid grid-4">${statCard('Tasks completed',String(completedInRange),`${summary.totalTasks} task${summary.totalTasks===1?'':'s'} on the calendar in this range.`,'',comparison(completedInRange,previousSummary.completed,period))}${statCard('Focus time',msHours(summary.focusMs),`${summary.sessions.length} saved timer session${summary.sessions.length===1?'':'s'}.`,'',comparison(summary.focusMs,previousSummary.focusMs,period))}${statCard('Task completion',pct,summary.completionPercent==null?'No tasks scheduled in this range.':'Completed tasks ÷ scheduled tasks.','',comparison(summary.completionPercent,previousSummary.completionPercent,period))}${statCard('Habit completion',summary.habits.percent==null?'—':`${summary.habits.percent}%`,summary.habits.total?`${summary.habits.completed} of ${summary.habits.total} scheduled check-ins.`:'No habit check-ins recorded.','',comparison(summary.habits.percent,previousSummary.habits.percent,period))}</div>
      <div class="grid grid-2" style="margin-top:16px"><section class="glass panel"><div class="panel-title"><div><span class="eyebrow">Work actually logged</span><h2>Focus time trend</h2></div><span class="badge aqua">${period[0].toUpperCase()+period.slice(1)}</span></div>${statsChart(summary,period)}</section><section class="glass panel"><div class="panel-title"><div><span class="eyebrow">Where it went</span><h2>Focus by category</h2></div></div>${breakdown(summary.byCategory)}</section></div>
      <div class="grid grid-2" style="margin-top:16px"><section class="glass panel"><div class="panel-title"><div><span class="eyebrow">The tasks behind the minutes</span><h2>Focus by task</h2></div></div>${breakdown(summary.byTask)}</section><section class="glass panel"><div class="panel-title"><div><span class="eyebrow">Follow-through</span><h2>Task completion trend</h2></div></div>${summary.days.some(d=>d.done||d.assigned) ? `<div class="breakdown-list">${summary.days.filter(d=>d.done||d.assigned).slice(-7).map(d=>`<div class="breakdown-row"><span>${fmtDate(d.date)}</span><span class="breakdown-track"><span style="width:${d.percent==null?0:d.percent}%"></span></span><strong>${d.done}/${d.assigned}</strong></div>`).join('')}</div>` : emptyState('No tasks in this range',MATE.matt.message('emptyTaskRange'))}</section></div>${persistenceNote()}`;
  }

  function mattSettings() {
    const preferences = MATE.matt.getPreferences();
    const cloud = MATE.cloudSync ? MATE.cloudSync.state() : { user: null, cloudConsentGranted: false, privacyHref: './privacy.html' };
    const control = function (key, label, description, value) {
      return '<div class="tone-setting"><div class="tone-setting-head"><label for="matt-' + key + '">' + label + '</label><output id="matt-' + key + '-value" for="matt-' + key + '">' + value + '%</output></div><input id="matt-' + key + '" class="tone-slider" type="range" min="0" max="100" step="1" value="' + value + '" data-matt-preference="' + key + '" aria-describedby="matt-' + key + '-help"/><p class="tone-setting-help" id="matt-' + key + '-help">' + description + '</p></div>';
    };
    const preview = esc(MATE.matt.preview(preferences));
    const dataPanel = cloud.user || cloud.cloudConsentGranted
      ? '<section class="glass panel" style="margin-top:16px"><span class="eyebrow">Privacy and data</span><h2>Your MATE data</h2><p class="muted">Cloud consent is active or saved in this browser. Use the account controls in the top bar to withdraw consent and delete cloud data. A local copy may remain on this device until you delete the account or withdraw consent.</p><p class="muted">Questions or an objection to local data processing? <a href="mailto:kate.kalman@gmail.com?subject=MATE%20privacy%20request">Contact Kálmán Kata</a>.</p></section>'
      : '<section class="glass panel" style="margin-top:16px"><span class="eyebrow">Privacy and data</span><h2>Your data on this device</h2><p class="muted">In local mode, your tasks, notes, habits, check-ins and focus sessions are saved in this browser profile. MATE does not send them to Firebase unless you separately consent to cloud sync. Other people using this browser profile may be able to see them. Avoid putting sensitive health, financial or other private details in task names and notes.</p><div class="actions"><button class="button small-button" type="button" data-action="export-local-data">Download a copy</button><button class="button danger-button small-button" type="button" data-action="delete-local-data">Delete data on this device</button></div><p class="muted small">You can also <a href="mailto:kate.kalman@gmail.com?subject=MATE%20privacy%20request">contact Kálmán Kata</a> to object to local data processing or ask a privacy question. Deleting here does not delete a Firebase account or data stored on another device.</p><p class="muted small"><a href="' + esc(cloud.privacyHref || './privacy.html') + '" target="_blank" rel="noopener noreferrer">Read the privacy notice</a>.</p></section>';
    return topbar() + heading("Matt's tone",'Personalize MATE','Choose how much dry humor and firm accountability feels useful.') +
      '<section class="glass panel tone-settings">' +
      control('humor','Humor','0 is mostly straight talk. 100 brings more dry wit. Matt stays kind at every setting.',preferences.humor) +
      control('firmness','Firmness','0 is gentle and warm. 100 is more direct about the next step.',preferences.firmness) +
      '<div class="matt-tone-preview"><span class="eyebrow">Preview</span><p id="matt-tone-preview">' + preview + '</p><small id="matt-tone-status" class="muted">Your settings are saved on this device.</small></div>' +
      '<div class="actions"><button class="button" type="button" data-action="reset-matt-settings">Reset Matt to defaults</button></div></section>' + dataPanel + persistenceNote();
  }

  function mattCongratulations(copy) {
    return '<div class="modal-backdrop" data-action="modal-backdrop"><section class="glass modal-card matt-congrats-card" role="dialog" aria-modal="true" aria-labelledby="matt-congrats-title"><span class="eyebrow">MATE</span><h2 id="matt-congrats-title">Well done</h2><p class="matt-congrats-copy">' + esc(copy) + '</p><div class="actions"><button class="button primary" type="button" data-action="dismiss-matt-congrats">I\'m amazing!</button></div></section></div>';
  }
  function nav(active) {
    const items = [ ['home','⌂','Home'],['tasks','☷','Tasks'],['habits','◉','Habits'],['stats','▥','Stats'] ];
    return `${items.slice(0,2).map(([page,icon,label])=>`<button type="button" class="nav-item ${active===page?'active':''}" data-nav="${page}" aria-current="${active===page?'page':'false'}"><span class="nav-icon" aria-hidden="true">${icon}</span><span class="nav-label">${esc(MATE.i18n.t(page))}</span></button>`).join('')}<button type="button" class="nav-add" data-action="add-task" aria-label="${esc(MATE.i18n.t('addTask'))}"><span aria-hidden="true">+</span></button>${items.slice(2).map(([page,icon,label])=>`<button type="button" class="nav-item ${active===page?'active':''}" data-nav="${page}" aria-current="${active===page?'page':'false'}"><span class="nav-icon" aria-hidden="true">${icon}</span><span class="nav-label">${esc(MATE.i18n.t(page))}</span></button>`).join('')}`;
  }

  function updateCloudAccount() {
    const gear = root.document.querySelector('.topbar .tone-settings-link');
    if (!gear || !gear.parentNode) return;
    let holder = root.document.getElementById('cloud-account');
    if (!holder) {
      holder = root.document.createElement('div');
      holder.id = 'cloud-account';
      holder.className = 'cloud-account';
      gear.parentNode.insertBefore(holder, gear);
    }
    const cloud = MATE.cloudSync ? MATE.cloudSync.state() : { configured: false, user: null, status: 'setup', privacyHref: './privacy.html', privacyReady: false, cloudConsentGranted: false };
    const privacyLink = '<a class="cloud-policy-link" href="' + esc(cloud.privacyHref || './privacy.html') + '" target="_blank" rel="noopener noreferrer">Privacy</a>';
    if (!cloud.configured) {
      holder.innerHTML = privacyLink + '<span class="cloud-status local" title="Cloud sync will be available after Firebase setup.">On this device</span>';
      return;
    }
    if (!cloud.privacyReady) {
      const signOut = cloud.user ? '<button class="button small-button auth-button" type="button" data-action="cloud-sign-out">Sign out</button>' : '';
      const withdraw = cloud.cloudConsentGranted ? '<button class="button small-button auth-button danger-button" type="button" data-action="withdraw-cloud-consent">Withdraw consent</button>' : '';
      const deleteAccount = cloud.user ? '<button class="button small-button auth-button danger-button" type="button" data-action="delete-cloud-account">Delete account</button>' : '';
      holder.innerHTML = privacyLink + '<span class="cloud-status setup" role="status">Privacy setup needed</span>' + withdraw + deleteAccount + signOut;
      return;
    }
    if (!cloud.cloudConsentGranted) {
      const accountName = cloud.user ? '<span class="cloud-account-name">' + esc(cloud.user.displayName || cloud.user.email || 'Google account') + '</span>' : '';
      const withdraw = cloud.user ? '<button class="button small-button auth-button danger-button" type="button" data-action="withdraw-cloud-consent">Withdraw consent</button>' : '';
      const signOut = cloud.user ? '<button class="button small-button auth-button" type="button" data-action="cloud-sign-out">Sign out</button>' : '';
      const deleteAccount = cloud.user ? '<button class="button small-button auth-button danger-button" type="button" data-action="delete-cloud-account">Delete account</button>' : '';
      holder.innerHTML = privacyLink + accountName + '<button class="button small-button auth-button" type="button" data-action="review-privacy">Review &amp; consent</button>' + withdraw + deleteAccount + signOut;
      return;
    }
    if (!cloud.user) {
      const withdraw = cloud.cloudConsentGranted ? '<button class="button small-button auth-button danger-button" type="button" data-action="withdraw-cloud-consent">Withdraw consent</button>' : '';
      holder.innerHTML = privacyLink + '<button class="button small-button auth-button" type="button" data-action="cloud-sign-in">Sign in with Google</button>' + withdraw;
      return;
    }
    const labels = { syncing: 'Syncing', synced: 'Synced', offline: 'Offline · saved here', error: 'Sync needs attention', privacy: 'Review privacy notice', local: 'Local only', setup: 'Setup needed', checking: 'Checking' };
    const label = labels[cloud.status] || 'Account connected';
    holder.innerHTML = privacyLink + '<span class="cloud-account-name" title="' + esc(cloud.user.email || cloud.user.displayName) + '">' + esc(cloud.user.displayName || cloud.user.email || 'Google account') + '</span><span class="cloud-status ' + esc(cloud.status) + '" role="status">' + esc(label) + '</span><button class="button small-button auth-button" type="button" data-action="cloud-export-data">Export data</button><button class="button small-button auth-button danger-button" type="button" data-action="delete-cloud-account">Delete account</button><button class="button small-button auth-button" type="button" data-action="cloud-sign-out">Sign out</button>';
  }
  function privacyAcknowledgement() {
    const cloud = MATE.cloudSync ? MATE.cloudSync.state() : { privacyReady: false, privacyHref: './privacy.html' };
    if (!cloud.privacyReady) return modal('Privacy notice still in draft', '<p>Google sign-in and cloud sync stay disabled until the notice has complete controller contact details, a chosen legal basis, retention terms, and the Firebase data region.</p><p><a href="' + esc(cloud.privacyHref || './privacy.html') + '" target="_blank" rel="noopener noreferrer">Review the draft notice</a></p>', '<button class="button primary" type="button" data-action="close-modal">Got it</button>');
    const body = '<p>Read the <a href="' + esc(cloud.privacyHref || './privacy.html') + '" target="_blank" rel="noopener noreferrer">MATE privacy notice</a>. Google sign-in and cloud sync are optional; choosing Not now keeps MATE in local-only mode and does not start Google sign-in.</p><label class="privacy-ack-label"><input id="privacy-consent-checkbox" type="checkbox"/><span>I have read the MATE privacy notice and freely and explicitly consent to MATE processing my Google account details and the MATE data I choose to sync through Firebase for account access and cross-device syncing.</span></label><p>You can withdraw this consent later. MATE will delete the Firebase account and its cloud data; local data on this device will remain. Copies stored locally on other devices must be removed separately.</p>';
    const consentAction = cloud.user ? 'Agree and resume sync' : 'Agree and sign in with Google';
    const actions = '<button class="button" type="button" data-action="close-modal">Not now</button><button id="privacy-continue" class="button primary" type="button" data-action="grant-cloud-consent" disabled>' + consentAction + '</button>';
    return modal('Before cloud sync', body, actions);
  }
  function deleteCloudAccountConfirmation() {
    const body = '<p>This permanently deletes your MATE cloud data and Firebase sign-in, then clears this account’s MATE data stored in this browser.</p><p>Other devices and any other MATE accounts saved in this browser may still hold copies. Export first if you want to keep a copy.</p>';
    const actions = '<button class="button" type="button" data-action="close-modal">Cancel</button><button class="button danger-button" type="button" data-action="confirm-delete-cloud-account">Delete account and data</button>';
    return modal('Delete account and data?', body, actions);
  }
  function withdrawCloudConsentConfirmation() {
    const cloud = MATE.cloudSync ? MATE.cloudSync.state() : { user: null };
    const body = cloud.user
      ? '<p>Withdrawing consent stops cloud sync and deletes your Firebase sign-in and MATE cloud data. Your local MATE data in this browser remains available. Copies saved locally on other devices are not removed by this action.</p><p>You can export a copy before continuing. This action cannot be undone.</p>'
      : cloud.cloudAccountLinked
        ? '<p>This browser was previously linked to a MATE cloud account. Continuing reconnects to the same Google account so MATE can delete that account and its cloud data. It will not resume syncing. Your local MATE data on this device remains available.</p><p>If you choose a different Google account, MATE will not delete it.</p>'
        : '<p>This removes the saved cloud-sync consent from this browser. No cloud account has been linked from this browser. Your local MATE data remains available.</p>';
    const actions = '<button class="button" type="button" data-action="close-modal">Keep cloud sync</button><button class="button danger-button" type="button" data-action="confirm-withdraw-cloud-consent">' + (cloud.user || cloud.cloudAccountLinked ? 'Withdraw consent and delete cloud data' : 'Withdraw cloud consent') + '</button>';
    return modal('Withdraw cloud consent?', body, actions);
  }
  function deleteLocalDataConfirmation() {
    const body = '<p>This removes MATE data stored in this browser profile, including tasks, notes, habits, check-ins, focus sessions, saved account copies and recovery copies. It does not delete a Firebase account, data in the cloud, or copies on other devices.</p><p>Download the currently open MATE data first if you want to keep it. Other account copies and recovery copies are also removed by this action. The app will restart with a fresh local list.</p>';
    const actions = '<button class="button" type="button" data-action="close-modal">Keep my data</button><button class="button danger-button" type="button" data-action="confirm-delete-local-data">Delete local data</button>';
    return modal('Delete data on this device?', body, actions);
  }
  function render(page, pageState) {
    let content;
    switch(page) {
      case 'home': content = home(pageState.homeGreeting); break;
      case 'tasks': content = tasks(pageState); break;
      case 'task-form': content = taskForm(); break;
      case 'task-confirmation': content = taskConfirmation(); break;
      case 'habits': content = habitHistory(pageState); break;
      case 'habit-categories': content = habitCategories(); break;
      case 'stats': content = stats(pageState); break;
      case 'matt-settings': content = mattSettings(); break;
      default: content = welcome(pageState);
    }
    root.document.getElementById('app').innerHTML = content;
    root.document.getElementById('bottom-nav').innerHTML = nav(page === 'task-form' || page === 'task-confirmation' ? '' : page === 'habit-categories' ? 'habits' : page);
  }
  function modal(title, body, actions) {
    return `<div class="modal-backdrop" data-action="modal-backdrop"><section class="glass modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><span class="eyebrow">MATE</span><h2 id="modal-title">${esc(title)}</h2>${body}${actions ? `<div class="actions">${actions}</div>` : ''}</section></div>`;
  }
  function habitForm(habit) {
    const editing = !!habit;
    const form = `<form id="habit-form" novalidate>
      <input type="hidden" name="id" value="${esc(habit ? habit.id : '')}"/>
      <div class="form-grid">
        <div class="field full"><label for="habit-name">Habit name *</label><input id="habit-name" name="name" required maxlength="80" value="${esc(habit ? habit.name : '')}" placeholder="A small promise to keep" /></div>
        <div class="field full"><label for="habit-category">Category *</label><select id="habit-category" name="category">${categoryOptions(habit ? habit.category : 'Personal')}</select></div>
        <div class="field full" id="habit-new-category-field" hidden><label for="habit-new-category">New category *</label><input id="habit-new-category" name="newCategory" type="text" maxlength="40" placeholder="Give it a name" /></div>
      </div>
      <p class="form-error" id="habit-form-error" aria-live="polite"></p>
      <div class="actions"><button class="button" type="button" data-action="close-modal">Cancel</button><button class="button primary" type="submit" data-action="save-habit">${editing ? 'Save changes' : 'Add habit'}</button></div>
    </form>`;
    return modal(editing ? 'Edit habit' : 'New habit', form, '');
  }
  function habitCategoryForm(category) {
    const editing = typeof category === 'string';
    const form = `<form id="habit-category-form" novalidate><input type="hidden" name="originalName" value="${esc(editing ? category : '')}"/><div class="field"><label for="habit-category-name">Category name *</label><input id="habit-category-name" name="name" type="text" maxlength="40" required autofocus value="${esc(editing ? category : '')}" placeholder="e.g. Creative work"/><p class="form-error" id="habit-category-error" aria-live="polite"></p></div><div class="actions"><button class="button" type="button" data-action="close-modal">Cancel</button><button class="button primary" type="submit" data-action="save-habit-category">${editing ? 'Save changes' : 'Add category'}</button></div></form>`;
    return modal(editing ? 'Edit category' : 'New category', form, '');
  }
  function confirmDeleteHabitCategory(category) {
    const fallback = getCategories().find(item => item !== category);
    return modal('Delete this category?', `<p><strong>${esc(category)}</strong> will be removed. Current habits move to <strong>${esc(fallback || '')}</strong>. Previously saved daily check-ins keep their original category.</p>`, `<button class="button" type="button" data-action="close-modal">Keep category</button><button class="button danger" type="button" data-action="confirm-delete-habit-category" data-category="${esc(category)}">Delete category</button>`);
  }
  function habitDayChoice(choice) {
    const count = Number(choice.habitCount) || 0;
    const date = fmtLongDate(dayDate(choice.previousDate));
    return modal('A new habit day', `<p>Your last saved list is from <strong>${esc(date)}</strong>. Copy all ${count} habit${count === 1 ? '' : 's'} into today? They will all start unchecked.</p><p>Choose “No, thanks” to start with an empty list and add habits manually.</p>`, `<button class="button" type="button" data-action="decline-habit-copy">No, thanks</button><button class="button primary" type="button" data-action="copy-habit-day" data-date="${esc(choice.previousDate)}">Copy the list</button>`);
  }
  function confirmDeleteHabit(habit) {
    return modal('Delete this habit?',`<p><strong>${esc(habit.name)}</strong> will leave your active list. Its earlier check-ins and weekly history stay saved.</p>`,`<button class="button" type="button" data-action="close-modal">Keep it</button><button class="button danger" type="button" data-action="confirm-delete-habit" data-id="${esc(habit.id)}">Delete habit</button>`);
  }
  function timerResolution(task, elapsed, pendingNext) {
    const text = MATE.matt.message('timerResolution', { task: task ? task.name : 'a task', time: fmtDuration(elapsed), pending: pendingNext });
    const body = '<p>' + esc(text) + '</p>';
    const actions = '<button class="button" type="button" data-action="resolve-timer" data-done="false">I’ll continue later</button><button class="button primary" type="button" data-action="resolve-timer" data-done="true">I’m done</button>';
    return modal('All done, or just taking a break?', body, actions);
  }
  function switchTimer(task) {
    const text = MATE.matt.message('switchTimer', { task: task.name });
    const body = '<p>' + esc(text) + '</p>';
    const actions = '<button class="button" type="button" data-action="close-modal">Keep current timer</button><button class="button primary" type="button" data-action="switch-timer" data-id="' + esc(task.id) + '">Stop and switch</button>';
    return modal('One timer at a time', body, actions);
  }
  MATE.screens = { render, updateCloudAccount, privacyAcknowledgement, deleteCloudAccountConfirmation, withdrawCloudConsentConfirmation, deleteLocalDataConfirmation, nav, modal, habitForm, habitCategoryForm, confirmDeleteHabitCategory, habitDayChoice, confirmDeleteHabit, timerResolution, switchTimer, mattCongratulations, helpers: { esc, fmtDate, fmtLongDate, fmtDuration, fmtClock, statCard, emptyState, taskCard } };
})(window);
