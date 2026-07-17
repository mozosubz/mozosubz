"use client"

import Link from "next/link"
import { useState } from "react"
import { Footer } from "@/components/footer"
import { ChevronRight, Copy, Check } from "lucide-react"

const API_BASE = "https://mozosubz.xyz/api/v1"

type Section = {
  id: string
  label: string
  group?: string
}

const SECTIONS: Section[] = [
  { id: "introduction", label: "Introduction", group: "Getting started" },
  { id: "authentication", label: "Authentication", group: "Getting started" },
  { id: "errors", label: "Errors & rate limits", group: "Getting started" },
  { id: "airtime", label: "Buy airtime", group: "VTU" },
  { id: "data-plans", label: "Data plans", group: "VTU" },
  { id: "data-purchase", label: "Buy data", group: "VTU" },
  { id: "services", label: "Service IDs", group: "Reference" },
]

// All supported data service IDs — mirrors NETWORKS in the admin pricing page exactly.
// Plan counts are live from the provider; only admin-priced plans are returned by the API.
const DATA_SERVICES = [
  { id: "mtn_sme",        network: "MTN",     type: "SME",        plans: 5,  note: "MTN SME reseller data" },
  { id: "mtn_datashare",  network: "MTN",     type: "Data Share", plans: 5,  note: "MTN data share plans" },
  { id: "mtn_gifting",    network: "MTN",     type: "Gifting",    plans: 30, note: "MTN gifting bundles" },
  { id: "mtn_awoof",      network: "MTN",     type: "AWOOF",      plans: 3,  note: "MTN AWOOF special offers" },
  { id: "glo_data",       network: "Glo",     type: "Data",       plans: 13, note: "Standard Glo data plans" },
  { id: "glo_sme",        network: "Glo",     type: "SME",        plans: 4,  note: "Glo SME reseller plans" },
  { id: "airtel_sme",     network: "Airtel",  type: "SME",        plans: 5,  note: "Airtel SME plans" },
  { id: "airtel_gifting", network: "Airtel",  type: "Gifting",    plans: 28, note: "Airtel gifting bundles" },
  { id: "etisalat_data",  network: "9mobile", type: "9mobile",    plans: null, note: "9mobile (Etisalat) data plans" },
]

// Supported airtime networks
const AIRTIME_NETWORKS = [
  { id: "mtn",      label: "MTN" },
  { id: "glo",      label: "Glo" },
  { id: "airtel",   label: "Airtel" },
  { id: "etisalat", label: "9mobile (Etisalat)" },
]

function CodeBlock({ children, lang = "bash" }: { children: string; lang?: string }) {
  const [copied, setCopied] = useState(false)
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(children)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {}
  }
  return (
    <div className="relative group">
      <div className="absolute top-2 right-2 sm:top-3 sm:right-3 flex items-center gap-2 z-10">
        <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-text-3 font-semibold">{lang}</span>
        <button
          type="button"
          onClick={onCopy}
          className="text-[10px] sm:text-[11px] font-semibold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-primary hover:opacity-90 text-white transition flex items-center gap-1 sm:gap-1.5 shadow-md"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline">Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-lg bg-card text-foreground text-[11px] sm:text-[12.5px] leading-relaxed p-3 sm:p-5 sm:pr-32 pr-24 font-mono border border-border shadow-md">
        <code>{children}</code>
      </pre>
    </div>
  )
}

function MethodPill({ method }: { method: "GET" | "POST" }) {
  const cls =
    method === "GET"
      ? "bg-success/10 text-success border-success/30"
      : "bg-primary/10 text-primary border-primary/30"
  return (
    <span className={`inline-flex items-center text-[9px] sm:text-[10px] font-bold px-2 py-1 rounded-md border ${cls}`}>
      {method}
    </span>
  )
}

function Endpoint({ method, path }: { method: "GET" | "POST"; path: string }) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 mb-4 sm:mb-5 p-3 sm:p-4 bg-secondary/50 rounded-lg border border-border">
      <MethodPill method={method} />
      <code className="text-[11px] sm:text-[13px] font-mono text-foreground bg-background px-2 sm:px-3 py-1 sm:py-1.5 rounded-md border border-border flex-1 overflow-x-auto w-full sm:w-auto">{path}</code>
    </div>
  )
}

function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-20 sm:scroll-mt-24 mb-12 sm:mb-20">
      <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
        <div className="w-1 h-6 sm:h-8 bg-primary rounded-full"></div>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">{title}</h2>
      </div>
      <div className="space-y-4 sm:space-y-5 text-text-2 text-[13px] sm:text-[14px] leading-relaxed">{children}</div>
    </section>
  )
}

function ParamRow({
  name,
  type,
  required,
  desc,
}: {
  name: string
  type: string
  required?: boolean
  desc: string
}) {
  return (
    <tr className="border-b border-border last:border-0 hover:bg-secondary/30 transition">
      <td className="py-2 sm:py-3 pr-2 sm:pr-4 align-top">
        <code className="text-[10px] sm:text-[12px] font-mono text-primary bg-primary/5 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded border border-primary/20">
          {name}
        </code>
      </td>
      <td className="py-2 sm:py-3 pr-2 sm:pr-4 align-top text-[10px] sm:text-[12px] text-text-3">{type}</td>
      <td className="py-2 sm:py-3 pr-2 sm:pr-4 align-top">
        {required ? (
          <span className="text-[9px] sm:text-[10px] font-bold bg-error/10 text-error border border-error/20 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">
            req
          </span>
        ) : (
          <span className="text-[9px] sm:text-[10px] text-text-3">opt</span>
        )}
      </td>
      <td className="py-2 sm:py-3 align-top text-text-2 text-[10px] sm:text-xs">{desc}</td>
    </tr>
  )
}

function ParamTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-secondary/20">
      <table className="w-full text-[11px] sm:text-[13px] border-collapse">
        <thead>
          <tr className="border-b border-border bg-secondary/40">
            <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-primary text-[10px] sm:text-xs">Field</th>
            <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-primary text-[10px] sm:text-xs">Type</th>
            <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-primary text-[10px] sm:text-xs">Req</th>
            <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-primary text-[10px] sm:text-xs">Description</th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export default function DocPage() {
  const [activeSection, setActiveSection] = useState("introduction")

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <Link href="/" className="text-sm sm:text-base font-bold text-primary hover:opacity-80 transition whitespace-nowrap">
              Mozosubz
            </Link>
            <span className="text-border hidden sm:inline">/</span>
            <span className="text-xs sm:text-sm text-text-2 hidden sm:inline">API Reference</span>
          </div>
          <Link
            href="/integrations/keys"
            className="text-xs sm:text-[13px] font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-primary text-white hover:opacity-90 transition flex items-center gap-1 sm:gap-2 whitespace-nowrap"
          >
            <span className="hidden sm:inline">Get API Key</span>
            <span className="sm:hidden">Key</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 flex gap-4 sm:gap-8 py-6 sm:py-12">
        {/* Sidebar nav - hidden on mobile */}
        <aside className="hidden lg:block w-52 xl:w-56 shrink-0 sticky top-20 self-start">
          <nav className="space-y-0.5 bg-secondary/50 rounded-lg border border-border p-3">
            {(() => {
              let lastGroup = ""
              return SECTIONS.map((s) => {
                const groupHeader =
                  s.group && s.group !== lastGroup ? (
                    <p
                      key={`g-${s.group}`}
                      className="text-[9px] uppercase tracking-widest font-bold text-primary/70 mt-3 mb-1.5 px-2 first:mt-0"
                    >
                      {(lastGroup = s.group) && s.group}
                    </p>
                  ) : null
                return (
                  <div key={s.id}>
                    {groupHeader}
                    <a
                      href={`#${s.id}`}
                      onClick={() => setActiveSection(s.id)}
                      className={`block text-xs sm:text-[13px] px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md transition flex items-center gap-1.5 sm:gap-2 ${
                        activeSection === s.id
                          ? "bg-primary text-white font-semibold"
                          : "text-text-3 hover:text-text-2 hover:bg-secondary"
                      }`}
                    >
                      {activeSection === s.id && <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                      {s.label}
                    </a>
                  </div>
                )
              })
            })()}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 w-full min-w-0">

          {/* ── Introduction ── */}
          <Section id="introduction" title="Introduction">
            <p>
              The <strong className="text-foreground">Mozosubz v1 API</strong> lets you purchase <strong className="text-primary">data</strong> and{" "}
              <strong className="text-primary">airtime</strong> programmatically using your wallet balance. It is designed
              for developers who want to integrate VTU services directly into their own apps.
            </p>
            <div className="p-3 sm:p-4 rounded-lg bg-primary/5 border border-primary/20 shadow-sm">
              <p className="text-[11px] sm:text-[12px] font-semibold text-primary uppercase tracking-wider mb-2">
                Base URL
              </p>
              <code className="text-xs sm:text-[13px] font-mono text-foreground bg-background px-2 sm:px-3 py-1.5 sm:py-2 rounded-md block overflow-x-auto border border-border">{API_BASE}</code>
            </div>
            <div className="p-3 sm:p-4 rounded-lg bg-accent/5 border border-accent/20 text-foreground text-xs sm:text-[13px]">
              <strong className="text-accent">✓ Note:</strong> Your wallet must be funded before making purchases. All
              amounts are in Nigerian Naira (₦). Prices shown by{" "}
              <code className="text-[11px] bg-accent/10 px-1.5 py-0.5 rounded border border-accent/30">/data/plans</code> are the
              exact amounts that will be deducted from your wallet.
            </div>
          </Section>

          {/* ── Authentication ── */}
          <Section id="authentication" title="Authentication">
            <p>
              Every request must include your Connect Key in the{" "}
              <code className="bg-background px-1.5 py-0.5 rounded text-xs sm:text-[12px] text-primary border border-border">{`X-Connect-Key`}</code>{" "}
              header. You can generate and manage keys from the{" "}
              <Link href="/integrations/keys" className="text-primary hover:opacity-80 underline font-medium transition">
                API Keys page
              </Link>
              .
            </p>
            <CodeBlock lang="bash">{`curl "${API_BASE}/data/plans?service=mtn_sme" \\
  -H "X-Connect-Key: connect_your_key_here"`}</CodeBlock>
            <div className="p-3 sm:p-4 rounded-lg bg-error/5 border border-error/20 text-foreground text-xs sm:text-[13px]">
              <strong className="text-error">⚠ Keep your key secret.</strong> Never expose it in client-side code or
              public repositories. Revoke and regenerate immediately if compromised.
            </div>
          </Section>

          {/* ── Errors ── */}
          <Section id="errors" title="Errors & rate limits">
            <p>
              All responses use standard HTTP status codes and return a JSON body with a{" "}
              <code className="bg-background px-1 py-0.5 rounded text-[11px] sm:text-[12px] text-primary border border-border">success</code> boolean and an{" "}
              <code className="bg-background px-1 py-0.5 rounded text-[11px] sm:text-[12px] text-primary border border-border">error</code> message on failure.
            </p>
            <CodeBlock lang="json">{`{
  "success": false,
  "error": "Insufficient wallet balance. Required: ₦300, Available: ₦50"
}`}</CodeBlock>
            <div className="overflow-x-auto rounded-lg border border-border bg-secondary/20">
              <table className="w-full text-[11px] sm:text-[13px] border-collapse">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-primary text-[10px] sm:text-xs">Code</th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-primary text-[10px] sm:text-xs">Meaning</th>
                  </tr>
                </thead>
                <tbody className="text-foreground">
                  {[
                    ["200", "Success"],
                    ["400", "Bad request — missing or invalid fields"],
                    ["401", "Unauthorized — invalid or missing API key"],
                    ["402", "Payment required — insufficient wallet balance"],
                    ["404", "Plan not found or not available for API users"],
                    ["429", "Rate limit exceeded (10,000 requests / day)"],
                    ["500 / 502", "Server or upstream provider error"],
                  ].map(([code, meaning]) => (
                    <tr key={code} className="border-b border-border last:border-0 hover:bg-secondary/30 transition">
                      <td className="py-2 sm:py-3 px-2 sm:px-4">
                        <code className="font-mono text-accent text-xs sm:text-sm">{code}</code>
                      </td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-text-2 text-xs sm:text-sm">{meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs sm:text-[13px] text-text-3">
              Rate limit: <strong className="text-foreground">10,000 requests per day</strong> per API key. The counter resets every 24 hours.
            </p>
          </Section>

          {/* ── Buy airtime ── */}
          <Section id="airtime" title="Buy airtime">
            <Endpoint method="POST" path={`${API_BASE}/airtime/purchase`} />
            <p>
              Purchase airtime for any Nigerian network. The exact{" "}
              <code className="bg-background px-1 py-0.5 rounded text-[11px] sm:text-[12px] text-primary border border-border">amount</code> is
              deducted from your wallet — there is no markup on airtime.
            </p>
            <h3 className="font-semibold text-foreground mt-4 sm:mt-5 mb-2 sm:mb-3 text-sm sm:text-base">Request body</h3>
            <ParamTable>
              <ParamRow name="network" type="string" required desc='Network operator: "mtn", "glo", "airtel", or "etisalat"' />
              <ParamRow name="amount" type="number" required desc="Amount in Naira (minimum ₦50)" />
              <ParamRow name="phone" type="string" required desc="Nigerian phone number (e.g. 08012345678)" />
            </ParamTable>
            <CodeBlock lang="bash">{`curl -X POST ${API_BASE}/airtime/purchase \\
  -H "X-Connect-Key: connect_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "network": "mtn",
    "amount": 200,
    "phone": "08012345678"
  }'`}</CodeBlock>
            <h3 className="font-semibold text-slate-800 mt-4 mb-2">Response</h3>
            <CodeBlock lang="json">{`{
  "success": true,
  "transaction_id": "V1-AIR-A1B2C3D4E5F6",
  "network": "MTN",
  "phone": "08012345678",
  "amount": 200,
  "balance_after": 4800
}`}</CodeBlock>
          </Section>

          {/* ── Data plans ── */}
          <Section id="data-plans" title="Data plans">
            <Endpoint method="GET" path={`${API_BASE}/data/plans?service={service}`} />
            <p>
              Returns available data plans for a given service along with the API price you will be
              charged. Only plans that have been configured with a price by the admin are returned.
            </p>
            <h3 className="font-semibold text-slate-800 mt-4 mb-2">Query parameters</h3>
            <ParamTable>
              <ParamRow
                name="service"
                type="string"
                required
                desc="One of: mtn_sme, mtn_gifting, mtn_datashare, mtn_awoof, glo_sme, glo_data, airtel_sme, airtel_gifting, etisalat_data"
              />
            </ParamTable>
            <CodeBlock lang="bash">{`curl "${API_BASE}/data/plans?service=mtn_sme" \\
  -H "X-Connect-Key: connect_your_key_here"`}</CodeBlock>
            <h3 className="font-semibold text-slate-800 mt-4 mb-2">Response</h3>
            <CodeBlock lang="json">{`{
  "success": true,
  "service": "mtn_sme",
  "plans": [
    {
      "id": "mtn-sme-500mb",
      "name": "500MB SME - 30 Days",
      "price": 150
    },
    {
      "id": "mtn-sme-1gb",
      "name": "1GB SME - 30 Days",
      "price": 300
    }
  ]
}`}</CodeBlock>
            <div className="p-3 sm:p-4 rounded-lg bg-primary/5 border border-primary/20 text-foreground text-xs sm:text-[13px]">
              <strong className="text-primary">ℹ How to use:</strong> Call <code className="bg-primary/10 px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] border border-primary/20">/data/plans</code> first
              to get the live plan list for a service, then pass the plan&apos;s{" "}
              <code className="bg-primary/10 px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] border border-primary/20">id</code> as{" "}
              <code className="bg-primary/10 px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] border border-primary/20">plan_id</code> in{" "}
              <code className="bg-primary/10 px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] border border-primary/20">/data/purchase</code>.
              The <code className="bg-primary/10 px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] border border-primary/20">price</code> is always
              real-time and is the exact amount deducted from your wallet — no hidden markup shown.
              IDs vary per service; always use the live response, never hardcode them.
            </div>
          </Section>

          {/* ── Buy data ── */}
          <Section id="data-purchase" title="Buy data">
            <Endpoint method="POST" path={`${API_BASE}/data/purchase`} />
            <p>
              Purchase a data plan. Use the <code className="bg-background px-1 py-0.5 rounded text-[11px] sm:text-[12px] text-primary border border-border">id</code>{" "}
              from <code className="bg-background px-1 py-0.5 rounded text-[11px] sm:text-[12px] text-primary border border-border">/data/plans</code> as the{" "}
              <code className="bg-background px-1 py-0.5 rounded text-[11px] sm:text-[12px] text-primary border border-border">plan_id</code>. The{" "}
              <code className="bg-background px-1 py-0.5 rounded text-[11px] sm:text-[12px] text-primary border border-border">price</code> shown
              in the plans response is the exact amount deducted from your wallet.
            </p>
            <h3 className="font-semibold text-foreground mt-4 sm:mt-5 mb-2 sm:mb-3 text-sm sm:text-base">Request body</h3>
            <ParamTable>
              <ParamRow name="service" type="string" required desc='Same service identifier used in /data/plans (e.g. "mtn_sme")' />
              <ParamRow name="plan_id" type="string" required desc='The plan id from /data/plans response (e.g. "SME1GB")' />
              <ParamRow name="phone" type="string" required desc="Nigerian phone number to receive the data (e.g. 08012345678)" />
            </ParamTable>
            <CodeBlock lang="bash">{`curl -X POST ${API_BASE}/data/purchase \\
  -H "X-Connect-Key: connect_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "service": "mtn_sme",
    "plan_id": "mtn-sme-1gb",
    "phone": "08012345678"
  }'`}</CodeBlock>
            <h3 className="font-semibold text-slate-800 mt-4 mb-2">Response</h3>
            <CodeBlock lang="json">{`{
  "success": true,
  "transaction_id": "V1-DATA-A1B2C3D4E5F6",
  "plan": "1GB SME - 30 Days",
  "phone": "08012345678",
  "amount": 300,
  "balance_after": 4700
}`}</CodeBlock>
          </Section>

          {/* ── Service IDs reference ── */}
          <Section id="services" title="Service IDs">
            <p>
              Use these identifiers in the <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[12px]">service</code>{" "}
              parameter when calling <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[12px]">/data/plans</code>{" "}
              and <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[12px]">/data/purchase</code>.
              Only plans that have been configured with an API price by the admin will appear
              when you call <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[12px]">/data/plans</code>.
            </p>

            <h3 className="font-semibold text-slate-800 mt-4 mb-2">Data service IDs</h3>
            <p className="text-[13px] text-slate-500 mb-3">
              Plan counts below reflect the total available from the provider. Only plans the admin has configured with an API price will be returned by <code className="bg-slate-100 px-1 rounded text-[12px]">/data/plans</code>.
            </p>
            <div className="overflow-x-auto rounded-lg border border-border bg-secondary/20">
              <table className="w-full text-[10px] sm:text-[13px] border-collapse">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-primary text-[9px] sm:text-xs">Service ID</th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-primary text-[9px] sm:text-xs">Network</th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-primary text-[9px] sm:text-xs">Type</th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-primary text-[9px] sm:text-xs">Plans</th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-primary text-[9px] sm:text-xs">Notes</th>
                  </tr>
                </thead>
                <tbody className="text-foreground">
                  {DATA_SERVICES.map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition">
                      <td className="py-2 sm:py-3 px-2 sm:px-4">
                        <code className="font-mono text-primary bg-primary/5 px-1 sm:px-2 py-0.5 sm:py-1 rounded text-[9px] sm:text-[12px] border border-primary/20">{s.id}</code>
                      </td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4 font-medium text-foreground text-xs sm:text-sm">{s.network}</td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-text-2 text-xs sm:text-sm">{s.type}</td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-text-3 text-xs sm:text-sm">{s.plans ?? "—"}</td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-text-3 text-xs sm:text-sm">{s.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="font-semibold text-foreground mt-5 sm:mt-6 mb-2 sm:mb-3 text-sm sm:text-base">Airtime network IDs</h3>
            <p className="text-text-2 text-xs sm:text-sm">Pass one of these as <code className="bg-background px-1.5 py-0.5 rounded text-[10px] sm:text-[12px] text-primary border border-border">network</code> in the airtime purchase request.</p>
            <div className="flex flex-wrap gap-2 sm:gap-3 mt-3 sm:mt-4">
              {AIRTIME_NETWORKS.map((n) => (
                <span key={n.id} className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg border border-border bg-secondary/50 text-[11px] sm:text-[13px] hover:border-primary transition">
                  <code className="font-mono text-primary text-[9px] sm:text-[12px]">{n.id}</code>
                  <span className="text-text-2 text-[10px] sm:text-sm">{n.label}</span>
                </span>
              ))}
            </div>
          </Section>

        </main>
      </div>

      <Footer />
    </div>
  )
}
