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
      <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{lang}</span>
        <button
          type="button"
          onClick={onCopy}
          className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white transition flex items-center gap-1.5 shadow-lg hover:shadow-xl"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-lg bg-gradient-to-br from-slate-900 to-slate-950 text-slate-100 text-[12.5px] leading-relaxed p-5 pr-32 font-mono border border-slate-800 shadow-xl">
        <code>{children}</code>
      </pre>
    </div>
  )
}

function MethodPill({ method }: { method: "GET" | "POST" }) {
  const cls =
    method === "GET"
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : "bg-blue-50 text-blue-700 border-blue-100"
  return (
    <span className={`inline-flex items-center text-[10px] font-bold px-2 py-1 rounded-md border ${cls}`}>
      {method}
    </span>
  )
}

function Endpoint({ method, path }: { method: "GET" | "POST"; path: string }) {
  return (
    <div className="flex items-center gap-3 flex-wrap mb-5 p-4 bg-gradient-to-r from-slate-800/50 to-slate-900/50 rounded-lg border border-slate-700">
      <MethodPill method={method} />
      <code className="text-[13px] font-mono text-indigo-300 bg-slate-900/50 px-3 py-1.5 rounded-md border border-slate-700 flex-1 overflow-x-auto">{path}</code>
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
    <section id={id} className="scroll-mt-24 mb-20">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-1 h-8 bg-gradient-to-b from-indigo-500 to-indigo-600 rounded-full"></div>
        <h2 className="text-2xl font-bold text-white">{title}</h2>
      </div>
      <div className="space-y-5 text-slate-300 text-[14px] leading-relaxed">{children}</div>
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
    <tr className="border-b border-slate-800 last:border-0 hover:bg-slate-800/30 transition">
      <td className="py-3 pr-4 align-top">
        <code className="text-[12px] font-mono text-indigo-300 bg-indigo-950/40 px-2 py-1 rounded border border-indigo-700/30">
          {name}
        </code>
      </td>
      <td className="py-3 pr-4 align-top text-[12px] text-slate-400">{type}</td>
      <td className="py-3 pr-4 align-top">
        {required ? (
          <span className="text-[10px] font-bold bg-red-950/40 text-red-300 border border-red-700/30 px-2 py-1 rounded">
            required
          </span>
        ) : (
          <span className="text-[10px] text-slate-500">optional</span>
        )}
      </td>
      <td className="py-3 align-top text-slate-300">{desc}</td>
    </tr>
  )
}

function ParamTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/30">
      <table className="w-full text-[13px] border-collapse">
        <thead>
          <tr className="border-b border-slate-800 bg-slate-900/50">
            <th className="text-left py-3 px-4 font-semibold text-indigo-300">Field</th>
            <th className="text-left py-3 px-4 font-semibold text-indigo-300">Type</th>
            <th className="text-left py-3 px-4 font-semibold text-indigo-300">Required</th>
            <th className="text-left py-3 px-4 font-semibold text-indigo-300">Description</th>
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 font-sans">
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm font-bold bg-gradient-to-r from-indigo-400 to-indigo-600 bg-clip-text text-transparent hover:from-indigo-300 hover:to-indigo-500 transition">
              Mozosubz
            </Link>
            <span className="text-slate-700">/</span>
            <span className="text-sm text-slate-400">API Reference</span>
          </div>
          <Link
            href="/integrations/keys"
            className="text-[13px] font-semibold px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-700 text-white hover:from-indigo-500 hover:to-indigo-600 transition shadow-lg hover:shadow-xl flex items-center gap-2"
          >
            Get API Key
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 flex gap-8 py-12">
        {/* Sidebar nav */}
        <aside className="hidden lg:block w-56 shrink-0 sticky top-24 self-start">
          <nav className="space-y-1 bg-slate-900/50 rounded-lg border border-slate-800 p-4">
            {(() => {
              let lastGroup = ""
              return SECTIONS.map((s) => {
                const groupHeader =
                  s.group && s.group !== lastGroup ? (
                    <p
                      key={`g-${s.group}`}
                      className="text-[10px] uppercase tracking-widest font-bold text-indigo-400 mt-4 mb-2 px-2 first:mt-0"
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
                      className={`block text-[13px] px-3 py-2 rounded-md transition flex items-center gap-2 ${
                        activeSection === s.id
                          ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-semibold shadow-lg"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                      }`}
                    >
                      {activeSection === s.id && <ChevronRight className="w-3.5 h-3.5" />}
                      {s.label}
                    </a>
                  </div>
                )
              })
            })()}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 max-w-3xl">

          {/* ── Introduction ── */}
          <Section id="introduction" title="Introduction">
            <p>
              The <strong className="text-white">Mozosubz v1 API</strong> lets you purchase <strong className="text-indigo-400">data</strong> and{" "}
              <strong className="text-indigo-400">airtime</strong> programmatically using your wallet balance. It is designed
              for developers who want to integrate VTU services directly into their own apps.
            </p>
            <div className="p-4 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 shadow-lg">
              <p className="text-[12px] font-semibold text-indigo-400 uppercase tracking-wider mb-2">
                Base URL
              </p>
              <code className="text-[13px] font-mono text-slate-100 bg-slate-950 px-3 py-2 rounded-md block overflow-x-auto">{API_BASE}</code>
            </div>
            <div className="p-4 rounded-lg bg-gradient-to-br from-amber-900/30 to-amber-950/30 border border-amber-700/50 text-amber-200 text-[13px]">
              <strong>✓ Note:</strong> Your wallet must be funded before making purchases. All
              amounts are in Nigerian Naira (₦). Prices shown by{" "}
              <code className="text-[12px] bg-amber-900/50 px-2 py-1 rounded border border-amber-700/50">/data/plans</code> are the
              exact amounts that will be deducted from your wallet.
            </div>
          </Section>

          {/* ── Authentication ── */}
          <Section id="authentication" title="Authentication">
            <p>
              Every request must include your Connect Key in the{" "}
              <code className="bg-slate-800 px-2 py-1 rounded text-[12px] text-indigo-300 border border-slate-700">{`X-Connect-Key`}</code>{" "}
              header. You can generate and manage keys from the{" "}
              <Link href="/integrations/keys" className="text-indigo-400 hover:text-indigo-300 underline font-medium transition">
                API Keys page
              </Link>
              .
            </p>
            <CodeBlock lang="bash">{`curl "${API_BASE}/data/plans?service=mtn_sme" \\
  -H "X-Connect-Key: connect_your_key_here"`}</CodeBlock>
            <div className="p-4 rounded-lg bg-gradient-to-br from-red-900/30 to-red-950/30 border border-red-700/50 text-red-200 text-[13px]">
              <strong>⚠ Keep your key secret.</strong> Never expose it in client-side code or
              public repositories. Revoke and regenerate immediately if compromised.
            </div>
          </Section>

          {/* ── Errors ── */}
          <Section id="errors" title="Errors & rate limits">
            <p>
              All responses use standard HTTP status codes and return a JSON body with a{" "}
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[12px]">success</code> boolean and an{" "}
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[12px]">error</code> message on failure.
            </p>
            <CodeBlock lang="json">{`{
  "success": false,
  "error": "Insufficient wallet balance. Required: ₦300, Available: ₦50"
}`}</CodeBlock>
            <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/30">
              <table className="w-full text-[13px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/50">
                    <th className="text-left py-3 px-4 font-semibold text-indigo-300">Code</th>
                    <th className="text-left py-3 px-4 font-semibold text-indigo-300">Meaning</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  {[
                    ["200", "Success"],
                    ["400", "Bad request — missing or invalid fields"],
                    ["401", "Unauthorized — invalid or missing API key"],
                    ["402", "Payment required — insufficient wallet balance"],
                    ["404", "Plan not found or not available for API users"],
                    ["429", "Rate limit exceeded (10,000 requests / day)"],
                    ["500 / 502", "Server or upstream provider error"],
                  ].map(([code, meaning]) => (
                    <tr key={code} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4">
                        <code className="font-mono text-amber-400">{code}</code>
                      </td>
                      <td className="py-3 px-4 text-slate-300">{meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[13px] text-slate-400">
              Rate limit: <strong className="text-slate-300">10,000 requests per day</strong> per API key. The counter resets
              every 24 hours.
            </p>
          </Section>

          {/* ── Buy airtime ── */}
          <Section id="airtime" title="Buy airtime">
            <Endpoint method="POST" path={`${API_BASE}/airtime/purchase`} />
            <p>
              Purchase airtime for any Nigerian network. The exact{" "}
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[12px]">amount</code> is
              deducted from your wallet — there is no markup on airtime.
            </p>
            <h3 className="font-semibold text-slate-800 mt-4 mb-2">Request body</h3>
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
            <div className="p-4 rounded-lg bg-gradient-to-br from-blue-900/30 to-blue-950/30 border border-blue-700/50 text-blue-200 text-[13px]">
              <strong>ℹ How to use:</strong> Call <code className="bg-blue-900/50 px-2 py-1 rounded text-[12px] border border-blue-700/50">/data/plans</code> first
              to get the live plan list for a service, then pass the plan&apos;s{" "}
              <code className="bg-blue-900/50 px-2 py-1 rounded text-[12px] border border-blue-700/50">id</code> as{" "}
              <code className="bg-blue-900/50 px-2 py-1 rounded text-[12px] border border-blue-700/50">plan_id</code> in{" "}
              <code className="bg-blue-900/50 px-2 py-1 rounded text-[12px] border border-blue-700/50">/data/purchase</code>.
              The <code className="bg-blue-900/50 px-2 py-1 rounded text-[12px] border border-blue-700/50">price</code> is always
              real-time and is the exact amount deducted from your wallet — no hidden markup shown.
              IDs vary per service; always use the live response, never hardcode them.
            </div>
          </Section>

          {/* ── Buy data ── */}
          <Section id="data-purchase" title="Buy data">
            <Endpoint method="POST" path={`${API_BASE}/data/purchase`} />
            <p>
              Purchase a data plan. Use the <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[12px]">id</code>{" "}
              from <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[12px]">/data/plans</code> as the{" "}
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[12px]">plan_id</code>. The{" "}
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[12px]">price</code> shown
              in the plans response is the exact amount deducted from your wallet.
            </p>
            <h3 className="font-semibold text-slate-800 mt-4 mb-2">Request body</h3>
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
            <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/30">
              <table className="w-full text-[13px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/50">
                    <th className="text-left py-3 px-4 font-semibold text-indigo-300">Service ID</th>
                    <th className="text-left py-3 px-4 font-semibold text-indigo-300">Network</th>
                    <th className="text-left py-3 px-4 font-semibold text-indigo-300">Type</th>
                    <th className="text-left py-3 px-4 font-semibold text-indigo-300">Plans</th>
                    <th className="text-left py-3 px-4 font-semibold text-indigo-300">Notes</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  {DATA_SERVICES.map((s) => (
                    <tr key={s.id} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4">
                        <code className="font-mono text-indigo-300 bg-indigo-950/40 px-2 py-1 rounded text-[12px] border border-indigo-700/30">{s.id}</code>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-200">{s.network}</td>
                      <td className="py-3 px-4 text-slate-400">{s.type}</td>
                      <td className="py-3 px-4 text-slate-400">{s.plans ?? "—"}</td>
                      <td className="py-3 px-4 text-slate-400">{s.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="font-semibold text-white mt-6 mb-3">Airtime network IDs</h3>
            <p className="text-slate-300">Pass one of these as <code className="bg-slate-800 px-2 py-1 rounded text-[12px] text-indigo-300 border border-slate-700">network</code> in the airtime purchase request.</p>
            <div className="flex flex-wrap gap-3 mt-4">
              {AIRTIME_NETWORKS.map((n) => (
                <span key={n.id} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 bg-gradient-to-r from-slate-800 to-slate-900 text-[13px] hover:border-indigo-600 transition shadow-lg">
                  <code className="font-mono text-indigo-400 text-[12px]">{n.id}</code>
                  <span className="text-slate-300">{n.label}</span>
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
