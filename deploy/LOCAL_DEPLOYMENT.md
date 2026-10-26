# UFHPTI shared portal deployment plan

Current target: one always-on, IT-managed UFHPTI computer serving the shared portal to staff browsers on the hospital network. AWS and changes to floridaphysics.org are deferred.

## Storage decision

Recommended: the live SQLite database stays on the host's local disk. A scheduled task creates verified snapshots on the shared drive. Other computers never open the SQLite file; they use the portal URL. All users therefore see the same central records.

Do not put the live database in SMB/NFS, a mapped network drive, OneDrive or Google Drive synchronization. The current database uses WAL; SQLite documents that WAL does not work on network filesystems: https://sqlite.org/wal.html. If the live database must be independent of this computer, use an IT-hosted database service and implement a PostgreSQL backend first; that backend is not implemented yet.

The user confirmed the plan: local live database with shared-drive backups. The actual computer, DNS name, TLS certificate, service account and shared backup folder must be supplied by UFHPTI IT. No workstation or AWS resources have been changed by this preparation.

## Roles and workflow

- Admin: users, setup, operational administration. Admin is not a substitute for a therapist or medical physicist's required sign-off.
- Physicist: QA, setup, and review. A different user must review a run than performed it.
- Therapist: QA entry and therapist sign-off.
- MPA: QA entry and results/trends, without setup or sign-off. This restricted default awaits confirmation of the desired MPA policy.

Lists containing a therapist review/approval item, or `[approval: therapist]` in a test description, require therapist sign-off after submission and then final review by a Physicist. A Yes checkbox does not satisfy the therapist sign-off. Signers, timestamps and audit events are stored. Existing completed/historical records are not silently re-approved. Browser-only GitHub Pages is still a demo with role selection, not an authenticated deployment.

## Native Windows setup (IT-managed)

1. Install a supported Python runtime and create a virtual environment in the application directory. Install `requirements-deploy.txt`.
2. Pick a local, access-controlled data directory, for example `C:\ProgramData\UFHPTI-QA\portal.db`. The Windows service identity needs write access to that directory, including SQLite WAL/SHM files.
3. Create the first administrator interactively, then seed an empty database if appropriate:

   ```powershell
   .\.venv\Scripts\python.exe run_portal.py --db C:\ProgramData\UFHPTI-QA\portal.db create-admin
   .\.venv\Scripts\python.exe run_portal.py --db C:\ProgramData\UFHPTI-QA\portal.db seed-defaults
   ```

4. Have IT allocate an internal HTTPS hostname and certificate. Set the external origin exactly, without a path:

   ```powershell
   $env:PORTAL_ORIGIN = "https://HOSTNAME-ASSIGNED-BY-IT"
   $env:PROTON_QA_DB = "C:\ProgramData\UFHPTI-QA\portal.db"
   $env:PORTAL_BIND_HOST = "127.0.0.1"
   .\.venv\Scripts\python.exe deploy\serve.py
   ```

5. Put an IT-managed TLS reverse proxy in front of `127.0.0.1:8790`. Bind only the proxy to the hospital network. For Caddy, `deploy/Caddyfile.local.example` uses IT-supplied certificate files. Alternatively use the hospital's existing HTTPS proxy. Do not distribute an HTTP address or expose the Python backend port to staff PCs.
6. IT should run the application and proxy as automatically restarting services under a dedicated service identity, disable sleep for the host, restrict inbound access to the required network, and control local/backup-folder ACLs. Registering services requires local administrative access; this has not been done remotely.
7. Create each person's account in Data Administration with their actual role. The shared server uses passwords; it does not serve `docs/local-backend.js` or the browser demo login gate.

## Shared-drive backup

IT's service account should use the share's UNC path, because mapped drive letters may not exist for scheduled tasks. Test write permissions under that same identity. No password should appear in commands or task arguments.

```powershell
.\.venv\Scripts\python.exe deploy\backup.py --db C:\ProgramData\UFHPTI-QA\portal.db --destination "\\SERVER\SHARE\QA-Backups"
```

The tool first uses SQLite's backup API to make a consistent local snapshot, checks integrity, then copies it to a temporary file on the share and renames it only after the copy succeeds. It fails if the share is unavailable and never moves the live database there. Use Windows Task Scheduler for hourly backups and monitor nonzero exit codes. Agree on retention with IT; the tool never deletes old backups automatically.

Restore drill: stop the application service, preserve the current DB and its WAL/SHM together, copy a verified snapshot onto the local DB path, remove only the old WAL/SHM after preserving them, restore ACLs and restart. Validate sign-in, run counts, recent results, approvals and audit entries. Perform this in a test directory before relying on backups.

## Existing browser data

GitHub Pages and localhost data are separate. Back up the chosen browser database before rollout. Existing browser records are not automatically merged into the SQL server. A verified browser-to-server migration must be planned before switching staff to the new shared portal; do not assume the demo's data automatically appears on the server.

## Capacity and remaining rollout checks

There is no hard user-count limit. The prepared server uses Waitress with 16 request threads and a 256-connection limit, one local SQLite database, server-enforced roles, HttpOnly/Secure/SameSite cookies, origin checks, bounded login throttling and audit logging. These settings are not a guarantee of production capacity. The final host needs realistic concurrent login/entry/import testing, backup restoration, and a UFHPTI acceptance review before staff rollout. Docker packaging is provided as an alternative; it has not been built on this Mac because Docker is unavailable here.

Waitress documentation: https://docs.pylonsproject.org/projects/waitress/en/latest/arguments.html
