import { sql } from "drizzle-orm";
import type { Db } from "./index";
import { locations, employees, messageTemplates, settings } from "./schema";
import formOptions from "@/lib/form-options.json";

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
`;

const DEFAULT_SETTINGS: Record<string, unknown> = {
  pin: "2472026",
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
  // wizard layout (null = code defaults)
  formLayout: null,
  // editable dropdown option overrides (null/{} = code defaults)
  fieldOptions: null,
};

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
}
