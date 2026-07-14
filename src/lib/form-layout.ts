/**
 * Configurable wizard layout: step order/visibility and per-step field
 * order/visibility/required. Stored in settings.formLayout; merged with
 * defaults so new fields added in code appear automatically.
 */

export type LayoutField = { key: string; label: string; visible: boolean; required: boolean };
export type LayoutStep = { key: string; title: string; enabled: boolean };
export type FormLayout = {
  steps: LayoutStep[];
  fields: Record<string, LayoutField[]>;
};

const f = (key: string, label: string, required = false): LayoutField => ({ key, label, visible: true, required });

export const DEFAULT_FORM_LAYOUT: FormLayout = {
  steps: [
    { key: "customer", title: "Customer", enabled: true },
    { key: "estimate", title: "Estimate", enabled: true },
    { key: "vehicle", title: "Vehicle & Job", enabled: true },
    { key: "designer", title: "Designer", enabled: true },
    { key: "terms", title: "Terms & Sign", enabled: true },
    { key: "staff", title: "Staff", enabled: true },
  ],
  fields: {
    customer: [
      f("search", "Existing customer search"),
      f("firstName", "First Name", true),
      f("lastName", "Last Name", true),
      f("phone", "Phone", true),
      f("email", "Email"),
      f("street", "Street Address"),
      f("city", "City"),
      f("state", "State"),
      f("zip", "ZIP"),
      f("howHeard", "How did you hear about us?"),
      f("smsConsent", "SMS Consent", true),
    ],
    vehicle: [
      f("vehicleYear", "Year"),
      f("vehicleMake", "Make"),
      f("vehicleModel", "Model"),
      f("drive", "Drive"),
      f("axleLocation", "Location (Front/Rear)"),
      f("cab", "Cab"),
      f("transmission", "Transmission"),
      f("transmissionSpeed", "Transmission Speed"),
      f("engineSize", "Engine Size"),
      f("bedSize", "Bed Size"),
      f("wheelbase", "Wheelbase"),
      f("horsePower", "Horse Power"),
      f("mileage", "Mileage"),
      f("stockVehicle", "Stock vehicle"),
      f("saveOldParts", "Save old parts"),
      f("vinMethod", "VIN Number"),
      f("complaint", "Customer complaint"),
    ],
    job: [
      f("notes", "Notes / Reason of coming"),
      f("laborRequest", "Labor Request"),
      f("uJointSerial", "U-Joint Serial"),
      f("driveshaftPieces", "Type of Driveshaft"),
      f("driveshaftMaterial", "Driveshaft Material"),
      f("driveshaftTypeChoice", "Driveshaft Type (measurements)"),
      f("productImage", "Product Image"),
      f("parts", "Parts used on this order"),
    ],
    terms: [f("deposit", "Payment Deposit"), f("total", "Total")],
    staff: [
      f("jobNumber", "Job Number"),
      f("employeeName", "Employee Name"),
      f("core", "Core"),
      f("payment", "Payment"),
      f("jobStatus", "Job Status"),
      f("signingDate", "Signing Date"),
      f("etaJob", "ETA Job"),
    ],
  },
};

/** Merge a stored layout with defaults: keep stored order/flags, add new items, drop unknown ones. */
export function mergeFormLayout(stored: FormLayout | null | undefined): FormLayout {
  if (!stored?.steps?.length) return DEFAULT_FORM_LAYOUT;

  const steps: LayoutStep[] = [];
  for (const s of stored.steps) {
    const def = DEFAULT_FORM_LAYOUT.steps.find((d) => d.key === s.key);
    if (def) steps.push({ ...def, ...s });
  }
  for (const def of DEFAULT_FORM_LAYOUT.steps) {
    if (!steps.some((s) => s.key === def.key)) steps.push(def);
  }

  const fields: Record<string, LayoutField[]> = {};
  for (const [group, defFields] of Object.entries(DEFAULT_FORM_LAYOUT.fields)) {
    const storedGroup = stored.fields?.[group] || [];
    const merged: LayoutField[] = [];
    for (const sf of storedGroup) {
      const def = defFields.find((d) => d.key === sf.key);
      if (def) merged.push({ ...def, ...sf });
    }
    for (const def of defFields) {
      if (!merged.some((m) => m.key === def.key)) merged.push(def);
    }
    fields[group] = merged;
  }

  return { steps, fields };
}

export type FieldConfigMap = Record<string, { visible: boolean; required: boolean; order: number }>;

/** Flatten a group's ordered list into a lookup map for step components. */
export function groupConfig(layout: FormLayout, group: string): FieldConfigMap {
  const map: FieldConfigMap = {};
  (layout.fields[group] || []).forEach((fld, i) => {
    map[fld.key] = { visible: fld.visible, required: fld.required, order: i };
  });
  return map;
}
