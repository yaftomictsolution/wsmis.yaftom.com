# WSMIS Windows Installer Guide

## What the installer provides

`WSMIS-Setup-1.0.0.exe` installs a complete local WSMIS application on a 64-bit Windows computer. It includes:

- MySQL 8.4 LTS on private local port `3307`.
- The production Laravel API on `127.0.0.1:8000`.
- The production Next.js application on `127.0.0.1:3000`.
- Automatic Windows services for MySQL, Laravel, and Next.js.
- A desktop shortcut named **WSMIS**.
- Secure first-time download and verification of cloud records and uploaded files.
- Automatic database and uploaded-file backup before upgrades and uninstall.

The client does not install XAMPP, Node.js, PHP, Composer, or npm and never runs `npm start`, `npm run dev`, or `php artisan serve`.

## One-time cloud preparation

The latest backend, including the synchronization migrations and device API, must be deployed to the cloud first.

Set the cloud backend environment to:

```dotenv
SYNC_ENABLED=true
SYNC_MODE=cloud
SYNC_BATCH_SIZE=100
SYNC_LEASE_HOURS=72
SYNC_REQUEST_TIMEOUT=45
DB_TIMEZONE=+00:00
```

On the cloud backend, run the normal production migrations, clear configuration cache, and initialize the synchronization baseline once:

```bash
php artisan migrate --force
php artisan config:clear
php artisan sync:initialize
```

Do not run `sync:initialize` on a local office computer.

## Create credentials for an office computer

1. Sign in to the online WSMIS website as **Admin** or **Super Admin**.
2. Open **Settings**.
3. Open **Local Computers**.
4. Select **Add Computer**.
5. Enter a clear name such as `Main Office Computer`.
6. Keep the displayed **Cloud API**, **Device ID**, and **Device Secret** open or select **Copy All**.

The secret is shown only once. Every computer must receive its own credentials. Never reuse one computer's Device ID or secret on another computer.

## Install on the client computer

1. Copy `WSMIS-Setup-1.0.0.exe` to the client computer or a flash drive.
2. Double-click the installer.
3. Approve the Windows administrator prompt.
4. Keep the default installation folder.
5. Paste the Cloud API, Device ID, and Device Secret from the online Settings page.
6. Select **Install** and wait for setup to finish.
7. Leave **Open WSMIS** selected and select **Finish**.

During setup, WSMIS creates a private MySQL database, applies every Laravel migration, downloads cloud records and files, compares integrity manifests, starts all services, and checks both local URLs. Setup does not mark the computer ready if verification fails.

## Normal daily use

1. Start the Windows computer normally.
2. Double-click **WSMIS** on the desktop.
3. Sign in with the same WSMIS user account used online.

The three WSMIS services start automatically with Windows. XAMPP and terminal windows are not used.

## Offline work and synchronization

Before intentionally working without internet:

1. Open the cloud icon in the local WSMIS header.
2. Select **Start Offline Work** while the internet is still connected.
3. Wait until synchronization and verification reach 100%.
4. Work locally after the online website becomes read-only.

When the connection is stable again:

1. Open the cloud icon.
2. Select **Sync & Return Online**.
3. Keep the computer on until the result reaches 100% with zero pending changes and zero conflicts.
4. Confirm that **Start Offline Work** is available again.

If the computer was off while records were added online, nothing is lost. The next synchronization downloads those records to local MySQL.

## Install an update

1. Finish any offline session with **Sync & Return Online**.
2. Close browser tabs showing local WSMIS.
3. Double-click the newer `WSMIS-Setup-x.y.z.exe` file.
4. Approve the administrator prompt and complete setup.

The updater stops WSMIS services, preserves the local MySQL database and uploads, creates a safety ZIP, updates the application and schema, and restarts all services. Pairing credentials are retained and are not requested again.

## Backups and retained data

Automatic safety backups are stored in:

```text
C:\ProgramData\WSMIS\backups
```

Each ZIP contains:

- A complete MySQL SQL dump.
- Customer documents, photos, receipts, and other uploaded files.
- Local application configuration and installation state.

The ZIP contains private business data and credentials. Keep it in protected storage.

Application logs and setup errors are stored in:

```text
C:\ProgramData\WSMIS\logs
C:\ProgramData\WSMIS\setup-error.txt
```

## Uninstall behavior

Windows **Installed apps → WSMIS Local Application → Uninstall** stops and removes the three WSMIS services and application programs. The database, uploads, configuration, and backups remain under `C:\ProgramData\WSMIS` to prevent accidental data loss.

Do not manually delete `C:\ProgramData\WSMIS` unless a verified backup exists and the local data is no longer needed.

## Build a new installer as a developer

From the project root on the build computer:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\installer\build-wsmis-installer.ps1 -Version 1.0.0
```

The build creates:

```text
installer\dist\WSMIS-Setup-1.0.0.exe
installer\dist\WSMIS-Setup-1.0.0.exe.sha256
```

The build computer needs npm, Composer, XAMPP PHP, and Inno Setup. The client computer does not.
