import { ExternalLink, Globe } from "lucide-react";
import { Card } from "@/components/ui";
import type { OnlineBuild } from "@/lib/integration-shared";

const isHttps = (v: string) => /^https:\/\/[^\s"'<>]+$/.test(v);

/**
 * A custom driveshaft ordered in the online builder, laid out for the bench: the drawing with its dimensions, the
 * figures that matter at a glance, then the build grouped by section (application, shaft, ends and yokes,
 * measurements, order). Prints with the job sheet.
 */
export function OnlineBuildCard({ build, image }: { build: OnlineBuild; image: string }) {
  const drawing = isHttps(image) ? image : isHttps(build.links.drawing) ? build.links.drawing : "";
  return (
    <Card className="p-5 break-inside-avoid">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
            <Globe className="w-3.5 h-3.5" /> Online builder · custom driveshaft
          </p>
          <h2 className="font-bold text-lg leading-snug mt-1">{build.title || "Custom driveshaft"}</h2>
          {build.subtitle && <p className="text-sm text-ink-500 mt-0.5">{build.subtitle}</p>}
        </div>
        {isHttps(build.links.build) && (
          <a href={build.links.build} target="_blank" rel="noopener noreferrer"
            className="no-print inline-flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">
            Open in the builder <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>

      {drawing && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={drawing} alt="Drawing of the build with its dimensions" className="mt-4 w-full max-h-80 object-contain rounded-xl border border-ink-200 bg-white" />
      )}

      {build.highlights.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {build.highlights.map((h, i) => (
            <div key={i} className="rounded-xl border border-brand-100 bg-brand-50 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-700">{h.label}</p>
              <p className="text-base font-bold text-ink-900 font-mono">{h.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 grid gap-x-8 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
        {build.sections.map((s, i) => (
          <section key={i} className="min-w-0 break-inside-avoid">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-ink-500 border-b border-ink-200 pb-1.5 mb-1">{s.title}</h3>
            <dl>
              {s.rows.map(([label, value], j) => (
                <div key={j} className="grid grid-cols-[minmax(0,42%)_minmax(0,1fr)] gap-3 py-1.5 border-b border-ink-100 last:border-0">
                  <dt className="text-xs text-ink-500">{label}</dt>
                  <dd className="text-sm font-medium text-ink-900 break-words whitespace-pre-line">
                    {isHttps(value) ? <a href={value} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">Open</a> : value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      {build.note && <p className="mt-4 text-xs text-ink-500">{build.note}</p>}
    </Card>
  );
}
