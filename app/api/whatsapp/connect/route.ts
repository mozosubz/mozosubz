import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    return NextResponse.json({ success: true, test: true, received: body })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
