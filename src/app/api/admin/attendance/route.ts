import { NextRequest, NextResponse } from "next/server";
import { sessionFromRequest } from "@/lib/session";
import { getShopConfig } from "@/lib/settings";
import { getDayBoard, todayKeyFor } from "@/lib/performance";
import { scheduleForDay, weekdayOf } from "@/lib/work-hours";

/** Attendance board for one day (`?date=YYYY-MM-DD`, defaults to today). */
export async function GET(req: NextRequest) {
  if (sessionFromRequest(req)?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  const config = await getShopConfig();
  const param = req.nextUrl.searchParams.get("date") || "";
  const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : todayKeyFor(config);
  const board = await getDayBoard(dateKey);
  return NextResponse.json({
    date: dateKey,
    schedule: scheduleForDay(config.workHours, weekdayOf(dateKey)),
    board: board.map(({ user, record }) => ({
      userId: user.id,
      name: user.name,
      title: user.title,
      record,
    })),
  });
}
