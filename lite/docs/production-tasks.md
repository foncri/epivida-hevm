# EPIVIDA Lite production tasks

## Remove bootstrapAdmin after initial production setup

Status: pending external confirmation.

Context: `lite/firebase/firestore.rules` currently allows one temporary
`bootstrapAdmin` path for initial setup of the first production admin profile.

Removal gate:

1. Confirm a real `users/{uid}` document exists for the production admin.
2. Confirm the profile has `role: "admin_epidemiologia"` and `active: true`.
3. Confirm the admin can open `#/admin` on `https://epivida-hevm.pages.dev/`.
4. Remove or manually gate `bootstrapAdmin` from Firestore rules.
5. Deploy Firestore rules and indexes.
6. Re-run `npm run validate:security` and `npm run validate`.

Reason: after initial setup, production admin access should depend on active
Firestore user profiles, not a hardcoded email bootstrap path.
