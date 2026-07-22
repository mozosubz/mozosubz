import { readFileSync } from 'fs'
import { join } from 'path'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const filePath = join(process.cwd(), 'bot-polling-system.md')
    const fileContent = readFileSync(filePath, 'utf-8')

    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': 'attachment; filename="bot-polling-system.md"',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error) {
    console.error('Error reading polling documentation:', error)
    return NextResponse.json(
      { error: 'Failed to read documentation' },
      { status: 500 }
    )
  }
}
