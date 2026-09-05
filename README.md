# UDS Check-In

Customer check-in application for Universal Driveshafts (replaces the WordPress + Gravity Forms site at checkin.ushafts.com). Built with Next.js 16, Tailwind CSS 4, Drizzle ORM, Twilio, and Hostinger SMTP.

## Features

- **Per-person sign-in with roles** — every member of staff has their own profile and password. `admin` accounts get the admin panel; `tech` accounts get the check-in station plus their own performance panel. The sign-in screen is a profile picker; sessions are HMAC-signed cookies and idle auto-lock still applies to counter tablets.
- **Working-hours gate + attendance** — technicians can only sign in during the shop's posted hours (Mon–Fri 8–5, Sat 9–2, Sun closed — editable in Admin → Settings). The first sign-in of each day is recorded as their arrival time, with lateness measured against that day's shift.
- **Manual performance scoring & monthly bonus** — everyone starts each month at 100 and the score only moves when an admin moves it. The editor shows the score now, the change being made and the score that will result; severity (minor / major / critical) only *suggests* an amount, and the admin can deduct, add, or type a target score outright. Lateness and missed shifts are reported next to the score but never deducted automatically. Admins can score a job straight from the entry it happened on, and each technician sees their own score, the reason behind every change, and their bonus status at `/tech`.
- **Work-order authorship** — every check-in records who took it, and every status change records who made it.
- **6-step check-in wizard** — replicates every field of the Gravity Forms "ODESSA CHECK-IN" form, including conditional logic, existing-customer search with autofill, signature pads, VIN/product photo capture, and structured parts lines. Drafts autosave locally so a refresh never loses a half-completed check-in.
- **SMS + Email notifications** — job status changes (Confirmed / Ongoing / On hold / Completed) trigger Twilio SMS (consent-gated) and Hostinger SMTP emails, with per-status editable templates and variables like `{first_name}`, `{status}`, `{on_hold_reason}`.
- **Admin panel** — dashboard with KPIs, warnings (who is late, who has not signed in, who is underperforming) and a technician leaderboard; team scorecards and per-technician detail; a daily attendance board with a 14-day arrival pattern; searchable entries table with filters and CSV export; full entry detail with inline editing / status changer / job-quality flagging / print job sheet; template editor; message delivery log; settings (working hours, scoring rules, Twilio, SMTP, employees, locations); and a one-click Gravity Forms CSV importer.

## Development

```bash
npm install
npm run dev
```

No external services needed: with no `DATABASE_URL`, an embedded Postgres (PGlite) runs from `.data/pg`, and uploads go to `.data/uploads`. Tables are created and seeded automatically on first request.

## Deployment (Vercel)

1. Create a Postgres database (Neon / Vercel Postgres) and set `DATABASE_URL`.
2. Create a Vercel Blob store and set `BLOB_READ_WRITE_TOKEN`.
3. Set `AUTH_SECRET` to a long random string.
4. Deploy, then point `checkin.ushafts.com` at the Vercel project.
5. In **Admin → Settings**, enter Twilio credentials (SID, token, from number) and Hostinger SMTP credentials (host `smtp.hostinger.com`, port 465, mailbox + password), enable both toggles, and use the built-in test senders to verify.
6. In **Admin → Import**, upload the Gravity Forms entries CSV export to migrate historical customers and jobs.

## Accounts

The database seeds three accounts on first run (existing rows are never overwritten):

| Username | Role | Notes |
| --- | --- | --- |
| `admin` | Administrator | Full admin panel; can sign in at any hour |
| `dani.ortega` | Technician | Station + `/tech`, working hours only |
| `will.rose` | Technician | Station + `/tech`, working hours only |

Passwords are stored as scrypt hashes — the plaintext is never in the repo or the database. Add people, reset passwords and change roles in **Admin → Team → Staff accounts**; a generated password is shown once, right after it is created.

## Architecture notes

- `src/proxy.ts` — session gate (Next 16 proxy, formerly middleware). The cookie is an HMAC-signed session (`uid`, `role`, `name`, `exp`); the proxy also keeps technicians out of `/admin` and `/api/admin`.
- `src/lib/work-hours.ts` — the weekly schedule, shop-timezone conversion and the sign-in window; `src/lib/attendance.ts` records arrivals; `src/lib/performance.ts` derives the score from the admin's points ledger (attendance is reported alongside it, never scored automatically).
- `src/db/` — Drizzle schema + idempotent bootstrap (DDL + seeds) that runs once per process; works on both PGlite (dev) and Postgres (prod).
- `src/lib/notify.ts` — template rendering and Twilio/SMTP senders; every attempt is recorded in `message_log`.
- `src/lib/form-options.json` / `legal-texts.json` — dropdown options and legal texts extracted verbatim from the Gravity Forms export.
