import { readFileSync } from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'deposit-api.md')
    const fileContent = readFileSync(filePath, 'utf-8')

    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': 'attachment; filename="deposit-api.md"',
        'Cache-Control': 'public, max-age=3600, immutable',
      },
    })
  } catch (error) {
    console.error('Error reading deposit-api.md:', error)
    return NextResponse.json(
      { error: 'File not found' },
      { status: 404 }
    )
  }
}
