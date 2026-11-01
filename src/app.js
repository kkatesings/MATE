(function (root) {
  'use strict';
  const MATE = root.MATE;
  const data = MATE.data;
  const screens = MATE.screens;
  const analytics = MATE.analytics;
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
  function render() { screens.render(appState.page, appState); }
  function navigate(page) {
    if (page === 'home') appState.homeGreeting = data.greeting();
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
    if (!active) { data.setActiveTimer(taskId); render(); toast('Timer started. One task, one honest clock.'); return; }
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
    if (resolved && resolved.task) {
      if (resolved.nextTaskId && data.findTask(resolved.nextTaskId)) data.setActiveTimer(resolved.nextTaskId);
      if (markDone) {
        appState.homeGreeting = data.greeting();
        toast(`${resolved.task.name} is done. ${resolved.duration ? 'Time is on the record.' : 'No timer time was lost.'}`);
      } else toast('Session saved. The task stays open for later.');
    }
    render();
  }
  function csvCell(value) {
    let text = String(value == null ? '' : value);
    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }
  function exportCsv() {
    const period = appState.statsPeriod;
    const summary = analytics.summarize(period);
    const rows = [['record_type','range_start','range_end','metric','value','task','category','session_id','started_at','ended_at','duration_ms','range_duration_ms','date']];
    const metric = (name,value) => rows.push(['stat',summary.range.start,summary.range.end,name,value,'','','','','','','','']);
    const state = data.getState();
    const completed = state.tasks.filter(t=>t.status==='done'&&t.completedAt&&data.dateKey(t.completedAt)>=summary.range.start&&data.dateKey(t.completedAt)<=summary.range.end).length;
    metric('completed_tasks',completed); metric('scheduled_tasks',summary.totalTasks); metric('focus_time_ms',summary.focusMs); metric('task_completion_percent',summary.completionPercent == null ? '' : summary.completionPercent); metric('habit_completed_check_ins',summary.habits.completed); metric('habit_scheduled_check_ins',summary.habits.total);
    for (const row of summary.byCategory) metric(`focus_ms_category_${row.name}`,row.value);
    for (const row of summary.byTask) metric(`focus_ms_task_${row.name}`,row.value);
    for (const session of summary.sessions) rows.push(['timer_session',summary.range.start,summary.range.end,'', '',session.taskName || '',session.category || '',session.id,session.startedAt,session.endedAt,session.duration,analytics.durationInRange(session,summary.range),session.date]);
    const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = `mate-stats-${summary.range.start}-to-${summary.range.end}.csv`;
    document.body.appendChild(link); link.click(); link.remove(); root.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`Exported ${summary.sessions.length} timer session${summary.sessions.length === 1 ? '' : 's'} and the selected statistics.`);
  }
  async function installApp() {
    if (!installPrompt) { toast('Open your browser menu and choose Install app to add MATE to this phone.'); return; }
    const prompt = installPrompt;
    installPrompt = null;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      appState.installAvailable = false;
      render();
      toast(choice && choice.outcome === 'accepted' ? 'MATE is ready on your home screen.' : 'No rush. You can install MATE from the browser menu later.');
    } catch (error) {
      appState.installAvailable = false;
      render();
      toast('Use your browser menu to install MATE on this phone.');
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
      toast(originalName ? `Category changed to ${name}. Past check-ins keep their old label.` : `Category added: ${name}.`);
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
      toast(id ? 'Habit updated. Today’s list is current; earlier snapshots stay intact.' : 'Habit added to today’s list. New habit, no dramatic vows required.');
    } catch (err) {
      if (error) error.textContent = err.message;
      document.getElementById('habit-name')?.focus();
    }
  }

  document.addEventListener('click', event => {
    const target = event.target.closest('button,[data-nav],[data-action]'); if (!target) return;
    if (target.dataset.nav) { navigate(target.dataset.nav); return; }
    const action = target.dataset.action;
    if (!action) return;
    switch (action) {
      case 'welcome': event.preventDefault(); appState.welcomeGreeting = data.welcomeQuote(); appState.page = 'welcome'; render(); break;
      case 'enter-home': navigate('home'); break;
      case 'add-task': appState.page = 'task-form'; render(); root.setTimeout(()=>document.getElementById('task-name')?.focus(),0); break;
      case 'add-another': closeModal(); appState.page = 'task-form'; render(); root.setTimeout(()=>document.getElementById('task-name')?.focus(),0); break;
      case 'confirmation-done': appState.taskFilter = 'open'; navigate('tasks'); break;
      case 'toggle-task': {
        const id = target.dataset.id; const task = data.findTask(id); if (!task) break;
        if (task.status === 'done') { data.reopenTask(id); toast('Reopened. Apparently it was not finished after all.'); }
        else if (data.getState().activeTimer?.taskId === id) { data.stopTimer(); showTimerResolution(); }
        else { data.completeTask(id); appState.homeGreeting = data.greeting(); toast('Task completed. That one can stop taking up mental space.'); }
        render(); break;
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
        toast(copied ? 'Copied. Every habit starts unchecked.' : 'Today’s habit list is already set.', copied ? 'success' : 'error');
        break;
      }
      case 'decline-habit-copy':
        data.declineHabitDay(data.habitDateKey());
        closeModal();
        appState.page = 'habits';
        appState.habitWeekOffset = 0;
        appState.selectedHabitDate = data.habitDateKey();
        render();
        toast('Fresh list. Add habits when ready.');
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
          toast(`Category removed. Current habits moved to ${fallback}; past check-ins were kept.`);
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
        if (habit) toast(`${habit.name} removed from the active list. Its history stays put.`);
        break;
      }
      case 'toggle-habit': data.toggleHabit(target.dataset.id, target.dataset.date || data.habitDateKey()); render(); break;
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
      case 'close-modal': closeModal(); break;
      case 'modal-backdrop': if (event.target === target) closeModal(); break;
      case 'export-csv': exportCsv(); break;
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
      if (!name) { error.textContent = 'Give the task a name first. Blank space is not a task, however ambitious.'; input?.focus(); return; }
      taskSubmitting = true; const button = document.getElementById('save-task'); if (button) button.disabled = true;
      try {
        data.addTask({ name, category: fields.get('category'), priority: fields.get('priority'), dueDate: fields.get('dueDate'), project: fields.get('project'), notes: fields.get('notes') });
        taskSubmitting = false; appState.page = 'task-confirmation'; render();
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

  appState.welcomeGreeting = data.welcomeQuote();
  appState.selectedHabitDate = data.habitDateKey();
  render();
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
      toast('MATE is installed. Your task list made the move too.');
    });
  }
  if (root.navigator && root.navigator.serviceWorker && root.location && root.location.protocol !== 'file:') {
    root.navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
  }
})(window);
