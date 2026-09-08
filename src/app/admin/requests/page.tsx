import { RequestsInbox } from "./inbox";
import { getSettingsCached } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Requests | UDS Admin" };

export default async function AdminRequestsPage() {
  const s = await getSettingsCached();
  return (
    <RequestsInbox
      inboxEmail={s.requestsEmail || ""}
      emailEnabled={!!s.requestsEmailEnabled && !!s.emailEnabled}
      replyPollEnabled={!!s.imapEnabled}
    />
  );
}
