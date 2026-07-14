# Deploying UDS Check-In on Hostinger

This app is a Next.js **server** app (API routes, DB access, server rendering), so
it needs a Node.js runtime. On Hostinger that means either a **VPS** (recommended)
or a **Business/Cloud plan with Node.js app hosting**. It cannot run on plain
static/PHP shared hosting.

**You do NOT need Vercel Blob.** Photos and signatures are stored on the server's
filesystem (set `UPLOADS_DIR`). The database is **Neon Postgres** (already set up
and migrated); Hostinger is used only for hosting the app and, optionally, the
outgoing email (SMTP).

## Environment variables

Set these on the server (see `.env.example`):

- `DATABASE_URL` — your Neon connection string.
- `AUTH_SECRET` — any long random string (e.g. `openssl rand -base64 32`).
- `UPLOADS_DIR` — a persistent folder **outside** the app directory, e.g.
  `/home/<user>/uds-uploads`. Create it once: `mkdir -p /home/<user>/uds-uploads`.
- `PORT` — the port Node should listen on (Hostinger often provides/expects one).

Twilio and SMTP are configured in the app at **Admin → Settings**, not via env.

---

## Option A — VPS (recommended)

1. **Install Node 20+** and git on the VPS.
2. Clone and build:
   ```bash
   git clone https://github.com/kiwiplusapp/uds-checkin.git
   cd uds-checkin
   npm install --legacy-peer-deps
   # create .env.local with DATABASE_URL, AUTH_SECRET, UPLOADS_DIR
   npm run build
   ```
3. **Run the standalone server** (the build produces `.next/standalone`):
   ```bash
   # copy static assets next to the standalone server (one-time per build)
   cp -r .next/static .next/standalone/.next/static
   cp -r public .next/standalone/public
   node .next/standalone/server.js
   ```
   Or simply `npm start` (runs `next start`).
4. **Keep it running** with PM2:
   ```bash
   npm install -g pm2
   pm2 start "npm start" --name uds-checkin
   pm2 save && pm2 startup
   ```
5. **Reverse proxy + HTTPS**: point nginx (or Hostinger's proxy) for
   `checkin.ushafts.com` to `http://localhost:3000`, and issue a Let's Encrypt
   certificate. Update the DNS A record to the VPS IP.

## Option B — Hostinger Node.js app hosting (Business/Cloud)

1. In hPanel → **Node.js**, create an app: choose Node 20+, set the app root to
   the uploaded project, and the startup file to `node_modules/.bin/next` with
   `start`, or use the standalone `server.js`.
2. Upload the repo (git or file manager). Run **npm install** and **npm run build**
   from the Node.js panel's terminal/commands.
3. Add the environment variables in the Node.js app settings.
4. Set the app's domain to `checkin.ushafts.com`.

## Redeploys

Because `UPLOADS_DIR` and the database live outside the app folder, you can safely
`git pull && npm run build && pm2 restart uds-checkin` without losing any data.

## Tablets / kiosk

Open `https://checkin.ushafts.com` in Chrome on the tablet → menu → **Install app /
Add to Home Screen**. Launching from the icon runs fullscreen. Unlock once with the
PIN (default 2472026); the device stays unlocked per the session/idle settings.
