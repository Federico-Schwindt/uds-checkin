export type PartLine = { sku: string; name: string; qty: number; price: string };

export type CheckinData = {
  /** Device location, attached at submit time (from localStorage). */
  locationId?: number | null;
  /** Values for admin-defined custom fields, keyed by the field's schema key. */
  custom?: Record<string, unknown>;
  // Step 1 — customer
  customerId: number | null;
  firstName: string;
  lastName: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  howHeard: string;
  smsConsent: boolean;

  // Step 2 — estimate authorization
  estimateChoice: string;
  estimateAmount: string;
  estimateSignature: string;
  estimateDate: string;

  // Step 3 — vehicle + job
  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;
  drive: string;
  axleLocation: string;
  cab: string;
  transmission: string;
  transmissionSpeed: string;
  engineSize: string;
  bedSize: string;
  bedSizeOther: string;
  wheelbase: string;
  horsePower: string;
  stockVehicle: string;
  stockVehicleExplain: string;
  vinMethod: string;
  vinPhoto: string;
  vin: string;
  mileage: string;
  saveOldParts: string;
  complaint: string;
  complaintOther: string;
  notes: string;
  laborRequest: string;
  laborOther: string;
  driveshaftPieces: string;
  driveshaftMaterial: string;
  uJointSerial: string;
  driveshaftTypeChoice: string;
  productImage: string;
  measurementA: string;
  measurementB: string;
  measurementC: string;
  parts: PartLine[];

  // Step 4 — designer
  designerType: string;

  // Step 5 — terms
  deposit: string;
  total: string;
  finalSignature: string;

  // Step 6 — staff
  jobNumber: string;
  employeeName: string;
  core: string;
  jobStatus: string;
  onHoldReason: string;
  payment: string;
  confirmationDate: string;
  assignedEmployee: string;
  timeOfJob: string;
  signingDate: string;
  etaJob: string;
};

export const initialCheckinData: CheckinData = {
  custom: {},
  customerId: null,
  firstName: "",
  lastName: "",
  street: "",
  city: "",
  state: "Florida",
  zip: "",
  phone: "",
  email: "",
  howHeard: "",
  smsConsent: false,

  estimateChoice: "",
  estimateAmount: "",
  estimateSignature: "",
  estimateDate: new Date().toISOString().slice(0, 10),

  vehicleYear: "",
  vehicleMake: "",
  vehicleModel: "",
  drive: "",
  axleLocation: "",
  cab: "",
  transmission: "",
  transmissionSpeed: "",
  engineSize: "",
  bedSize: "",
  bedSizeOther: "",
  wheelbase: "",
  horsePower: "",
  stockVehicle: "",
  stockVehicleExplain: "",
  vinMethod: "",
  vinPhoto: "",
  vin: "",
  mileage: "",
  saveOldParts: "",
  complaint: "",
  complaintOther: "",
  notes: "",
  laborRequest: "",
  laborOther: "",
  driveshaftPieces: "",
  driveshaftMaterial: "",
  uJointSerial: "",
  driveshaftTypeChoice: "",
  productImage: "",
  measurementA: "",
  measurementB: "",
  measurementC: "",
  parts: [],

  designerType: "",

  deposit: "",
  total: "",
  finalSignature: "",

  jobNumber: "",
  employeeName: "",
  core: "",
  jobStatus: "New",
  onHoldReason: "",
  payment: "",
  confirmationDate: "",
  assignedEmployee: "",
  timeOfJob: "",
  signingDate: "",
  etaJob: "",
};

