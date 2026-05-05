# Security Specification for Rescue Time

## 1. Data Invariants
- A `Day` entry, `List`, or `Task` must belong to the authenticated user who created it (`uid` must match `request.auth.uid`).
- `AppSettings` must be uniquely identifiable by `userId` and belong to that user.
- Timestamps (`createdAt`, `updatedAt`) must be set using `serverTimestamp()`.
- Document IDs for `users` and `settings` must match the user's `uid`.

## 2. The "Dirty Dozen" Payloads (Malicious Payloads)
1. **Identity Spoofing (Create)**: Creating a task with someone else's `uid`.
2. **Identity Spoofing (Update)**: Changing the `uid` of an existing task to someone else's.
3. **Ghost Field Injection**: Adding an `isAdmin: true` field to a `UserProfile` document.
4. **Invalid Type (Task)**: Setting `completed` to a string instead of a boolean.
5. **Denial of Wallet (ID Poisoning)**: Using a 10KB string as a `taskId`.
6. **Denial of Wallet (Value Poisoning)**: Setting `text` to a 1MB string.
7. **Temporal Integrity Breach**: Manually setting `createdAt` to a date in the past instead of `serverTimestamp()`.
8. **Unauthenticated Write**: Trying to create a list without being logged in.
9. **Cross-User Read**: Trying to read someone else's `settings`.
10. **Terminal State Bypass**: (N/A for this app as there are no terminal states yet, but we can prevent immutable field modification).
11. **Path Variable Mismatch**: Creating a setting document where the path ID doesn't match the `uid` in the data.
12. **PII Leak**: A logged-in user trying to list all `users` profiles.

## 3. Test Runner Definition
(Logic for `firestore.rules.test.ts` described here)
- Verify `PERMISSION_DENIED` for all above payloads.
