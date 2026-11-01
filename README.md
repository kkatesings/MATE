# MATE

**MATE - Personal Accountability System**  
Check-MATE to your to-do list.

## Run it

Open `index.html` in a modern browser. The app has no build step, package install, backend, or external font dependency. If your browser blocks storage for local files, open the directory through any local static web server instead.

Tasks, timer sessions, habits, and history are stored in that browser profile using localStorage. Data stays on this device and does not sync to an account or another device.

See [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) for the product and architecture notes.

## Install on Android

MATE is configured as an installable Progressive Web App (PWA). It must be hosted over HTTPS; opening the local `file:///` page cannot be installed.

1. Push this project to a GitHub repository.
2. In that repository, open **Settings > Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select the branch containing these files (usually `main`), and choose `/(root)`.
4. Wait for GitHub Pages to publish the site, then open its HTTPS address on your Android phone in Chrome.

Use the **Install MATE** button if Chrome offers it, or open Chrome's menu and choose **Install app** / **Add to Home screen**. The service worker caches the app shell for offline launches after the first online visit.

MATE keeps its tasks, habits, and timer data in local browser storage on that phone. It does not sync with the desktop browser or other devices.
