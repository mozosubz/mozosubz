import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

export async function GET(request: NextRequest) {
  try {
    // Read the bot.md file
    const filePath = join(process.cwd(), 'bot.md')
    const fileContent = await readFile(filePath, 'utf-8')

    // Return as downloadable file
    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': 'attachment; filename="bot-guide.md"',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error) {
    console.error('[Bot Guide Download] Error:', error)
    return NextResponse.json(
      { error: 'Failed to download bot guide' },
      { status: 500 }
    )
  }
}
