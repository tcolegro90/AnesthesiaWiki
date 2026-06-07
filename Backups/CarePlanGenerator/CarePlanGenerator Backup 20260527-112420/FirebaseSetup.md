# Firebase Setup For Care Plan Cloud Saves

This care plan generator can now store named plans in Firebase Firestore so the same saved plans are available across devices.

Current behavior:
- Unsaved typing still uses browser local storage.
- The Save Plan, Load Plan, Delete Plan, and Print Saved Plans actions use Firebase when configured.
- If Firebase is not configured or not reachable, the app falls back to browser local storage.

## 1. Create Firebase Project

1. Create a Firebase project in the Firebase console.
2. Add a Web app to the project.
3. Enable Firestore Database.

## 2. Fill In The Web Config

Edit [firebase-config.js](/Users/trevor/Desktop/Anesthesia Tools/Anesthesia Wiki/CarePlanGenerator/firebase-config.js) and replace the empty values with your Firebase web app config.

Set:

```js
enabled: true,
apiKey: '...'
authDomain: '...'
projectId: '...'
storageBucket: '...'
messagingSenderId: '...'
appId: '...'
```

The default Firestore collection is `carePlanSavedPlans`. You can change it with `collectionName` if needed.

## 3. Serve The App Over HTTP

Firebase web access should be used from `http://` or `https://`, not `file://`.

Examples:
- VS Code Live Server
- Python simple server
- Firebase Hosting
- Netlify
- GitHub Pages

## 4. Firestore Rules

If you want anyone with the app to read and write shared plans, start with rules like this:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /carePlanSavedPlans/{planId} {
      allow read, write: if true;
    }
  }
}
```

That is intentionally open, so only use it if you truly want public edits.

If you want tighter control later, add Firebase Authentication and restrict writes to signed-in users.

## 5. Data Shape

Each saved plan document stores:

```json
{
  "name": "AB | 2026-04-10 | 0730 | Total Hip Arthroplasty",
  "savedAt": "2026-04-10T15:20:00.000Z",
  "state": {
    "pat-initials": "AB"
  }
}
```

## 6. Practical Notes

- Existing local saved plans stay in the browser unless you re-save them after Firebase is enabled.
- The live draft state key remains local and is not synced across devices.
- If you want, the next step can be moving the live autosave state into Firebase as well.