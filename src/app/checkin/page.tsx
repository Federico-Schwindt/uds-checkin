import { getSettings } from "@/lib/settings";
import { CheckinWizard } from "@/components/checkin/wizard";
import { IdleLock } from "@/components/idle-lock";

export const dynamic = "force-dynamic";
export const metadata = { title: "New Check-In | UDS" };

export default async function CheckinPage() {
  const s = await getSettings();
  return (
    <main className="min-h-dvh">
      <IdleLock minutes={Number(s.idleLockMinutes) || 0} />
      <CheckinWizard turnaroundBanner={s.turnaroundBanner} schema={s.formSchema} options={s.fieldOptions} />
    </main>
  );
}
