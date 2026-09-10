import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { ArrowUpRight, Info } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui";
import { getSession } from "@/lib/session";
import { getShopConfig } from "@/lib/settings";
import { describeWorkHours } from "@/lib/work-hours";
import { fillTokens, guideFor } from "@/lib/guide";

export const metadata = { title: "Guide | UDS Check-In" };
export const dynamic = "force-dynamic";

export default async function HelpPage() {
  const session = await getSession();
  if (!session) redirect("/lock?next=/help");

  const config = await getShopConfig();
  const tokens = { workHours: describeWorkHours(config.workHours).join(", ") };
  const sections = guideFor(session.role);

  return (
    <AppShell session={session} active="/help">
      <div className="lg:flex lg:gap-8 lg:items-start">
        {/* Contents — sticky on a desktop, a scrolling strip on a phone */}
        <nav className="lg:w-56 shrink-0 lg:sticky lg:top-[4.5rem] mb-4 lg:mb-0">
          <p className="max-lg:hidden text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400 px-2 pb-2">
            Contents
          </p>
          <div className="flex lg:flex-col gap-1 overflow-x-auto no-scrollbar -mx-3 px-3 lg:mx-0 lg:px-0">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="shrink-0 px-3 py-2 rounded-lg text-[13px] font-semibold text-ink-600 hover:bg-white hover:text-brand-700 border border-transparent hover:border-ink-200 transition-colors whitespace-nowrap"
              >
                {s.title}
              </a>
            ))}
          </div>
        </nav>

        <div className="min-w-0 flex-1 space-y-8">
          {sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24 space-y-3">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-ink-900">{section.title}</h2>
                <p className="text-[13px] text-ink-500 mt-0.5">{section.blurb}</p>
              </div>

              {section.topics.map((topic) => (
                <Card key={topic.id} id={topic.id} className="p-4 sm:p-5 scroll-mt-24">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-bold text-ink-900">{topic.title}</h3>
                      <p className="text-[13px] text-ink-500 mt-0.5">{topic.summary}</p>
                    </div>
                    {topic.href && (
                      <Link
                        href={topic.href}
                        className="shrink-0 inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-ink-200 text-[12px] font-semibold text-ink-600 hover:border-brand-400 hover:text-brand-700 transition-colors"
                      >
                        Open it <ArrowUpRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>

                  <ol className="mt-3.5 space-y-2">
                    {topic.steps.map((step, i) => (
                      <li key={i} className="flex gap-2.5 text-[13.5px] text-ink-700 leading-relaxed">
                        <span className="shrink-0 mt-0.5 w-5 h-5 rounded-md bg-ink-100 text-ink-500 text-[11px] font-bold flex items-center justify-center tabular-nums">
                          {i + 1}
                        </span>
                        <span className="min-w-0">{step}</span>
                      </li>
                    ))}
                  </ol>

                  {topic.note && (
                    <p className="mt-3.5 flex gap-2.5 rounded-lg bg-brand-50 border border-brand-100 px-3 py-2.5 text-[13px] text-brand-900 leading-relaxed">
                      <Info className="w-4 h-4 shrink-0 mt-0.5 text-brand-600" />
                      <span className="min-w-0">{fillTokens(topic.note, tokens)}</span>
                    </p>
                  )}

                  {topic.shot && (
                    <figure className="mt-4">
                      <div className="rounded-lg border border-ink-200 overflow-hidden bg-ink-50">
                        <Image
                          src={topic.shot.src}
                          alt={topic.shot.alt}
                          width={1200}
                          height={800}
                          className="w-full h-auto block"
                          unoptimized
                        />
                      </div>
                      <figcaption className="mt-1.5 text-[12px] text-ink-400">{topic.shot.alt}</figcaption>
                    </figure>
                  )}
                </Card>
              ))}
            </section>
          ))}

          <Card className="p-4 sm:p-5 bg-ink-50">
            <p className="text-[13px] text-ink-600 leading-relaxed">
              Something here not match what you see on screen? The pictures are taken from the app itself, so if they
              are out of date the app has moved on — tell your manager and they will have them retaken.
            </p>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
