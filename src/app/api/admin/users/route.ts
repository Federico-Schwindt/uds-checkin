import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getDb, employees, users } from "@/db";
import { generatePassword, hashPassword } from "@/lib/password";
import { sessionFromRequest } from "@/lib/session";
import { actorLabel } from "@/lib/auth";
import { logActivity } from "@/lib/audit";

const PUBLIC_COLUMNS = {
  id: users.id,
  username: users.username,
  name: users.name,
  role: users.role,
  title: users.title,
  phone: users.phone,
  email: users.email,
  active: users.active,
  bypassWorkHours: users.bypassWorkHours,
  lastLoginAt: users.lastLoginAt,
  createdAt: users.createdAt,
};

function requireAdmin(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (session?.role !== "admin") return null;
  return session;
}

/** "Dani Ortega" → "dani.ortega", deduped against the accounts that already exist. */
async function uniqueUsername(base: string): Promise<string> {
  const db = await getDb();
  const slug =
    base
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.|\.$/g, "") || "user";
  const existing = await db.select({ username: users.username }).from(users);
  const taken = new Set(existing.map((u) => u.username));
  if (!taken.has(slug)) return slug;
  for (let i = 2; i < 100; i++) {
    if (!taken.has(`${slug}${i}`)) return `${slug}${i}`;
  }
  return `${slug}.${Date.now()}`;
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const db = await getDb();
  const role = req.nextUrl.searchParams.get("role") || "";
  const rows = await db
    .select(PUBLIC_COLUMNS)
    .from(users)
    .where(role ? eq(users.role, role) : undefined)
    .orderBy(asc(users.role), asc(users.name));
  return NextResponse.json({ users: rows });
}

export async function POST(req: NextRequest) {
  const session = requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  const role = body.role === "admin" ? "admin" : "tech";
  const username = String(body.username || "").trim().toLowerCase() || (await uniqueUsername(name));
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
    return NextResponse.json(
      { error: "Username must be 3-40 characters: lowercase letters, numbers, dot, dash or underscore" },
      { status: 400 }
    );
  }

  const db = await getDb();
  const clash = await db.select({ id: users.id }).from(users).where(eq(users.username, username));
  if (clash.length) return NextResponse.json({ error: `Username “${username}” is already taken` }, { status: 409 });

  // Generated here and returned exactly once — only the hash is stored.
  const password = String(body.password || "") || generatePassword();
  const [row] = await db
    .insert(users)
    .values({
      username,
      name,
      role,
      title: String(body.title || "").trim(),
      phone: String(body.phone || "").trim(),
      email: String(body.email || "").trim(),
      passwordHash: hashPassword(password),
      bypassWorkHours: role === "admin" ? true : !!body.bypassWorkHours,
    })
    .returning(PUBLIC_COLUMNS);

  // Technicians must also exist as employees so jobs can be assigned to them.
  if (role === "tech") {
    const existing = await db.select({ id: employees.id }).from(employees).where(eq(employees.name, name));
    if (!existing.length) await db.insert(employees).values({ name, sortOrder: 50 });
  }

  await logActivity({
    action: "user.create",
    entity: "user",
    entityId: row.id,
    summary: `Created ${role} account “${name}” (${username})`,
    actor: actorLabel(session),
    req,
  });
  return NextResponse.json({ user: row, password });
}

export async function PUT(req: NextRequest) {
  const session = requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: "Id required" }, { status: 400 });

  const db = await getDb();
  const [current] = await db.select().from(users).where(eq(users.id, id));
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.title === "string") patch.title = body.title.trim();
  if (typeof body.phone === "string") patch.phone = body.phone.trim();
  if (typeof body.email === "string") patch.email = body.email.trim();
  if (typeof body.bypassWorkHours === "boolean") patch.bypassWorkHours = body.bypassWorkHours;
  if (body.role === "admin" || body.role === "tech") patch.role = body.role;
  if (typeof body.active === "boolean") patch.active = body.active;

  // The shop must never be left without a way into the admin panel.
  const losesAdmin =
    current.role === "admin" && ((patch.role && patch.role !== "admin") || patch.active === false);
  if (losesAdmin) {
    const others = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "admin"));
    const remaining = others.filter((u) => u.id !== id).length;
    if (remaining === 0) {
      return NextResponse.json(
        { error: "This is the only admin account — create another admin first." },
        { status: 400 }
      );
    }
  }

  let password: string | undefined;
  if (body.resetPassword) {
    password = String(body.password || "") || generatePassword();
    patch.passwordHash = hashPassword(password);
  }

  await db.update(users).set(patch).where(eq(users.id, id));

  // Keep the employees dropdown in step with a rename.
  if (typeof patch.name === "string" && patch.name !== current.name) {
    await db.update(employees).set({ name: patch.name as string }).where(eq(employees.name, current.name));
  }

  const [row] = await db.select(PUBLIC_COLUMNS).from(users).where(eq(users.id, id));
  await logActivity({
    action: password ? "user.password_reset" : "user.update",
    entity: "user",
    entityId: id,
    summary: password
      ? `Reset the password for “${current.name}”`
      : `Updated account “${current.name}”${patch.active === false ? " (deactivated)" : ""}`,
    details: password ? undefined : { ...patch, updatedAt: undefined },
    actor: actorLabel(session),
    req,
  });
  return NextResponse.json({ user: row, password });
}

/** Deactivates rather than deletes, so attendance and performance history survive. */
export async function DELETE(req: NextRequest) {
  const session = requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: "Id required" }, { status: 400 });
  if (id === session.uid) {
    return NextResponse.json({ error: "You cannot deactivate the account you are signed in with" }, { status: 400 });
  }

  const db = await getDb();
  const [current] = await db.select().from(users).where(eq(users.id, id));
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (current.role === "admin") {
    const others = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
    if (others.filter((u) => u.id !== id).length === 0) {
      return NextResponse.json({ error: "This is the only admin account." }, { status: 400 });
    }
  }

  await db.update(users).set({ active: false, updatedAt: new Date() }).where(eq(users.id, id));
  await db.update(employees).set({ active: false }).where(eq(employees.name, current.name));
  await logActivity({
    action: "user.deactivate",
    entity: "user",
    entityId: id,
    summary: `Deactivated account “${current.name}”`,
    actor: actorLabel(session),
    req,
  });
  return NextResponse.json({ ok: true });
}
