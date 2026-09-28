import { eq } from "drizzle-orm";
import { customers, getDb } from "@/db";
import { getSettingsCached } from "@/lib/settings";
import { CheckinWizard } from "@/components/checkin/wizard";
import { IdleLock } from "@/components/idle-lock";

export const dynamic = "force-dynamic";
export const metadata = { title: "New Check-In | UDS" };

export default async function CheckinPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string; fresh?: string }>;
}) {
  const s = await getSettingsCached();
  const { customer, fresh } = await searchParams;

  // Started from the quick-start with a returning customer: load them here so
  // the wizard opens with their details already filled in.
  let initialCustomer = null;
  const customerId = parseInt(customer || "", 10);
  if (!isNaN(customerId)) {
    const db = await getDb();
    const [row] = await db.select().from(customers).where(eq(customers.id, customerId));
    if (row) {
      initialCustomer = {
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        phone: row.phone,
        companyPhone: row.companyPhone,
        email: row.email,
        street: row.street,
        city: row.city,
        state: row.state,
        zip: row.zip,
        smsConsent: row.smsConsent,
      };
    }
  }

  return (
    <main className="min-h-dvh">
      <IdleLock minutes={Number(s.idleLockMinutes) || 0} />
      <CheckinWizard
        turnaroundBanner={s.turnaroundBanner}
        schema={s.formSchema}
        options={s.fieldOptions}
        googleMapsKey={s.googleMapsKey}
        initialCustomer={initialCustomer}
        fresh={fresh === "1" || initialCustomer !== null}
      />
    </main>
  );
}
