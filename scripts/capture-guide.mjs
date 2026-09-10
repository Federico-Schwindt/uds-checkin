/**
 * Retakes the pictures in the employee guide.
 *
 * Run it against a dev server holding test data — never against production,
 * because these images are committed and a real customer's name would go with
 * them.
 *
 *   npm run dev
 *   npm i --no-save playwright        # not a project dependency; only this needs it
 *   node scripts/capture-guide.mjs [--base http://localhost:3000]
 *
 * Credentials come from the environment so nothing is hard-coded here:
 *   GUIDE_ADMIN_USER / GUIDE_ADMIN_PIN   (default: admin)
 *   GUIDE_TECH_USER  / GUIDE_TECH_PIN    (optional; falls back to the admin)
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";

const { chromium } = await import("playwright").catch(() => {
  console.error("This script needs Playwright, which the app itself does not:\n  npm i --no-save playwright");
  process.exit(1);
});

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};

const BASE = arg("base", process.env.GUIDE_BASE || "http://localhost:3000");
const OUT = path.resolve("public/guide");
const VIEWPORT = { width: 1280, height: 860 };

const ADMIN = { user: process.env.GUIDE_ADMIN_USER || "admin", pin: process.env.GUIDE_ADMIN_PIN };
const TECH = { user: process.env.GUIDE_TECH_USER, pin: process.env.GUIDE_TECH_PIN };

if (!ADMIN.pin) {
  console.error("Set GUIDE_ADMIN_PIN (and optionally GUIDE_TECH_USER / GUIDE_TECH_PIN) before running.");
  process.exit(1);
}

const shots = [];

async function signIn(page, who) {
  await page.goto(`${BASE}/lock`, { timeout: 90_000 });
  const ok = await page.evaluate(async (creds) => {
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: creds.user, password: creds.pin }),
    });
    return r.ok;
  }, who);
  if (!ok) throw new Error(`could not sign in as ${who.user}`);
}

async function shoot(page, name, { path: route, wait = 1200, clip, full = false, before, viewport } = {}) {
  // A centred screen photographs badly on a wide window — narrow it instead of
  // shipping a picture that is mostly empty background.
  if (viewport) await page.setViewportSize(viewport);
  if (route) await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 90_000 });
  if (before) await before(page);
  await page.waitForTimeout(wait);
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, clip, fullPage: full });
  if (viewport) await page.setViewportSize(VIEWPORT);
  shots.push(name);
  console.log("  ✓", name);
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
// The dev-server badge is not part of the app; employees should never see it.
await page.addInitScript(() => {
  const css = "nextjs-portal,[data-nextjs-toast],#__next-build-watcher{display:none!important}";
  const add = () => {
    const el = document.createElement("style");
    el.textContent = css;
    document.head?.appendChild(el);
  };
  if (document.head) add();
  else document.addEventListener("DOMContentLoaded", add);
});
await mkdir(OUT, { recursive: true });

try {
  console.log("Signed out screens");
  await page.goto(`${BASE}/lock`, { timeout: 90_000 });
  await page.evaluate(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
  });
  await shoot(page, "sign-in", { path: "/lock", wait: 1800, viewport: { width: 720, height: 900 } });

  console.log("Shop floor");
  await signIn(page, TECH.user && TECH.pin ? TECH : ADMIN);
  await shoot(page, "jobs", { path: "/" });
  await shoot(page, "nav", { path: "/", clip: { x: 0, y: 0, width: VIEWPORT.width, height: 132 } });
  await shoot(page, "quick-edit", {
    path: "/",
    before: async (p) => {
      await p.locator('table tbody tr').first().locator('button[title="Click to change status"]').click();
      await p.waitForTimeout(400);
    },
  });
  await shoot(page, "row-editor", {
    path: "/",
    before: async (p) => {
      await p.locator('table tbody tr').first().locator('button[title="Quick edit every field"]').click();
      await p.waitForTimeout(500);
    },
  });
  await shoot(page, "new-checkin", {
    path: "/",
    before: async (p) => {
      await p.locator('button:has-text("New check-in"), a:has-text("New check-in")').first().click();
      await p.waitForTimeout(600);
    },
  });

  const firstJob = await page.evaluate(async () => {
    const j = await (await fetch("/api/entries?page=1&pageSize=1")).json();
    return j.rows?.[0]?.id ?? 1;
  });
  await shoot(page, "job-page", { path: `/entry/${firstJob}`, wait: 1500 });

  if (TECH.user && TECH.pin) {
    await signIn(page, TECH);
    await shoot(page, "my-panel", { path: "/tech", wait: 1500 });
    await shoot(page, "requests-tech", {
      path: "/tech",
      wait: 1500,
      before: async (p) => {
        await p.evaluate(() => {
          const h = [...document.querySelectorAll("h2, h3")].find((x) => /request/i.test(x.textContent || ""));
          h?.scrollIntoView({ block: "center" });
        });
      },
    });
  } else {
    console.log("  (skipped my-panel / requests-tech — set GUIDE_TECH_USER and GUIDE_TECH_PIN)");
  }

  console.log("Admin");
  await signIn(page, ADMIN);
  await shoot(page, "admin-dashboard", { path: "/admin", wait: 1600 });
  await shoot(page, "admin-attendance", { path: "/admin/attendance", wait: 1400 });
  await shoot(page, "admin-schedule", { path: "/admin/schedule", wait: 1600 });
  await shoot(page, "admin-requests", { path: "/admin/requests", wait: 1400 });
  await shoot(page, "admin-activity", { path: "/admin/activity", wait: 1400 });

  const techId = await page.evaluate(async () => {
    const j = await (await fetch("/api/admin/users")).json();
    const list = j.users || j.rows || j;
    return Array.isArray(list) ? list.find((u) => u.role === "tech")?.id : undefined;
  });
  if (techId) {
    await shoot(page, "admin-score", {
      path: `/admin/team/${techId}`,
      wait: 1600,
      before: async (p) => {
        await p.evaluate(() => {
          const h = [...document.querySelectorAll("h2, h3")].find((x) => /adjust the score/i.test(x.textContent || ""));
          h?.scrollIntoView({ block: "center" });
        });
      },
    });
  } else {
    console.log("  (skipped admin-score — no technician account found)");
  }

  console.log(`\n${shots.length} pictures written to public/guide`);
} finally {
  await browser.close();
}
