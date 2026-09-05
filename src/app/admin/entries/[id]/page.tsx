import { EntryDetail } from "@/components/entry-detail";

export default async function AdminEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <EntryDetail id={parseInt(id)} basePath="/admin/entries" backHref="/admin/entries" backLabel="Entries" admin />
  );
}
