import { NextResponse } from "next/server";
import { isConfigured } from "@/lib/supabase/config";
export function GET() {
  return NextResponse.json(
    {
      status: isConfigured() ? "configured" : "configuration_required",
      payments: "mock_only",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
