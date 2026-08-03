import legalTexts from "./legal-texts.json";
import type { ConditionGroup, FormField, FormSchema, FormStep } from "./form-schema";

/**
 * The default schema reproduces the current check-in form exactly, with every
 * existing field marked `core` so it keeps writing to its real DB column.
 * Admins can then reorder/retitle/hide these and add unlimited custom fields.
 */

const AMOUNT_OPTION = "I DO NOT REQUEST A WRITTEN ESTIMATE AS LONG AS THE REPAIR COSTS DO NOT EXCEED_______.";
const B_TYPES = ["1 Piece Driveshaft Type 1", "2 Piece Driveshaft Type 1", "2 Piece Driveshaft Type 2"];
const C_TYPES = ["2 Piece Driveshaft Type 2"];

const showWhen = (field: string, value: string): ConditionGroup => ({
  action: "show",
  logic: "all",
  rules: [{ field, op: "is", value }],
});

const showWhenAnyOf = (field: string, values: string[]): ConditionGroup => ({
  action: "show",
  logic: "any",
  rules: values.map((value) => ({ field, op: "is" as const, value })),
});

/** Core entry field shorthand. */
const core = (
  key: string,
  label: string,
  type: FormField["type"],
  extra: Partial<FormField> = {}
): FormField => ({
  id: `core_${key}`,
  type,
  key,
  core: true,
  entity: "entry",
  label,
  width: 12,
  ...extra,
});

/** Core customer field shorthand. */
const cust = (
  key: string,
  label: string,
  type: FormField["type"],
  extra: Partial<FormField> = {}
): FormField => ({
  id: `core_${key}`,
  type,
  key,
  core: true,
  entity: "customer",
  label,
  width: 12,
  ...extra,
});

const heading = (id: string, label: string): FormField => ({
  id: `h_${id}`,
  type: "heading",
  key: `h_${id}`,
  label,
  width: 12,
});

const html = (id: string, content: string): FormField => ({
  id: `html_${id}`,
  type: "html",
  key: `html_${id}`,
  label: "",
  content,
  width: 12,
});

const row = (id: string, children: FormField[]): FormField => ({
  id: `row_${id}`,
  type: "row",
  key: `row_${id}`,
  label: "Columns",
  width: 12,
  children,
});

const widget = (id: string, label: string, name: string): FormField => ({
  id: `w_${id}`,
  type: "widget",
  key: `w_${id}`,
  label,
  widget: name,
  width: 12,
  locked: true,
});

/* ---------------- steps ---------------- */

const customerStep: FormStep = {
  id: "customer",
  title: "Customer",
  enabled: true,
  fields: [
    widget("customerSearch", "Search existing customer", "customerSearch"),
    heading("customerInfo", "Customer Information"),
    row("name", [
      cust("firstName", "First Name", "text", { required: true, locked: true, width: 6, placeholder: "First" }),
      cust("lastName", "Last Name", "text", { required: true, locked: true, width: 6, placeholder: "Last" }),
    ]),
    row("contact", [
      cust("phone", "Phone", "phone", { required: true, locked: true, width: 6, placeholder: "(123) 123-1233" }),
      cust("email", "Email", "email", { width: 6, placeholder: "customer@email.com" }),
    ]),
    cust("street", "Street Address", "text", { placeholder: "Address" }),
    row("cityStateZip", [
      cust("city", "City", "text", { width: 6, placeholder: "City" }),
      cust("state", "State", "text", { width: 3, placeholder: "State" }),
      cust("zip", "ZIP", "text", { width: 3, placeholder: "ZIP" }),
    ]),
    core("howHeard", "How did you hear about us?", "radio", { optionsSource: "howHeard" }),
    heading("sms", "SMS Notifications"),
    cust("smsConsent", "SMS Consent", "checkbox", {
      required: true,
      locked: true,
      content: legalTexts.consent,
    }),
  ],
};

const estimateStep: FormStep = {
  id: "estimate",
  title: "Estimate",
  enabled: true,
  fields: [
    heading("estimate", "Written Estimate Authorization"),
    html(
      "estimateIntro",
      "PLEASE READ CAREFULLY, CHECK ONE OF THE STATEMENTS BELOW, AND SIGN:\n\nI understand that, under state law, I am entitled to a written estimate if my final bill will exceed $150."
    ),
    core("estimateChoice", "Select one option", "radio", { optionsSource: "estimateOptions", required: true }),
    core("estimateAmount", "Amount", "money", {
      width: 6,
      placeholder: "Amount here",
      conditions: showWhen("estimateChoice", AMOUNT_OPTION),
    }),
    html("estimateDisclosure", legalTexts.estimateDisclosure),
    row("estimateSign", [
      core("estimateSignature", "Customer Signature", "signature", { required: true, width: 9 }),
      core("estimateDate", "Date", "date", { width: 3 }),
    ]),
  ],
};

const vehicleStep: FormStep = {
  id: "vehicle",
  title: "Vehicle & Job",
  enabled: true,
  fields: [
    heading("vehicleInfo", "Vehicle Information"),
    row("ymm", [
      core("vehicleMake", "Make", "select", { optionsSource: "makes", width: 4 }),
      core("vehicleYear", "Year", "select", {
        optionsSource: "years",
        width: 4,
        conditions: { action: "show", logic: "all", rules: [{ field: "vehicleMake", op: "notEmpty", value: "" }] },
      }),
      core("vehicleModel", "Model", "text", {
        width: 4,
        placeholder: "Model",
        conditions: { action: "show", logic: "all", rules: [{ field: "vehicleMake", op: "notEmpty", value: "" }] },
      }),
    ]),
    row("driveCab", [
      core("drive", "Drive", "select", { optionsSource: "drives", width: 4 }),
      core("axleLocation", "Location", "select", { optionsSource: "axleLocations", width: 4 }),
      core("cab", "Cab", "select", { optionsSource: "cabs", width: 4 }),
    ]),
    row("trans", [
      core("transmission", "Transmission", "select", { optionsSource: "transmissions", width: 4 }),
      core("transmissionSpeed", "Transmission Speed", "select", { optionsSource: "transmissionSpeeds", width: 4 }),
      core("engineSize", "Engine Size", "text", { width: 4, placeholder: "e.g. 5.3" }),
    ]),
    row("bed", [
      core("bedSize", "Bed Size", "select", { optionsSource: "bedSizes", width: 6 }),
      core("bedSizeOther", "Other Bed Size", "text", { width: 6, conditions: showWhen("bedSize", "Other") }),
    ]),
    row("dims", [
      core("wheelbase", "Wheelbase", "text", { width: 4 }),
      core("horsePower", "Horse Power", "number", { width: 4 }),
      core("mileage", "Mileage", "number", { width: 4 }),
    ]),
    row("stock", [
      core("stockVehicle", "Stock vehicle", "yesno", { width: 6 }),
      core("saveOldParts", "Save old parts (core may apply)", "yesno", { width: 6 }),
    ]),
    core("stockVehicleExplain", "If not stock, please explain", "text", {
      conditions: showWhen("stockVehicle", "No"),
    }),
    core("vinMethod", "VIN Number", "radio", {
      options: ["Write Manually", "Take/Upload a Photo"],
    }),
    core("vin", "VIN", "text", { conditions: showWhen("vinMethod", "Write Manually") }),
    core("vinPhoto", "VIN Photo", "photo", { conditions: showWhen("vinMethod", "Take/Upload a Photo") }),
    row("complaintRow", [
      core("complaint", "Customer complaint / problem", "select", { optionsSource: "complaints", width: 6 }),
      core("complaintOther", "Specify the problem / complaint", "text", {
        width: 6,
        conditions: showWhen("complaint", "Something else"),
      }),
    ]),

    heading("jobInfo", "Technician Job Information"),
    core("notes", "Notes / Reason of coming", "textarea", { placeholder: "Notes…" }),
    row("labor", [
      core("laborRequest", "Labor Request", "select", { optionsSource: "laborRequests", width: 6 }),
      core("laborOther", "Other Labor (specify)", "text", { width: 6, conditions: showWhen("laborRequest", "Other") }),
    ]),
    core("uJointSerial", "U-Joint Serial", "text", { width: 6 }),
    row("shaft", [
      core("driveshaftPieces", "Type of Driveshaft", "radio", { optionsSource: "driveshaftPieces", width: 6 }),
      core("driveshaftMaterial", "Driveshaft Material", "radio", { optionsSource: "driveshaftMaterials", width: 6 }),
    ]),
    core("driveshaftTypeChoice", "Choose your Driveshaft Type", "radio", {
      optionsSource: "driveshaftTypes",
      help: "Measurements requested depend on the type selected",
    }),
    row("measurements", [
      core("measurementA", "A measurement", "text", {
        width: 4,
        conditions: { action: "show", logic: "any", rules: [{ field: "driveshaftTypeChoice", op: "notEmpty", value: "" }] },
      }),
      core("measurementB", "B measurement", "text", {
        width: 4,
        conditions: showWhenAnyOf("driveshaftTypeChoice", B_TYPES),
      }),
      core("measurementC", "C measurement", "text", {
        width: 4,
        conditions: showWhenAnyOf("driveshaftTypeChoice", C_TYPES),
      }),
    ]),
    core("productImage", "Product Image", "photo", { help: "Use this to capture a photo of the product" }),
    widget("parts", "Parts Used on This Order", "partsTable"),
  ],
};

const designerStep: FormStep = {
  id: "designer",
  title: "Designer",
  enabled: true,
  fields: [widget("designer", "Driveshaft Designer", "driveshaftDesigner")],
};

const termsStep: FormStep = {
  id: "terms",
  title: "Terms & Sign",
  enabled: true,
  fields: [
    heading("terms", "Terms & Conditions"),
    html("termsBody", legalTexts.terms),
    heading("payment", "Payment"),
    row("money", [
      core("deposit", "Payment Deposit", "money", { width: 6 }),
      core("total", "Total", "money", { width: 6 }),
    ]),
    html(
      "signNote",
      "By signing below I hereby acknowledge that I have completely read and fully understand the terms & conditions above and agree to them."
    ),
    core("finalSignature", "Customer Signature", "signature", { required: true }),
  ],
};

const staffStep: FormStep = {
  id: "staff",
  title: "Staff",
  enabled: true,
  fields: [
    heading("staffOnly", "For staff only"),
    row("job", [
      core("jobNumber", "Job Number", "text", { width: 6, placeholder: "Job #" }),
      core("employeeName", "Employee Name", "select", { optionsSource: "employees", width: 6 }),
    ]),
    row("corePay", [
      core("core", "Core", "yesno", { width: 6 }),
      core("payment", "Payment", "radio", { optionsSource: "payments", width: 6 }),
    ]),
    core("jobStatus", "Job Status", "radio", {
      optionsSource: "jobStatuses",
      help: "Changing status after check-in will notify the customer by SMS/email (if configured)",
    }),
    core("onHoldReason", "On Hold Reason", "radio", {
      optionsSource: "onHoldReasons",
      conditions: showWhen("jobStatus", "On hold"),
    }),
    core("confirmationDate", "Confirmation Date", "datetime", {
      width: 6,
      conditions: showWhen("jobStatus", "Confirmed"),
    }),
    core("assignedEmployee", "Assigned Employee", "radio", {
      optionsSource: "assignedEmployees",
      conditions: showWhen("jobStatus", "Ongoing"),
    }),
    core("timeOfJob", "Time of Job", "datetime", {
      width: 6,
      conditions: {
        action: "show",
        logic: "all",
        rules: [{ field: "assignedEmployee", op: "notEmpty", value: "" }],
      },
    }),
    row("dates", [
      core("signingDate", "Signing Date", "datetime", { width: 6 }),
      core("etaJob", "ETA Job", "date", { width: 6, help: "Estimated completion date for the job" }),
    ]),
  ],
};

export const DEFAULT_FORM_SCHEMA: FormSchema = {
  version: 1,
  steps: [customerStep, estimateStep, vehicleStep, designerStep, termsStep, staffStep],
};

/**
 * Stored schemas are used as-is (the admin owns them). We only fall back to the
 * default when nothing has been saved yet.
 */
export function resolveSchema(stored: FormSchema | null | undefined): FormSchema {
  if (!stored || !Array.isArray(stored.steps) || stored.steps.length === 0) return DEFAULT_FORM_SCHEMA;
  return stored;
}
