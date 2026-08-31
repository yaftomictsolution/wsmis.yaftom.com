# WSMIS Local and Cloud Synchronization

## What this feature does

The office computer runs its own Laravel API, MySQL database, file storage, and production Next.js frontend. Staff continue using the local system when the internet is slow or unavailable. When the connection is stable, an administrator opens the **Synchronization Center** and selects **Sync Now**.

The synchronization process:

1. Detects local inserts, edits, and deletions across customer, billing, finance, inventory, asset, HR, payroll, and reporting records.
2. Uploads referenced documents and photos with SHA-256 checksum validation.
3. Sends local database changes in retry-safe batches.
4. Downloads records created or changed on the website while the office computer was off.
5. Rebuilds foreign-key relationships using stable UUIDs instead of assuming numeric IDs match.
6. Compares local and cloud integrity manifests before reporting success.
7. Quarantines conflicting records for an administrator instead of silently overwriting either copy.

## Normal office workflow

### Before working without internet

1. Open the local WSMIS application.
2. Open the cloud icon in the header.
3. Select **Sync Now** and wait for 100%.
4. Select **Start Offline Work** while internet is still available.
5. The cloud website becomes read-only, and the local computer becomes the only writer.
6. Disconnecting from the internet is now safe. Continue creating customers, readings, payments, purchases, attendance, and other records locally.

### When internet becomes stable

1. Open the local WSMIS application.
2. Open **Synchronization Center**.
3. Select **Sync Now**.
4. Do not turn off the computer until progress reaches 100%.
5. Resolve any listed conflict by selecting **Keep Local** or **Use Online**.
6. Run **Sync Now** again after resolving conflicts.
7. When pending changes and conflicts are both zero, select **Return To Online Work**.

## What happens when the office computer is off

Online records remain in the cloud database. The local database remains unchanged while the computer is off. On the next synchronization, the local computer downloads all cloud changes after its last saved cursor. Delivery is idempotent, so a repeated request cannot create a duplicate record.

## Conflict behavior

A conflict is created only when the same record changed locally and online from the same earlier version.
 
- **Keep Local** rebases the local version on top of the latest cloud version and sends it during the next synchronization.
- **Use Online** replaces only that conflicted local record with the cloud version.
- Related records are not deleted or overwritten as a side effect of resolving an unrelated conflict.

Use the writer lease whenever possible. It prevents most conflicts by making the website read-only during an offline work session.

## Initial cloud setup

Back up the production database and uploaded files before the first rollout.

Set these values in the cloud Laravel `.env`:

```dotenv
SYNC_ENABLED=true
SYNC_MODE=cloud
SYNC_BATCH_SIZE=100
SYNC_LEASE_HOURS=72
SYNC_REQUEST_TIMEOUT=45
```

Then run:

```bash
php artisan migrate --path=database/migrations/2026_08_29_000000_create_offline_sync_tables.php --force
php artisan config:clear
php artisan sync:initialize
php artisan sync:register-device "Main Office Computer"
```

The final command prints a device UUID and one-time secret. Store the secret securely. Never commit it to Git or place it in the frontend environment.

## Initial local-computer setup

Use a fresh copy of the cloud database and uploaded files after the cloud baseline has been initialized. This gives both installations an identical starting point.

Set the values printed by `sync:register-device` in the local Laravel `.env`:

```dotenv
SYNC_ENABLED=true
SYNC_MODE=local
SYNC_REMOTE_URL=https://wsmis-api.yaftom.com/api
SYNC_DEVICE_UUID=the-registered-device-uuid
SYNC_DEVICE_SECRET=the-one-time-secret
SYNC_BATCH_SIZE=100
SYNC_LEASE_HOURS=72
SYNC_REQUEST_TIMEOUT=45
```

The local frontend must use the local Laravel API:

```dotenv
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api
```

Build and run production services, not development servers:

```bash
cd backend
php artisan migrate --path=database/migrations/2026_08_29_000000_create_offline_sync_tables.php --force
php artisan config:clear

cd ../frontend
npm ci
npm run build
npm start
```
For daily client use, install MySQL, Laravel/PHP, and the Next.js server as Windows services that start at login. The desktop shortcut should only open `http://127.0.0.1:3000`; the client should never need to run XAMPP, `php artisan serve`, or `npm run dev` manually.

### Simple Windows local-app launcher

This repository includes helper scripts for a single office computer:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\local-app\install-local-wsmis-startup.ps1 -ProjectRoot D:\WSMIS
```

That command creates:

- A Windows startup task named `WSMIS Local App`.
- A desktop shortcut named `WSMIS Local`.
- A hidden local backend process on `127.0.0.1:8000`.
- A hidden local frontend process on `127.0.0.1:3000`.

The shortcut runs the built production frontend with `npm start`, not `npm run dev`. MySQL is started if a normal MySQL service or XAMPP MySQL launcher is available. For a stricter production office setup, replace the launcher with dedicated Windows services for MySQL, PHP/Laravel, and Node.

To remove the startup task and shortcut:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\local-app\uninstall-local-wsmis-startup.ps1
```

## Recovery guarantees

- Local writes are committed to local MySQL before synchronization begins.
- Failed network requests leave changes pending for retry.
- Repeated requests use unique change IDs and cannot duplicate accepted rows.
- Deletions leave synchronization tombstones so an offline device cannot recreate deleted data accidentally.
- Foreign keys are transferred using stable entity UUIDs.
- File content is validated before it is accepted.
- Database uniqueness or relationship failures become conflicts and do not partially overwrite existing records.
- A final per-table manifest identifies any remaining count, version, deletion, or checksum mismatch.

## Operational safety

- Keep automated daily backups on both local and cloud databases.
- Use one registered local writer device unless multi-device synchronization is explicitly designed and tested later.
- Never reset training data in a synchronization-enabled production database.
- Do not manually edit synchronization tables.
- Do not release the local writer lease while pending changes or conflicts remain.
