import { NextRequest, NextResponse } from 'next/server'
import { logRequestWithBody, logResponse, formatLog } from './api-logger'

export type ApiHandler = (request: NextRequest) => Promise<NextResponse>

/**
 * Wraps an API handler with automatic request/response logging
 * Usage: export const POST = withApiLogging(yourHandler)
 */
export function withApiLogging(handler: ApiHandler, endpointName: string) {
  return async (request: NextRequest) => {
    const startTime = Date.now()
    const requestLog = await logRequestWithBody(request)

    try {
      console.log(`[${endpointName}] → ${request.method} ${request.nextUrl.pathname}`)
      
      const response = await handler(request)
      
      const duration = Date.now() - startTime
      const responseLog = logResponse(response.status, duration, 0)
      
      console.log(formatLog(requestLog, responseLog))
      
      return response
    } catch (err) {
      const duration = Date.now() - startTime
      console.error(`[${endpointName}] ✗ Error: ${err} | ${duration}ms`)
      
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}
