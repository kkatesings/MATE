/* Translation hooks keep stored enum values stable while allowing display labels to vary. */
(function (root) {
  'use strict';
  const MATE = root.MATE = root.MATE || {};
  const catalogs = {
    en: {
      home: 'Home', tasks: 'Tasks', habits: 'Habits', stats: 'Stats', addTask: 'Add a task',
      completed: 'Completed', open: 'Open', all: 'All', today: 'Today',
      saveTask: 'Save task', cancel: 'Cancel', newHabit: 'New habit',
      category: 'Category', priority: 'Priority', dueDate: 'Due date', project: 'Project', notes: 'Notes',
      low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent',
      music: 'Music', business: 'Business', reading: 'Reading', fitness: 'Fitness', meditation: 'Meditation', personal: 'Personal',
      daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly', custom: 'Custom date range',
      completedToday: 'Completed today', openToday: 'Open today', focusTimeToday: 'Focus time today', habitsChecked: 'Habits checked'
    }
  };
  function locale() {
    const configured = MATE.data && MATE.data.getState().settings.language || 'en';
    return catalogs[configured] ? configured : 'en';
  }
  function t(key) { return catalogs[locale()][key] || catalogs.en[key] || key; }
  function label(value) {
    const key = String(value || '').toLocaleLowerCase().replace(/[^a-z]/g,'');
    return catalogs[locale()][key] || catalogs.en[key] || String(value || '');
  }
  MATE.i18n = { catalogs, locale, t, label };
})(window);
