# UDS Check-In

Customer check-in application for Universal Driveshafts (replaces the WordPress + Gravity Forms site at checkin.ushafts.com). Built with Next.js 16, Tailwind CSS 4, Drizzle ORM, Twilio, and Hostinger SMTP.

## Features

- **PIN-locked station** — the whole app sits behind a PIN pad (default `2472026`, changeable in Admin → Settings), with configurable idle auto-lock for counter tablets and in-store screens.
- **6-step check-in wizard** — replicates every field of the Gravity Forms "ODESSA CHECK-IN" form, including conditional logic, existing-customer search with autofill, signature pads, VIN/product photo capture, and structured parts lines. Drafts autosave locally so a refresh never loses a half-completed check-in.
- **SMS + Email notifications** — job status changes (Confirmed / Ongoing / On hold / Completed) trigger Twilio SMS (consent-gated) and Hostinger SMTP emails, with per-status editable templates and variables like `{first_name}`, `{status}`, `{on_hold_reason}`.
- **Admin panel** — dashboard with KPIs and status pipeline, searchable entries table with filters and CSV export, full entry detail with inline editing / status changer / print job sheet, template editor, message delivery log, settings (PIN, Twilio, SMTP, employees, locations), and a one-click Gravity Forms CSV importer.

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

## Architecture notes

- `src/proxy.ts` — session gate (Next 16 proxy, formerly middleware). Cookie is an HMAC-signed expiry token; the PIN is checked in `/api/auth/login` against the settings table.
- `src/db/` — Drizzle schema + idempotent bootstrap (DDL + seeds) that runs once per process; works on both PGlite (dev) and Postgres (prod).
- `src/lib/notify.ts` — template rendering and Twilio/SMTP senders; every attempt is recorded in `message_log`.
- `src/lib/form-options.json` / `legal-texts.json` — dropdown options and legal texts extracted verbatim from the Gravity Forms export.
