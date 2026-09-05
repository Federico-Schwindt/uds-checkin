import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  numeric,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value"),
});

export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  twilioFrom: text("twilio_from"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Staff accounts. `admin` runs the shop panel; `tech` signs in on the floor. */
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    username: text("username").notNull(),
    name: text("name").notNull(),
    role: text("role").notNull().default("tech"), // admin | tech
    passwordHash: text("password_hash").notNull().default(""),
    title: text("title").notNull().default(""),
    phone: text("phone").notNull().default(""),
    email: text("email").notNull().default(""),
    active: boolean("active").notNull().default(true),
    /** Lets a non-admin sign in outside the posted opening hours. */
    bypassWorkHours: boolean("bypass_work_hours").notNull().default(false),
    lastLoginAt: timestamp("last_login_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_username_idx").on(t.username), index("users_role_idx").on(t.role)]
);

/** One row per staff member per working day — the first sign-in is the arrival time. */
export const attendance = pgTable(
  "attendance",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Shop-local calendar day, "YYYY-MM-DD". */
    workDate: text("work_date").notNull(),
    firstLoginAt: timestamp("first_login_at").notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
    /** Scheduled shift start that day, "HH:MM". */
    scheduledStart: text("scheduled_start").notNull().default(""),
    /** Arrival as minutes since shop-local midnight, so it is timezone-proof. */
    arrivalMinutes: integer("arrival_minutes").notNull().default(0),
    minutesLate: integer("minutes_late").notNull().default(0),
    late: boolean("late").notNull().default(false),
    logins: integer("logins").notNull().default(1),
  },
  (t) => [
    uniqueIndex("attendance_user_date_idx").on(t.userId, t.workDate),
    index("attendance_date_idx").on(t.workDate),
  ]
);

/** Points ledger behind each technician's score. */
export const performanceEvents = pgTable(
  "performance_events",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The job this is about, when the admin flagged it from an entry. */
    entryId: integer("entry_id").references(() => entries.id, { onDelete: "set null" }),
    type: text("type").notNull().default("mistake"), // mistake | praise | adjustment
    severity: text("severity").notNull().default(""), // minor | major | critical
    category: text("category").notNull().default(""),
    note: text("note").notNull().default(""),
    /** Negative for penalties, positive for recognition. */
    points: integer("points").notNull().default(0),
    createdBy: text("created_by").notNull().default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("performance_user_idx").on(t.userId),
    index("performance_created_idx").on(t.createdAt),
    index("performance_entry_idx").on(t.entryId),
  ]
);

export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    firstName: text("first_name").notNull().default(""),
    lastName: text("last_name").notNull().default(""),
    phone: text("phone").notNull().default(""), // digits only
    email: text("email").notNull().default(""),
    street: text("street").notNull().default(""),
    address2: text("address2").notNull().default(""),
    city: text("city").notNull().default(""),
    state: text("state").notNull().default(""),
    zip: text("zip").notNull().default(""),
    country: text("country").notNull().default("United States"),
    smsConsent: boolean("sms_consent").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("customers_phone_idx").on(t.phone), index("customers_name_idx").on(t.lastName, t.firstName)]
);

export const entries = pgTable(
  "entries",
  {
    id: serial("id").primaryKey(),
    locationId: integer("location_id").references(() => locations.id),
    customerId: integer("customer_id").references(() => customers.id),

    // Step 2 — estimate authorization
    estimateChoice: text("estimate_choice").notNull().default(""),
    estimateAmount: text("estimate_amount").notNull().default(""),
    estimateSignature: text("estimate_signature").notNull().default(""),
    estimateDate: text("estimate_date").notNull().default(""),

    // Step 3 — vehicle
    vehicleYear: text("vehicle_year").notNull().default(""),
    vehicleMake: text("vehicle_make").notNull().default(""),
    vehicleModel: text("vehicle_model").notNull().default(""),
    drive: text("drive").notNull().default(""),
    axleLocation: text("axle_location").notNull().default(""),
    cab: text("cab").notNull().default(""),
    transmission: text("transmission").notNull().default(""),
    transmissionSpeed: text("transmission_speed").notNull().default(""),
    engineSize: text("engine_size").notNull().default(""),
    bedSize: text("bed_size").notNull().default(""),
    bedSizeOther: text("bed_size_other").notNull().default(""),
    wheelbase: text("wheelbase").notNull().default(""),
    horsePower: text("horse_power").notNull().default(""),
    stockVehicle: text("stock_vehicle").notNull().default(""),
    stockVehicleExplain: text("stock_vehicle_explain").notNull().default(""),
    vinMethod: text("vin_method").notNull().default(""),
    vinPhoto: text("vin_photo").notNull().default(""),
    vin: text("vin").notNull().default(""),
    mileage: text("mileage").notNull().default(""),
    saveOldParts: text("save_old_parts").notNull().default(""),
    complaint: text("complaint").notNull().default(""),
    complaintOther: text("complaint_other").notNull().default(""),

    // Step 3 — technician job info
    notes: text("notes").notNull().default(""),
    laborRequest: text("labor_request").notNull().default(""),
    laborOther: text("labor_other").notNull().default(""),
    driveshaftPieces: text("driveshaft_pieces").notNull().default(""),
    driveshaftMaterial: text("driveshaft_material").notNull().default(""),
    uJointSerial: text("u_joint_serial").notNull().default(""),
    driveshaftTypeChoice: text("driveshaft_type_choice").notNull().default(""),
    productImage: text("product_image").notNull().default(""),
    measurementA: text("measurement_a").notNull().default(""),
    measurementB: text("measurement_b").notNull().default(""),
    measurementC: text("measurement_c").notNull().default(""),

    // Step 4 — driveshaft designer
    designerType: text("designer_type").notNull().default(""),

    // Step 1/5 — misc + totals
    howHeard: text("how_heard").notNull().default(""),
    deposit: numeric("deposit", { precision: 10, scale: 2 }),
    total: numeric("total", { precision: 10, scale: 2 }),
    finalSignature: text("final_signature").notNull().default(""),

    // Step 6 — staff only
    jobNumber: text("job_number").notNull().default(""),
    employeeName: text("employee_name").notNull().default(""),
    core: text("core").notNull().default(""),
    jobStatus: text("job_status").notNull().default("New"),
    onHoldReason: text("on_hold_reason").notNull().default(""),
    payment: text("payment").notNull().default(""),
    confirmationDate: text("confirmation_date").notNull().default(""),
    assignedEmployee: text("assigned_employee").notNull().default(""),
    timeOfJob: text("time_of_job").notNull().default(""),
    signingDate: text("signing_date").notNull().default(""),
    etaJob: text("eta_job").notNull().default(""),

    /** Values for admin-defined custom fields, keyed by the field's schema key. */
    custom: jsonb("custom"),

    // meta
    /** Who took the check-in. Kept as an id + a name snapshot that survives user deletion. */
    createdByUserId: integer("created_by_user_id"),
    createdByName: text("created_by_name").notNull().default(""),
    sourceEntryId: integer("source_entry_id"), // Gravity Forms entry id when imported
    /** Soft-delete marker. Deleted entries are hidden but recoverable from the log. */
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("entries_status_idx").on(t.jobStatus),
    index("entries_customer_idx").on(t.customerId),
    index("entries_created_idx").on(t.createdAt),
    index("entries_deleted_idx").on(t.deletedAt),
    uniqueIndex("entries_source_idx").on(t.sourceEntryId),
  ]
);

/** Append-only audit trail of everything that happens in the app. */
export const activityLog = pgTable(
  "activity_log",
  {
    id: serial("id").primaryKey(),
    action: text("action").notNull(), // e.g. entry.create, entry.delete, status.change, employee.delete
    entity: text("entity").notNull().default(""), // entry | customer | employee | settings | auth | location
    entityId: integer("entity_id"),
    summary: text("summary").notNull().default(""),
    details: jsonb("details"),
    actor: text("actor").notNull().default(""),
    ip: text("ip").notNull().default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("activity_action_idx").on(t.action),
    index("activity_entity_idx").on(t.entity, t.entityId),
    index("activity_created_idx").on(t.createdAt),
  ]
);

export const parts = pgTable(
  "parts",
  {
    id: serial("id").primaryKey(),
    entryId: integer("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    sku: text("sku").notNull().default(""),
    name: text("name").notNull().default(""),
    qty: integer("qty").notNull().default(1),
    price: numeric("price", { precision: 10, scale: 2 }),
  },
  (t) => [index("parts_entry_idx").on(t.entryId)]
);

export const statusHistory = pgTable(
  "status_history",
  {
    id: serial("id").primaryKey(),
    entryId: integer("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    fromStatus: text("from_status").notNull().default(""),
    toStatus: text("to_status").notNull().default(""),
    note: text("note").notNull().default(""),
    changedBy: text("changed_by").notNull().default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("status_history_entry_idx").on(t.entryId)]
);

export const messageTemplates = pgTable(
  "message_templates",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull(), // submission | confirmed | ongoing | on_hold | completed | admin_submission
    channel: text("channel").notNull(), // sms | email
    name: text("name").notNull().default(""),
    subject: text("subject").notNull().default(""),
    body: text("body").notNull().default(""),
    enabled: boolean("enabled").notNull().default(true),
  },
  (t) => [uniqueIndex("templates_key_channel_idx").on(t.key, t.channel)]
);

export const messageLog = pgTable(
  "message_log",
  {
    id: serial("id").primaryKey(),
    entryId: integer("entry_id").references(() => entries.id, { onDelete: "set null" }),
    channel: text("channel").notNull(), // sms | email
    recipient: text("recipient").notNull().default(""),
    templateKey: text("template_key").notNull().default(""),
    subject: text("subject").notNull().default(""),
    body: text("body").notNull().default(""),
    status: text("status").notNull().default("queued"), // sent | failed
    providerId: text("provider_id").notNull().default(""),
    error: text("error").notNull().default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("message_log_entry_idx").on(t.entryId), index("message_log_created_idx").on(t.createdAt)]
);
