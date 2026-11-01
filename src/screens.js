(function (root) {
  'use strict';
  const MATE = root.MATE = root.MATE || {};
  const { CATEGORIES, PRIORITIES, dateKey, getState, getDay, currentPersistence, findTask } = MATE.data;
  const { dashboard, habitStats, weekHabits, summarize } = MATE.analytics;
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
  const topbar = () => `<header class="topbar"><a class="brand" href="#" data-action="welcome" aria-label="MATE home"><span class="brand-mark">M</span><span class="brand-name">MATE</span></a><time class="top-date">${fmtLongDate(new Date())}</time></header>`;
  const heading = (title, eyebrow, subtitle = '', action = '') => `<div class="page-heading"><div><span class="eyebrow">${esc(eyebrow)}</span><h1>${esc(title)}</h1>${subtitle ? `<p class="subheading">${esc(subtitle)}</p>` : ''}</div>${action}</div>`;
  const statCard = (label, value, note, icon) => `<article class="glass stat-card"><span class="stat-icon" aria-hidden="true">${icon}</span><div class="stat-label">${esc(label)}</div><div class="stat-number">${esc(value)}</div><div class="stat-note">${esc(note)}</div></article>`;
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
  function activeTimerBanner() {
    const timer = getState().activeTimer; if (!timer) return '';
    const task = findTask(timer.taskId); if (!task) return '';
    const elapsed = timer.stoppedAt ? new Date(timer.stoppedAt).getTime() - new Date(timer.startedAt).getTime() : Date.now() - new Date(timer.startedAt).getTime();
    return `<div class="glass panel" style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:17px;padding:13px 17px"><div><span class="eyebrow" style="margin-bottom:4px">${timer.stoppedAt ? 'SESSION READY TO SAVE' : 'FOCUSING NOW'}</span><strong style="font-size:12px">${esc(task.name)}</strong></div><div style="display:flex;align-items:center;gap:11px"><span class="timer-active" data-timer-elapsed="${esc(task.id)}">${fmtClock(elapsed)}</span>${timer.stoppedAt ? `<button class="button small-button" type="button" data-action="resolve-pending">Choose what’s next</button>` : `<button class="button small-button" type="button" data-action="stop-timer" data-id="${esc(task.id)}">Stop</button>`}</div></div>`;
  }

  function welcome(pageState) {
    const greeting = pageState.welcomeGreeting;
    return `${topbar()}<section class="welcome"><span class="eyebrow">${fmtLongDate(new Date())}</span><div class="welcome-orbit" aria-hidden="true"><div class="atom-scene"><span class="atom-nucleus"><i></i><i></i><i></i><i></i></span><span class="atom-orbit orbit-one"><i></i></span><span class="atom-orbit orbit-two"><i></i></span><span class="atom-orbit orbit-three"><i></i></span></div></div><h1>MATE</h1><p class="welcome-name">Personal Accountability System</p><p class="tagline">Check-MATE to your to-do list.</p><p class="welcome-greeting">${esc(greeting)}</p><div class="welcome-actions"><button class="button primary" type="button" data-action="enter-home">Let's get to it <span aria-hidden="true">→</span></button>${pageState.installAvailable ? '<button class="button" type="button" data-action="install-app">Install MATE <span aria-hidden="true">↓</span></button>' : ''}</div></section>`;
  }

  function home(greeting) {
    const d = dashboard(); const state = getState(); const percent = d.percent == null ? 0 : d.percent;
    const todayList = d.tasks.length ? d.tasks : state.tasks.filter(t => t.status === 'open').slice(0, 3);
    const listLabel = d.tasks.length ? 'Due today' : 'A few open loops';
    const habitPercent = d.habit.percent == null ? 0 : d.habit.percent;
    return `${topbar()}${activeTimerBanner()}<section class="glass greeting-card"><span class="eyebrow">Your daily check-in</span><p class="greeting-copy">${esc(greeting)}</p><span class="tagline">Less planning. More doing. Honest feedback.</span></section>
      <div class="grid grid-4" style="margin-top:16px">${statCard(MATE.i18n.t('completedToday'), String(d.completed), d.completed === 1 ? 'One less thing hanging over you.' : 'Counted from actual completion times.', '✓')}${statCard(MATE.i18n.t('openToday'), String(d.open), 'Tasks with today on the calendar.', '○')}${statCard(MATE.i18n.t('focusTimeToday'), fmtDuration(d.focusMs), d.focusMs ? 'Saved timer sessions plus the active timer.' : 'Start a task timer when you begin.', '◷')}${statCard(MATE.i18n.t('habitsChecked'), d.habit.total ? `${d.habit.completed} / ${d.habit.total}` : '—', d.habit.percent == null ? 'No habits scheduled today.' : `${d.habit.percent}% of today’s habit list.`, '✦')}</div>
      <div class="grid dashboard-grid" style="margin-top:16px"><section class="glass panel"><div class="panel-title"><div><span class="eyebrow">Daily progress</span><h2>${d.percent == null ? 'No tasks on today’s calendar' : `${percent}% of today’s tasks complete`}</h2></div><span class="circle-progress" style="--progress:${percent}%"><span>${d.percent == null ? '—' : `${percent}%`}</span></span></div><div class="progress-track"><div class="progress-fill ${d.percent === 100 ? 'green' : ''}" style="width:${percent}%"></div></div><div class="progress-meta"><span>${d.progressDone} completed</span><span>${d.open} still open</span></div>${d.overdue.length ? `<p class="note" style="margin:16px 0 0">${d.overdue.length} overdue ${d.overdue.length === 1 ? 'task is' : 'tasks are'} still on the board. No lecture.</p>` : ''}</section>
        <section class="glass panel"><div class="panel-title"><div><span class="eyebrow">Habit rhythm</span><h2>${d.habit.percent == null ? 'Build a small routine' : `${d.habit.percent}% checked today`}</h2></div><button class="link-button" type="button" data-nav="habits">Open habits →</button></div>${d.habit.total ? `<div class="progress-track"><div class="progress-fill green" style="width:${habitPercent}%"></div></div><div class="progress-meta"><span>${d.habit.completed} of ${d.habit.total} done</span><span>Today</span></div>` : emptyState('Nothing scheduled yet','Add one habit and give tomorrow a little structure.','<button class="button small-button" type="button" data-nav="habits">Set up habits</button>')}</section></div>
      <section class="glass panel" style="margin-top:16px"><div class="panel-title"><div><span class="eyebrow">${esc(listLabel)}</span><h2>${d.tasks.length ? 'Selected tasks for today' : 'Your next moves'}</h2></div><button class="button small-button" type="button" data-nav="tasks">All tasks →</button></div>${todayList.length ? `<div class="task-list">${todayList.slice(0,4).map(t => taskCard(t,true)).join('')}</div>` : emptyState('A suspiciously clear day',"I know you're hiding something. Now get your shit together and add those tasks here!",'<button class="button primary small-button" type="button" data-action="add-task">+ Add a task</button>')}</section>${persistenceNote()}`;
  }

  function tasks(pageState) {
    const state = getState(); const filter = pageState.taskFilter || 'open';
    const list = state.tasks.filter(t => filter === 'all' || (filter === 'completed' ? t.status === 'done' : t.status === 'open'));
    const tabs = ['open','completed','all'].map(tab => `<button type="button" class="filter-chip ${filter === tab ? 'active' : ''}" data-action="task-filter" data-task-filter="${tab}" aria-pressed="${filter === tab}">${esc(MATE.i18n.label(tab))} <span class="mono">${state.tasks.filter(t => tab === 'all' || (tab === 'completed' ? t.status === 'done' : t.status === 'open')).length}</span></button>`).join('');
    const overdue = state.tasks.filter(t => t.status === 'open' && t.dueDate && t.dueDate < dateKey()).length;
    return `${topbar()}${activeTimerBanner()}${heading('Tasks','The board',overdue ? `${overdue} overdue. They’re not going to reschedule themselves.` : 'A clear list, a running timer, and fewer places to hide.','<button class="button primary" type="button" data-action="add-task">+ Add task</button>')}
      <section class="glass panel"><div class="stats-toolbar"><div class="filter-row" role="group" aria-label="Filter tasks">${tabs}</div><span class="muted small">${state.tasks.length} total ${state.tasks.length === 1 ? 'task' : 'tasks'}</span></div>${list.length ? `<div class="task-list">${list.map(task => taskCard(task)).join('')}</div>` : emptyState(filter === 'completed' ? 'No completed tasks yet' : filter === 'all' ? 'The board is empty' : 'Nothing open right now',filter === 'completed' ? 'The green cards will show up here when you finish something.' : 'That is either impressive or suspicious. Add a task to find out.',filter !== 'completed' ? '<button class="button primary small-button" type="button" data-action="add-task">+ Add a task</button>' : '')}</section>${persistenceNote()}`;
  }

  function taskForm() {
    return `${topbar()}${heading('Add a task','One clear next step','Give it a name. The rest can be filled in later if you are in a hurry.')}
      <section class="glass panel" style="max-width:760px"><form id="task-form" novalidate><div class="form-grid"><div class="field full"><label for="task-name">Task name <span aria-hidden="true">*</span></label><input id="task-name" name="name" type="text" maxlength="160" required autofocus placeholder="What needs doing?" autocomplete="off" /><p class="form-error" id="task-name-error" aria-live="polite"></p></div>
        <div class="field"><label for="task-category">Category</label><select id="task-category" name="category">${options(CATEGORIES,'Personal')}</select></div><div class="field"><label for="task-priority">Priority</label><select id="task-priority" name="priority">${options(PRIORITIES,'Medium')}</select></div>
        <div class="field"><label for="task-due">Due date</label><input id="task-due" name="dueDate" type="date" /></div><div class="field"><label for="task-project">Project <span class="muted">(optional)</span></label><input id="task-project" name="project" type="text" maxlength="100" placeholder="A bigger thing this belongs to" /></div>
        <div class="field full"><label for="task-notes">Notes <span class="muted">(optional)</span></label><textarea id="task-notes" name="notes" maxlength="2000" placeholder="Any details worth keeping nearby?"></textarea></div></div><div class="form-actions"><button type="button" class="button" data-nav="tasks">Cancel</button><button type="submit" class="button primary" id="save-task">Save task <span aria-hidden="true">→</span></button></div></form></section>${persistenceNote()}`;
  }
  function taskConfirmation() {
    const state = getState(); const task = state.tasks[0];
    return `${topbar()}<section class="glass confirm-card"><div class="confirm-icon" aria-hidden="true">✓</div><span class="eyebrow">Task saved</span><h1>${task ? esc(task.name) : 'Another move on the board.'}</h1><p class="muted">That’s it, or do you have more to add?</p><div class="actions"><button type="button" class="button" data-action="confirmation-done">I’m done</button><button type="button" class="button primary" data-action="add-another">Add another</button></div></section>`;
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
    const state = getState(); const day = getDay(dateKey()); const completed = new Set(day.completedHabitIds); const active = state.habits.filter(h => !h.deletedAt);
    const rows = day.habits.map(snapshot => {
      const habit = state.habits.find(h => h.id === snapshot.id) || snapshot; const checked = completed.has(snapshot.id);
      return `<article class="habit-row ${checked ? 'is-checked' : ''}"><button class="habit-check ${checked ? 'checked' : ''}" type="button" data-action="toggle-habit" data-id="${esc(snapshot.id)}" aria-label="${checked ? 'Uncheck' : 'Check'} ${esc(snapshot.name)}" aria-pressed="${checked}">✓</button><span class="habit-name">${esc(snapshot.name)}</span><span class="badge aqua">${esc(MATE.i18n.label(snapshot.category))}</span><button class="icon-button" type="button" data-action="edit-habit" data-id="${esc(habit.id)}" aria-label="Edit ${esc(snapshot.name)}" title="Edit habit">✎</button><button class="icon-button" type="button" data-action="delete-habit" data-id="${esc(habit.id)}" aria-label="Delete ${esc(snapshot.name)}" title="Delete habit">×</button></article>`;
    }).join('');
    return `${topbar()}${activeTimerBanner()}${heading('Habits','Small promises, kept','No gold stars. Just a more honest record of what you actually did.','<button class="button primary" type="button" data-action="new-habit">+ New habit</button>')}
      ${weeklyHabitChart()}<section class="glass panel" style="margin-top:16px"><div class="panel-title"><div><span class="eyebrow">${fmtLongDate(new Date())}</span><h2>Today’s checklist</h2></div><span class="badge ${day.habits.length && day.habits.every(h => completed.has(h.id)) ? 'green' : 'aqua'}">${day.habits.length ? `${day.habits.filter(h => completed.has(h.id)).length} / ${day.habits.length} done` : 'No habits today'}</span></div>${rows ? `<div class="habit-list">${rows}</div>` : emptyState(active.length ? 'No habits active today':'Start a habit list','Pick something small enough that you cannot blame the weather.','<button class="button primary small-button" type="button" data-action="new-habit">+ New habit</button>')}</section>${persistenceNote()}`;
  }

  function msHours(ms) { const hours = (Number(ms)||0)/3600000; return hours >= 10 ? `${hours.toFixed(0)}h` : `${hours.toFixed(1)}h`; }
  function breakdown(rows) {
    if (!rows.length) return emptyState('No focus sessions in this range','Start a timer from a task and saved sessions will show up here.');
    const max = Math.max(...rows.map(r=>r.value),1);
    return `<div class="breakdown-list">${rows.slice(0,8).map(row => `<div class="breakdown-row"><span title="${esc(row.name)}">${esc(row.name)}</span><span class="breakdown-track"><span style="width:${Math.max(2,row.value/max*100)}%"></span></span><strong>${msHours(row.value)}</strong></div>`).join('')}</div>`;
  }
  function statsChart(summary, period) {
    let bins;
    if (period === 'yearly') {
      bins = Array.from({length:12},(_,m)=>({label:new Intl.DateTimeFormat(MATE.i18n.locale(),{month:'short'}).format(new Date(2020,m,1)), focus:summary.days.filter(d=>new Date(d.date+'T12:00:00').getMonth()===m).reduce((a,d)=>a+d.focus,0), done:summary.days.filter(d=>new Date(d.date+'T12:00:00').getMonth()===m).reduce((a,d)=>a+d.done,0)}));
    } else if (period === 'monthly') {
      const groups = new Map();
      for (const d of summary.days) { const day = new Date(d.date+'T12:00:00'); const week = Math.ceil(day.getDate()/7); const key = `Week ${week}`; const bin = groups.get(key)||{label:key,focus:0,done:0}; bin.focus+=d.focus; bin.done+=d.done; groups.set(key,bin); }
      bins = Array.from(groups.values());
    } else bins = summary.days.map(d=>({label:period === 'daily' ? 'Today' : new Intl.DateTimeFormat(MATE.i18n.locale(),{weekday:'short'}).format(new Date(d.date+'T12:00:00')),focus:d.focus,done:d.done}));
    const max = Math.max(...bins.map(b=>b.focus), 1);
    return bins.length ? `<div class="chart-bars" role="img" aria-label="Focus time trend">${bins.map(bin=>`<div class="chart-column tooltip-wrap" tabindex="0" data-tooltip="${esc(bin.label)}: ${esc(msHours(bin.focus))} focus"><div class="chart-bar" style="height:${Math.max(bin.focus?4:2,bin.focus/max*100)}%"></div><span class="chart-label">${esc(bin.label)}</span></div>`).join('')}</div>` : emptyState('No daily records','Your daily trend will appear as you use MATE.');
  }
  function stats(pageState) {
    const period = pageState.statsPeriod || 'weekly'; const summary = summarize(period,pageState.customStart,pageState.customEnd);
    const state = getState(); const completedInRange = state.tasks.filter(t=>t.status==='done'&&t.completedAt&&t.completedAt.slice(0,10)>=summary.range.start&&t.completedAt.slice(0,10)<=summary.range.end).length;
    const pct = summary.completionPercent == null ? '—' : `${summary.completionPercent}%`;
    const rangeLabel = `${fmtDate(summary.range.start,{month:'short',day:'numeric',year:'numeric'})} – ${fmtDate(summary.range.end,{month:'short',day:'numeric',year:'numeric'})}`;
    const custom = period === 'custom' ? `<input aria-label="Start date" type="date" name="customStart" value="${esc(pageState.customStart||summary.range.start)}" /><input aria-label="End date" type="date" name="customEnd" value="${esc(pageState.customEnd||summary.range.end)}" />` : '';
    return `${topbar()}${activeTimerBanner()}${heading('Stats','Receipts, not vibes','A useful look at the time and follow-through you have actually logged.')}
      <div class="stats-toolbar"><div class="date-controls"><label class="small muted" for="stats-period">Range</label><select id="stats-period" name="statsPeriod">${options(['daily','weekly','monthly','yearly','custom'],period)}</select>${custom}<span class="muted small">${rangeLabel}</span></div><button type="button" class="button small-button" data-action="export-csv">↓ Export CSV</button></div>
      <div class="grid grid-4">${statCard('Tasks completed',String(completedInRange),`${summary.totalTasks} task${summary.totalTasks===1?'':'s'} on the calendar in this range.`, '✓')}${statCard('Focus time',msHours(summary.focusMs),`${summary.sessions.length} saved timer session${summary.sessions.length===1?'':'s'}.`, '◷')}${statCard('Task completion',pct,summary.completionPercent==null?'No tasks scheduled in this range.':'Completed tasks ÷ scheduled tasks.', '↗')}${statCard('Habit completion',summary.habits.percent==null?'—':`${summary.habits.percent}%`,summary.habits.total?`${summary.habits.completed} of ${summary.habits.total} scheduled check-ins.`:'No habit check-ins recorded.', '✦')}</div>
      <div class="grid grid-2" style="margin-top:16px"><section class="glass panel"><div class="panel-title"><div><span class="eyebrow">Work actually logged</span><h2>Focus time trend</h2></div><span class="badge aqua">${period[0].toUpperCase()+period.slice(1)}</span></div>${statsChart(summary,period)}</section><section class="glass panel"><div class="panel-title"><div><span class="eyebrow">Where it went</span><h2>Focus by category</h2></div></div>${breakdown(summary.byCategory)}</section></div>
      <div class="grid grid-2" style="margin-top:16px"><section class="glass panel"><div class="panel-title"><div><span class="eyebrow">The tasks behind the minutes</span><h2>Focus by task</h2></div></div>${breakdown(summary.byTask)}</section><section class="glass panel"><div class="panel-title"><div><span class="eyebrow">Follow-through</span><h2>Task completion trend</h2></div></div>${summary.days.some(d=>d.done||d.assigned) ? `<div class="breakdown-list">${summary.days.filter(d=>d.done||d.assigned).slice(-7).map(d=>`<div class="breakdown-row"><span>${fmtDate(d.date)}</span><span class="breakdown-track"><span style="width:${d.percent==null?0:d.percent}%"></span></span><strong>${d.done}/${d.assigned}</strong></div>`).join('')}</div>` : emptyState('No tasks in this range','Add and complete tasks to see your follow-through.')}</section></div>${persistenceNote()}`;
  }

  function nav(active) {
    const items = [ ['home','⌂','Home'],['tasks','☷','Tasks'],['habits','◉','Habits'],['stats','▥','Stats'] ];
    return `${items.slice(0,2).map(([page,icon,label])=>`<button type="button" class="nav-item ${active===page?'active':''}" data-nav="${page}" aria-current="${active===page?'page':'false'}"><span class="nav-icon" aria-hidden="true">${icon}</span><span class="nav-label">${esc(MATE.i18n.t(page))}</span></button>`).join('')}<button type="button" class="nav-add" data-action="add-task" aria-label="${esc(MATE.i18n.t('addTask'))}"><span aria-hidden="true">+</span></button>${items.slice(2).map(([page,icon,label])=>`<button type="button" class="nav-item ${active===page?'active':''}" data-nav="${page}" aria-current="${active===page?'page':'false'}"><span class="nav-icon" aria-hidden="true">${icon}</span><span class="nav-label">${esc(MATE.i18n.t(page))}</span></button>`).join('')}`;
  }

  function render(page, pageState) {
    let content;
    switch(page) {
      case 'home': content = home(pageState.homeGreeting); break;
      case 'tasks': content = tasks(pageState); break;
      case 'task-form': content = taskForm(); break;
      case 'task-confirmation': content = taskConfirmation(); break;
      case 'habits': content = habits(); break;
      case 'stats': content = stats(pageState); break;
      default: content = welcome(pageState);
    }
    root.document.getElementById('app').innerHTML = content;
    root.document.getElementById('bottom-nav').innerHTML = nav(page === 'task-form' || page === 'task-confirmation' ? '' : page);
  }
  function modal(title, body, actions) {
    return `<div class="modal-backdrop" data-action="modal-backdrop"><section class="glass modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><span class="eyebrow">MATE</span><h2 id="modal-title">${esc(title)}</h2>${body}<div class="actions">${actions}</div></section></div>`;
  }
  function habitForm(habit) {
    const editing = !!habit;
    return modal(editing ? 'Edit habit' : 'New habit',`<form id="habit-form" novalidate><input type="hidden" name="id" value="${esc(habit ? habit.id : '')}"/><div class="form-grid"><div class="field full"><label for="habit-name">Habit name *</label><input id="habit-name" name="name" required maxlength="80" value="${esc(habit ? habit.name : '')}" placeholder="A small promise to keep" /></div><div class="field full"><label for="habit-category">Category *</label><select id="habit-category" name="category">${options(CATEGORIES,habit ? habit.category : 'Personal')}</select></div></div><p class="form-error" id="habit-form-error" aria-live="polite"></p></form>`,`${editing ? '<button class="button" type="button" data-action="close-modal">Cancel</button>' : '<button class="button" type="button" data-action="close-modal">Cancel</button>'}<button class="button primary" type="submit" form="habit-form">${editing ? 'Save changes' : 'Add habit'}</button>`);
  }
  function confirmDeleteHabit(habit) {
    return modal('Delete this habit?',`<p><strong>${esc(habit.name)}</strong> will leave your active list. Its earlier check-ins and weekly history stay saved.</p>`,`<button class="button" type="button" data-action="close-modal">Keep it</button><button class="button danger" type="button" data-action="confirm-delete-habit" data-id="${esc(habit.id)}">Delete habit</button>`);
  }
  function timerResolution(task, elapsed, pendingNext) {
    return modal('All done, or just taking a break?',`<p>You focused on <strong>${esc(task ? task.name : 'a task')}</strong> for <strong>${fmtDuration(elapsed)}</strong>. ${pendingNext ? 'Another timer will start after this session is saved.' : 'Every minute is now on the record.'}</p>`,`<button class="button" type="button" data-action="resolve-timer" data-done="false">I’ll continue later</button><button class="button primary" type="button" data-action="resolve-timer" data-done="true">I’m done</button>`);
  }
  function switchTimer(task) {
    return modal('One timer at a time',`<p><strong>${esc(task.name)}</strong> is still running. Save that session before timing something else.</p>`,`<button class="button" type="button" data-action="close-modal">Keep current timer</button><button class="button primary" type="button" data-action="switch-timer" data-id="${esc(task.id)}">Stop and switch</button>`);
  }
  MATE.screens = { render, nav, modal, habitForm, confirmDeleteHabit, timerResolution, switchTimer, helpers: { esc, fmtDate, fmtLongDate, fmtDuration, fmtClock, statCard, emptyState, taskCard } };
})(window);
