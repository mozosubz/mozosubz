"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { Footer } from "@/components/footer"
import { ChevronRight, Copy, Check, Send, Loader2 } from "lucide-react"

const API_BASE = "https://mozosubz.xyz/api/v1"

const DATA_SERVICES = [
  { id: "mtn_sme", network: "MTN", type: "SME", plans: 5, note: "MTN SME reseller data" },
  { id: "mtn_datashare", network: "MTN", type: "Data Share", plans: 5, note: "MTN data share plans" },
  { id: "mtn_gifting", network: "MTN", type: "Gifting", plans: 30, note: "MTN gifting bundles" },
  { id: "mtn_awoof", network: "MTN", type: "AWOOF", plans: 3, note: "MTN AWOOF special offers" },
  { id: "glo_data", network: "Glo", type: "Data", plans: 13, note: "Standard Glo data plans" },
  { id: "glo_sme", network: "Glo", type: "SME", plans: 4, note: "Glo SME reseller plans" },
  { id: "airtel_sme", network: "Airtel", type: "SME", plans: 5, note: "Airtel SME plans" },
  { id: "airtel_gifting", network: "Airtel", type: "Gifting", plans: 28, note: "Airtel gifting bundles" },
  { id: "etisalat_data", network: "9mobile", type: "9mobile", plans: null, note: "9mobile (Etisalat) data plans" },
]

const AIRTIME_NETWORKS = [
  { id: "mtn", label: "MTN" },
  { id: "glo", label: "Glo" },
  { id: "airtel", label: "Airtel" },
  { id: "etisalat", label: "9mobile (Etisalat)" },
]

interface ApiResponse {
  data?: unknown
  error?: string
  status?: number
  duration?: number
}

export default function DocPage() {
  const [apiKey, setApiKey] = useState("")
  const [activeTab, setActiveTab] = useState<"data-plans" | "data-purchase" | "airtime">("data-plans")
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<ApiResponse | null>(null)

  // Data Plans state
  const [selectedService, setSelectedService] = useState(DATA_SERVICES[0].id)
  const [dataPlans, setDataPlans] = useState<any[]>([])

  // Data Purchase state
  const [purchaseService, setPurchaseService] = useState(DATA_SERVICES[0].id)
  const [purchasePlanId, setPurchasePlanId] = useState("")
  const [purchasePhone, setPurchasePhone] = useState("")

  // Airtime state
  const [airtimeNetwork, setAirtimeNetwork] = useState(AIRTIME_NETWORKS[0].id)
  const [airtimeAmount, setAirtimeAmount] = useState("100")
  const [airtimePhone, setAirtimePhone] = useState("")

  const handleTestDataPlans = async () => {
    if (!apiKey) {
      setResponse({ error: "Please enter your API key" })
      return
    }

    setLoading(true)
    const startTime = Date.now()

    try {
      const res = await fetch(`${API_BASE}/data/plans?service=${selectedService}`, {
        method: "GET",
        headers: {
          "X-Connect-Key": apiKey,
        },
      })

      const data = await res.json()
      const duration = Date.now() - startTime

      if (data.success && data.plans) {
        setDataPlans(data.plans)
        if (data.plans.length > 0) {
          setPurchasePlanId(data.plans[0].id)
        }
      }

      setResponse({
        data: data,
        status: res.status,
        duration,
        error: data.error,
      })
    } catch (err: any) {
      const duration = Date.now() - startTime
      setResponse({
        error: err.message,
        duration,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleTestDataPurchase = async () => {
    if (!apiKey) {
      setResponse({ error: "Please enter your API key" })
      return
    }

    if (!purchasePlanId || !purchasePhone) {
      setResponse({ error: "Please fill all fields (service, plan, phone)" })
      return
    }

    setLoading(true)
    const startTime = Date.now()

    try {
      const res = await fetch(`${API_BASE}/data/purchase`, {
        method: "POST",
        headers: {
          "X-Connect-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          service: purchaseService,
          plan_id: purchasePlanId,
          phone: purchasePhone,
        }),
      })

      const data = await res.json()
      const duration = Date.now() - startTime

      setResponse({
        data: data,
        status: res.status,
        duration,
        error: data.error,
      })
    } catch (err: any) {
      const duration = Date.now() - startTime
      setResponse({
        error: err.message,
        duration,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleTestAirtime = async () => {
    if (!apiKey) {
      setResponse({ error: "Please enter your API key" })
      return
    }

    if (!airtimePhone || !airtimeAmount) {
      setResponse({ error: "Please fill all fields (network, amount, phone)" })
      return
    }

    setLoading(true)
    const startTime = Date.now()

    try {
      const res = await fetch(`${API_BASE}/airtime/purchase`, {
        method: "POST",
        headers: {
          "X-Connect-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          network: airtimeNetwork,
          amount: parseFloat(airtimeAmount),
          phone: airtimePhone,
        }),
      })

      const data = await res.json()
      const duration = Date.now() - startTime

      setResponse({
        data: data,
        status: res.status,
        duration,
        error: data.error,
      })
    } catch (err: any) {
      const duration = Date.now() - startTime
      setResponse({
        error: err.message,
        duration,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/" className="text-lg font-bold text-primary hover:opacity-80 transition">
              Mozosubz
            </Link>
            <span className="text-border hidden sm:inline">/</span>
            <span className="text-sm text-text-2 hidden sm:inline">API Tester</span>
          </div>
          <Link href="/integrations/keys" className="text-xs sm:text-[13px] font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-primary text-white hover:opacity-90 transition flex items-center gap-1.5">
            <span className="hidden sm:inline">Get API Key</span>
            <span className="sm:hidden">Key</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* API Key Input */}
        <div className="mb-8">
          <div className="p-4 rounded-lg bg-secondary/50 border border-border">
            <label className="block text-sm font-semibold text-foreground mb-2">API Key (X-Connect-Key)</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="paste_your_api_key_here"
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {(["data-plans", "data-purchase", "airtime"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab)
                setResponse(null)
              }}
              className={`px-4 py-2 rounded-lg font-medium transition text-sm ${
                activeTab === tab
                  ? "bg-primary text-white"
                  : "bg-secondary/50 text-text-2 hover:bg-secondary"
              }`}
            >
              {tab === "data-plans" && "Data Plans"}
              {tab === "data-purchase" && "Buy Data"}
              {tab === "airtime" && "Buy Airtime"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Request Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-foreground">Request</h2>

            {activeTab === "data-plans" && (
              <div className="space-y-3 p-4 rounded-lg bg-secondary/30 border border-border">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Service</label>
                  <select
                    value={selectedService}
                    onChange={(e) => setSelectedService(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  >
                    {DATA_SERVICES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.network} - {s.type}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="p-3 rounded-lg bg-background border border-border text-xs text-text-2 font-mono">
                  GET /api/v1/data/plans?service={selectedService}
                </div>
                <button
                  onClick={handleTestDataPlans}
                  disabled={loading}
                  className="w-full px-4 py-2 rounded-lg bg-primary text-white font-medium hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Test Request
                </button>
              </div>
            )}

            {activeTab === "data-purchase" && (
              <div className="space-y-3 p-4 rounded-lg bg-secondary/30 border border-border">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Service</label>
                  <select
                    value={purchaseService}
                    onChange={(e) => {
                      setPurchaseService(e.target.value)
                      setDataPlans([])
                      setPurchasePlanId("")
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  >
                    {DATA_SERVICES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.network} - {s.type}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Plan</label>
                  {dataPlans.length > 0 ? (
                    <select
                      value={purchasePlanId}
                      onChange={(e) => setPurchasePlanId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    >
                      {dataPlans.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.displayName} - ₦{p.price}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <button
                      onClick={handleTestDataPlans}
                      className="w-full px-3 py-2 rounded-lg bg-secondary text-text-2 border border-border text-sm hover:bg-secondary/80 transition"
                    >
                      Load Plans for {purchaseService}
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Phone Number</label>
                  <input
                    type="tel"
                    value={purchasePhone}
                    onChange={(e) => setPurchasePhone(e.target.value)}
                    placeholder="08012345678"
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                </div>

                <div className="p-3 rounded-lg bg-background border border-border text-xs text-text-2 font-mono overflow-x-auto">
                  POST /api/v1/data/purchase
                </div>

                <button
                  onClick={handleTestDataPurchase}
                  disabled={loading || !purchasePlanId}
                  className="w-full px-4 py-2 rounded-lg bg-accent text-white font-medium hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Purchase Data
                </button>
              </div>
            )}

            {activeTab === "airtime" && (
              <div className="space-y-3 p-4 rounded-lg bg-secondary/30 border border-border">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Network</label>
                  <select
                    value={airtimeNetwork}
                    onChange={(e) => setAirtimeNetwork(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  >
                    {AIRTIME_NETWORKS.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Amount (₦)</label>
                  <input
                    type="number"
                    value={airtimeAmount}
                    onChange={(e) => setAirtimeAmount(e.target.value)}
                    placeholder="100"
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Phone Number</label>
                  <input
                    type="tel"
                    value={airtimePhone}
                    onChange={(e) => setAirtimePhone(e.target.value)}
                    placeholder="08012345678"
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                </div>

                <div className="p-3 rounded-lg bg-background border border-border text-xs text-text-2 font-mono overflow-x-auto">
                  POST /api/v1/airtime/purchase
                </div>

                <button
                  onClick={handleTestAirtime}
                  disabled={loading}
                  className="w-full px-4 py-2 rounded-lg bg-accent text-white font-medium hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Buy Airtime
                </button>
              </div>
            )}
          </div>

          {/* Response Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-foreground">Response</h2>

            {response ? (
              <div className="p-4 rounded-lg bg-secondary/30 border border-border max-h-96 overflow-y-auto">
                {response.status && (
                  <div className="mb-3 pb-3 border-b border-border">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${response.status === 200 ? "bg-success/20 text-success" : "bg-error/20 text-error"}`}>
                      {response.status}
                    </span>
                    {response.duration && <span className="ml-2 text-xs text-text-3">{response.duration}ms</span>}
                  </div>
                )}

                {response.error && (
                  <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm mb-3">
                    {response.error}
                  </div>
                )}

                {response.data && (
                  <pre className="text-xs text-foreground bg-background p-3 rounded-lg border border-border overflow-x-auto font-mono">
                    {JSON.stringify(response.data, null, 2)}
                  </pre>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-secondary/30 border border-dashed border-border text-text-3 text-sm text-center py-12">
                Send a request to see the response here
              </div>
            )}
          </div>
        </div>

        {/* Reference Section */}
        <div className="mt-12 space-y-6">
          <h2 className="text-xl font-bold text-foreground">Reference</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 rounded-lg bg-secondary/30 border border-border">
              <h3 className="font-bold text-foreground mb-3">Data Services</h3>
              <div className="space-y-2 text-sm">
                {DATA_SERVICES.map((s) => (
                  <div key={s.id} className="flex items-start gap-2">
                    <code className="text-primary font-mono text-xs bg-background px-2 py-1 rounded flex-shrink-0">{s.id}</code>
                    <span className="text-text-2">{s.network} {s.type}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-lg bg-secondary/30 border border-border">
              <h3 className="font-bold text-foreground mb-3">Airtime Networks</h3>
              <div className="space-y-2 text-sm">
                {AIRTIME_NETWORKS.map((n) => (
                  <div key={n.id} className="flex items-center gap-2">
                    <code className="text-primary font-mono text-xs bg-background px-2 py-1 rounded">{n.id}</code>
                    <span className="text-text-2">{n.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Complete API Documentation */}
        <div className="mt-16 space-y-12 pb-12">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-6">Complete API Documentation</h2>

            {/* Getting Started */}
            <div className="space-y-6">
              <div className="p-6 rounded-lg bg-primary/5 border border-primary/20">
                <h3 className="text-lg font-bold text-foreground mb-3">Getting Started</h3>
                <p className="text-text-2 text-sm mb-4">
                  The Mozosubz V1 API allows you to purchase data and airtime programmatically. All requests require authentication using your API Connect Key.
                </p>
                <div className="space-y-2 text-sm">
                  <p><strong className="text-foreground">Base URL:</strong> <code className="bg-background px-2 py-1 rounded text-primary border border-border text-xs">{API_BASE}</code></p>
                  <p><strong className="text-foreground">Authentication:</strong> Include your API key in the <code className="bg-background px-2 py-1 rounded text-primary border border-border text-xs">X-Connect-Key</code> header</p>
                  <p><strong className="text-foreground">Response Format:</strong> All responses are in JSON format</p>
                </div>
              </div>

              {/* API Key Format */}
              <div className="p-6 rounded-lg bg-secondary/30 border border-border">
                <h3 className="text-lg font-bold text-foreground mb-4">API Key Format</h3>
                <div className="space-y-3">
                  <p className="text-text-2 text-sm">Your API key format looks like:</p>
                  <code className="block bg-background p-4 rounded-lg border border-border text-primary font-mono text-sm overflow-x-auto">
                    connect_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p
                  </code>
                  <p className="text-text-3 text-xs">
                    You can generate and manage your API keys from the <Link href="/integrations/keys" className="text-primary hover:underline">API Keys page</Link>.
                  </p>
                </div>
              </div>
            </div>

            {/* Endpoints Documentation */}
            <div className="mt-8 space-y-8">
              {/* Endpoint 1: Data Plans */}
              <div className="border-l-4 border-primary pl-6">
                <h3 className="text-lg font-bold text-foreground mb-4">1. Get Data Plans</h3>
                
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-background border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 rounded text-xs font-bold bg-blue-500/20 text-blue-600">GET</span>
                      <code className="text-primary font-mono text-sm">/api/v1/data/plans</code>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-foreground text-sm mb-2">Query Parameters:</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex gap-2">
                        <code className="text-primary bg-background px-2 py-1 rounded border border-border text-xs flex-shrink-0">service*</code>
                        <div>
                          <p className="text-foreground font-medium">Required. The data service ID</p>
                          <p className="text-text-3 text-xs">Example: <code className="bg-background px-1.5 py-0.5 rounded">mtn_sme</code>, <code className="bg-background px-1.5 py-0.5 rounded">glo_data</code></p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-foreground text-sm mb-2">Headers:</h4>
                    <code className="block bg-background p-3 rounded-lg border border-border text-text-2 font-mono text-xs overflow-x-auto">
                      X-Connect-Key: your_api_key_here
                    </code>
                  </div>

                  <div>
                    <h4 className="font-semibold text-foreground text-sm mb-2">Response Example:</h4>
                    <pre className="bg-background p-3 rounded-lg border border-border text-primary font-mono text-xs overflow-x-auto">
{JSON.stringify({
  success: true,
  service: "mtn_sme",
  plans: [
    {
      id: "plan_1",
      displayName: "1GB",
      price: 500,
      validity: "30 days"
    }
  ]
}, null, 2)}
                    </pre>
                  </div>

                  <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-success text-xs">
                    <strong>✓ Status 200:</strong> Successfully retrieved data plans
                  </div>
                </div>
              </div>

              {/* Endpoint 2: Buy Data */}
              <div className="border-l-4 border-accent pl-6">
                <h3 className="text-lg font-bold text-foreground mb-4">2. Purchase Data</h3>
                
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-background border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 rounded text-xs font-bold bg-orange-500/20 text-orange-600">POST</span>
                      <code className="text-primary font-mono text-sm">/api/v1/data/purchase</code>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-foreground text-sm mb-2">Request Body:</h4>
                    <pre className="bg-background p-3 rounded-lg border border-border text-primary font-mono text-xs overflow-x-auto">
{JSON.stringify({
  service: "mtn_sme",
  plan_id: "plan_1",
  phone: "08012345678"
}, null, 2)}
                    </pre>
                  </div>

                  <div>
                    <h4 className="font-semibold text-foreground text-sm mb-2">Request Fields:</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex gap-2">
                        <code className="text-primary bg-background px-2 py-1 rounded border border-border text-xs flex-shrink-0">service*</code>
                        <div>
                          <p className="text-foreground font-medium">Data service ID</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <code className="text-primary bg-background px-2 py-1 rounded border border-border text-xs flex-shrink-0">plan_id*</code>
                        <div>
                          <p className="text-foreground font-medium">Plan ID from data plans endpoint</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <code className="text-primary bg-background px-2 py-1 rounded border border-border text-xs flex-shrink-0">phone*</code>
                        <div>
                          <p className="text-foreground font-medium">Nigerian phone number</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-foreground text-sm mb-2">Response Example:</h4>
                    <pre className="bg-background p-3 rounded-lg border border-border text-primary font-mono text-xs overflow-x-auto">
{JSON.stringify({
  success: true,
  transaction_id: "V1-DATA-ABC123DEF456",
  plan: "1GB",
  phone: "08012345678",
  amount: 500,
  balance_after: 9500
}, null, 2)}
                    </pre>
                  </div>

                  <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-success text-xs">
                    <strong>✓ Status 200:</strong> Data purchase successful
                  </div>
                </div>
              </div>

              {/* Endpoint 3: Buy Airtime */}
              <div className="border-l-4 border-accent pl-6">
                <h3 className="text-lg font-bold text-foreground mb-4">3. Purchase Airtime</h3>
                
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-background border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 rounded text-xs font-bold bg-orange-500/20 text-orange-600">POST</span>
                      <code className="text-primary font-mono text-sm">/api/v1/airtime/purchase</code>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-foreground text-sm mb-2">Request Body:</h4>
                    <pre className="bg-background p-3 rounded-lg border border-border text-primary font-mono text-xs overflow-x-auto">
{JSON.stringify({
  network: "mtn",
  amount: 1000,
  phone: "08012345678"
}, null, 2)}
                    </pre>
                  </div>

                  <div>
                    <h4 className="font-semibold text-foreground text-sm mb-2">Request Fields:</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex gap-2">
                        <code className="text-primary bg-background px-2 py-1 rounded border border-border text-xs flex-shrink-0">network*</code>
                        <div>
                          <p className="text-foreground font-medium">Network ID (mtn, glo, airtel, etisalat)</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <code className="text-primary bg-background px-2 py-1 rounded border border-border text-xs flex-shrink-0">amount*</code>
                        <div>
                          <p className="text-foreground font-medium">Amount in Nigerian Naira (₦). Minimum: ₦50</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <code className="text-primary bg-background px-2 py-1 rounded border border-border text-xs flex-shrink-0">phone*</code>
                        <div>
                          <p className="text-foreground font-medium">Nigerian phone number</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-foreground text-sm mb-2">Response Example:</h4>
                    <pre className="bg-background p-3 rounded-lg border border-border text-primary font-mono text-xs overflow-x-auto">
{JSON.stringify({
  success: true,
  transaction_id: "V1-AIRTIME-XYZ789ABC",
  network: "MTN",
  phone: "08012345678",
  amount: 1000,
  balance_after: 8500
}, null, 2)}
                    </pre>
                  </div>

                  <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-success text-xs">
                    <strong>✓ Status 200:</strong> Airtime purchase successful
                  </div>
                </div>
              </div>
            </div>

            {/* Error Codes */}
            <div className="mt-8 p-6 rounded-lg bg-secondary/30 border border-border">
              <h3 className="text-lg font-bold text-foreground mb-4">Error Responses</h3>
              <div className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <span className="px-2 py-1 rounded text-xs font-bold bg-blue-500/20 text-blue-600 flex-shrink-0">400</span>
                  <div>
                    <p className="text-foreground font-medium">Bad Request</p>
                    <p className="text-text-3 text-xs">Missing or invalid required fields</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="px-2 py-1 rounded text-xs font-bold bg-red-500/20 text-red-600 flex-shrink-0">401</span>
                  <div>
                    <p className="text-foreground font-medium">Unauthorized</p>
                    <p className="text-text-3 text-xs">Invalid or missing API key</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="px-2 py-1 rounded text-xs font-bold bg-yellow-500/20 text-yellow-600 flex-shrink-0">402</span>
                  <div>
                    <p className="text-foreground font-medium">Payment Required</p>
                    <p className="text-text-3 text-xs">Insufficient wallet balance</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="px-2 py-1 rounded text-xs font-bold bg-red-500/20 text-red-600 flex-shrink-0">429</span>
                  <div>
                    <p className="text-foreground font-medium">Too Many Requests</p>
                    <p className="text-text-3 text-xs">Rate limit exceeded (50 requests per minute)</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="px-2 py-1 rounded text-xs font-bold bg-red-500/20 text-red-600 flex-shrink-0">500</span>
                  <div>
                    <p className="text-foreground font-medium">Server Error</p>
                    <p className="text-text-3 text-xs">Internal server error or provider issue</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Best Practices */}
            <div className="mt-8 p-6 rounded-lg bg-primary/5 border border-primary/20">
              <h3 className="text-lg font-bold text-foreground mb-4">Best Practices</h3>
              <ul className="space-y-2 text-sm text-text-2">
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>Always validate phone numbers before sending requests</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>Fetch data plans in real-time — don&apos;t hardcode plan IDs</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>Keep your API key secure — never expose it in client-side code</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>Implement retry logic for network failures</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>Check wallet balance before making purchase requests</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
