"use client";

import { Fragment, useEffect, useState } from "react";
import { Card, Field, Input, Select, SelectOptions, ChoiceChips } from "@/components/ui";
import { groupConfig } from "@/lib/form-layout";
import formOptions from "@/lib/form-options.json";
import type { StepProps } from "../types";

export function StepStaff({ data, set, errors, layout, options }: StepProps) {
  const cfg = groupConfig(layout, "staff");
  const [employees, setEmployees] = useState<string[]>(formOptions.employees);

  useEffect(() => {
    fetch("/api/meta")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.employees?.length) setEmployees([...j.employees, "Other"]);
      })
      .catch(() => {});
  }, []);

  const req = (k: string) => !!cfg[k]?.required;

  const renderers: Record<string, () => React.ReactNode> = {
    jobNumber: () => (
      <Field key="jobNumber" label="Job Number" required={req("jobNumber")} error={errors.jobNumber}>
        <Input value={data.jobNumber} onChange={(e) => set("jobNumber", e.target.value)} placeholder="Job #" />
      </Field>
    ),
    employeeName: () => (
      <Field key="employeeName" label="Employee Name" required={req("employeeName")} error={errors.employeeName}>
        <Select value={data.employeeName} onChange={(e) => set("employeeName", e.target.value)} placeholder="Employee">
          <SelectOptions options={employees} />
        </Select>
      </Field>
    ),
    core: () => (
      <Field key="core" label="Core" required={req("core")} error={errors.core}>
        <ChoiceChips options={formOptions.core} value={data.core} onChange={(v) => set("core", v)} columns={2} />
      </Field>
    ),
    payment: () => (
      <Field key="payment" label="Payment" required={req("payment")} error={errors.payment}>
        <ChoiceChips options={options.payments} value={data.payment} onChange={(v) => set("payment", v)} columns={3} />
      </Field>
    ),
    signingDate: () => (
      <Field key="signingDate" label="Signing Date" required={req("signingDate")} error={errors.signingDate}>
        <Input type="datetime-local" value={data.signingDate} onChange={(e) => set("signingDate", e.target.value)} />
      </Field>
    ),
    etaJob: () => (
      <Field key="etaJob" label="ETA Job" hint="Estimated completion date for the job" required={req("etaJob")} error={errors.etaJob}>
        <Input type="date" value={data.etaJob} onChange={(e) => set("etaJob", e.target.value)} />
      </Field>
    ),
    jobStatus: () => (
      <Fragment key="jobStatus">
        <Field
          label="Status"
          hint="Changing status after check-in will notify the customer by SMS/email (if configured)"
          className="sm:col-span-2"
        >
          <ChoiceChips
            options={formOptions.jobStatuses}
            value={data.jobStatus === "New" ? "" : data.jobStatus}
            onChange={(v) => set("jobStatus", v || "New")}
            columns={4}
          />
        </Field>
        {data.jobStatus === "On hold" && (
          <Field label="On Hold Reason" className="animate-fade-up sm:col-span-2">
            <ChoiceChips options={options.onHoldReasons} value={data.onHoldReason} onChange={(v) => set("onHoldReason", v)} columns={2} />
          </Field>
        )}
        {data.jobStatus === "Confirmed" && (
          <Field label="Confirmation Date" className="animate-fade-up max-w-64">
            <Input type="datetime-local" value={data.confirmationDate} onChange={(e) => set("confirmationDate", e.target.value)} />
          </Field>
        )}
        {data.jobStatus === "Ongoing" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-up sm:col-span-2">
            <Field label="Assigned Employee">
              <ChoiceChips
                options={formOptions.assignedEmployees}
                value={data.assignedEmployee}
                onChange={(v) => set("assignedEmployee", v)}
                columns={2}
              />
            </Field>
            {data.assignedEmployee && (
              <Field label="Time of Job" className="animate-fade-up">
                <Input type="datetime-local" value={data.timeOfJob} onChange={(e) => set("timeOfJob", e.target.value)} />
              </Field>
            )}
          </div>
        )}
      </Fragment>
    ),
  };

  const ordered = (layout.fields.staff || []).filter((fld) => fld.visible && renderers[fld.key]);

  return (
    <div className="space-y-6">
      <Card className="p-5 sm:p-6 border-amber-300 bg-amber-50/40">
        <div className="flex items-center gap-2 mb-4">
          <span className="px-2.5 py-1 rounded-md bg-amber-400/90 text-amber-950 text-xs font-bold uppercase tracking-wide">
            For staff only
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{ordered.map((fld) => renderers[fld.key]())}</div>
      </Card>
    </div>
  );
}
