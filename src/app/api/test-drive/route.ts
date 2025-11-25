import { NextResponse } from "next/server";
import { createClientFolders } from "@/lib/s3";

export async function GET() {
  try {
    const folders = await createClientFolders("Test Client");
    return NextResponse.json({ success: true, folders });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
