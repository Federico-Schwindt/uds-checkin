"use client";

import { Plus, Trash2 } from "lucide-react";
import { Card, Field, Input, Select, SelectOptions, Textarea, ChoiceChips, SectionTitle, Button } from "@/components/ui";
import { PhotoInput } from "@/components/photo-input";
import formOptions from "@/lib/form-options.json";
import type { StepProps, PartLine } from "../types";

const B_TYPES = ["1 Piece Driveshaft Type 1", "2 Piece Driveshaft Type 1", "2 Piece Driveshaft Type 2"];
const C_TYPES = ["2 Piece Driveshaft Type 2"];

export function StepVehicle({ data, set, errors }: StepProps) {
  const updatePart = (i: number, patch: Partial<PartLine>) => {
    set(
      "parts",
      data.parts.map((p, idx) => (idx === i ? { ...p, ...patch } : p))
    );
  };

  return (
    <div className="space-y-6">
      <Card className="p-5 sm:p-6">
        <SectionTitle>Vehicle Information</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="Year" error={errors.vehicleYear}>
            <Select value={data.vehicleYear} onChange={(e) => set("vehicleYear", e.target.value)} placeholder="Year">
              <SelectOptions options={formOptions.years} />
            </Select>
          </Field>
          <Field label="Make" error={errors.vehicleMake}>
            <Select value={data.vehicleMake} onChange={(e) => set("vehicleMake", e.target.value)} placeholder="Make">
              <SelectOptions options={formOptions.makes} />
            </Select>
          </Field>
          <Field label="Model" error={errors.vehicleModel}>
            <Input value={data.vehicleModel} onChange={(e) => set("vehicleModel", e.target.value)} placeholder="Model" />
          </Field>
          <Field label="Drive">
            <Select value={data.drive} onChange={(e) => set("drive", e.target.value)} placeholder="Drive">
              <SelectOptions options={formOptions.drives} />
            </Select>
          </Field>
          <Field label="Location">
            <Select value={data.axleLocation} onChange={(e) => set("axleLocation", e.target.value)} placeholder="Front / Rear">
              <SelectOptions options={formOptions.axleLocations} />
            </Select>
          </Field>
          <Field label="Cab">
            <Select value={data.cab} onChange={(e) => set("cab", e.target.value)} placeholder="Cab">
              <SelectOptions options={formOptions.cabs} />
            </Select>
          </Field>
          <Field label="Transmission">
            <Select value={data.transmission} onChange={(e) => set("transmission", e.target.value)} placeholder="Transmission">
              <SelectOptions options={formOptions.transmissions} />
            </Select>
          </Field>
          <Field label="Transmission Speed">
            <Select
              value={data.transmissionSpeed}
              onChange={(e) => set("transmissionSpeed", e.target.value)}
              placeholder="Speed"
            >
              <SelectOptions options={formOptions.transmissionSpeeds} />
            </Select>
          </Field>
          <Field label="Engine Size">
            <Input value={data.engineSize} onChange={(e) => set("engineSize", e.target.value)} placeholder="e.g. 5.3" />
          </Field>
          <Field label="Bed Size">
            <Select value={data.bedSize} onChange={(e) => set("bedSize", e.target.value)} placeholder="Bed size">
              <SelectOptions options={formOptions.bedSizes} />
            </Select>
          </Field>
          {data.bedSize === "Other" && (
            <Field label="Other Bed Size" className="animate-fade-up">
              <Input value={data.bedSizeOther} onChange={(e) => set("bedSizeOther", e.target.value)} />
            </Field>
          )}
          <Field label="Wheelbase">
            <Input value={data.wheelbase} onChange={(e) => set("wheelbase", e.target.value)} />
          </Field>
          <Field label="Horse Power">
            <Input value={data.horsePower} onChange={(e) => set("horsePower", e.target.value)} inputMode="numeric" />
          </Field>
          <Field label="Mileage">
            <Input value={data.mileage} onChange={(e) => set("mileage", e.target.value)} inputMode="numeric" />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
          <Field label="Stock vehicle">
            <ChoiceChips options={formOptions.core} value={data.stockVehicle} onChange={(v) => set("stockVehicle", v)} columns={2} />
          </Field>
          <Field label="Save old parts (core may apply)">
            <ChoiceChips options={formOptions.core} value={data.saveOldParts} onChange={(v) => set("saveOldParts", v)} columns={2} />
          </Field>
          {data.stockVehicle === "No" && (
            <Field label="If not stock, please explain" className="sm:col-span-2 animate-fade-up">
              <Input value={data.stockVehicleExplain} onChange={(e) => set("stockVehicleExplain", e.target.value)} />
            </Field>
          )}
        </div>

        <div className="mt-5 space-y-4">
          <Field label="VIN Number">
            <ChoiceChips
              options={["Write Manually", "Take/Upload a Photo"]}
              value={data.vinMethod}
              onChange={(v) => set("vinMethod", v)}
              columns={2}
            />
          </Field>
          {data.vinMethod === "Write Manually" && (
            <Field label="VIN" className="animate-fade-up">
              <Input value={data.vin} onChange={(e) => set("vin", e.target.value.toUpperCase())} className="font-mono" />
            </Field>
          )}
          {data.vinMethod === "Take/Upload a Photo" && (
            <Field label="VIN Photo" className="animate-fade-up">
              <PhotoInput value={data.vinPhoto} onChange={(v) => set("vinPhoto", v)} label="Capture VIN photo" />
            </Field>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
          <Field label="Customer complaint / problem">
            <Select value={data.complaint} onChange={(e) => set("complaint", e.target.value)} placeholder="Select complaint">
              <SelectOptions options={formOptions.complaints} />
            </Select>
          </Field>
          {data.complaint === "Something else" && (
            <Field label="Specify the problem / complaint" className="animate-fade-up">
              <Input value={data.complaintOther} onChange={(e) => set("complaintOther", e.target.value)} />
            </Field>
          )}
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <SectionTitle>Technician Job Information</SectionTitle>
        <div className="space-y-4">
          <Field label="Notes / Reason of coming">
            <Textarea value={data.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Notes…" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Labor Request">
              <Select value={data.laborRequest} onChange={(e) => set("laborRequest", e.target.value)} placeholder="Select labor">
                <SelectOptions options={formOptions.laborRequests} />
              </Select>
            </Field>
            {data.laborRequest === "Other" && (
              <Field label="Other Labor (specify)" className="animate-fade-up">
                <Input value={data.laborOther} onChange={(e) => set("laborOther", e.target.value)} />
              </Field>
            )}
            <Field label="U-Joint Serial">
              <Input value={data.uJointSerial} onChange={(e) => set("uJointSerial", e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Type of Driveshaft">
              <ChoiceChips
                options={formOptions.driveshaftPieces}
                value={data.driveshaftPieces}
                onChange={(v) => set("driveshaftPieces", v)}
                columns={2}
              />
            </Field>
            <Field label="Driveshaft Material">
              <ChoiceChips
                options={formOptions.driveshaftMaterials}
                value={data.driveshaftMaterial}
                onChange={(v) => set("driveshaftMaterial", v)}
                columns={2}
              />
            </Field>
          </div>
          <Field label="Choose your Driveshaft Type" hint="Measurements requested depend on the type selected">
            <ChoiceChips
              options={formOptions.driveshaftTypes}
              value={data.driveshaftTypeChoice}
              onChange={(v) => set("driveshaftTypeChoice", v)}
              columns={2}
            />
          </Field>
          {data.driveshaftTypeChoice && (
            <div className="grid grid-cols-3 gap-4 animate-fade-up">
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
          <Field label="Product Image" hint="Use this to capture a photo of the product">
            <PhotoInput value={data.productImage} onChange={(v) => set("productImage", v)} />
          </Field>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <SectionTitle>Parts Used on This Order</SectionTitle>
        <div className="space-y-3">
          {data.parts.length === 0 && (
            <p className="text-sm text-ink-500">No parts added yet.</p>
          )}
          {data.parts.map((p, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_84px_110px_44px] max-sm:grid-cols-[1fr_84px_44px] gap-2 items-end">
              <Field label={i === 0 ? "Part SKU" : undefined}>
                <Input
                  value={p.sku}
                  onChange={(e) => updatePart(i, { sku: e.target.value })}
                  placeholder="Scan or type SKU"
                />
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
                <Input
                  value={p.price}
                  onChange={(e) => updatePart(i, { price: e.target.value })}
                  inputMode="decimal"
                  placeholder="$"
                />
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
          <Button
            type="button"
            variant="outline"
            onClick={() => set("parts", [...data.parts, { sku: "", name: "", qty: 1, price: "" }])}
          >
            <Plus className="w-4.5 h-4.5" /> Add part
          </Button>
        </div>
      </Card>
    </div>
  );
}
