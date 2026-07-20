import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Public signup is closed. Create a shop from the homepage, or ask your shop admin to add users in Settings." },
    { status: 403 },
  );
}
