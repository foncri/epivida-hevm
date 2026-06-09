# EPIVIDA Lite production tasks

## Remove bootstrapAdmin after initial production setup

Status: ready to deploy.
GitHub issue: https://github.com/foncri/epivida-hevm/issues/5

Context: the first production admin profile was confirmed externally. The
temporary `bootstrapAdmin` path has been removed from
`lite/firebase/firestore.rules`; the remaining manual step is deploying
Firestore rules and indexes.

Removal gate:

1. Confirm a real `users/{uid}` document exists for the production admin.
2. Confirm the profile has `role: "admin_epidemiologia"` and `active: true`.
3. Confirm the admin can open `#/admin` on `https://epivida-hevm.pages.dev/`.
4. Deploy Firestore rules and indexes.
5. Re-run `npm run validate:security` and `npm run validate`.

Reason: after initial setup, production admin access should depend on active
Firestore user profiles, not a hardcoded email bootstrap path.
