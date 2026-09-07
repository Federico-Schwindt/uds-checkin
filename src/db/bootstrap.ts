import { and, eq, sql } from "drizzle-orm";
import type { Db } from "./index";
import { locations, employees, messageTemplates, settings, users } from "./schema";
import formOptions from "@/lib/form-options.json";
import { DEFAULT_TIMEZONE, DEFAULT_WORK_HOURS } from "@/lib/work-hours";
import { DEFAULT_SCORING } from "@/lib/performance-config";

const DDL = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB
);
CREATE TABLE IF NOT EXISTS locations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  twilio_from TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'tech',
  password_hash TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  bypass_work_hours BOOLEAN NOT NULL DEFAULT false,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_idx ON users (username);
CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);
CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_date TEXT NOT NULL,
  first_login_at TIMESTAMP NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMP NOT NULL DEFAULT now(),
  scheduled_start TEXT NOT NULL DEFAULT '',
  arrival_minutes INTEGER NOT NULL DEFAULT 0,
  minutes_late INTEGER NOT NULL DEFAULT 0,
  late BOOLEAN NOT NULL DEFAULT false,
  logins INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS attendance_user_date_idx ON attendance (user_id, work_date);
CREATE INDEX IF NOT EXISTS attendance_date_idx ON attendance (work_date);
CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'info',
  expires_at TIMESTAMP,
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS announcements_created_idx ON announcements (created_at);
CREATE TABLE IF NOT EXISTS announcement_reads (
  id SERIAL PRIMARY KEY,
  announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS announcement_reads_idx ON announcement_reads (announcement_id, user_id);
CREATE TABLE IF NOT EXISTS requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'other',
  subject TEXT NOT NULL DEFAULT '',
  requested_date TEXT NOT NULL DEFAULT '',
  requested_end_date TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  token TEXT NOT NULL DEFAULT '',
  last_message_at TIMESTAMP NOT NULL DEFAULT now(),
  unread_for_admin BOOLEAN NOT NULL DEFAULT true,
  unread_for_user BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS requests_token_idx ON requests (token);
CREATE INDEX IF NOT EXISTS requests_user_idx ON requests (user_id);
CREATE INDEX IF NOT EXISTS requests_status_idx ON requests (status);
CREATE TABLE IF NOT EXISTS request_messages (
  id SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  author_role TEXT NOT NULL DEFAULT 'tech',
  author_name TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  via_email BOOLEAN NOT NULL DEFAULT false,
  external_id TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS request_messages_request_idx ON request_messages (request_id);
CREATE INDEX IF NOT EXISTS request_messages_ext_idx ON request_messages (external_id);
CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  street TEXT NOT NULL DEFAULT '',
  address2 TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  zip TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT 'United States',
  sms_consent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customers_phone_idx ON customers (phone);
CREATE INDEX IF NOT EXISTS customers_name_idx ON customers (last_name, first_name);
CREATE TABLE IF NOT EXISTS entries (
  id SERIAL PRIMARY KEY,
  location_id INTEGER REFERENCES locations(id),
  customer_id INTEGER REFERENCES customers(id),
  estimate_choice TEXT NOT NULL DEFAULT '',
  estimate_amount TEXT NOT NULL DEFAULT '',
  estimate_signature TEXT NOT NULL DEFAULT '',
  estimate_date TEXT NOT NULL DEFAULT '',
  vehicle_year TEXT NOT NULL DEFAULT '',
  vehicle_make TEXT NOT NULL DEFAULT '',
  vehicle_model TEXT NOT NULL DEFAULT '',
  drive TEXT NOT NULL DEFAULT '',
  axle_location TEXT NOT NULL DEFAULT '',
  cab TEXT NOT NULL DEFAULT '',
  transmission TEXT NOT NULL DEFAULT '',
  transmission_speed TEXT NOT NULL DEFAULT '',
  engine_size TEXT NOT NULL DEFAULT '',
  bed_size TEXT NOT NULL DEFAULT '',
  bed_size_other TEXT NOT NULL DEFAULT '',
  wheelbase TEXT NOT NULL DEFAULT '',
  horse_power TEXT NOT NULL DEFAULT '',
  stock_vehicle TEXT NOT NULL DEFAULT '',
  stock_vehicle_explain TEXT NOT NULL DEFAULT '',
  vin_method TEXT NOT NULL DEFAULT '',
  vin_photo TEXT NOT NULL DEFAULT '',
  vin TEXT NOT NULL DEFAULT '',
  mileage TEXT NOT NULL DEFAULT '',
  save_old_parts TEXT NOT NULL DEFAULT '',
  complaint TEXT NOT NULL DEFAULT '',
  complaint_other TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  labor_request TEXT NOT NULL DEFAULT '',
  labor_other TEXT NOT NULL DEFAULT '',
  driveshaft_pieces TEXT NOT NULL DEFAULT '',
  driveshaft_material TEXT NOT NULL DEFAULT '',
  u_joint_serial TEXT NOT NULL DEFAULT '',
  driveshaft_type_choice TEXT NOT NULL DEFAULT '',
  product_image TEXT NOT NULL DEFAULT '',
  measurement_a TEXT NOT NULL DEFAULT '',
  measurement_b TEXT NOT NULL DEFAULT '',
  measurement_c TEXT NOT NULL DEFAULT '',
  designer_type TEXT NOT NULL DEFAULT '',
  how_heard TEXT NOT NULL DEFAULT '',
  deposit NUMERIC(10,2),
  total NUMERIC(10,2),
  final_signature TEXT NOT NULL DEFAULT '',
  job_number TEXT NOT NULL DEFAULT '',
  employee_name TEXT NOT NULL DEFAULT '',
  core TEXT NOT NULL DEFAULT '',
  job_status TEXT NOT NULL DEFAULT 'New',
  on_hold_reason TEXT NOT NULL DEFAULT '',
  payment TEXT NOT NULL DEFAULT '',
  confirmation_date TEXT NOT NULL DEFAULT '',
  assigned_employee TEXT NOT NULL DEFAULT '',
  time_of_job TEXT NOT NULL DEFAULT '',
  signing_date TEXT NOT NULL DEFAULT '',
  eta_job TEXT NOT NULL DEFAULT '',
  source_entry_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS entries_status_idx ON entries (job_status);
CREATE INDEX IF NOT EXISTS entries_customer_idx ON entries (customer_id);
CREATE INDEX IF NOT EXISTS entries_created_idx ON entries (created_at);
CREATE UNIQUE INDEX IF NOT EXISTS entries_source_idx ON entries (source_entry_id);
CREATE TABLE IF NOT EXISTS assignments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_date TEXT NOT NULL,
  start_time TEXT NOT NULL DEFAULT '',
  end_time TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'task',
  title TEXT NOT NULL DEFAULT '',
  customer_name TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT '',
  entry_id INTEGER REFERENCES entries(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  seen_at TIMESTAMP,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assignments_user_date_idx ON assignments (user_id, work_date);
CREATE INDEX IF NOT EXISTS assignments_date_idx ON assignments (work_date);
CREATE INDEX IF NOT EXISTS assignments_entry_idx ON assignments (entry_id);
CREATE TABLE IF NOT EXISTS performance_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_id INTEGER REFERENCES entries(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'mistake',
  severity TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  points INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS performance_user_idx ON performance_events (user_id);
CREATE INDEX IF NOT EXISTS performance_created_idx ON performance_events (created_at);
CREATE INDEX IF NOT EXISTS performance_entry_idx ON performance_events (entry_id);
CREATE TABLE IF NOT EXISTS parts (
  id SERIAL PRIMARY KEY,
  entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  sku TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  qty INTEGER NOT NULL DEFAULT 1,
  price NUMERIC(10,2)
);
CREATE INDEX IF NOT EXISTS parts_entry_idx ON parts (entry_id);
CREATE TABLE IF NOT EXISTS status_history (
  id SERIAL PRIMARY KEY,
  entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  from_status TEXT NOT NULL DEFAULT '',
  to_status TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS status_history_entry_idx ON status_history (entry_id);
CREATE TABLE IF NOT EXISTS message_templates (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL,
  channel TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX IF NOT EXISTS templates_key_channel_idx ON message_templates (key, channel);
CREATE TABLE IF NOT EXISTS message_log (
  id SERIAL PRIMARY KEY,
  entry_id INTEGER REFERENCES entries(id) ON DELETE SET NULL,
  channel TEXT NOT NULL,
  recipient TEXT NOT NULL DEFAULT '',
  template_key TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued',
  provider_id TEXT NOT NULL DEFAULT '',
  error TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS message_log_entry_idx ON message_log (entry_id);
CREATE INDEX IF NOT EXISTS message_log_created_idx ON message_log (created_at);
CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  entity TEXT NOT NULL DEFAULT '',
  entity_id INTEGER,
  summary TEXT NOT NULL DEFAULT '',
  details JSONB,
  actor TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activity_action_idx ON activity_log (action);
CREATE INDEX IF NOT EXISTS activity_entity_idx ON activity_log (entity, entity_id);
CREATE INDEX IF NOT EXISTS activity_created_idx ON activity_log (created_at);
`;

const DEFAULT_SETTINGS: Record<string, unknown> = {
  idleLockMinutes: 15,
  sessionDays: 30,
  businessName: "Universal Driveshafts",
  adminEmail: "Orders@universaldriveshafts.com",
  turnaroundBanner: "Turnaround Time : 1-4 Days",
  helpPhone: "1-813-518-8438",
  // Twilio
  twilioAccountSid: "",
  twilioAuthToken: "",
  twilioFrom: "",
  twilioMessagingServiceSid: "",
  smsEnabled: false,
  // SMTP (Hostinger)
  smtpHost: "smtp.hostinger.com",
  smtpPort: 465,
  smtpSecure: true,
  smtpUser: "",
  smtpPass: "",
  smtpFromName: "Universal Driveshafts",
  smtpFromEmail: "",
  emailEnabled: false,
  // notify admin on each check-in
  adminNotifyEnabled: true,
  // branding — absolute URL so it also renders inside emails
  logoUrl: "https://universaldriveshafts.com/wp-content/uploads/2025/01/uds-logo-rebrand.png",
  brandColor: "#1246ab",
  // Google Places API key for address autocomplete (client-side)
  googleMapsKey: "AIzaSyBNoKUZ4FAKUvFXdoNmwds18IJgSypP9BU",
  // kiosk table columns (order + visibility)
  kioskColumns: [
    { key: "customer", visible: true },
    { key: "phone", visible: true },
    { key: "vehicle", visible: true },
    { key: "jobNumber", visible: true },
    { key: "status", visible: true },
    { key: "payment", visible: true },
    { key: "total", visible: true },
    { key: "eta", visible: true },
    { key: "date", visible: true },
  ],
  // wizard layout (legacy simple layout; superseded by formSchema)
  formLayout: null,
  // full form builder schema (null = code default schema)
  formSchema: null,
  // editable dropdown option overrides (null/{} = code defaults)
  fieldOptions: null,
  // shop schedule — technicians may only sign in inside these hours
  timezone: DEFAULT_TIMEZONE,
  workHours: DEFAULT_WORK_HOURS,
  /** How long before the shift a technician may sign in. */
  earlyLoginMinutes: 30,
  /** How long after closing sign-in still works (overtime). */
  lateLoginMinutes: 60,
  /** Technician sessions end this long after their shift. */
  shiftSessionGraceMinutes: 60,
  // performance / bonus rules
  scoring: DEFAULT_SCORING,
  // staff requests (time off, extra hours, concerns)
  requestsEmail: "moehamis@udshafts.com",
  requestsEmailEnabled: true,
  /** Mailbox polled for replies to request emails — usually the sending mailbox. */
  imapHost: "imap.hostinger.com",
  imapPort: 993,
  imapUser: "",
  imapPass: "",
  imapEnabled: false,
  /** Days ahead the panel starts celebrating a birthday / work anniversary. */
  celebrationLeadDays: 7,
};

/**
 * Seed accounts. PINs are pre-hashed so the plaintext never lives in the
 * repository or the database; the admin sets any of them from Admin → Team.
 */
const SEED_USERS: Array<{
  username: string;
  name: string;
  role: string;
  title: string;
  passwordHash: string;
  bypassWorkHours: boolean;
}> = [
  {
    username: "admin",
    name: "Administrator",
    role: "admin",
    title: "Shop Manager",
    passwordHash:
      "scrypt$16384$8$1$-cGFlYqGuqHhufOw6NY3xQ$oiz9MXVUnoNbAU6xLnesEh8hFmsMU5QHGbVVh0mNPAZVuEOvPGGaYH1JHAR8TVES1gqS4kP5bYesp_ePrnytpw",
    bypassWorkHours: true,
  },
  {
    username: "dani.ortega",
    name: "Dani Ortega",
    role: "tech",
    title: "Driveshaft Technician",
    passwordHash:
      "scrypt$16384$8$1$m2M2kHolvFZhXAZKnF8H9Q$6TImjzReBMlYXLi8bmcCSVcpvxCgrGUfslkGac7WfnkdhWf1i_DKjXqWpdjO7FxrFlLnJydKVQh_03_Z71PWXQ",
    bypassWorkHours: false,
  },
  {
    username: "will.rose",
    name: "Will Rose",
    role: "tech",
    title: "Driveshaft Technician",
    passwordHash:
      "scrypt$16384$8$1$s_gl7lcvWcqdIMWr-wOsaQ$LJzM9pSb2Ck9S8r_C9oeDLqyYWEUnzVE7CaSxZiu8uPemT-_3bw0ImIQOlLsC8aGtt61qOXmT4sGL8iO4YEkmA",
    bypassWorkHours: false,
  },
];

const SIGNOFF = "\n\nUniversal Driveshafts";

const DEFAULT_TEMPLATES: Array<{
  key: string;
  channel: "sms" | "email";
  name: string;
  subject: string;
  body: string;
}> = [
  {
    key: "submission",
    channel: "sms",
    name: "Check-in received (SMS)",
    subject: "",
    body:
      "Hello {first_name}, we have received your information and your order is awaiting confirmation. You will receive an SMS at every stage of the process. Thank you for trusting Universal Driveshafts. Reply STOP to opt out.",
  },
  {
    key: "submission",
    channel: "email",
    name: "Check-in received (Email)",
    subject: "We received your information!",
    body:
      "Hello {first_name},\n\nWe have received your information and your order is awaiting confirmation. You should receive an SMS to your phone number ({phone}) in every stage of the process.\n\nIf you need to update your contact information, please don't hesitate to reach out to us. We're here to ensure you receive the best service and support. Thank you for your trust in Universal Driveshafts." +
      SIGNOFF,
  },
  {
    key: "confirmed",
    channel: "sms",
    name: "Status: Confirmed (SMS)",
    subject: "",
    body:
      "Hello {first_name}, your Universal Driveshafts order has been CONFIRMED. We will notify you when work begins. Thank you for choosing us!",
  },
  {
    key: "confirmed",
    channel: "email",
    name: "Status: Confirmed (Email)",
    subject: "Your order has been confirmed",
    body:
      "Hello {first_name},\n\nThank you for choosing Universal Driveshafts. Your order has been confirmed and is scheduled. We will keep you updated at every stage of the process." +
      SIGNOFF,
  },
  {
    key: "ongoing",
    channel: "sms",
    name: "Status: Ongoing (SMS)",
    subject: "",
    body:
      "Hello {first_name}, your order is now IN PROGRESS. Assigned employee: {assigned_employee}. Once your order is completed we will send you a confirmation SMS. - Universal Driveshafts",
  },
  {
    key: "ongoing",
    channel: "email",
    name: "Status: Ongoing (Email)",
    subject: "Update on Your Order Status!",
    body:
      "Hello {first_name},\n\nThank you for choosing Universal Driveshafts. The current status of your order is: {status} and the assigned employee working on your order is {assigned_employee}. Once your order is completed, we will send you a confirmation SMS to your registered phone number: {phone}.\n\nIf you need to update your contact information, please don't hesitate to reach out to us. We're here to ensure you receive the best service and support." +
      SIGNOFF,
  },
  {
    key: "on_hold",
    channel: "sms",
    name: "Status: On hold (SMS)",
    subject: "",
    body:
      "Hello {first_name}, your Universal Driveshafts order is ON HOLD: {on_hold_reason}. As soon as work resumes you will receive an SMS update.",
  },
  {
    key: "on_hold",
    channel: "email",
    name: "Status: On hold (Email)",
    subject: "Important Update on Your Universal Driveshafts Order",
    body:
      "Hello {first_name},\n\nThank you for choosing Universal Driveshafts. We wanted to keep you informed regarding your order. The current status is {status} due to the following reason: {on_hold_reason}. As soon as work begins on your driveshaft or vehicle, you'll receive an SMS update at your registered phone number: {phone}.\n\nIf any of your contact details need to be updated, please reach out to us at your convenience. We're dedicated to providing you with the best service and are here to address any questions you may have.\n\nThank you again for trusting Universal Driveshafts." +
      SIGNOFF,
  },
  {
    key: "completed",
    channel: "sms",
    name: "Status: Completed (SMS)",
    subject: "",
    body:
      "Hello {first_name}, great news! Your driveshaft/vehicle is now COMPLETE and ready for pickup. Thank you for trusting Universal Driveshafts!",
  },
  {
    key: "completed",
    channel: "email",
    name: "Status: Completed (Email)",
    subject: "Your Order is Ready for Pickup!",
    body:
      "Hello {first_name},\n\nThank you for choosing Universal Driveshafts. We're pleased to inform you that your driveshaft/vehicle is now complete and ready for pickup.\n\nWe appreciate your trust in Universal Driveshafts and look forward to serving you again.\n\nBest regards,\nThe Universal Driveshafts Team",
  },
  {
    key: "admin_submission",
    channel: "email",
    name: "New check-in (Admin notification)",
    subject: "New job order from {full_name}",
    body:
      "A new check-in was submitted.\n\nCustomer: {full_name}\nPhone: {phone}\nEmail: {email}\nVehicle: {vehicle}\nJob #: {job_number}\nStatus: {status}\nDeposit: {deposit}\nTotal: {total}\n\nOpen the admin panel to view the full entry.",
  },
];

/** [username, hash shipped in the first release, hash to move it to] */
const LEGACY_PASSWORD_MIGRATIONS: Array<[string, string, string]> = [
  ["dani.ortega", "scrypt$16384$8$1$IIM1jML0nI6sFGZhVc3Y1Q$gnbVJ9O03wiuYp4K4W3FNkfOUzfJwy7cexTsJtJQ9ZIgm4zADtqVTSDC7vXNmDqU_5lAeRmAFOnTttDraengWA", "scrypt$16384$8$1$m2M2kHolvFZhXAZKnF8H9Q$6TImjzReBMlYXLi8bmcCSVcpvxCgrGUfslkGac7WfnkdhWf1i_DKjXqWpdjO7FxrFlLnJydKVQh_03_Z71PWXQ"],
  ["will.rose", "scrypt$16384$8$1$mrbpBdPDB9BRfUoEv5Ezcg$oALeUJ2pCBdXvJ0FT7HDR1PUmb1605FEmz36HndTjtN4h-6oCvNwCLpPTkqaUUALQzoUZ4Py5rcs5666BFhF9g", "scrypt$16384$8$1$s_gl7lcvWcqdIMWr-wOsaQ$LJzM9pSb2Ck9S8r_C9oeDLqyYWEUnzVE7CaSxZiu8uPemT-_3bw0ImIQOlLsC8aGtt61qOXmT4sGL8iO4YEkmA"],
];

export async function bootstrap(db: Db) {
  for (const stmt of DDL.split(";")) {
    const s = stmt.trim();
    if (s) await db.execute(sql.raw(s));
  }

  // Seed defaults only when missing (idempotent).
  const existing = await db.select().from(settings);
  const existingKeys = new Set(existing.map((r) => r.key));
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (!existingKeys.has(key)) {
      await db.insert(settings).values({ key, value });
    }
  }

  const locs = await db.select().from(locations);
  if (locs.length === 0) {
    await db.insert(locations).values({ name: "Odessa", slug: "odessa" });
  }

  const emps = await db.select().from(employees);
  if (emps.length === 0) {
    await db
      .insert(employees)
      .values(formOptions.employees.filter((n) => n !== "Other").map((name, i) => ({ name, sortOrder: i })));
  }

  const tpls = await db.select().from(messageTemplates);
  const tplKeys = new Set(tpls.map((t) => `${t.key}:${t.channel}`));
  for (const t of DEFAULT_TEMPLATES) {
    if (!tplKeys.has(`${t.key}:${t.channel}`)) {
      await db.insert(messageTemplates).values(t);
    }
  }

  // Micro-migration: entries created before locations were mandatory get the first location.
  await db.execute(
    sql.raw("UPDATE entries SET location_id = (SELECT MIN(id) FROM locations) WHERE location_id IS NULL")
  );

  // Micro-migration: JSONB bag for admin-defined custom field values.
  await db.execute(sql.raw("ALTER TABLE entries ADD COLUMN IF NOT EXISTS custom JSONB"));

  // Micro-migration: soft-delete marker for entries.
  await db.execute(sql.raw("ALTER TABLE entries ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP"));
  await db.execute(sql.raw("CREATE INDEX IF NOT EXISTS entries_deleted_idx ON entries (deleted_at)"));

  // Micro-migration: who took the check-in.
  await db.execute(sql.raw("ALTER TABLE entries ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER"));
  await db.execute(
    sql.raw("ALTER TABLE entries ADD COLUMN IF NOT EXISTS created_by_name TEXT NOT NULL DEFAULT ''")
  );
  await db.execute(
    sql.raw("ALTER TABLE status_history ADD COLUMN IF NOT EXISTS changed_by TEXT NOT NULL DEFAULT ''")
  );

  // Micro-migration: birthdays and hire dates on staff profiles.
  await db.execute(sql.raw("ALTER TABLE users ADD COLUMN IF NOT EXISTS birthday TEXT NOT NULL DEFAULT ''"));
  await db.execute(sql.raw("ALTER TABLE users ADD COLUMN IF NOT EXISTS hired_on TEXT NOT NULL DEFAULT ''"));

  // The first release shipped alphanumeric passwords for the two technicians;
  // sign-in is a numeric keypad now, so those cannot be typed. Move them onto a
  // PIN, but only while the account still carries the password we shipped — a
  // PIN the admin has already set is left alone.
  for (const [username, wasHash, nowHash] of LEGACY_PASSWORD_MIGRATIONS) {
    await db
      .update(users)
      .set({ passwordHash: nowHash, updatedAt: new Date() })
      .where(and(eq(users.username, username), eq(users.passwordHash, wasHash)));
  }

  // Seed staff accounts. Existing rows are never overwritten, so PIN changes
  // and renames made in the admin panel survive a redeploy.
  const existingUsers = await db.select({ username: users.username }).from(users);
  const usernames = new Set(existingUsers.map((u) => u.username));
  for (const u of SEED_USERS) {
    if (!usernames.has(u.username)) await db.insert(users).values(u);
  }

  // Technicians also need an employees row so they appear in the job dropdowns.
  const empRows = await db.select({ name: employees.name }).from(employees);
  const empNames = new Set(empRows.map((e) => e.name));
  for (const u of SEED_USERS) {
    if (u.role === "tech" && !empNames.has(u.name)) {
      await db.insert(employees).values({ name: u.name, sortOrder: 50 });
    }
  }
}
