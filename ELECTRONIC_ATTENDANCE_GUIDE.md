# Electronic Attendance Device Guide

This feature is ready for ZKTeco-style fingerprint, face, card, and PIN attendance terminals, including the uFace 950 shown in the device photos.

## What the System Stores

Every device punch is saved first as an audit record. The system then matches the device user to an employee and creates one pending attendance record for that employee and date.

```
Device punch -> Raw punch log -> Employee mapping -> Pending attendance -> Manager approval -> Payroll
```

An approved attendance record is never replaced by a later device download. It is shown as a conflict for HR to review.

## Test Before Hardware Arrives

1. Sign in as HR, Manager, Admin, or Super Admin.
2. Open **People & Payroll -> Attendance -> Electronic Attendance**.
3. Click **Add Attendance Device**.
4. Select **Test simulator** as the connection method.
5. Save the device and click **Create test punches**.
6. Select an employee, choose a past or current date, then create a check-in and check-out punch.
7. Open the normal **Attendance** tab. The employee record should be pending approval.
8. Sign in as Manager or Admin and approve the attendance record.

Running the same simulator punches again will be ignored as duplicates.

## Prepare Employees

For each employee, enter the device's user ID in the employee **Biometric ID** field. For example, if the terminal shows employee user `1001`, save `1001` as the employee biometric ID.

You can also leave this blank and use **Device Mappings** in Electronic Attendance. This is safer when the device uses a different user number or card number from WSMIS.

## Use a USB Export

Use this method if the device is not on the office network.

1. Export attendance logs from the terminal to a USB drive in CSV, TXT, or DAT format.
2. In WSMIS, add the device with **USB / file import** selected.
3. Open **USB / File Import**, select the device, and upload the export file.
4. Unknown device users appear in **Punch Review**.
5. Click **Map** and select the correct employee. All waiting punches for that device user are processed together.
6. Review and approve the generated attendance records in the normal Attendance tab.

The downloadable template in this screen documents the accepted raw-punch fields.

## Use a Local Network Connection

Only use network sync from the installed local WSMIS office application, never by exposing the attendance terminal to the public internet.

1. Give the device a fixed private LAN IP, for example `192.168.1.201`.
2. Connect the device and office computer to the same router or switch.
3. In WSMIS, add the device with **Network (TCP/IP)** selected.
4. Enter the device IP, default port `4370`, and timezone `Asia/Kabul`.
5. Click **Test connection** first. Do not sync until the test succeeds.
6. Click **Sync** to download device users and punch logs.
7. Resolve any unknown users in **Punch Review**, then approve the resulting attendance records.

Do not configure public IP access, port forwarding, or cloud-to-device access. The local office application is the only component that should communicate with the terminal.

## First-Time Hardware Checklist

- Confirm the exact device model and firmware with the vendor.
- Set the correct time, date, and timezone on the device before enrolling employees.
- Create one employee test user on the device and map it in WSMIS.
- Test one check-in and one check-out before enrolling all staff.
- Keep the device serial number in the WSMIS device record for audit and support.
- If the vendor enabled a communication key or proprietary export format, request the configuration guide from them before enabling network sync. USB import remains the safe fallback.

## Troubleshooting

- **Unknown employee:** map the Device User ID to the employee in Punch Review.
- **Duplicate punch:** WSMIS has already received the same device event; no action is needed.
- **Approved attendance conflict:** correct or delete the approved attendance record only if the HR manager confirms it is wrong, then retry the punch.
- **Network test fails:** check power, LAN cable, device IP, port 4370, local firewall, and that WSMIS is running on the same office LAN.
