"use client"

import Link from "next/link"
import { useState } from "react"
import { Footer } from "@/components/footer"

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
      <div className="absolute top-3 right-3 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{lang}</span>
        <button
          type="button"
          onClick={onCopy}
          className="text-[11px] font-semibold px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
          aria-label="Copy code"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-xl bg-slate-950 text-slate-100 text-[12.5px] leading-relaxed p-4 pr-24 font-mono border border-slate-900">
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
    <div className="flex items-center gap-2 flex-wrap mb-3">
      <MethodPill method={method} />
      <code className="text-[13px] font-mono text-slate-700 bg-slate-100 px-2 py-1 rounded-md">{path}</code>
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
    <section id={id} className="scroll-mt-24 mb-16">
      <h2 className="text-xl font-bold text-slate-900 mb-5 pb-2 border-b border-slate-100">{title}</h2>
      <div className="space-y-5 text-slate-700 text-[14px] leading-relaxed">{children}</div>
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
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-2.5 pr-4 align-top">
        <code className="text-[12px] font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
          {name}
        </code>
      </td>
      <td className="py-2.5 pr-4 align-top text-[12px] text-slate-500">{type}</td>
      <td className="py-2.5 pr-4 align-top">
        {required ? (
          <span className="text-[10px] font-bold bg-red-50 text-red-600 border border-red-100 px-1.5 py-0.5 rounded">
            required
          </span>
        ) : (
          <span className="text-[10px] text-slate-400">optional</span>
        )}
      </td>
      <td className="py-2.5 align-top text-slate-600">{desc}</td>
    </tr>
  )
}

function ParamTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px] border-collapse">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left py-2 pr-4 font-semibold text-slate-700">Field</th>
            <th className="text-left py-2 pr-4 font-semibold text-slate-700">Type</th>
            <th className="text-left py-2 pr-4 font-semibold text-slate-700">Required</th>
            <th className="text-left py-2 font-semibold text-slate-700">Description</th>
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
    <div className="min-h-screen bg-white font-sans">
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm font-bold text-slate-900 hover:text-slate-700">
              Mozosubz
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-sm text-slate-500">API Reference</span>
          </div>
          <Link
            href="/integrations/keys"
            className="text-[13px] font-semibold px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition"
          >
            Get API Key
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 flex gap-8 py-10">
        {/* Sidebar nav */}
        <aside className="hidden lg:block w-52 shrink-0 sticky top-24 self-start">
          <nav className="space-y-1">
            {(() => {
              let lastGroup = ""
              return SECTIONS.map((s) => {
                const groupHeader =
                  s.group && s.group !== lastGroup ? (
                    <p
                      key={`g-${s.group}`}
                      className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mt-5 mb-1 px-2"
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
                      className={`block text-[13px] px-2 py-1.5 rounded-md transition ${
                        activeSection === s.id
                          ? "bg-slate-100 text-slate-900 font-semibold"
                          : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                      }`}
                    >
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
              The <strong>Mozosubz v1 API</strong> lets you purchase <strong>data</strong> and{" "}
              <strong>airtime</strong> programmatically using your wallet balance. It is designed
              for developers who want to integrate VTU services directly into their own apps.
            </p>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Base URL
              </p>
              <code className="text-[13px] font-mono text-slate-800">{API_BASE}</code>
            </div>
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[13px]">
              <strong>Note:</strong> Your wallet must be funded before making purchases. All
              amounts are in Nigerian Naira (₦). Prices shown by{" "}
              <code className="text-[12px] bg-amber-100 px-1 rounded">/data/plans</code> are the
              exact amounts that will be deducted from your wallet.
            </div>
          </Section>

          {/* ── Authentication ── */}
          <Section id="authentication" title="Authentication">
            <p>
              Every request must include your Connect Key in the{" "}
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[12px]">X-Connect-Key</code>{" "}
              header. You can generate and manage keys from the{" "}
              <Link href="/integrations/keys" className="text-indigo-600 hover:underline font-medium">
                API Keys page
              </Link>
              .
            </p>
            <CodeBlock lang="bash">{`curl ${API_BASE}/data/plans?service=mtn_sme \\
  -H "X-Connect-Key: mzk_your_key_here"`}</CodeBlock>
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-[13px]">
              <strong>Keep your key secret.</strong> Never expose it in client-side code or
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
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 pr-6 font-semibold text-slate-700">Code</th>
                    <th className="text-left py-2 font-semibold text-slate-700">Meaning</th>
                  </tr>
                </thead>
                <tbody className="text-slate-600">
                  {[
                    ["200", "Success"],
                    ["400", "Bad request — missing or invalid fields"],
                    ["401", "Unauthorized — invalid or missing API key"],
                    ["402", "Payment required — insufficient wallet balance"],
                    ["404", "Plan not found or not available for API users"],
                    ["429", "Rate limit exceeded (10,000 requests / day)"],
                    ["500 / 502", "Server or upstream provider error"],
                  ].map(([code, meaning]) => (
                    <tr key={code} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 pr-6">
                        <code className="font-mono text-slate-800">{code}</code>
                      </td>
                      <td className="py-2.5 text-slate-600">{meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[13px] text-slate-600">
              Rate limit: <strong>10,000 requests per day</strong> per API key. The counter resets
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
  -H "X-Connect-Key: mzk_your_key_here" \\
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
  "reference": "GSUBZ-REF-XXXXX",
  "balance_before": 5000,
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
  -H "X-Connect-Key: mzk_your_key_here"`}</CodeBlock>
            <h3 className="font-semibold text-slate-800 mt-4 mb-2">Response</h3>
            <CodeBlock lang="json">{`{
  "success": true,
  "service": "mtn_sme",
  "plans": [
    {
      "id": "mtn_sme_1gb",
      "name": "1GB - 7 Days",
      "provider_price": 300,
      "api_price": 315,
      "available": true
    },
    {
      "id": "mtn_sme_2gb",
      "name": "2GB - 30 Days",
      "provider_price": 600,
      "api_price": 620,
      "available": true
    }
  ]
}`}</CodeBlock>
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-[13px]">
              Use the <code className="bg-blue-100 px-1 rounded text-[12px]">name</code> value as
              the <code className="bg-blue-100 px-1 rounded text-[12px]">plan_id</code> when
              calling <code className="bg-blue-100 px-1 rounded text-[12px]">/data/purchase</code>.
            </div>
          </Section>

          {/* ── Buy data ── */}
          <Section id="data-purchase" title="Buy data">
            <Endpoint method="POST" path={`${API_BASE}/data/purchase`} />
            <p>
              Purchase a data plan. The <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[12px]">api_price</code>{" "}
              shown in <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[12px]">/data/plans</code> is
              the exact amount deducted from your wallet.
            </p>
            <h3 className="font-semibold text-slate-800 mt-4 mb-2">Request body</h3>
            <ParamTable>
              <ParamRow name="service" type="string" required desc='Same service identifier used in /data/plans (e.g. "mtn_sme")' />
              <ParamRow name="plan_id" type="string" required desc='The plan name from /data/plans (e.g. "1GB - 7 Days")' />
              <ParamRow name="phone" type="string" required desc="Nigerian phone number to receive the data (e.g. 08012345678)" />
            </ParamTable>
            <CodeBlock lang="bash">{`curl -X POST ${API_BASE}/data/purchase \\
  -H "X-Connect-Key: mzk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "service": "mtn_sme",
    "plan_id": "1GB - 7 Days",
    "phone": "08012345678"
  }'`}</CodeBlock>
            <h3 className="font-semibold text-slate-800 mt-4 mb-2">Response</h3>
            <CodeBlock lang="json">{`{
  "success": true,
  "transaction_id": "V1-DATA-A1B2C3D4E5F6",
  "plan": "1GB - 7 Days",
  "phone": "08012345678",
  "amount": 315,
  "reference": "GSUBZ-REF-XXXXX",
  "balance_before": 5000,
  "balance_after": 4685
}`}</CodeBlock>
          </Section>

        </main>
      </div>

      <Footer />
    </div>
  )
}
