import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public health probe for container/PaaS orchestration. Never cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const timestamp = new Date().toISOString();

  let database: "up" | "down" = "up";
  try {
    // Lightweight round-trip to confirm the DB connection is alive.
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "down";
  }

  const healthy = database === "up";

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      app: "up",
      database,
      timestamp,
    },
    { status: healthy ? 200 : 503 },
  );
}
