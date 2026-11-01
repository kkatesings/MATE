# MATE — Project Context

## Product vision

MATE is a personal accountability system for tasks, habits, focus time, and honest progress. Its central promise is **less planning, more doing, honest feedback, measurable progress**. The official tagline is **“Check-MATE to your to-do list.”** The visible product name is always MATE.

## Brand and language

- English (US) is the default interface language.
- MATE is intelligent, direct, dryly witty, supportive, and never patronizing.
- The interface uses a dark navy/petrol Liquid Glass direction with aqua accents and emerald completion states.
- Motion is restrained and honors `prefers-reduced-motion`.

## Design system

- Background: `#07151C`; raised surface: `#0B2029`.
- Primary aqua: `#49E6DD`; secondary aqua: `#24B8C4`.
- Completed state: `#39D98A` / `#4ADE80`.
- Panels use translucent layered surfaces, subtle borders, blur, soft reflections, and controlled glow.
- A fixed, safe-area-aware bottom navigation appears on all primary screens. Its center action opens task creation.
- Responsive layouts collapse to one column on small screens and retain bottom-navigation clearance.
- The Welcome screen uses a slow, atom-like orbital animation without a large central letter mark.
- The empty Home state uses direct, cheeky MATE copy to prompt the user to add tasks.

## Architecture

The first release is a dependency-free, browser-native app. `index.html` loads ordered classic JavaScript files so the project can be opened directly without a package manager, build step, or network connection. UI, data, analytics, and interaction handling are kept in separate files under `src/`.

- `src/data.js`: centralized store, schema version, local persistence, migrations, tasks, timer sessions, habit snapshots, and MATE copy.
- `src/i18n.js`: English message catalog, locale lookup, and display-label hooks for stable category/priority values.
- `src/analytics.js`: date ranges, dashboard metrics, weekly habit performance, and statistics derived from saved records.
- `src/screens.js`: accessible screen templates and shared visual components.
- `src/app.js`: navigation, forms, timers, confirmation flows, CSV export, and live timer updates.
- `manifest.webmanifest` and `sw.js`: Android-installable PWA metadata and offline app-shell caching.
- `styles.css`: responsive Liquid Glass design system.

## Data model and persistence

The single `mate.accountability.data` localStorage record has schema version 2 and stores tasks, timer sessions, habits, user-managed categories, per-date habit snapshots/checks, the active timer, and settings. The v0-to-v2 migration keeps existing arrays, supplies default categories, and normalizes legacy statuses/snapshots. A future-version record is displayed without writes. Initial install seeds the five requested habits but does not create fake tasks or productivity metrics. IDs use `crypto.randomUUID()` when available. The app preserves unknown fields during normalization and keeps a recovery copy before replacing malformed JSON.

Timer sessions are stored individually and retain task/category, start/end timestamps, duration, and local calendar date. Analytics allocate elapsed time across local date boundaries. One persisted active timer is supported at a time. Habit snapshots retain the habit names/categories scheduled on a date; changes made today update today’s schedule while earlier snapshots and checks stay intact. Deleted habits are soft-deleted.

Persistence is local to this browser profile and does not synchronize across devices. No account or backend is configured.

## Implemented features

- Habits screen supports week-by-week navigation, selecting a day, and correcting check-ins in historical daily snapshots.
- Habit days roll over at 4:00 a.m. local time. On a new day, the Habits screen offers to copy the last saved list with every check-in cleared, or start empty for manual additions.
- Welcome screen shows a rotating, randomly selected MATE quote on each visit.
- Daily Stats show each saved focus session with its task, time, and duration; monthly focus charts use full Monday–Sunday weeks, including days at the neighboring month boundaries.
- Welcome screen with date, varied MATE greeting, tagline, entry action, and bottom navigation.
- Home dashboard with real task, focus, and habit metrics, task list, and progress indicators.
- Task creation, required-name validation, categories, priorities, due dates, project/notes fields, confirmation, and fresh “add another” form.
- Open/completed/all task filters; synchronized completion and reopen actions; green completed cards.
- Task-based timer with active-session persistence, elapsed-time restoration, one-timer rule, session accumulation, and “I’m done” / “I’ll continue later” resolution.
- Habit category manager supports adding, renaming, and deleting categories; past daily snapshots keep the category recorded at the time.
- Daily habit checks, editable/deletable habits, confirmation before deletion, historical snapshots, and a Monday–Sunday chart.
- Daily, weekly, monthly, and yearly statistics with comparisons to the previous matching period, category/task focus breakdowns, completion trends, and UTF-8 CSV export.
- Keyboard form submission, focus styles, accessible labels, reduced-motion support, and responsive layouts.
- PWA manifest with standalone display, install prompt handling where supported, atom-themed launcher icons, and a cached offline shell.

## Important technical decisions

- No third-party dependencies or remote font loads are needed to run the first release.
- A small locale catalog and stable enum-label hooks keep English as the default and provide a base for additional catalogs.
- Browser localStorage is used because this checkout has no backend or Node.js toolchain. It is suitable for a single-browser local-first release, not cloud sync.
- A dependency-free implementation was chosen to keep the empty checkout runnable without installing or downloading tools.
- Dates are formatted in English (US) and stored as local keys. Tasks and focus sessions use calendar days; Habit lists use a 4:00 a.m. local-day boundary.

## Current development phase

All requested product phases are represented in the initial implementation. The project is in **Phase 7 — polish and verification**. Browser verification is still required before claiming the requested interactions have passed.

## Known limitations and outstanding bugs

- No cloud account, synchronization, reminders, calendar integration, or AI service is configured.
- Browser privacy settings may disable localStorage; in that case the UI reports that changes are in-memory only. Data from a newer schema is read-only until this app is updated.
- Android installation requires hosting the project on HTTPS (for example, GitHub Pages). The current build is an installable web app, not an APK or Play Store package.
- The app opens as a local static page. Browser behavior for `file:` URL storage varies; if persistence is unavailable, serve this directory from localhost.
- Productivity is computed from tasks’ due date (or creation date when no due date exists) and completion timestamps. It is an activity summary, not a performance grade.
- Habit form submissions that navigated away instead of saving were found in browser review and corrected; the latest history, statistics, 4:00 a.m. Habit-day rollover, daily-list choice, category management, Stats comparisons, and Welcome quotes still need a refreshed browser review.

## Testing status

- JavaScript syntax: passed for all five app scripts using the tool-provided V8 runtime.
- Isolated integration checks: 34 assertions passed across task forms/filters/status, timer saving/switching/restoration, habit check/edit/delete history, date-boundary analytics, statistics, CSV output, schema migration, and malformed/future-schema storage.
- Follow-up habit form checks passed: add and edit actions prevent navigation, update the daily habit snapshot, persist across reload, and return to the Habits screen after adding.
- Weekly history navigation/backfill and the Daily/Monthly Stats displays were added after those isolated checks; they have not yet been reviewed in the live browser.
- The integration checks used a mock DOM and isolated localStorage; they are not a full browser or responsive-layout test.
- Browser screenshots supplied during the task showed the Welcome and Home screens rendering before the final visual/copy edits. A post-edit browser inspection could not run because both desktop automation bridges exited with a missing `kernel.js` error.
- Mobile layout and the final live-browser refresh remain to be checked.

## Future requirements

Consider a backend/account layer for synchronization, additional languages, reminders, calendar integration, richer project management, and a secure server-side AI integration. These are future possibilities and are not simulated in the current release.
