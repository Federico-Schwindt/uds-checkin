import { RequestsInbox } from "./inbox";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Requests | UDS Admin" };

export default async function AdminRequestsPage() {
  const s = await getSettings();
  return (
    <RequestsInbox
      inboxEmail={s.requestsEmail || ""}
      emailEnabled={!!s.requestsEmailEnabled && !!s.emailEnabled}
      replyPollEnabled={!!s.imapEnabled}
    />
  );
}
