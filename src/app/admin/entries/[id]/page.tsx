import { EntryDetail } from "./entry-detail";

export default async function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EntryDetail id={parseInt(id)} />;
}
