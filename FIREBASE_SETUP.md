# Firebase setup for MATE

This project is prepared for Firebase Authentication with Google and Cloud Firestore. Cloud sign-in stays disabled until Firebase is configured and the privacy notice is complete.

## 1. Create the Firebase project

1. Open [Firebase Console](https://console.firebase.google.com/) and sign in with the Google account that will own MATE's backend.
2. Choose Add project and name it MATE (or another name you prefer).
3. Google Analytics is not needed for this app; leave it off unless you specifically want it.

The Firebase project belongs to you. It is separate from the public GitHub repository.

## 2. Register MATE as a web app

1. Open the new project's overview page and select the web app icon.
2. Give the app a name such as MATE Web.
3. Register the app. Firebase Hosting is not required for this setup.
4. Copy the Firebase config values shown on screen. MATE needs apiKey, authDomain, projectId, and appId.
5. In the local project, open src/firebase-config.js and replace its four placeholders with those values.

The Firebase web config is public client configuration. Do not put a service account, Admin SDK private key, or other server secret in this file or in GitHub.

## 3. Enable Google sign-in

1. In Firebase Console, open Authentication and choose Get started if prompted.
2. Open Sign-in method (or Sign-in providers), select Google, enable it, choose a support email, and save.
3. In Authentication settings, open Authorized domains and add kkatesings.github.io.
4. Open the app through its HTTPS GitHub Pages URL; file:///... cannot complete Google sign-in. Add localhost only if you deliberately test through a local web server, and remove it before inviting testers.

If the GitHub Pages account or site URL changes, add its hostname here. Enter only the hostname, without https:// or the /MATE path.

## 4. Create Cloud Firestore

1. Open Firestore Database. If the database already exists, confirm its location is `eur3` (Europe multi-region). If you have not created it yet, choose Production mode and `eur3` before creating it.
2. Before saving app data, open the Rules tab, replace the rules with the contents of this repository's firestore.rules, and publish them.

Choose the region carefully: Firebase says a Firestore database's location cannot be changed after it is provisioned. The included rules allow a signed-in user to read and write only under that user's own UID path; do not replace them with open/test rules.

## 5. Complete the privacy notice before publishing or inviting testers

The app intentionally does not enable cloud sync while src/privacy-config.js says ready is false. Before publishing the app with account features enabled, complete privacy.html and decide:

- The data controller's full name or organization name and a contact email.
- The legal basis for optional Google sign-in and cloud sync is explicit, specific, informed, freely given consent. The local-only app remains available without it; the legal basis for local browser storage must be finalized separately.
- Data retention periods, including what service-provider logs/backups may retain.
- The selected Firestore region and the processor/transfer details that apply to this Firebase project.
- The account deletion / cloud data deletion flow, plus the applicable contract and international-transfer terms for this Firebase project. Current Firebase terms place Cloud Firestore and Firebase Authentication under Google Cloud Platform terms; do not assume the separate Firebase Data Processing and Security Terms govern those two services.
- How users will be told about material changes to the notice.

Important location and terms detail: the Firebase project's Firestore database is in eur3 (Europe multi-region), but Firebase Authentication operates exclusively from US data centers according to Google's current Firebase privacy documentation. Authentication data can therefore be processed in the United States. Google says Firebase Authentication IP logs are kept for a few weeks and other authentication information is removed from live and backup systems within 180 days after deletion is initiated; that retention statement is for Authentication and should not be presented as the Firestore retention period. Google's current [Firebase Terms](https://firebase.google.com/terms) list Cloud Firestore and Firebase Authentication under Google Cloud Platform Terms, and Google's [Firebase privacy and security information](https://firebase.google.com/support/privacy) says GCP-governed Firebase services are covered by the associated [Cloud Data Processing Addendum](https://cloud.google.com/terms/data-processing-addendum). Confirm the applicable project contract and transfer safeguards before enabling sync. The separate Firebase Data Processing and Security Terms apply to the Firebase services listed under those terms, not automatically to Firestore/Auth. GitHub Pages also logs visitors' IP addresses for security; see its [Pages data collection note](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) and [Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).

The repository contains `LEGITIMATE_INTEREST_ASSESSMENT_DRAFT.md` as an internal proposal for local browser storage. It is not approved as final. Check the local-storage analysis separately from cloud consent, including the ePrivacy device-storage rule, the right to object, the in-app delete/export controls, and the data controller's role. New local-only installs do not request the Firebase SDK from Google's CDN. A browser previously linked to a cloud account still loads the SDK so its account can be managed.

The consent checkbox is a separate, unticked opt-in for Google sign-in and cloud sync, not a blanket acceptance of the privacy notice. It identifies the purpose; users can refuse and keep using local mode, or later withdraw consent and delete their cloud account and data. Consider getting a qualified privacy review before inviting testers.

After the notice and all legal details are complete, update its version and ready value in src/privacy-config.js. Users must give explicit cloud-sync consent before Google sign-in starts. Declining keeps MATE in local-only mode. Withdrawing consent deletes the Firebase account and MATE cloud data while keeping local data on the current device.

## 6. Publish and connect the web app

1. Make sure Steps 1–5 are complete.
2. Upload the full MATE project, including the src folder, firestore.rules, and the final privacy.html, to the GitHub repository.
3. Open the HTTPS GitHub Pages URL and reload the app. Do not test Google sign-in from a file:/// URL.
4. Confirm Google sign-in works with your own account before inviting anyone else.

## 7. Check account controls

While signed in, MATE provides Export data (downloads a JSON copy) and Delete account (requires Google re-authentication, deletes this Firebase account and its MATE cloud documents, and clears the current browser's MATE data). Local copies on other devices must be cleared on those devices too.

## 8. Verify access before inviting testers

1. [x] The owner confirmed the published rules match `firestore.rules` and are not open/test rules.
2. [x] The owner confirmed the Rules Playground results in this order: unauthenticated read denied, Google user read under their own UID allowed, same user under another UID denied. The latest rules were then published.
3. In Google Cloud Console > APIs & Services > Credentials, confirm the Firebase web API key is restricted to Firebase-related APIs and is not enabled for unrelated paid services. Firebase API keys identify the project; Firestore Security Rules and App Check are the authorization controls.
4. Confirm the GitHub Pages hostname is the only production Authorized Domain needed for Google sign-in. Do not invite testers until Google login, account deletion, export, consent refusal, and consent withdrawal have been checked on the HTTPS site.

Firebase documents the [API key guidance](https://firebase.google.com/docs/projects/api-keys) and [Firestore Rules simulator](https://firebase.google.com/docs/firestore/security/get-started). App Check can be considered as an additional abuse-prevention layer later; it does not replace Security Rules.

