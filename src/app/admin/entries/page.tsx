"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Search } from "lucide-react";
import { Button, Card, Input, Select, StatusBadge, Badge, Spinner } from "@/components/ui";
import { formatDateTime, formatMoney, formatPhone } from "@/lib/utils";
import formOptions from "@/lib/form-options.json";

type Row = {
  id: number;
  jobNumber: string;
  jobStatus: string;
  payment: string;
  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;
  laborRequest: string;
  total: string | null;
  deposit: string | null;
  createdAt: string;
  etaJob: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
};

function EntriesInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const q = params.get("q") || "";
  const status = params.get("status") || "";
  const payment = params.get("payment") || "";
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  const page = Math.max(1, parseInt(params.get("page") || "1"));
  const pageSize = 25;

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== "page") next.delete("page");
      router.replace(`/admin/entries?${next.toString()}`);
    },
    [params, router]
  );

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show the spinner while the fetch below runs
    setLoading(true);
    const usp = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (q) usp.set("q", q);
    if (status) usp.set("status", status);
    if (payment) usp.set("payment", payment);
    if (from) usp.set("from", from);
    if (to) usp.set("to", to);
    fetch(`/api/entries?${usp.toString()}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        setRows(j.rows || []);
        setTotal(j.total || 0);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [q, status, payment, from, to, page]);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  const exportUrl = (() => {
    const usp = new URLSearchParams();
    if (q) usp.set("q", q);
    if (status) usp.set("status", status);
    if (payment) usp.set("payment", payment);
    if (from) usp.set("from", from);
    if (to) usp.set("to", to);
    return `/api/export?${usp.toString()}`;
  })();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Entries</h1>
          <p className="text-sm text-ink-500 mt-0.5">{total} check-ins</p>
        </div>
        <a href={exportUrl} download>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </a>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="relative col-span-2">
            <Search className="w-4.5 h-4.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            <Input
              defaultValue={q}
              onChange={(e) => {
                const v = e.target.value;
                clearTimeout((window as unknown as { __qT?: number }).__qT);
                (window as unknown as { __qT?: number }).__qT = window.setTimeout(() => setParam("q", v), 350);
              }}
              placeholder="Name, phone, job #, vehicle…"
              className="pl-10 h-11"
            />
          </div>
          <Select value={status} onChange={(e) => setParam("status", e.target.value)} placeholder="All statuses" className="h-11">
            {["New", ...formOptions.jobStatuses].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select value={payment} onChange={(e) => setParam("payment", e.target.value)} placeholder="All payments" className="h-11">
            {formOptions.payments.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Input type="date" value={from} onChange={(e) => setParam("from", e.target.value)} className="h-11" />
          <Input type="date" value={to} onChange={(e) => setParam("to", e.target.value)} className="h-11" />
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-500 border-b border-ink-200 bg-ink-50">
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Vehicle</th>
                <th className="px-4 py-3 font-semibold max-lg:hidden">Labor</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold max-sm:hidden">Payment</th>
                <th className="px-4 py-3 font-semibold text-right max-lg:hidden">Total</th>
                <th className="px-4 py-3 font-semibold text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <Spinner className="text-brand-600" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-ink-400">
                    No entries match these filters.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => router.push(`/admin/entries/${r.id}`)}
                    className="cursor-pointer hover:bg-ink-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-ink-900">
                        {r.firstName || r.lastName ? `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() : "—"}
                      </p>
                      <p className="text-xs text-ink-500">
                        {formatPhone(r.phone || "")}
                        {r.jobNumber ? ` · Job ${r.jobNumber}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-ink-700">
                      {[r.vehicleYear, r.vehicleMake, r.vehicleModel].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-ink-600 max-lg:hidden">{r.laborRequest || "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.jobStatus} />
                    </td>
                    <td className="px-4 py-3 max-sm:hidden">
                      {r.payment ? (
                        <Badge tone={r.payment === "Paid" ? "success" : r.payment === "Unpaid" ? "danger" : "warning"}>
                          {r.payment}
                        </Badge>
                      ) : (
                        <span className="text-ink-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium max-lg:hidden">{formatMoney(r.total)}</td>
                    <td className="px-4 py-3 text-right text-ink-500 whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-ink-200 bg-ink-50">
            <span className="text-xs text-ink-500">
              Page {page} of {pages}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setParam("page", String(page - 1))}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setParam("page", String(page + 1))}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function EntriesPage() {
  return (
    <Suspense>
      <EntriesInner />
    </Suspense>
  );
}
