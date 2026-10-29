import { NextRequest, NextResponse } from "next/server";
import { desc, ilike, or, sql } from "drizzle-orm";
import { getDb, customers } from "@/db";
import { normalizePhone } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ customers: [] });

  const db = await getDb();
  const digits = normalizePhone(q);
  const isPhone = digits.length >= 3 && /^[\d\s()+-]+$/.test(q);

  let rows;
  if (isPhone) {
    rows = await db
      .select()
      .from(customers)
      .where(or(ilike(customers.phone, `%${digits}%`), ilike(customers.companyPhone, `%${digits}%`)))
      .orderBy(desc(customers.updatedAt))
      .limit(8);
  } else {
    const terms = q.split(/\s+/).filter(Boolean);
    const conds = terms.map((t) =>
      or(
        ilike(customers.firstName, `%${t}%`),
        ilike(customers.lastName, `%${t}%`),
        ilike(customers.companyName, `%${t}%`),
        ilike(customers.email, `%${t}%`)
      )
    );
    rows = await db
      .select()
      .from(customers)
      .where(sql.join(conds.map((c) => sql`(${c})`), sql` AND `))
      .orderBy(desc(customers.updatedAt))
      .limit(8);
  }

  return NextResponse.json({
    customers: rows.map((c) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      phone: c.phone,
      companyName: c.companyName,
      companyPhone: c.companyPhone,
      email: c.email,
      street: c.street,
      city: c.city,
      state: c.state,
      zip: c.zip,
      smsConsent: c.smsConsent,
    })),
  });
}
