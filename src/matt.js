(function (root) {
  'use strict';

  const MATE = root.MATE = root.MATE || {};
  const DEFAULTS = Object.freeze({ humor: 55, firmness: 55 });
  const PROFILE = Object.freeze({
    name: 'Matt',
    purpose: 'A clever, caring accountability partner who helps the user act without making productivity a measure of their worth.',
    principles: ['clear before clever', 'tease behavior, never identity', 'use real data', 'support rest and recovery', 'keep humor out of difficult moments']
  });
  // Keep quote rotation only in memory. Persisting quote IDs is not needed for
  // the tracker and would create an extra browser-storage purpose.
  const recent = Object.create(null);

  const catalog = {
    welcomeQuotes: [
      { id: 'welcome-01', humor: 8, firmness: 12, text: "Hey. I've got you. One thing at a time." },
      { id: 'welcome-02', humor: 10, firmness: 15, text: 'No grand reset needed. Just the next honest step.' },
      { id: 'welcome-03', humor: 4, firmness: 8, text: 'Take a breath. The list can wait ten seconds.' },
      { id: 'welcome-04', humor: 12, firmness: 22, text: 'You do not have to feel ready. Start small and let ready catch up.' },
      { id: 'welcome-05', humor: 6, firmness: 14, text: 'A quiet start still counts as a start.' },
      { id: 'welcome-06', humor: 14, firmness: 18, text: 'Progress can be embarrassingly small. It still counts.' },
      { id: 'welcome-07', humor: 12, firmness: 22, text: 'We can make this manageable before making it impressive.' },
      { id: 'welcome-08', humor: 18, firmness: 28, text: 'Rest is allowed. Avoidance just likes borrowing its coat.' },
      { id: 'welcome-09', humor: 8, firmness: 20, text: 'One thing, then a pause. That is a perfectly respectable plan.' },
      { id: 'welcome-10', humor: 22, firmness: 20, text: 'You are allowed to start where you are. Very inconvenient, I know.' },
      { id: 'welcome-11', humor: 4, firmness: 10, text: 'No shame, no speeches. What is one useful next step?' },
      { id: 'welcome-12', humor: 10, firmness: 18, text: 'You showed up. Let us keep the next thing kind and doable.' },
      { id: 'welcome-13', humor: 30, firmness: 24, text: 'A small start is still a start. The paperwork has been approved.' },
      { id: 'welcome-14', humor: 24, firmness: 30, text: 'You can change the plan without turning it into a court case.' },
      { id: 'welcome-15', humor: 16, firmness: 28, text: 'Pick one gentle next step. The rest can wait its turn.' },
      { id: 'welcome-16', humor: 24, firmness: 18, text: 'You are a person, not a productivity dashboard. Let us act accordingly.' },
      { id: 'welcome-17', humor: 28, firmness: 34, text: 'Start with the version that fits your actual energy today.' },
      { id: 'welcome-18', humor: 34, firmness: 20, text: 'You do not need a perfect day to make one useful move.' },
      { id: 'welcome-19', humor: 32, firmness: 38, text: 'Make it smaller if you need to. Just make it real.' },
      { id: 'welcome-20', humor: 20, firmness: 36, text: 'You can take this one step at a time. That is how steps work.' },
      { id: 'welcome-21', humor: 42, firmness: 24, text: 'The task is still there. It has excellent job security.' },
      { id: 'welcome-22', humor: 52, firmness: 35, text: 'We could plan another hour, or give the task a thrilling two minutes.' },
      { id: 'welcome-23', humor: 46, firmness: 32, text: 'Your future self has submitted a modest request: begin.' },
      { id: 'welcome-24', humor: 58, firmness: 44, text: 'Your next step does not need a committee.' },
      { id: 'welcome-25', humor: 55, firmness: 40, text: 'Let us make progress before the planning department reconvenes.' },
      { id: 'welcome-26', humor: 50, firmness: 32, text: 'The blank page has had enough screen time.' },
      { id: 'welcome-27', humor: 54, firmness: 38, text: 'You will feel more prepared after you begin. Annoying how often that works.' },
      { id: 'welcome-28', humor: 58, firmness: 42, text: 'That task has been waiting so long it may qualify for benefits.' },
      { id: 'welcome-29', humor: 60, firmness: 48, text: 'Start before your brain opens another meeting about starting.' },
      { id: 'welcome-30', humor: 48, firmness: 36, text: 'Today’s agenda: one actual thing. I know, ambitious.' },
      { id: 'welcome-31', humor: 42, firmness: 28, text: 'Call it a warm-up if that makes the first minute less dramatic.' },
      { id: 'welcome-32', humor: 40, firmness: 32, text: 'A small win is still legally a win.' },
      { id: 'welcome-33', humor: 52, firmness: 42, text: 'The plan can be elegant later. For now, it needs to exist.' },
      { id: 'welcome-34', humor: 62, firmness: 44, text: 'You do not need a new notebook or a ceremonial candle. Probably.' },
      { id: 'welcome-35', humor: 48, firmness: 46, text: 'Let us see what happens when you start the thing.' },
      { id: 'welcome-36', humor: 44, firmness: 38, text: 'You are allowed to do this the ordinary way.' },
      { id: 'welcome-37', humor: 62, firmness: 52, text: 'Less rearranging. More one small, finished step.' },
      { id: 'welcome-38', humor: 56, firmness: 50, text: 'Your to-do list has no hands. You will have to move it yourself.' },
      { id: 'welcome-39', humor: 44, firmness: 40, text: 'The deadline is not a personality test. Make a plan.' },
      { id: 'welcome-40', humor: 55, firmness: 45, text: 'Nobody has ever completed a task by thinking about its font.' },
      { id: 'welcome-41', humor: 50, firmness: 42, text: 'The task gets less mysterious once you open it. Suspicious, but true.' },
      { id: 'welcome-42', humor: 60, firmness: 42, text: 'Let us turn one of those plans into an actual thing.' },
      { id: 'welcome-43', humor: 70, firmness: 72, text: 'Pick the task you have been negotiating with and do the first two minutes.' },
      { id: 'welcome-44', humor: 66, firmness: 66, text: 'Enough rehearsing. Start the first step and reassess when it is real.' },
      { id: 'welcome-45', humor: 64, firmness: 68, text: 'Name the next action. Then do it before it grows a second head.' },
      { id: 'welcome-46', humor: 58, firmness: 70, text: 'Choose something specific. Vague plans are excellent at escaping.' },
      { id: 'welcome-47', humor: 64, firmness: 74, text: 'No more polishing the plan. Put one piece of it into motion.' },
      { id: 'welcome-48', humor: 72, firmness: 78, text: 'Set a timer, silence the debate, and begin.' },
      { id: 'welcome-49', humor: 60, firmness: 64, text: 'You already know the next step. Give it ten focused minutes.' },
      { id: 'welcome-50', humor: 74, firmness: 72, text: 'The work will not do itself. I checked. Very rude of it.' },
      { id: 'welcome-51', humor: 72, firmness: 80, text: 'Pick one thing that matters. Close the other tabs. Yes, all of them.' },
      { id: 'welcome-52', humor: 62, firmness: 68, text: 'Decide: make it smaller, reschedule it honestly, or start.' },
      { id: 'welcome-53', humor: 68, firmness: 76, text: 'Your calendar has made its case. You make the next move.' },
      { id: 'welcome-54', humor: 60, firmness: 68, text: 'You do not need to finish everything. You do need to choose something.' },
      { id: 'welcome-55', humor: 70, firmness: 76, text: 'Start with the part you keep avoiding.' },
      { id: 'welcome-56', humor: 64, firmness: 72, text: 'Make the first step concrete enough to do before you can renegotiate.' }
    ],    homeComplete: [
      { id: 'home-complete-warm', humor: 15, firmness: 20, text: 'You showed up and got things done. Let’s keep the next step manageable.' },
      { id: 'home-complete-dry', humor: 58, firmness: 42, text: 'Look at you, closing loops. Try not to make it a habit. Actually, do.' },
      { id: 'home-complete-firm', humor: 80, firmness: 75, text: 'Progress is on the record. Keep going while the momentum is here.' }
    ],
    homeOverdue: [
      { id: 'home-overdue-soft', humor: 5, firmness: 20, text: 'A few things slipped. That happens. Let’s decide what still matters.' },
      { id: 'home-overdue-dry', humor: 55, firmness: 60, text: 'The overdue list has formed a small committee. Pick one item and disappoint it.' },
      { id: 'home-overdue-firm', humor: 72, firmness: 88, text: 'Those dates are asking for a decision. Choose one task and make a dent.' }
    ],
    homePlan: [
      { id: 'home-plan-soft', humor: 8, firmness: 18, text: 'You have a plan for today. Let’s take it one step at a time.' },
      { id: 'home-plan-dry', humor: 55, firmness: 42, text: 'Today has a plan. Bold move. Let’s see it through.' },
      { id: 'home-plan-firm', humor: 72, firmness: 78, text: 'One task at a time. Start with the one you keep circling.' }
    ],
    homeClear: [
      { id: 'home-clear-soft', humor: 5, firmness: 12, text: 'Hey. I’ve got you. One thing at a time.' },
      { id: 'home-clear-dry', humor: 58, firmness: 35, text: 'A clean slate. Suspiciously full of potential.' },
      { id: 'home-clear-firm', humor: 78, firmness: 76, text: 'Pick one useful thing. The blank list can handle the news.' }
    ],
    taskAdded: [
      { id: 'task-added-soft', humor: 8, firmness: 18, text: 'Added. One less thing to keep in your head.' },
      { id: 'task-added-dry', humor: 55, firmness: 38, text: 'Added: {task}. Now it has a name and a place to be.' },
      { id: 'task-added-firm', humor: 73, firmness: 74, text: 'Added. Good. Now give it a real next step.' }
    ],
    taskCompleted: [
      { id: 'task-done-soft', humor: 8, firmness: 15, text: 'Done. Nicely handled.' },
      { id: 'task-done-dry', humor: 55, firmness: 34, text: 'That’s one less thing renting space in your head.' },
      { id: 'task-done-firm', humor: 74, firmness: 65, text: 'You did the work. Take the win, then choose what matters next.' }
    ],
    taskReopened: [
      { id: 'task-reopen-soft', humor: 4, firmness: 15, text: 'Reopened. Plans change; the list can keep up.' },
      { id: 'task-reopen-dry', humor: 55, firmness: 35, text: 'Reopened. Better an honest list than a fictional finish.' },
      { id: 'task-reopen-firm', humor: 66, firmness: 67, text: 'Back on the board. Decide when you’ll take another run at it.' }
    ],
    timerStarted: [
      { id: 'timer-start-soft', humor: 4, firmness: 20, text: 'Focus time started. One task, one step.' },
      { id: 'timer-start-dry', humor: 48, firmness: 42, text: 'Clock’s running. Make it count.' },
      { id: 'timer-start-firm', humor: 60, firmness: 80, text: 'Timer’s on. Phone down, task up.' }
    ],
    timerCompleted: [
      { id: 'timer-complete-soft', humor: 3, firmness: 15, text: 'Good session. Every minute counts.' },
      { id: 'timer-complete-dry', humor: 48, firmness: 36, text: 'Saved. Look at you, keeping receipts.' },
      { id: 'timer-complete-firm', humor: 65, firmness: 72, text: 'Session saved. Keep the next step realistic and keep moving.' }
    ],
    timerSaved: [
      { id: 'timer-save-soft', humor: 3, firmness: 12, text: 'Session saved. You can pick this up when you’re ready.' },
      { id: 'timer-save-dry', humor: 48, firmness: 34, text: 'Saved. The task stays open; no dramatic exit required.' },
      { id: 'timer-save-firm', humor: 62, firmness: 72, text: 'Session saved. The task is still there when you’re ready to return.' }
    ],
    habitAdded: [
      { id: 'habit-added-soft', humor: 4, firmness: 15, text: 'Added to today’s list. Keep it small enough to repeat.' },
      { id: 'habit-added-dry', humor: 52, firmness: 36, text: 'Added. A small promise, now officially on the books.' },
      { id: 'habit-added-firm', humor: 65, firmness: 70, text: 'Added. Consistency starts with the next check-in.' }
    ],
    habitUpdated: [
      { id: 'habit-updated-soft', humor: 4, firmness: 12, text: 'Updated. Earlier check-ins keep their original record.' },
      { id: 'habit-updated-dry', humor: 50, firmness: 32, text: 'Updated. The present is tidier; the past stays honest.' },
      { id: 'habit-updated-firm', humor: 62, firmness: 68, text: 'Updated. Keep the version that fits your actual routine.' }
    ],
    habitRemoved: [
      { id: 'habit-removed-soft', humor: 2, firmness: 10, text: 'Removed from the active list. Its history is still saved.' },
      { id: 'habit-removed-dry', humor: 50, firmness: 32, text: 'Removed. No need to keep a promise that no longer fits.' },
      { id: 'habit-removed-firm', humor: 64, firmness: 65, text: 'Removed. Make room for a habit you’re willing to keep.' }
    ],
    habitChecked: [
      { id: 'habit-check-soft', humor: 2, firmness: 12, text: 'Logged. One small promise kept.' },
      { id: 'habit-check-dry', humor: 52, firmness: 32, text: 'Nice. Small habits, big consequences.' },
      { id: 'habit-check-firm', humor: 62, firmness: 64, text: 'On the record. Consistency is built one check-in at a time.' }
    ],
    habitUnchecked: [
      { id: 'habit-uncheck-soft', humor: 2, firmness: 10, text: 'Updated. The record should match what actually happened.' },
      { id: 'habit-uncheck-dry', humor: 48, firmness: 30, text: 'Changed. Honest data beats a decorative streak.' },
      { id: 'habit-uncheck-firm', humor: 60, firmness: 64, text: 'Updated. Accuracy matters more than a perfect-looking chart.' }
    ],
    habitCopied: [
      { id: 'habit-copy-soft', humor: 3, firmness: 10, text: 'Copied. Every habit starts unchecked.' },
      { id: 'habit-copy-dry', humor: 52, firmness: 28, text: 'Yesterday’s list is back. Today still has to do the work.' },
      { id: 'habit-copy-firm', humor: 62, firmness: 58, text: 'Copied, unchecked. You get a fresh chance to show up.' }
    ],
    habitCopyAlreadySet: [
      { id: 'habit-copy-set-soft', humor: 2, firmness: 8, text: 'Today’s habit list is already set.' },
      { id: 'habit-copy-set-dry', humor: 42, firmness: 25, text: 'Today’s list is already here. No need to copy it twice.' }
    ],
    habitFresh: [
      { id: 'habit-fresh-soft', humor: 2, firmness: 10, text: 'Fresh list. Add what fits today.' },
      { id: 'habit-fresh-dry', humor: 48, firmness: 28, text: 'Blank list. No pressure to recreate yesterday’s entire personality.' },
      { id: 'habit-fresh-firm', humor: 60, firmness: 55, text: 'Fresh start. Add only what you intend to do today.' }
    ],
    categoryAdded: [
      { id: 'category-added-soft', humor: 2, firmness: 10, text: 'Category added: {name}.' },
      { id: 'category-added-dry', humor: 45, firmness: 25, text: 'Added {name}. Your habits have a new shelf.' }
    ],
    categoryUpdated: [
      { id: 'category-updated-soft', humor: 2, firmness: 10, text: 'Category changed to {name}. Past check-ins keep their old label.' },
      { id: 'category-updated-dry', humor: 42, firmness: 25, text: 'Renamed to {name}. History stays exactly where it belongs.' }
    ],
    categoryRemoved: [
      { id: 'category-removed-soft', humor: 2, firmness: 10, text: 'Category removed. Current habits moved to {fallback}; past check-ins were kept.' },
      { id: 'category-removed-dry', humor: 44, firmness: 25, text: 'Removed. Current habits moved to {fallback}; history keeps its old label.' }
    ],
    exported: [
      { id: 'export-soft', humor: 2, firmness: 8, text: 'Exported {count} focus sessions for {period}.' },
      { id: 'export-dry', humor: 42, firmness: 22, text: 'Exported. The spreadsheet now has the receipts for {period}.' }
    ],
    installInstructions: [
      { id: 'install-help-soft', humor: 2, firmness: 10, text: 'Use your browser menu and choose Install app to add MATE to this phone.' },
      { id: 'install-help-dry', humor: 38, firmness: 18, text: 'Your browser menu has the install option. MATE is ready when you are.' }
    ],
    installAccepted: [
      { id: 'install-accepted-soft', humor: 2, firmness: 8, text: 'MATE is ready on your home screen.' },
      { id: 'install-accepted-dry', humor: 40, firmness: 20, text: 'Moved in. Your task list came along.' }
    ],
    installDeclined: [
      { id: 'install-declined-soft', humor: 2, firmness: 8, text: 'No rush. You can install MATE from the browser menu later.' },
      { id: 'install-declined-dry', humor: 40, firmness: 18, text: 'No rush. MATE will wait in the browser. Patiently, apparently.' }
    ],
    installFallback: [
      { id: 'install-fallback-soft', humor: 2, firmness: 8, text: 'Use your browser menu to install MATE on this phone.' },
      { id: 'install-fallback-dry', humor: 36, firmness: 16, text: 'The install prompt wandered off. The browser menu still has it.' }
    ],
    emptyHomeTasks: [
      { id: 'empty-home-soft', humor: 5, firmness: 10, text: 'No tasks on today’s calendar. Add one when you’re ready.' },
      { id: 'empty-home-dry', humor: 62, firmness: 48, text: 'I know you’re hiding something. Add a task and let’s find out what.' },
      { id: 'empty-home-firm', humor: 90, firmness: 92, text: 'I know you’re hiding something. Now get your shit together and add those tasks here.' }
    ],
    emptyTasksCompleted: [
      { id: 'empty-done-soft', humor: 2, firmness: 8, text: 'Nothing completed in this filter yet. That’s a record, not a verdict.' },
      { id: 'empty-done-dry', humor: 42, firmness: 25, text: 'No finished tasks here yet. The green cards are waiting for actual work.' }
    ],
    emptyTasksAll: [
      { id: 'empty-all-soft', humor: 2, firmness: 8, text: 'Your task list is empty. Add one clear next step when you’re ready.' },
      { id: 'empty-all-dry', humor: 52, firmness: 28, text: 'The board is clear. Either impressive or suspicious. You decide.' }
    ],
    emptyTasksOpen: [
      { id: 'empty-open-soft', humor: 2, firmness: 8, text: 'Nothing open right now. Take the win.' },
      { id: 'empty-open-dry', humor: 48, firmness: 24, text: 'Nothing open. Look at you, making the list behave.' }
    ],
    emptyHabits: [
      { id: 'empty-habits-soft', humor: 2, firmness: 8, text: 'No habits on today’s list. Start with one that fits your actual day.' },
      { id: 'empty-habits-dry', humor: 50, firmness: 24, text: 'Pick something small enough that you cannot blame the weather.' }
    ],
    emptyHabitHistory: [
      { id: 'empty-history-soft', humor: 2, firmness: 6, text: 'There were no habits scheduled on this date.' },
      { id: 'empty-history-dry', humor: 34, firmness: 16, text: 'Nothing was scheduled that day. No backfill required.' }
    ],
    emptyFocus: [
      { id: 'empty-focus-soft', humor: 2, firmness: 8, text: 'No focus sessions in this range. Start a timer from a task to leave a record.' },
      { id: 'empty-focus-dry', humor: 45, firmness: 25, text: 'No focus sessions here yet. The timer cannot log vibes, unfortunately.' }
    ],
    emptyFocusToday: [
      { id: 'empty-focus-today-soft', humor: 2, firmness: 8, text: 'Start a task timer and this panel will list each task, time, and session length.' },
      { id: 'empty-focus-today-dry', humor: 40, firmness: 22, text: 'Give a task a timer and this panel will keep the receipts.' }
    ],
    emptyRecords: [
      { id: 'empty-records-soft', humor: 2, firmness: 8, text: 'Your daily trend will appear as you use MATE.' },
      { id: 'empty-records-dry', humor: 42, firmness: 22, text: 'No daily records yet. Nothing to analyze, which is refreshingly efficient.' }
    ],
    emptyTaskRange: [
      { id: 'empty-task-range-soft', humor: 2, firmness: 8, text: 'No tasks in this range. Add and complete a task to see your follow-through.' },
      { id: 'empty-task-range-dry', humor: 42, firmness: 22, text: 'No task records in this range. We need at least one plot point.' }
    ],
    taskCongratulations: [
      { id: 'task-congrats-soft', humor: 18, firmness: 18, text: 'Done. That task can stop taking up space in your head now.' },
      { id: 'task-congrats-dry', humor: 58, firmness: 35, text: 'Look at you, making the task nervous.' },
      { id: 'task-congrats-firm', humor: 78, firmness: 72, text: 'Well, well, well. Someone did the thing instead of adding another planning layer.' },
      { id: 'task-congrats-04', humor: 8, firmness: 12, text: 'You got it over the line. Take the win before your brain adds a sequel.' },
      { id: 'task-congrats-05', humor: 14, firmness: 18, text: 'One less open loop. That quiet feeling is yours.' },
      { id: 'task-congrats-06', humor: 18, firmness: 20, text: 'You did the thing even if the mood was not cooperating.' },
      { id: 'task-congrats-07', humor: 10, firmness: 16, text: 'Finished means finished. No extra polish required.' },
      { id: 'task-congrats-08', humor: 20, firmness: 22, text: 'A task moved from "I should" to "I did." Nice work.' },
      { id: 'task-congrats-09', humor: 6, firmness: 12, text: 'You followed through. Let that be enough for this moment.' },
      { id: 'task-congrats-10', humor: 24, firmness: 26, text: 'You made a decision and followed it through. That was the whole trick.' },
      { id: 'task-congrats-11', humor: 12, firmness: 18, text: 'One finished task is a respectable amount of finished task.' },
      { id: 'task-congrats-12', humor: 22, firmness: 28, text: 'That is work you can point to. Nicely handled.' },
      { id: 'task-congrats-13', humor: 18, firmness: 24, text: 'You started, stayed with it, and got it done. Good.' },
      { id: 'task-congrats-14', humor: 26, firmness: 30, text: 'A tiny bit less chaos. We will take it.' },
      { id: 'task-congrats-15', humor: 12, firmness: 26, text: 'One promise to yourself, kept. That matters.' },
      { id: 'task-congrats-16', humor: 44, firmness: 28, text: 'Look at that: action followed by an actual result.' },
      { id: 'task-congrats-17', humor: 52, firmness: 36, text: 'The list just got shorter. Try not to look so surprised.' },
      { id: 'task-congrats-18', humor: 48, firmness: 40, text: 'You have successfully made "later" someone else’s problem.' },
      { id: 'task-congrats-19', humor: 60, firmness: 44, text: 'The task is done and your open tabs may grieve in private.' },
      { id: 'task-congrats-20', humor: 56, firmness: 42, text: 'That task has lost its favorite hobby: bothering you.' },
      { id: 'task-congrats-21', humor: 42, firmness: 34, text: 'Progress, evidence, and a completed item. Excellent paperwork.' },
      { id: 'task-congrats-22', humor: 62, firmness: 48, text: 'Done. You may stop mentally carrying it around now.' },
      { id: 'task-congrats-23', humor: 50, firmness: 32, text: 'Very competent of you. We will both try to stay humble.' },
      { id: 'task-congrats-24', humor: 58, firmness: 46, text: 'Another loop closed. Your brain thanks you silently, as usual.' },
      { id: 'task-congrats-25', humor: 46, firmness: 38, text: 'You handled it. No elaborate postmortem required.' },
      { id: 'task-congrats-26', humor: 64, firmness: 50, text: 'The checkbox has witnessed a rare and beautiful event: follow-through.' },
      { id: 'task-congrats-27', humor: 52, firmness: 44, text: 'That is what happens when you actually start. Curious.' },
      { id: 'task-congrats-28', humor: 66, firmness: 62, text: 'You picked a next step and took it. Keep that energy sensible.' },
      { id: 'task-congrats-29', humor: 72, firmness: 70, text: 'The task is finished. Your excuses can clock out.' },
      { id: 'task-congrats-30', humor: 68, firmness: 76, text: 'Not perfect. Completed. That is the useful version.' },
      { id: 'task-congrats-31', humor: 74, firmness: 72, text: 'You finished before the calendar could send a second email.' },
      { id: 'task-congrats-32', humor: 60, firmness: 66, text: 'Take the win, then decide what actually matters next.' },
      { id: 'task-congrats-33', humor: 78, firmness: 78, text: 'The task lost. You remain undefeated by a checkbox.' },
      { id: 'task-congrats-34', humor: 64, firmness: 70, text: 'You did the work. Enjoy the brief luxury of not thinking about it.' },
      { id: 'task-congrats-35', humor: 70, firmness: 82, text: 'One more loop closed. Do not immediately open six new ones.' },
      { id: 'task-congrats-36', humor: 62, firmness: 64, text: 'Finished is a fine place to stop. Let it count.' },
      { id: 'task-congrats-37', humor: 76, firmness: 74, text: 'Excellent. The task has been returned to the land of completed things.' },
      { id: 'task-congrats-38', humor: 68, firmness: 68, text: 'You made the plan real. That is the part that counts.' },
      { id: 'task-congrats-39', humor: 82, firmness: 80, text: 'Finish line reached. Please accept this extremely official imaginary stamp.' }
    ],
    habitCongratulations: [
      { id: 'habit-congrats-soft', humor: 16, firmness: 18, text: 'One promise kept. Small habits are annoyingly effective.' },
      { id: 'habit-congrats-dry', humor: 58, firmness: 35, text: 'Consistency looks good on you. Annoying, but true.' },
      { id: 'habit-congrats-firm', humor: 76, firmness: 68, text: 'Habit checked. Your future self just filed a very small thank-you note.' },
      { id: 'habit-congrats-04', humor: 8, firmness: 12, text: 'You showed up for the habit. That counts before the streak does.' },
      { id: 'habit-congrats-05', humor: 12, firmness: 18, text: 'One check-in, one promise kept. No fireworks required.' },
      { id: 'habit-congrats-06', humor: 18, firmness: 20, text: 'You kept the appointment you made with yourself.' },
      { id: 'habit-congrats-07', humor: 10, firmness: 16, text: 'A small routine, reinforced. This is how it sticks.' },
      { id: 'habit-congrats-08', humor: 22, firmness: 22, text: 'You did not need to make it dramatic. You just did it.' },
      { id: 'habit-congrats-09', humor: 6, firmness: 12, text: 'Another small vote for the person you are becoming.' },
      { id: 'habit-congrats-10', humor: 20, firmness: 24, text: 'Great job showing up, especially if starting felt like the whole workout.' },
      { id: 'habit-congrats-11', humor: 14, firmness: 18, text: 'Your routine just got one tiny bit more believable.' },
      { id: 'habit-congrats-12', humor: 24, firmness: 28, text: 'Today’s small promise did not get ghosted.' },
      { id: 'habit-congrats-13', humor: 18, firmness: 26, text: 'You made the habit happen. Quietly solid work.' },
      { id: 'habit-congrats-14', humor: 26, firmness: 30, text: 'Small action, solid repeatable evidence.' },
      { id: 'habit-congrats-15', humor: 14, firmness: 24, text: 'You showed up again. That is how consistency gets built.' },
      { id: 'habit-congrats-16', humor: 44, firmness: 30, text: 'Habit checked. Your consistency has entered the chat.' },
      { id: 'habit-congrats-17', humor: 54, firmness: 38, text: 'That tiny checkbox is carrying a suspicious amount of momentum.' },
      { id: 'habit-congrats-18', humor: 48, firmness: 32, text: 'You made a habit of doing the habit. Meta, but useful.' },
      { id: 'habit-congrats-19', humor: 60, firmness: 44, text: 'The pattern is becoming less of a rumor.' },
      { id: 'habit-congrats-20', humor: 58, firmness: 42, text: 'Completed without a committee, mood board, or new tracking system.' },
      { id: 'habit-congrats-21', humor: 44, firmness: 32, text: 'The habit is done. Even the weather cannot claim credit.' },
      { id: 'habit-congrats-22', humor: 62, firmness: 46, text: 'Your streak can celebrate quietly in the corner.' },
      { id: 'habit-congrats-23', humor: 52, firmness: 36, text: 'Follow-through: observed in the wild.' },
      { id: 'habit-congrats-24', humor: 46, firmness: 40, text: 'Checked, logged, and no longer theoretical.' },
      { id: 'habit-congrats-25', humor: 64, firmness: 48, text: 'Look at you, making consistency look almost normal.' },
      { id: 'habit-congrats-26', humor: 56, firmness: 42, text: 'You kept the promise. That is the whole flex.' },
      { id: 'habit-congrats-27', humor: 50, firmness: 40, text: 'The habit happened. Repetition works. Rude.' },
      { id: 'habit-congrats-28', humor: 66, firmness: 64, text: 'Another rep for your future routine. Keep it repeatable.' },
      { id: 'habit-congrats-29', humor: 72, firmness: 70, text: 'You did not wait for motivation to file the necessary forms.' },
      { id: 'habit-congrats-30', humor: 68, firmness: 76, text: 'Small promise, kept. That is the whole flex.' },
      { id: 'habit-congrats-31', humor: 74, firmness: 72, text: 'Your habit escaped the land of good intentions.' },
      { id: 'habit-congrats-32', humor: 60, firmness: 66, text: 'Consistency is built on days just like this one.' },
      { id: 'habit-congrats-33', humor: 78, firmness: 78, text: 'That habit is getting more reliable than your tabs. Low bar, admittedly.' },
      { id: 'habit-congrats-34', humor: 64, firmness: 72, text: 'Keep it simple. Keep showing up.' },
      { id: 'habit-congrats-35', humor: 70, firmness: 82, text: 'The habit is checked. Let it count without adding a new rule.' },
      { id: 'habit-congrats-36', humor: 62, firmness: 64, text: 'You made today’s routine a little more real.' },
      { id: 'habit-congrats-37', humor: 76, firmness: 74, text: 'Your future self is quietly pleased. Try not to let it go to your head.' },
      { id: 'habit-congrats-38', humor: 68, firmness: 68, text: 'You may now enjoy the glamorous reward: a completed habit.' },
      { id: 'habit-congrats-39', humor: 82, firmness: 80, text: 'One more check-in. No need to turn it into a personality.' }
    ],    taskConfirmation: [
      { id: 'task-confirm-soft', humor: 2, firmness: 8, text: 'That’s it, or do you have more to add?' },
      { id: 'task-confirm-dry', humor: 44, firmness: 24, text: 'One task safely out of your head. More, or are we done here?' },
      { id: 'task-confirm-firm', humor: 62, firmness: 64, text: 'Good. Add another if it truly belongs on today’s list.' }
    ],
    switchTimer: [
      { id: 'switch-timer-soft', humor: 2, firmness: 8, text: '{task} is still running. Save that session before timing something else.' },
      { id: 'switch-timer-dry', humor: 42, firmness: 24, text: 'One timer at a time. {task} still has the floor.' },
      { id: 'switch-timer-firm', humor: 62, firmness: 65, text: 'Finish saving the session for {task} before starting another clock.' }
    ],
    timerResolution: [
      { id: 'timer-resolution-soft', humor: 2, firmness: 8, text: 'You focused on {task} for {time}. The session is ready to save.' },
      { id: 'timer-resolution-dry', humor: 44, firmness: 25, text: '{time} on {task}. Every minute is now on the record.' },
      { id: 'timer-resolution-firm', humor: 60, firmness: 64, text: '{time} on {task}. Decide whether the task is done or needs another session.' }
    ],
    statsQuiet: [
      { id: 'stats-quiet-soft', humor: 2, firmness: 8, text: 'Nothing logged for {period} yet. That’s a snapshot, not a verdict. Start with one next step.' },
      { id: 'stats-quiet-dry', humor: 42, firmness: 25, text: 'No records for {period} yet. The chart is refusing to make things up.' }
    ],
    statsNoTasksDone: [
      { id: 'stats-none-soft', humor: 2, firmness: 8, text: 'No scheduled tasks were completed in {period}. Choose what still matters and reset the plan.' },
      { id: 'stats-none-dry', humor: 44, firmness: 35, text: '{scheduled} tasks were scheduled in {period}; none were completed. Let’s make the next plan more usable.' }
    ],
    statsCombined: [
      { id: 'stats-both-soft', humor: 3, firmness: 10, text: '{completed} tasks completed and {focus} focused in {period}. That work is on the record.' },
      { id: 'stats-both-dry', humor: 48, firmness: 32, text: '{completed} tasks done, {focus} focused in {period}. The numbers brought receipts.' },
      { id: 'stats-both-firm', humor: 62, firmness: 65, text: '{completed} tasks and {focus} of focus in {period}. Keep the next commitment just as concrete.' }
    ],
    statsTasksOnly: [
      { id: 'stats-tasks-soft', humor: 2, firmness: 8, text: '{completed} tasks completed in {period}. Good progress, recorded plainly.' },
      { id: 'stats-tasks-dry', humor: 42, firmness: 28, text: '{completed} tasks completed in {period}. The list has fewer arguments now.' }
    ],
    statsFocusOnly: [
      { id: 'stats-focus-soft', humor: 2, firmness: 8, text: '{focus} of focus recorded in {period}. Keep the next step manageable.' },
      { id: 'stats-focus-dry', humor: 42, firmness: 28, text: '{focus} focused in {period}. Look at you, keeping receipts.' }
    ],
    statsHabitsOnly: [
      { id: 'stats-habits-soft', humor: 2, firmness: 8, text: '{habitsDone} habit check-ins logged in {period}. Small promises count.' },
      { id: 'stats-habits-dry', humor: 42, firmness: 28, text: '{habitsDone} check-ins in {period}. Quiet consistency is still consistency.' }
    ],
    settingsPreview: [
      { id: 'settings-preview-soft', humor: 8, firmness: 10, text: "Hey. I've got you. One thing at a time." },
      { id: 'settings-preview-dry', humor: 58, firmness: 38, text: 'The task is still there. It has excellent job security.' },
      { id: 'settings-preview-firm', humor: 75, firmness: 82, text: 'You have thought about it enough. Pick one next step and start.' }
    ]
  };

  function clamp(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : fallback;
  }

  function normalizePreferences(input) {
    return {
      humor: clamp(input && input.humor, DEFAULTS.humor),
      firmness: clamp(input && input.firmness, DEFAULTS.firmness)
    };
  }

  function getPreferences() {
    const state = MATE.data.getState();
    return normalizePreferences(state.settings && state.settings.matt);
  }

  function setPreferences(next) {
    const state = MATE.data.getState();
    const current = getPreferences();
    state.settings = state.settings || {};
    state.settings.matt = normalizePreferences({
      humor: next && next.humor != null ? next.humor : current.humor,
      firmness: next && next.firmness != null ? next.firmness : current.firmness
    });
    MATE.data.persist();
    return getPreferences();
  }

  function resetPreferences() {
    return setPreferences(DEFAULTS);
  }

  function fill(template, context) {
    return String(template).replace(/\{(\w+)\}/g, function (_, key) {
      return context && context[key] != null ? String(context[key]) : '';
    });
  }

  function choose(eventName, context, override) {
    const entries = catalog[eventName] || catalog.settingsPreview;
    const preferences = normalizePreferences(override || getPreferences());
    const safeEntries = context && context.supportive
      ? entries.filter(function (entry) { return entry.humor <= 35 && entry.firmness <= 35; })
      : entries;
    const source = safeEntries.length ? safeEntries : entries;
    const ranked = source.map(function (entry) {
      const score = Math.abs(preferences.humor - entry.humor) * 0.55 + Math.abs(preferences.firmness - entry.firmness) * 0.45;
      return { entry: entry, score: score };
    }).sort(function (a, b) { return a.score - b.score; });
    const cutoff = ranked[0].score + ((eventName === 'welcomeQuotes' || eventName === 'taskCongratulations' || eventName === 'habitCongratulations') ? 36 : 18);
    let pool = ranked.filter(function (item) { return item.score <= cutoff; }).map(function (item) { return item.entry; });
    const previous = recent[eventName] || [];
    if (pool.length > 1) {
      const fresh = pool.filter(function (entry) { return previous.indexOf(entry.id) === -1; });
      if (fresh.length) pool = fresh;
    }
    const selected = pool[Math.floor(Math.random() * pool.length)] || ranked[0].entry;
    recent[eventName] = previous.concat(selected.id).slice(-8);
    return fill(selected.text, context || {});
  }

  function message(eventName, context, override) {
    return choose(eventName, context || {}, override);
  }

  function welcomeGreeting() {
    return message('welcomeQuotes', {});
  }

  function homeGreeting() {
    const tasks = MATE.data.getState().tasks || [];
    const today = MATE.data.dateKey();
    const completed = tasks.filter(function (task) {
      return task.status === 'done' && task.completedAt && MATE.data.dateKey(task.completedAt) === today;
    }).length;
    const overdue = tasks.filter(function (task) {
      return task.status === 'open' && task.dueDate && task.dueDate < today;
    }).length;
    const dueToday = tasks.filter(function (task) {
      return task.status === 'open' && task.dueDate === today;
    }).length;
    if (completed) return message('homeComplete', { count: completed });
    if (overdue) return message('homeOverdue', { count: overdue });
    if (dueToday) return message('homePlan', { count: dueToday });
    return message('homeClear', {});
  }

  function durationLabel(milliseconds) {
    const minutes = Math.max(0, Math.round((Number(milliseconds) || 0) / 60000));
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return hours ? hours + 'h ' + String(remaining).padStart(2, '0') + 'm' : minutes + 'm';
  }

  function statsReflection(summary, period, completedCount) {
    const completed = Math.max(0, Number(completedCount) || 0);
    const scheduled = Math.max(0, Number(summary && summary.totalTasks) || 0);
    const focusMs = Math.max(0, Number(summary && summary.focusMs) || 0);
    const habits = summary && summary.habits ? summary.habits : { completed: 0 };
    const habitsDone = Math.max(0, Number(habits.completed) || 0);
    const label = String(period || 'selected range');
    if (!completed && !focusMs && !habitsDone) return message('statsQuiet', { period: label });
    if (scheduled && !completed) return message('statsNoTasksDone', { scheduled: scheduled, period: label });
    if (completed && focusMs) return message('statsCombined', { completed: completed, focus: durationLabel(focusMs), period: label });
    if (completed) return message('statsTasksOnly', { completed: completed, period: label });
    if (focusMs) return message('statsFocusOnly', { focus: durationLabel(focusMs), period: label });
    return message('statsHabitsOnly', { habitsDone: habitsDone, period: label });
  }

  function preview(preferences) {
    return choose('settingsPreview', {}, preferences || getPreferences());
  }

  MATE.matt = {
    PROFILE: PROFILE,
    DEFAULTS: DEFAULTS,
    getPreferences: getPreferences,
    setPreferences: setPreferences,
    resetPreferences: resetPreferences,
    message: message,
    welcomeGreeting: welcomeGreeting,
    homeGreeting: homeGreeting,
    statsReflection: statsReflection,
    preview: preview
  };
})(window);
