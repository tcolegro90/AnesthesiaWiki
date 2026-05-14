# Clinical Sites Firebase Setup

Clinical Sites now supports shared cloud sync through Firestore.

## What syncs

- Site data (`appData`)
- Favorite site (`favoriteSiteId`)

## Current fallback behavior

If Firebase is not configured or unavailable:

- Clinical Sites still works normally.
- Data is saved to local browser storage only.

## Configure Firebase later

Edit [clinical-sites-firebase-config.js](clinical-sites-firebase-config.js):

```js
enabled: true,
apiKey: '...',
authDomain: '...',
projectId: '...',
storageBucket: '...',
messagingSenderId: '...',
appId: '...',
collectionName: 'clinicalSites',
documentId: 'shared'
```

## Firestore data location

- Collection: `clinicalSites`
- Document: `shared`

You can change these names in config if needed.

## Important

Use `http://` or `https://` hosting when enabling Firebase. Cloud sync is blocked on `file://`.
