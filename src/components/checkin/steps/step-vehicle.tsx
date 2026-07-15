"use client";

import { Fragment } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, Field, Input, Select, SelectOptions, Textarea, ChoiceChips, SectionTitle, Button } from "@/components/ui";
import { PhotoInput } from "@/components/photo-input";
import { groupConfig } from "@/lib/form-layout";
import formOptions from "@/lib/form-options.json";
import type { StepProps, PartLine } from "../types";

const B_TYPES = ["1 Piece Driveshaft Type 1", "2 Piece Driveshaft Type 1", "2 Piece Driveshaft Type 2"];
const C_TYPES = ["2 Piece Driveshaft Type 2"];

export function StepVehicle({ data, set, errors, layout, options }: StepProps) {
  const vehicleCfg = groupConfig(layout, "vehicle");
  const jobCfg = groupConfig(layout, "job");

  const updatePart = (i: number, patch: Partial<PartLine>) => {
    set(
      "parts",
      data.parts.map((p, idx) => (idx === i ? { ...p, ...patch } : p))
    );
  };

  const req = (group: "vehicle" | "job", k: string) =>
    !!(group === "vehicle" ? vehicleCfg : jobCfg)[k]?.required;

  /* --- Vehicle group: compact select/input fields; conditional children ride with their parent --- */
  const vehicleRenderers: Record<string, () => React.ReactNode> = {
    vehicleYear: () => (
      <Field key="vehicleYear" label="Year" required={req("vehicle", "vehicleYear")} error={errors.vehicleYear}>
        <Select value={data.vehicleYear} onChange={(e) => set("vehicleYear", e.target.value)} placeholder="Year">
          <SelectOptions options={options.years} />
        </Select>
      </Field>
    ),
    vehicleMake: () => (
      <Field key="vehicleMake" label="Make" required={req("vehicle", "vehicleMake")} error={errors.vehicleMake}>
        <Select value={data.vehicleMake} onChange={(e) => set("vehicleMake", e.target.value)} placeholder="Make">
          <SelectOptions options={options.makes} />
        </Select>
      </Field>
    ),
    vehicleModel: () => (
      <Field key="vehicleModel" label="Model" required={req("vehicle", "vehicleModel")} error={errors.vehicleModel}>
        <Input value={data.vehicleModel} onChange={(e) => set("vehicleModel", e.target.value)} placeholder="Model" />
      </Field>
    ),
    drive: () => (
      <Field key="drive" label="Drive" required={req("vehicle", "drive")} error={errors.drive}>
        <Select value={data.drive} onChange={(e) => set("drive", e.target.value)} placeholder="Drive">
          <SelectOptions options={options.drives} />
        </Select>
      </Field>
    ),
    axleLocation: () => (
      <Field key="axleLocation" label="Location" required={req("vehicle", "axleLocation")} error={errors.axleLocation}>
        <Select value={data.axleLocation} onChange={(e) => set("axleLocation", e.target.value)} placeholder="Front / Rear">
          <SelectOptions options={options.axleLocations} />
        </Select>
      </Field>
    ),
    cab: () => (
      <Field key="cab" label="Cab" required={req("vehicle", "cab")} error={errors.cab}>
        <Select value={data.cab} onChange={(e) => set("cab", e.target.value)} placeholder="Cab">
          <SelectOptions options={options.cabs} />
        </Select>
      </Field>
    ),
    transmission: () => (
      <Field key="transmission" label="Transmission" required={req("vehicle", "transmission")} error={errors.transmission}>
        <Select value={data.transmission} onChange={(e) => set("transmission", e.target.value)} placeholder="Transmission">
          <SelectOptions options={options.transmissions} />
        </Select>
      </Field>
    ),
    transmissionSpeed: () => (
      <Field key="transmissionSpeed" label="Transmission Speed" required={req("vehicle", "transmissionSpeed")} error={errors.transmissionSpeed}>
        <Select value={data.transmissionSpeed} onChange={(e) => set("transmissionSpeed", e.target.value)} placeholder="Speed">
          <SelectOptions options={options.transmissionSpeeds} />
        </Select>
      </Field>
    ),
    engineSize: () => (
      <Field key="engineSize" label="Engine Size" required={req("vehicle", "engineSize")} error={errors.engineSize}>
        <Input value={data.engineSize} onChange={(e) => set("engineSize", e.target.value)} placeholder="e.g. 5.3" />
      </Field>
    ),
    bedSize: () => (
      <Fragment key="bedSize">
        <Field label="Bed Size" required={req("vehicle", "bedSize")} error={errors.bedSize}>
          <Select value={data.bedSize} onChange={(e) => set("bedSize", e.target.value)} placeholder="Bed size">
            <SelectOptions options={options.bedSizes} />
          </Select>
        </Field>
        {data.bedSize === "Other" && (
          <Field label="Other Bed Size" className="animate-fade-up">
            <Input value={data.bedSizeOther} onChange={(e) => set("bedSizeOther", e.target.value)} />
          </Field>
        )}
      </Fragment>
    ),
    wheelbase: () => (
      <Field key="wheelbase" label="Wheelbase" required={req("vehicle", "wheelbase")} error={errors.wheelbase}>
        <Input value={data.wheelbase} onChange={(e) => set("wheelbase", e.target.value)} />
      </Field>
    ),
    horsePower: () => (
      <Field key="horsePower" label="Horse Power" required={req("vehicle", "horsePower")} error={errors.horsePower}>
        <Input value={data.horsePower} onChange={(e) => set("horsePower", e.target.value)} inputMode="numeric" />
      </Field>
    ),
    mileage: () => (
      <Field key="mileage" label="Mileage" required={req("vehicle", "mileage")} error={errors.mileage}>
        <Input value={data.mileage} onChange={(e) => set("mileage", e.target.value)} inputMode="numeric" />
      </Field>
    ),
    stockVehicle: () => (
      <Fragment key="stockVehicle">
        <Field label="Stock vehicle" required={req("vehicle", "stockVehicle")} error={errors.stockVehicle}>
          <ChoiceChips options={formOptions.core} value={data.stockVehicle} onChange={(v) => set("stockVehicle", v)} columns={2} />
        </Field>
        {data.stockVehicle === "No" && (
          <Field label="If not stock, please explain" className="animate-fade-up sm:col-span-2">
            <Input value={data.stockVehicleExplain} onChange={(e) => set("stockVehicleExplain", e.target.value)} />
          </Field>
        )}
      </Fragment>
    ),
    saveOldParts: () => (
      <Field key="saveOldParts" label="Save old parts (core may apply)" required={req("vehicle", "saveOldParts")} error={errors.saveOldParts}>
        <ChoiceChips options={formOptions.core} value={data.saveOldParts} onChange={(v) => set("saveOldParts", v)} columns={2} />
      </Field>
    ),
    vinMethod: () => (
      <Fragment key="vinMethod">
        <Field label="VIN Number" required={req("vehicle", "vinMethod")} error={errors.vinMethod} className="sm:col-span-2">
          <ChoiceChips
            options={["Write Manually", "Take/Upload a Photo"]}
            value={data.vinMethod}
            onChange={(v) => set("vinMethod", v)}
            columns={2}
          />
        </Field>
        {data.vinMethod === "Write Manually" && (
          <Field label="VIN" className="animate-fade-up sm:col-span-2">
            <Input value={data.vin} onChange={(e) => set("vin", e.target.value.toUpperCase())} className="font-mono" />
          </Field>
        )}
        {data.vinMethod === "Take/Upload a Photo" && (
          <Field label="VIN Photo" className="animate-fade-up sm:col-span-2">
            <PhotoInput value={data.vinPhoto} onChange={(v) => set("vinPhoto", v)} label="Capture VIN photo" />
          </Field>
        )}
      </Fragment>
    ),
    complaint: () => (
      <Fragment key="complaint">
        <Field label="Customer complaint / problem" required={req("vehicle", "complaint")} error={errors.complaint}>
          <Select value={data.complaint} onChange={(e) => set("complaint", e.target.value)} placeholder="Select complaint">
            <SelectOptions options={options.complaints} />
          </Select>
        </Field>
        {data.complaint === "Something else" && (
          <Field label="Specify the problem / complaint" className="animate-fade-up">
            <Input value={data.complaintOther} onChange={(e) => set("complaintOther", e.target.value)} />
          </Field>
        )}
      </Fragment>
    ),
  };

  /* --- Job group --- */
  const jobRenderers: Record<string, () => React.ReactNode> = {
    notes: () => (
      <Field key="notes" label="Notes / Reason of coming" required={req("job", "notes")} error={errors.notes} className="sm:col-span-2">
        <Textarea value={data.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Notes…" />
      </Field>
    ),
    laborRequest: () => (
      <Fragment key="laborRequest">
        <Field label="Labor Request" required={req("job", "laborRequest")} error={errors.laborRequest}>
          <Select value={data.laborRequest} onChange={(e) => set("laborRequest", e.target.value)} placeholder="Select labor">
            <SelectOptions options={options.laborRequests} />
          </Select>
        </Field>
        {data.laborRequest === "Other" && (
          <Field label="Other Labor (specify)" className="animate-fade-up">
            <Input value={data.laborOther} onChange={(e) => set("laborOther", e.target.value)} />
          </Field>
        )}
      </Fragment>
    ),
    uJointSerial: () => (
      <Field key="uJointSerial" label="U-Joint Serial" required={req("job", "uJointSerial")} error={errors.uJointSerial}>
        <Input value={data.uJointSerial} onChange={(e) => set("uJointSerial", e.target.value)} />
      </Field>
    ),
    driveshaftPieces: () => (
      <Field key="driveshaftPieces" label="Type of Driveshaft" required={req("job", "driveshaftPieces")} error={errors.driveshaftPieces}>
        <ChoiceChips
          options={options.driveshaftPieces}
          value={data.driveshaftPieces}
          onChange={(v) => set("driveshaftPieces", v)}
          columns={2}
        />
      </Field>
    ),
    driveshaftMaterial: () => (
      <Field key="driveshaftMaterial" label="Driveshaft Material" required={req("job", "driveshaftMaterial")} error={errors.driveshaftMaterial}>
        <ChoiceChips
          options={options.driveshaftMaterials}
          value={data.driveshaftMaterial}
          onChange={(v) => set("driveshaftMaterial", v)}
          columns={2}
        />
      </Field>
    ),
    driveshaftTypeChoice: () => (
      <Fragment key="driveshaftTypeChoice">
        <Field
          label="Choose your Driveshaft Type"
          hint="Measurements requested depend on the type selected"
          required={req("job", "driveshaftTypeChoice")}
          error={errors.driveshaftTypeChoice}
          className="sm:col-span-2"
        >
          <ChoiceChips
            options={formOptions.driveshaftTypes}
            value={data.driveshaftTypeChoice}
            onChange={(v) => set("driveshaftTypeChoice", v)}
            columns={2}
          />
        </Field>
        {data.driveshaftTypeChoice && (
          <div className="grid grid-cols-3 gap-4 animate-fade-up sm:col-span-2">
            <Field label="A measurement">
              <Input value={data.measurementA} onChange={(e) => set("measurementA", e.target.value)} inputMode="decimal" />
            </Field>
            {B_TYPES.includes(data.driveshaftTypeChoice) && (
              <Field label="B measurement">
                <Input value={data.measurementB} onChange={(e) => set("measurementB", e.target.value)} inputMode="decimal" />
              </Field>
            )}
            {C_TYPES.includes(data.driveshaftTypeChoice) && (
              <Field label="C measurement">
                <Input value={data.measurementC} onChange={(e) => set("measurementC", e.target.value)} inputMode="decimal" />
              </Field>
            )}
          </div>
        )}
      </Fragment>
    ),
    productImage: () => (
      <Field key="productImage" label="Product Image" hint="Use this to capture a photo of the product" className="sm:col-span-2">
        <PhotoInput value={data.productImage} onChange={(v) => set("productImage", v)} />
      </Field>
    ),
  };

  const orderedVehicle = (layout.fields.vehicle || []).filter((fld) => fld.visible && vehicleRenderers[fld.key]);
  const orderedJob = (layout.fields.job || []).filter((fld) => fld.visible && jobRenderers[fld.key]);
  const showParts = jobCfg.parts?.visible !== false;

  return (
    <div className="space-y-6">
      {orderedVehicle.length > 0 && (
        <Card className="p-5 sm:p-6">
          <SectionTitle>Vehicle Information</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">{orderedVehicle.map((fld) => vehicleRenderers[fld.key]())}</div>
        </Card>
      )}

      {orderedJob.length > 0 && (
        <Card className="p-5 sm:p-6">
          <SectionTitle>Technician Job Information</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {orderedJob.filter((fld) => fld.key !== "parts").map((fld) => jobRenderers[fld.key]())}
          </div>
        </Card>
      )}

      {showParts && (
        <Card className="p-5 sm:p-6">
          <SectionTitle>Parts Used on This Order</SectionTitle>
          <div className="space-y-3">
            {data.parts.length === 0 && <p className="text-sm text-ink-500">No parts added yet.</p>}
            {data.parts.map((p, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_84px_110px_44px] max-sm:grid-cols-[1fr_84px_44px] gap-2 items-end">
                <Field label={i === 0 ? "Part SKU" : undefined}>
                  <Input value={p.sku} onChange={(e) => updatePart(i, { sku: e.target.value })} placeholder="Scan or type SKU" />
                </Field>
                <Field label={i === 0 ? "Part name" : undefined} className="max-sm:hidden">
                  <Input value={p.name} onChange={(e) => updatePart(i, { name: e.target.value })} placeholder="Description" />
                </Field>
                <Field label={i === 0 ? "Qty" : undefined}>
                  <Input
                    value={String(p.qty)}
                    onChange={(e) => updatePart(i, { qty: Math.max(1, parseInt(e.target.value) || 1) })}
                    inputMode="numeric"
                    className="text-center"
                  />
                </Field>
                <Field label={i === 0 ? "Price" : undefined} className="max-sm:hidden">
                  <Input value={p.price} onChange={(e) => updatePart(i, { price: e.target.value })} inputMode="decimal" placeholder="$" />
                </Field>
                <Button
                  variant="danger"
                  size="md"
                  type="button"
                  className="w-11 px-0"
                  onClick={() => set("parts", data.parts.filter((_, idx) => idx !== i))}
                  aria-label="Remove part"
                >
                  <Trash2 className="w-4.5 h-4.5" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => set("parts", [...data.parts, { sku: "", name: "", qty: 1, price: "" }])}>
              <Plus className="w-4.5 h-4.5" /> Add part
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
