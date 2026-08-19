# School ERP LAN Deployment Guide

## Recommended architecture

Use one Windows/Linux computer as the **School ERP Server**. It hosts:

- the Express API;
- the built React workspace;
- the local SQLite database;
- the uploads directory; and
- the backups directory.

All client computers open the ERP through a browser at the server URL. Client computers **must not open, copy, or mount the SQLite database file directly**.

```text
Client Browser ────── HTTP/LAN ──────> Server PC: Express + SQLite + uploads
Client Browser ────── HTTP/LAN ──────> Server PC: Express + SQLite + uploads
Client Browser ────── HTTP/LAN ──────> Server PC: Express + SQLite + uploads
```

## 1. Prepare the server PC

1. Install Node.js LTS.
2. Copy the project to a local server drive, for example:

   ```text
   C:\SchoolERP
   ```

3. Do **not** place the database on a network share, Dropbox, OneDrive, Google Drive, or NAS-mounted SQLite folder.
4. Open a terminal in the project folder:

   ```bash
   npm install
   npm run build
   ```

5. Create a production environment file:

   ```env
   PORT=3299
   JWT_SECRET=replace-with-a-long-private-random-secret
   DATABASE_PATH=C:\SchoolERP\data\school.db
   UPLOAD_DIR=C:\SchoolERP\data\uploads
   BACKUP_DIR=C:\SchoolERP\data\backups
   SERVE_RENDERER=true
   ```

6. Start LAN server mode:

   ```bash
   npm run start:lan
   ```

The server hosts both the frontend and API on one address:

```text
http://SERVER-IP:3299
```

Example:

```text
http://192.168.1.50:3299
```

## 2. Assign a static server IP

Configure the server PC with a static IPv4 address from the school router, for example:

```text
IP address: 192.168.1.50
Subnet mask: 255.255.255.0
Gateway: 192.168.1.1
DNS: router DNS or 8.8.8.8
```

Alternatively, reserve the server MAC address in the school router DHCP settings. A stable IP is important because clients bookmark this address.

## 3. Windows Firewall

On the server PC, allow inbound TCP traffic for the selected port.

PowerShell as Administrator:

```powershell
New-NetFirewallRule -DisplayName "School ERP LAN" -Direction Inbound -Protocol TCP -LocalPort 3299 -Action Allow
```

Verify from a client browser:

```text
http://192.168.1.50:3299/api/health
```

Expected response:

```json
{"success":true,"data":{"status":"ok"}}
```

## 4. Configure client PCs

1. Connect each client PC to the same LAN/Wi-Fi/VLAN.
2. Open a supported modern browser.
3. Browse to:

   ```text
   http://SERVER-IP:3299
   ```

4. Add a desktop shortcut or browser bookmark.
5. Each staff member signs in with their own account.

Because server mode serves the frontend and API from the same origin, uploads, print templates, reports, and asset paths remain correct without client-side SQLite files.

## 5. Upload sharing

Uploads are stored only on the server at the configured `UPLOAD_DIR`.

- The server exposes uploaded photos/documents through authenticated ERP workflows.
- Client browsers access them through the same server URL.
- Back up uploads together with the SQLite database.
- Do not configure individual client upload folders.

## 6. Backup strategy

Use **Settings → Backup & restore** on the server account.

Recommended schedule:

| Frequency | Action |
| --- | --- |
| Daily | Create a SQLite backup after school hours |
| Weekly | Download/copy backup plus uploads to encrypted external storage |
| Monthly | Test restore to a separate test computer/database |
| Before updates | Create and verify a backup |

Keep a copy of both:

```text
school.db backup file
uploads folder
```

## 7. Restore strategy

1. Inform users to stop work.
2. Create a fresh backup of the current state.
3. In **Settings → Backup & restore**, select the desired `.db`, `.sqlite`, or `.sqlite3` file.
4. Confirm restore.
5. The ERP creates a pre-restore safety copy, replaces the database, and signs out active users.
6. Verify login, data counts, uploads, reports, and recent transactions.

## 8. SQLite multi-user limitations

SQLite is appropriate for a small school when:

- only the server process opens the database file;
- all clients connect through Express over HTTP;
- the database remains on the server’s local SSD; and
- concurrent write volume is moderate.

The ERP enables WAL mode and a busy timeout, which improves normal concurrent reads/writes. However, SQLite still permits one writer at a time. Avoid direct file sharing.

### Move to PostgreSQL/MySQL when

Use PostgreSQL (recommended) or MySQL when the school needs:

- more than roughly 10–20 simultaneous heavy users;
- multiple branches/campuses;
- high-frequency biometric/device imports;
- hosted cloud access/VPN access;
- advanced reporting workloads; or
- database replication/high availability.

A future PostgreSQL migration should keep the same Express API contract so client workflows remain unchanged.

## 9. Operational recommendations

- Use a UPS for the server PC/router.
- Configure automatic server startup with Windows Task Scheduler, NSSM, systemd, or PM2.
- Use strong unique passwords for every staff account.
- Keep the server PC physically secure.
- Restrict router guest Wi-Fi from the ERP VLAN.
- Review backup restoration quarterly.
