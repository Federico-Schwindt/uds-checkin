import { AnnouncementsManager } from "./manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notices | UDS Admin" };

export default function AnnouncementsPage() {
  return <AnnouncementsManager />;
}
