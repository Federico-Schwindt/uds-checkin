import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";
import { allFields, holdsValue } from "@/lib/form-schema";
import { resolveSchema } from "@/lib/form-schema-default";

/** Exposes the active schema plus a key→label map, used to title custom values. */
export async function GET() {
  const s = await getSettings();
  const schema = resolveSchema(s.formSchema);
  const labels: Record<string, string> = {};
  for (const f of allFields(schema)) {
    if (!f.core && holdsValue(f.type) && f.key) labels[f.key] = f.label || f.key;
  }
  return NextResponse.json({ schema, labels });
}
