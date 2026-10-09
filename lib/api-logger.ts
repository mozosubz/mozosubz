import "server-only"
import { NextRequest, NextResponse } from 'next/server'

interface RequestLog {
  timestamp: string
  method: string
  path: string
  url: string
  headers: Record<string, string>
  query: Record<string, string>
  body?: unknown
  userAgent?: string
  ip?: string
}

interface ResponseLog {
  statusCode: number
  duration: number
  size?: number
  error?: string
}

export function logRequest(req: NextRequest): RequestLog {
  const url = new URL(req.url)
  const headers: Record<string, string> = {}
  
  req.headers.forEach((value, key) => {
    headers[key] = value
  })

  const query: Record<string, string> = {}
  url.searchParams.forEach((value, key) => {
    query[key] = value
  })

  const log: RequestLog = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: url.pathname,
    url: url.toString(),
    headers,
    query,
    userAgent: req.headers.get('user-agent') ?? undefined,
    ip: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown',
  }

  return log
}

export async function logRequestWithBody(req: NextRequest): Promise<RequestLog> {
  const log = logRequest(req)
  
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const contentType = req.headers.get('content-type')
      if (contentType?.includes('application/json')) {
        const clonedReq = req.clone()
        const body = await clonedReq.json()
        log.body = body
      }
    }
  } catch (err) {
    log.body = '[Unable to parse body]'
  }

  return log
}

export function logResponse(statusCode: number, duration: number, size?: number, error?: string): ResponseLog {
  return {
    statusCode,
    duration,
    size,
    error,
  }
}

export function formatLog(request: RequestLog, response: ResponseLog): string {
  const statusEmoji = response.statusCode >= 200 && response.statusCode < 300 ? '✓' : '✗'
  const body = request.body ? ` | Body: ${JSON.stringify(request.body).substring(0, 100)}` : ''
  const error = response.error ? ` | Error: ${response.error}` : ''
  
  return `[API] ${statusEmoji} ${request.method} ${request.path} | Status: ${response.statusCode} | ${response.duration}ms${body}${error}`
}

export function debugLog(request: RequestLog, response: ResponseLog): void {
}
