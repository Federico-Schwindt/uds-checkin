"use client";

import { useEffect, useState } from "react";
import { Card, Field, Input, Select, SelectOptions, ChoiceChips, SectionTitle } from "@/components/ui";
import formOptions from "@/lib/form-options.json";
import type { StepProps } from "../types";

export function StepStaff({ data, set }: StepProps) {
  const [employees, setEmployees] = useState<string[]>(formOptions.employees);

  useEffect(() => {
    fetch("/api/meta")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.employees?.length) setEmployees([...j.employees, "Other"]);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <Card className="p-5 sm:p-6 border-amber-300 bg-amber-50/40">
        <div className="flex items-center gap-2 mb-4">
          <span className="px-2.5 py-1 rounded-md bg-amber-400/90 text-amber-950 text-xs font-bold uppercase tracking-wide">
            For staff only
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Job Number">
            <Input value={data.jobNumber} onChange={(e) => set("jobNumber", e.target.value)} placeholder="Job #" />
          </Field>
          <Field label="Employee Name">
            <Select value={data.employeeName} onChange={(e) => set("employeeName", e.target.value)} placeholder="Employee">
              <SelectOptions options={employees} />
            </Select>
          </Field>
          <Field label="Core">
            <ChoiceChips options={formOptions.core} value={data.core} onChange={(v) => set("core", v)} columns={2} />
          </Field>
          <Field label="Payment">
            <ChoiceChips options={formOptions.payments} value={data.payment} onChange={(v) => set("payment", v)} columns={3} />
          </Field>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <SectionTitle>Job Status</SectionTitle>
        <div className="space-y-4">
          <Field
            label="Status"
            hint="Changing status after check-in will notify the customer by SMS/email (if configured)"
          >
            <ChoiceChips
              options={formOptions.jobStatuses}
              value={data.jobStatus === "New" ? "" : data.jobStatus}
              onChange={(v) => set("jobStatus", v || "New")}
              columns={4}
            />
          </Field>

          {data.jobStatus === "On hold" && (
            <Field label="On Hold Reason" className="animate-fade-up">
              <ChoiceChips
                options={formOptions.onHoldReasons}
                value={data.onHoldReason}
                onChange={(v) => set("onHoldReason", v)}
                columns={2}
              />
            </Field>
          )}

          {data.jobStatus === "Confirmed" && (
            <Field label="Confirmation Date" className="animate-fade-up max-w-64">
              <Input
                type="datetime-local"
                value={data.confirmationDate}
                onChange={(e) => set("confirmationDate", e.target.value)}
              />
            </Field>
          )}

          {data.jobStatus === "Ongoing" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-up">
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
                  <Input
                    type="datetime-local"
                    value={data.timeOfJob}
                    onChange={(e) => set("timeOfJob", e.target.value)}
                  />
                </Field>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Signing Date">
              <Input
                type="datetime-local"
                value={data.signingDate}
                onChange={(e) => set("signingDate", e.target.value)}
              />
            </Field>
            <Field label="ETA Job" hint="Estimated completion date for the job">
              <Input type="date" value={data.etaJob} onChange={(e) => set("etaJob", e.target.value)} />
            </Field>
          </div>
        </div>
      </Card>
    </div>
  );
}
