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

const CABLE_PROVIDERS = [
  { id: "dstv", label: "DStv" },
  { id: "gotv", label: "GOtv" },
  { id: "startimes", label: "Startimes" },
]

const DISCO_PROVIDERS = [
  { id: "ikeja electric", label: "Ikeja Electric" },
  { id: "eko electric", label: "Eko Electric" },
  { id: "abuja electric", label: "Abuja Electric" },
  { id: "kano electric", label: "Kano Electric" },
  { id: "port harcourt electric", label: "Port Harcourt Electric" },
]

interface ApiResponse {
  data?: unknown
  error?: string
  /** Stable machine-readable code returned alongside every v1 error. */
  errorCode?: string
  status?: number
  duration?: number
}

export default function DocPage() {
  const [apiKey, setApiKey] = useState("")
  const [activeTab, setActiveTab] = useState<"data-plans" | "data-purchase" | "airtime" | "cable" | "electricity">("data-plans")
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

  // Cable and electricity purchase state
  const [cableProvider, setCableProvider] = useState(CABLE_PROVIDERS[0].id)
  const [cablePackage, setCablePackage] = useState("")
  const [cableSmartcard, setCableSmartcard] = useState("")
  const [cablePhone, setCablePhone] = useState("")
  const [disco, setDisco] = useState(DISCO_PROVIDERS[0].id)
  const [meterType, setMeterType] = useState("PREPAID")
  const [meterNumber, setMeterNumber] = useState("")
  const [electricityAmount, setElectricityAmount] = useState("1000")
  const [electricityPhone, setElectricityPhone] = useState("")

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
        errorCode: data.error_code,
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
        errorCode: data.error_code,
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

  const handleTestPurchase = async (path: string, body: Record<string, string | number>, missingMessage: string) => {
    if (!apiKey) {
      setResponse({ error: "Please enter your API key" })
      return
    }
    if (Object.values(body).some((value) => !String(value).trim())) {
      setResponse({ error: missingMessage })
      return
    }

    setLoading(true)
    const startTime = Date.now()
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "X-Connect-Key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      setResponse({ data, status: res.status, duration: Date.now() - startTime, error: data.error, errorCode: data.error_code })
    } catch (err: any) {
      setResponse({ error: err.message, duration: Date.now() - startTime })
    } finally {
      setLoading(false)
    }
  }

  const handleTestCable = () => handleTestPurchase(
    "/cable/purchase",
    { provider: cableProvider, package: cablePackage, smartcard: cableSmartcard, phone: cablePhone },
    "Please fill all fields (provider, package, smartcard, phone)"
  )

  const handleTestElectricity = () => handleTestPurchase(
    "/electricity/purchase",
    { disco, meter_type: meterType, meter_number: meterNumber, amount: Number(electricityAmount), phone: electricityPhone },
    "Please fill all fields (DISCO, meter type, meter number, amount, phone)"
  )

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
        errorCode: data.error_code,
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
          {(["data-plans", "data-purchase", "airtime", "cable", "electricity"] as const).map((tab) => (
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
              {tab === "cable" && "Buy Cable TV"}
              {tab === "electricity" && "Buy Electricity"}
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

            {activeTab === "cable" && (
              <div className="space-y-3 p-4 rounded-lg bg-secondary/30 border border-border">
                <label className="block text-sm font-medium text-foreground">Provider</label>
                <select value={cableProvider} onChange={(e) => setCableProvider(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm">
                  {CABLE_PROVIDERS.map((provider) => <option key={provider.id} value={provider.id}>{provider.label}</option>)}
                </select>
                <input value={cablePackage} onChange={(e) => setCablePackage(e.target.value)} placeholder="Package name, e.g. DStv Compact" className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground placeholder:text-text-3 text-sm" />
                <input value={cableSmartcard} onChange={(e) => setCableSmartcard(e.target.value)} placeholder="Smartcard / IUC number" className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground placeholder:text-text-3 text-sm" />
                <input type="tel" value={cablePhone} onChange={(e) => setCablePhone(e.target.value)} placeholder="08012345678" className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground placeholder:text-text-3 text-sm" />
                <div className="p-3 rounded-lg bg-background border border-border text-xs text-text-2 font-mono">POST /api/v1/cable/purchase</div>
                <button onClick={handleTestCable} disabled={loading} className="w-full px-4 py-2 rounded-lg bg-accent text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Purchase Cable TV
                </button>
              </div>
            )}

            {activeTab === "electricity" && (
              <div className="space-y-3 p-4 rounded-lg bg-secondary/30 border border-border">
                <label className="block text-sm font-medium text-foreground">DISCO</label>
                <select value={disco} onChange={(e) => setDisco(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm">
                  {DISCO_PROVIDERS.map((provider) => <option key={provider.id} value={provider.id}>{provider.label}</option>)}
                </select>
                <select value={meterType} onChange={(e) => setMeterType(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm">
                  <option value="PREPAID">Prepaid</option><option value="POSTPAID">Postpaid</option>
                </select>
                <input value={meterNumber} onChange={(e) => setMeterNumber(e.target.value)} placeholder="Meter number" className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground placeholder:text-text-3 text-sm" />
                <input type="number" min="1000" value={electricityAmount} onChange={(e) => setElectricityAmount(e.target.value)} placeholder="Amount (₦)" className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground placeholder:text-text-3 text-sm" />
                <input type="tel" value={electricityPhone} onChange={(e) => setElectricityPhone(e.target.value)} placeholder="08012345678" className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground placeholder:text-text-3 text-sm" />
                <div className="p-3 rounded-lg bg-background border border-border text-xs text-text-2 font-mono">POST /api/v1/electricity/purchase</div>
                <button onClick={handleTestElectricity} disabled={loading} className="w-full px-4 py-2 rounded-lg bg-accent text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Purchase Electricity
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
                  <div className="p-3 rounded-lg bg-error/10 border border-error/20 mb-3">
                    {response.errorCode && (
                      <code className="inline-block mb-1 px-1.5 py-0.5 rounded bg-error/20 text-error text-[10px] font-bold font-mono">
                        {response.errorCode}
                      </code>
                    )}
                    <p className="text-error text-sm leading-relaxed">{response.error}</p>
                  </div>
                )}

                {response.data ? (
                  <pre className="text-xs text-foreground bg-background p-3 rounded-lg border border-border overflow-x-auto font-mono">
                    {JSON.stringify(response.data, null, 2)}
                  </pre>
                ) : null}
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

            <div className="p-4 rounded-lg bg-secondary/30 border border-border">
              <h3 className="font-bold text-foreground mb-3">Cable and Electricity</h3>
              <p className="text-sm text-text-2 leading-relaxed">
                Cable purchases use <code className="text-primary font-mono">provider</code>, <code className="text-primary font-mono">package</code>, <code className="text-primary font-mono">smartcard</code>, and <code className="text-primary font-mono">phone</code>. Electricity purchases use <code className="text-primary font-mono">disco</code>, <code className="text-primary font-mono">meter_type</code>, <code className="text-primary font-mono">meter_number</code>, <code className="text-primary font-mono">amount</code>, and <code className="text-primary font-mono">phone</code>.
              </p>
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
  transaction_id: "V1-AIR-7B2E4F9A1C3D",
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

              {/* Endpoint 4: Buy Cable TV */}
              <div className="border-l-4 border-accent pl-6">
                <h3 className="text-lg font-bold text-foreground mb-4">4. Purchase Cable TV</h3>
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-background border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 rounded text-xs font-bold bg-orange-500/20 text-orange-600">POST</span>
                      <code className="text-primary font-mono text-sm">/api/v1/cable/purchase</code>
                    </div>
                    <p className="text-text-3 text-xs">Requires the <code className="text-primary">cable</code> or <code className="text-primary">all</code> permission.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground text-sm mb-2">Request body:</h4>
                    <pre className="bg-background p-3 rounded-lg border border-border text-primary font-mono text-xs overflow-x-auto">{JSON.stringify({ provider: "dstv", package: "DStv Compact", smartcard: "4123456789", phone: "08012345678" }, null, 2)}</pre>
                    <p className="text-text-3 text-xs mt-2">Supported providers: <code className="text-primary">dstv</code>, <code className="text-primary">gotv</code>, <code className="text-primary">startimes</code>. The package must match an active cable pricing rule created in Admin API Pricing.</p>
                  </div>
                  <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-success text-xs">
                    The amount is calculated from the active package rule: base price plus fixed or percentage markup. A timeout returns a pending transaction; do not retry it with a new request ID.
                  </div>
                </div>
              </div>

              {/* Endpoint 5: Buy Electricity */}
              <div className="border-l-4 border-accent pl-6">
                <h3 className="text-lg font-bold text-foreground mb-4">5. Purchase Electricity</h3>
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-background border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 rounded text-xs font-bold bg-orange-500/20 text-orange-600">POST</span>
                      <code className="text-primary font-mono text-sm">/api/v1/electricity/purchase</code>
                    </div>
                    <p className="text-text-3 text-xs">Requires the <code className="text-primary">electricity</code> or <code className="text-primary">all</code> permission, and the endpoint must be enabled by an administrator. If disabled, the API returns HTTP 503 with <code className="text-primary">SERVICE_DISABLED</code>.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground text-sm mb-2">Request body:</h4>
                    <pre className="bg-background p-3 rounded-lg border border-border text-primary font-mono text-xs overflow-x-auto">{JSON.stringify({ disco: "ikeja electric", meter_type: "PREPAID", meter_number: "1234567890", amount: 1000, phone: "08012345678" }, null, 2)}</pre>
                    <p className="text-text-3 text-xs mt-2">Supports PREPAID and POSTPAID meters and the 12 configured Nigerian DISCOs. The minimum amount is ₦1,000, matching the normal electricity dashboard. Electricity charges the requested amount directly; no API pricing-rule markup is applied.</p>
                  </div>
                  <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-success text-xs">
                    A provider timeout is saved as PENDING and verified for up to two minutes. Confirm the transaction status before retrying; confirmed failure or an expired verification is refunded automatically.
                  </div>
                </div>
              </div>
            </div>

            {/* Error Codes */}
            <div className="mt-8 p-6 rounded-lg bg-secondary/30 border border-border">
              <h3 className="text-lg font-bold text-foreground mb-2">Error Responses</h3>
              <p className="text-text-3 text-sm mb-4 leading-relaxed">
                Every failure returns{' '}
                <code className="text-primary bg-background px-1.5 py-0.5 rounded border border-border text-xs">success: false</code>{' '}
                and a human-readable{' '}
                <code className="text-primary bg-background px-1.5 py-0.5 rounded border border-border text-xs">error</code>{' '}
                string, plus a stable{' '}
                <code className="text-primary bg-background px-1.5 py-0.5 rounded border border-border text-xs">error_code</code>{' '}
                you should branch on instead of matching the message text.
              </p>

              <div className="mb-6">
                <h4 className="font-semibold text-foreground text-sm mb-2">Error Response Shape:</h4>
                <pre className="bg-background p-3 rounded-lg border border-border text-primary font-mono text-xs overflow-x-auto">
{JSON.stringify({
  success: false,
  error: "This number is not eligible for the selected bundle. Please choose a different plan and try again. Your wallet has not been charged.",
  error_code: "NOT_ELIGIBLE",
  transaction_id: "V1-DATA-3F8783748ED9",
  refunded: true,
  balance_after: 12779.92
}, null, 2)}
                </pre>
                <p className="text-text-3 text-xs mt-2 leading-relaxed">
                  <code className="text-primary text-xs">transaction_id</code>, <code className="text-primary text-xs">refunded</code> and{' '}
                  <code className="text-primary text-xs">balance_after</code> are present only once a wallet debit was attempted (provider
                  failures). Validation and auth errors return just <code className="text-primary text-xs">error</code> and{' '}
                  <code className="text-primary text-xs">error_code</code>.
                </p>
              </div>

              {/* Refund guarantee */}
              <div className="mb-6 p-3 rounded-lg bg-success/10 border border-success/20">
                <p className="text-success text-xs font-bold mb-1">Automatic refunds</p>
                <p className="text-text-2 text-xs leading-relaxed">
                  If your wallet was debited but the provider did not deliver, the debit is reversed automatically before the
                  response is returned and <code className="text-success text-xs">refunded: true</code> is set. You never need to
                  request a refund for a failed API purchase, and you should not retry a{' '}
                  <code className="text-success text-xs">refunded: true</code> response as if it were a timeout.
                </p>
              </div>

              {/* Error code reference */}
              <div className="mb-6">
                <h4 className="font-semibold text-foreground text-sm mb-3">Error Code Reference:</h4>
                <div className="flex flex-col gap-2 text-sm">
                  {[
                    { code: 'UNAUTHORIZED', http: '401', desc: 'Invalid, revoked, or missing API key.', retry: false },
                    { code: 'FORBIDDEN', http: '403', desc: 'Key is valid but lacks permission for this service.', retry: false },
                    { code: 'INVALID_REQUEST', http: '400', desc: 'Request body is not valid JSON.', retry: false },
                    { code: 'MISSING_FIELDS', http: '400', desc: 'A required field was omitted.', retry: false },
                    { code: 'INVALID_PHONE', http: '400', desc: 'Not a valid Nigerian phone number.', retry: false },
                    { code: 'INVALID_NETWORK', http: '400', desc: 'Airtime only. Network must be mtn, glo, airtel or etisalat.', retry: false },
                    { code: 'INVALID_AMOUNT', http: '400', desc: 'Airtime only. Amount is below the ₦50 minimum.', retry: false },
                    { code: 'INVALID_PLAN', http: '404', desc: 'Data only. Unknown plan_id — refetch GET /api/v1/data/plans.', retry: false },
                    { code: 'PLAN_NOT_ENABLED', http: '404', desc: 'Data only. Plan exists but is not enabled for API access.', retry: false },
                    { code: 'ACCOUNT_NOT_FOUND', http: '404', desc: 'The account behind this key no longer exists.', retry: false },
                    { code: 'INSUFFICIENT_BALANCE', http: '402', desc: 'Your wallet cannot cover the purchase. Top up and retry.', retry: false },
                    { code: 'NOT_ELIGIBLE', http: '400', desc: 'The number is not eligible for this bundle. Use a different plan.', retry: false },
                    { code: 'PLAN_UNAVAILABLE', http: '400', desc: 'Plan is temporarily out of stock at the provider.', retry: true },
                    { code: 'INVALID_RECIPIENT', http: '400', desc: 'Provider rejected the number as invalid or barred.', retry: false },
                    { code: 'DUPLICATE_TRANSACTION', http: '400', desc: 'Provider flagged this as a repeat. Wait before retrying.', retry: true },
                    { code: 'DELIVERY_FAILED', http: '400', desc: 'Provider accepted then failed to deliver. Safe to retry.', retry: true },
                    { code: 'SERVICE_UNAVAILABLE', http: '400', desc: 'Provider is temporarily unable to process this service.', retry: true },
                    { code: 'PROVIDER_TIMEOUT', http: '400', desc: 'Provider timed out. Verify before retrying.', retry: true },
                    { code: 'PROVIDER_UNREACHABLE', http: '502', desc: 'We could not reach the provider at all.', retry: true },
                    { code: 'RATE_LIMITED', http: '429', desc: 'Over 50 requests/minute. Honour the Retry-After header.', retry: true },
                    { code: 'INTERNAL_ERROR', http: '500', desc: 'Unexpected error on our side.', retry: true },
                    { code: 'UNKNOWN_ERROR', http: '400', desc: 'Unrecognised provider failure. Read the error string.', retry: true },
                  ].map((row) => (
                    <div key={row.code} className="flex flex-col gap-1 p-2 rounded-lg bg-background border border-border">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-primary text-xs font-mono">{row.code}</code>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-secondary text-text-2">{row.http}</span>
                        {row.retry && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-500/20 text-yellow-600">
                            retryable
                          </span>
                        )}
                      </div>
                      <p className="text-text-3 text-xs leading-relaxed">{row.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-foreground text-xs font-bold mb-1">Forward compatibility</p>
                <p className="text-text-2 text-xs leading-relaxed">
                  New <code className="text-primary text-xs">error_code</code>{' '}
                  values may be added over time. Treat any code you
                  don&apos;t recognise the same way you treat{' '}
                  <code className="text-primary text-xs">UNKNOWN_ERROR</code> and fall back to displaying the{' '}
                  <code className="text-primary text-xs">error</code> string.
                </p>
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
                  <span>
                    Only retry errors marked <em>retryable</em> above — retrying a{' '}
                    <code className="text-primary text-xs">NOT_ELIGIBLE</code> or{' '}
                    <code className="text-primary text-xs">INVALID_PLAN</code> failure will always fail again
                  </span>
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
