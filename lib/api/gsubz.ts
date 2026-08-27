"use server"

import { unstable_cache } from "next/cache"
const API_BASE_URL = "https://gsubz.com"
const API_PLANS_URL = "https://gsubz.com"
const API_KEY = process.env.GSUBZ_API_KEY || ""

/**
 * Gsubz responses come back in two shapes and the previous type only described
 * one of them, so every real field (api_response, transactionID, amount, token)
 * was a type error at each call site.
 *
 * Soft failure — HTTP 200, reason in `api_response`, no `description`:
 *   { code: 200, status: "failed", api_response: "...not eligible..." }
 * Hard failure / success — code as number OR string, ALL_CAPS `description`:
 *   { code: "402", status: "TRANSACTION_FAILED", description: "INSUFFICIENT_BALANCE" }
 */
export interface ApiResponseContent {
  transactionID?: number | string
  requestID?: number | string
  amount?: number | string
  phone?: string
  serviceID?: string
  email?: string
  customerID?: string
  plan?: string
  status?: string
  code?: number | string
  description?: string
  token?: string
  [key: string]: unknown
}

export interface ApiResponse {
  code: number | string
  status: string
  description?: string
  api_response?: string
  transactionID?: number | string
  requestID?: number | string
  amount?: number | string
  amountPaid?: number | string
  phone?: string
  serviceID?: string
  token?: string
  date?: string
  balance?: string | number
  content?: ApiResponseContent
  gateway?: Record<string, unknown>
}

interface PlanResponse {
  service: string
  PlanName: string
  fixedPrice: boolean
  plans: Array<{
    displayName: string
    value: string
    price: string
  }>
}

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

async function makeApiRequest(endpoint: string, method: "GET" | "POST" = "POST", body?: FormData) {
  const headers: HeadersInit = {
    Authorization: `Bearer ${API_KEY}`,
    "User-Agent": BROWSER_USER_AGENT,
    Accept: "application/json, text/plain, */*",
    "Connection": "keep-alive",
  }

  const options: RequestInit = {
    method,
    headers,
  }

  if (body && method === "POST") {
    options.body = body
  }

  // 2 minute timeout (120s) — gives the provider maximum time on slow networks.
  // Most transactions will complete before timeout. If it fires, a PENDING row is saved
  // and the background verify job polls every 500ms for 2 minutes as a safety net.
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 120000)

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = (await response.json()) as ApiResponse
    const content = data.content && typeof data.content === "object" ? data.content : undefined

    return {
      ...data,
      transactionID: data.transactionID ?? content?.transactionID,
      requestID: data.requestID ?? content?.requestID,
      amount: data.amount ?? content?.amount,
      phone: data.phone ?? content?.phone,
      serviceID: data.serviceID ?? content?.serviceID,
      token: data.token ?? content?.token,
      status: content?.status ?? data.status,
      description: content?.description ?? data.description,
    }
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

// Uncached function to fetch data plans from API
async function _fetchDataPlansFromAPI(serviceId: string): Promise<PlanResponse> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 sec timeout for plans

    const response = await fetch(`${API_PLANS_URL}/api/plans?service=${serviceId}`, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "User-Agent": BROWSER_USER_AGENT,
        Accept: "application/json, text/plain, */*",
        "Connection": "keep-alive",
        "Accept-Encoding": "gzip",
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error("[v0] Error fetching plans:", error)
    throw error
  }
}

// Uncached real-time fetch — use this for the v1 API so prices are always live
export async function getDataPlansRealtime(serviceId: string): Promise<PlanResponse> {
  return _fetchDataPlansFromAPI(serviceId)
}

// Cached wrapper for data plans - creates separate cache per serviceId
export async function getDataPlans(serviceId: string): Promise<PlanResponse> {
  const getCached = unstable_cache(
    async () => _fetchDataPlansFromAPI(serviceId),
    [`gsubz-data-plans-${serviceId}`],
    { revalidate: 1800 }
  )
  return getCached()
}

// Uncached function to fetch cable plans from API
async function _fetchCablePlansFromAPI(service: string): Promise<PlanResponse> {
  try {
    const response = await fetch(`${API_PLANS_URL}/api/plans?service=${service}`, {
      redirect: "follow",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "User-Agent": BROWSER_USER_AGENT,
        Accept: "application/json, text/plain, */*",
      },
    })

    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`)
    }

    const data = await response.json()

    // Transform the response to match expected format
    if (data.list && Array.isArray(data.list)) {
      const transformed = {
        service: data.service || service,
        PlanName: "plan",
        fixedPrice: data.fixedPrice !== undefined ? data.fixedPrice : true,
        plans: data.list.map((item: any) => ({
          displayName: item.display_name || item.displayName || "",
          value: item.value || "",
          price: item.price || "0",
        })),
      }
      return transformed
    }

    return data
  } catch (error) {
    throw error
  }
}

// Cached wrapper for cable plans - creates separate cache per service
export async function getCablePlans(service: string): Promise<PlanResponse> {
  const getCached = unstable_cache(
    async () => _fetchCablePlansFromAPI(service),
    [`gsubz-cable-plans-${service}`],
    { revalidate: 1800 }
  )
  return getCached()
}

export async function buyData(data: {
  serviceID: string
  plan: string
  phone: string
  requestID?: string
}): Promise<ApiResponse> {
  const formData = new FormData()
  formData.append("serviceID", data.serviceID)
  formData.append("plan", data.plan)
  formData.append("api", API_KEY)
  formData.append("amount", "")
  formData.append("phone", data.phone)
  if (data.requestID) {
    formData.append("requestID", data.requestID)
  }

  return makeApiRequest("/api/pay/", "POST", formData)
}

export async function buyAirtime(data: {
  serviceID: string
  amount: string
  phone: string
  requestID?: string
}): Promise<ApiResponse> {
  const formData = new FormData()
  formData.append("serviceID", data.serviceID)
  formData.append("api", API_KEY)
  formData.append("amount", data.amount)
  formData.append("phone", data.phone)
  if (data.requestID) {
    formData.append("requestID", data.requestID)
  }

  return makeApiRequest("/api/pay/", "POST", formData)
}

export async function buyCableSubscription(data: {
  serviceID: string
  plan: string
  amount: string
  phone: string
  email: string
  customerID: string
  requestID: string
}): Promise<ApiResponse> {
  const formData = new FormData()
  formData.append("serviceID", data.serviceID)
  formData.append("plan", data.plan)
  formData.append("amount", data.amount)
  formData.append("phone", data.phone)
  formData.append("email", data.email)
  formData.append("customerID", data.customerID)
  formData.append("requestID", data.requestID)

  return makeApiRequest("/pay", "POST", formData)
}

export async function buyElectricityToken(data: {
  serviceID: string
  phone: string
  customerID: string
  amount: string
  variationCode: "prepaid" | "postpaid"
}): Promise<ApiResponse> {
  const formData = new FormData()
  formData.append("serviceID", data.serviceID)
  formData.append("api", API_KEY)
  formData.append("phone", data.phone)
  formData.append("customerID", data.customerID)
  formData.append("amount", data.amount)
  formData.append("variation_code", data.variationCode)

  return makeApiRequest("/api/pay/", "POST", formData)
}

export async function getWalletBalance(): Promise<{ balance: string }> {
  const formData = new FormData()
  formData.append("api", API_KEY)
  const response = await makeApiRequest("/api/balance/", "POST", formData)
  return { balance: String(response.balance ?? "0") }
}

export async function getProviderBalance(): Promise<{ balance: string }> {
  const formData = new FormData()
  formData.append("api", API_KEY)
  const response = await makeApiRequest("/api/balance/", "POST", formData)
  return { balance: String(response.balance ?? "0") }
}

export async function verifyTransaction(requestID: string): Promise<ApiResponse> {
  const formData = new FormData()
  formData.append("api", API_KEY)
  formData.append("requestID", requestID)

  return makeApiRequest("/api/verify/", "POST", formData)
}

export async function generateRechargePins(data: {
  network: string
  value: string
  number: string
}): Promise<any> {
  const formData = new FormData()
  formData.append("network", data.network)
  formData.append("value", data.value)
  formData.append("number", data.number)

  return makeApiRequest("/apiV2/generate/", "POST", formData)
}
