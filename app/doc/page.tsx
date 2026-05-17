"use client"

import Link from "next/link"
import { useState } from "react"
import { Footer } from "@/components/footer"

const API_BASE = "https://api.mozosubz.xyz"

type Section = {
  id: string
  label: string
  group?: string
}

const SECTIONS: Section[] = [
  { id: "introduction", label: "Introduction", group: "Getting started" },
  { id: "authentication", label: "Authentication", group: "Getting started" },
  { id: "errors", label: "Errors & rate limits", group: "Getting started" },
  { id: "balance", label: "Get balance", group: "Wallet" },
  { id: "deposit-start", label: "Start deposit", group: "Wallet" },
  { id: "transactions", label: "List transactions", group: "Wallet" },
  { id: "verify", label: "Verify a transaction", group: "Wallet" },
  { id: "airtime", label: "Buy airtime", group: "VTU" },
  { id: "data-plans", label: "Data plans", group: "VTU" },
  { id: "data-purchase", label: "Buy data", group: "VTU" },
  { id: "cable-plans", label: "Cable plans", group: "VTU" },
  { id: "cable-subscribe", label: "Subscribe cable", group: "VTU" },
  { id: "electricity", label: "Pay electricity", group: "VTU" },
  { id: "pins", label: "Generate recharge pins", group: "VTU" },
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
      <h2 className="text-2xl font-bold text-slate-900 mb-4 tracking-tight">{title}</h2>
      <div className="space-y-4 text-[14.5px] leading-relaxed text-slate-700">{children}</div>
    </section>
  )
}

function ParamTable({
  rows,
}: {
  rows: { name: string; type: string; required?: boolean; description: string }[]
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-[13px]">
        <thead className="bg-slate-50">
          <tr className="text-left">
            <th className="px-3 py-2 font-semibold text-slate-700">Field</th>
            <th className="px-3 py-2 font-semibold text-slate-700">Type</th>
            <th className="px-3 py-2 font-semibold text-slate-700">Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-t border-slate-100 align-top">
              <td className="px-3 py-2.5 font-mono text-slate-900">
                {r.name}
                {r.required && <span className="ml-1 text-[10px] text-orange-600 font-semibold">required</span>}
              </td>
              <td className="px-3 py-2.5 text-slate-600 font-mono">{r.type}</td>
              <td className="px-3 py-2.5 text-slate-700">{r.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function DocsPage() {
  const grouped = SECTIONS.reduce<Record<string, Section[]>>((acc, s) => {
    const g = s.group || "Other"
    acc[g] = acc[g] || []
    acc[g].push(s)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/icon.svg" alt="Mozosubz" className="w-8 h-8 rounded-lg" />
            <span className="font-bold text-slate-900">
              Mozosubz <span className="text-slate-400 font-medium">/ Docs</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/integrations/keys"
              className="text-sm font-semibold text-slate-700 hover:text-blue-700 transition hidden sm:inline"
            >
              Connect Keys
            </Link>
            <Link
              href="/dashboard"
              className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg transition"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <div className="grid lg:grid-cols-[240px_1fr] gap-10">
          {/* Sidebar */}
          <aside className="hidden lg:block">
            <nav className="sticky top-20">
              {Object.entries(grouped).map(([group, items]) => (
                <div key={group} className="mb-6">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">
                    {group}
                  </h4>
                  <ul className="space-y-1">
                    {items.map((s) => (
                      <li key={s.id}>
                        <a
                          href={`#${s.id}`}
                          className="block text-sm text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-md px-2.5 py-1.5 transition"
                        >
                          {s.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>

          {/* Main content */}
          <main className="min-w-0">
            {/* Hero */}
            <div className="mb-12 pb-10 border-b border-slate-200">
              <p className="text-xs font-bold uppercase tracking-widest text-orange-600 mb-2">
                Mozosubz API · v1
              </p>
              <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight mb-4 text-balance">
                Build VTU into anything.
              </h1>
              <p className="text-lg text-slate-600 leading-relaxed max-w-2xl text-pretty">
                Sell airtime, data, cable, electricity and recharge pins programmatically using a single
                Connect Key tied to your Mozosubz wallet. Stable JSON, predictable errors, no surprises.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/integrations/keys"
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition"
                >
                  Get a Connect Key
                </Link>
                <a
                  href="#authentication"
                  className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-sm font-semibold px-4 py-2.5 rounded-lg transition"
                >
                  Read auth guide
                </a>
              </div>

              <div className="mt-8 grid sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                    Base URL
                  </p>
                  <code className="text-[13px] font-mono text-slate-900">{API_BASE}</code>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                    Auth header
                  </p>
                  <code className="text-[13px] font-mono text-slate-900">X-Connect-Key: connect_…</code>
                </div>
              </div>
            </div>

            {/* INTRODUCTION */}
            <Section id="introduction" title="Introduction">
              <p>
                The Mozosubz v1 API lets you charge your Mozosubz wallet for VTU services from any backend.
                Every endpoint is JSON in / JSON out, every successful purchase is debited atomically from
                your wallet, and every transaction is recorded against your account just like a UI purchase.
              </p>
              <ul className="list-disc pl-6 space-y-1.5">
                <li>One credential — a Connect Key — replaces signing, signing keys and OAuth.</li>
                <li>All amounts are in Naira (<code className="font-mono text-[13px]">NGN</code>).</li>
                <li>All timestamps are ISO‑8601 in UTC.</li>
                <li>Wallet, key and webhook actions stay on Mozosubz — you never call providers directly.</li>
              </ul>
            </Section>

            {/* AUTHENTICATION */}
            <Section id="authentication" title="Authentication">
              <p>
                Authenticate every request with a Connect Key in the{" "}
                <code className="font-mono text-[13px]">X-Connect-Key</code> header. Generate one from{" "}
                <Link href="/integrations/keys" className="text-blue-700 font-semibold hover:underline">
                  Settings → Connect Keys
                </Link>
                . Each user can have one active key at a time; creating a new one revokes the previous.
              </p>
              <CodeBlock lang="bash">{`curl ${API_BASE}/v1/balance \\
  -H "X-Connect-Key: connect_live_xxxxxxxxxxxxxxxxxxxxxxxx"`}</CodeBlock>
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-[13.5px] text-orange-900">
                <strong className="font-bold">Treat your key like a password.</strong> Store it in your
                server&apos;s environment variables. Never expose it in client code, mobile apps, or
                browser-visible bundles. If a key is exposed, revoke it from your dashboard immediately.
              </div>
            </Section>

            {/* ERRORS */}
            <Section id="errors" title="Errors & rate limits">
              <p>
                The API uses standard HTTP status codes. Error responses always include a{" "}
                <code className="font-mono text-[13px]">success: false</code> field and a human‑readable{" "}
                <code className="font-mono text-[13px]">error</code> message.
              </p>
              <ParamTable
                rows={[
                  { name: "200", type: "OK", description: "Request succeeded." },
                  { name: "400", type: "Bad request", description: "Missing or invalid parameters." },
                  { name: "401", type: "Unauthorized", description: "Missing, invalid or revoked key." },
                  { name: "402", type: "Payment required", description: "Insufficient wallet balance." },
                  { name: "404", type: "Not found", description: "Resource (e.g. transaction) not found." },
                  { name: "429", type: "Too many requests", description: "Rate limit exceeded." },
                  { name: "500", type: "Server error", description: "Unexpected server error. Safe to retry idempotent calls." },
                ]}
              />
              <p>
                Rate limit: <strong>10,000 requests per key per 24h</strong>. Contact support if you need a
                higher limit for production traffic.
              </p>
              <CodeBlock lang="json">{`{
  "success": false,
  "error": "Insufficient wallet balance"
}`}</CodeBlock>
            </Section>

            {/* BALANCE */}
            <Section id="balance" title="Get balance">
              <Endpoint method="GET" path="/v1/balance" />
              <p>Returns the current available balance on the key holder&apos;s wallet, in Naira.</p>
              <CodeBlock lang="bash">{`curl ${API_BASE}/v1/balance \\
  -H "X-Connect-Key: $MOZOSUBZ_KEY"`}</CodeBlock>
              <CodeBlock lang="json">{`{
  "success": true,
  "balance": 12540.75
}`}</CodeBlock>
            </Section>

            {/* DEPOSIT START */}
            <Section id="deposit-start" title="Start a deposit">
              <Endpoint method="POST" path="/v1/deposit/start" />
              <p>
                Create a one‑time virtual account for funding the wallet. The user pays into the returned
                account number; once Mozosubz receives Monnify&apos;s webhook, the wallet is credited (net
                of processing fee) automatically. Poll{" "}
                <a href="#verify" className="text-blue-700 font-semibold hover:underline">
                  /v1/verify
                </a>{" "}
                with the returned <code className="font-mono text-[13px]">paymentReference</code> to detect
                when the deposit lands.
              </p>
              <ParamTable
                rows={[
                  { name: "amount", type: "number", required: true, description: "Amount to deposit, NGN. Min ₦100, max ₦1,000,000." },
                ]}
              />
              <CodeBlock lang="bash">{`curl ${API_BASE}/v1/deposit/start \\
  -H "X-Connect-Key: $MOZOSUBZ_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "amount": 5000 }'`}</CodeBlock>
              <CodeBlock lang="json">{`{
  "success": true,
  "paymentReference": "MOZO_a1b2c3d4_1731000000000_xyz",
  "amount": 5000,
  "processingFee": 50,
  "netAmount": 4950,
  "accountNumber": "1234567890",
  "bankName": "Wema Bank",
  "accountName": "MOZOSUBZ-USER",
  "expiresAt": "2026-05-17T09:20:00.000Z"
}`}</CodeBlock>
            </Section>

            {/* TRANSACTIONS */}
            <Section id="transactions" title="List transactions">
              <Endpoint method="GET" path="/v1/transactions" />
              <p>Returns the key holder&apos;s service transactions, newest first.</p>
              <ParamTable
                rows={[
                  { name: "limit", type: "number", description: "1–100, default 20." },
                  { name: "offset", type: "number", description: "Pagination offset, default 0." },
                  { name: "category", type: "string", description: "AIRTIME, DATA, CABLE, ELECTRICITY, RECHARGE_PIN." },
                  { name: "status", type: "string", description: "SUCCESS, FAILED, PENDING." },
                ]}
              />
              <CodeBlock lang="bash">{`curl "${API_BASE}/v1/transactions?limit=10&category=DATA" \\
  -H "X-Connect-Key: $MOZOSUBZ_KEY"`}</CodeBlock>
              <CodeBlock lang="json">{`{
  "success": true,
  "transactions": [
    {
      "transaction_id": "TX-1731000000000-abcd",
      "category": "DATA",
      "service_id": "mtn-data",
      "service_name": "MTN Data",
      "amount": 1200,
      "phone": "08012345678",
      "status": "SUCCESS",
      "description": "MTN 2GB · 30 days",
      "balance_before": 5000,
      "balance_after": 3800,
      "created_at": "2026-05-17T08:55:12.000Z"
    }
  ],
  "pagination": { "limit": 10, "offset": 0, "total": 42, "hasMore": true }
}`}</CodeBlock>
            </Section>

            {/* VERIFY */}
            <Section id="verify" title="Verify a transaction">
              <Endpoint method="POST" path="/v1/verify" />
              <p>
                Look up either a service <code className="font-mono text-[13px]">transaction_id</code> or a
                deposit <code className="font-mono text-[13px]">paymentReference</code>. Only transactions
                belonging to the key holder are returned.
              </p>
              <ParamTable
                rows={[
                  { name: "reference", type: "string", required: true, description: "transaction_id or paymentReference." },
                ]}
              />
              <CodeBlock lang="bash">{`curl ${API_BASE}/v1/verify \\
  -H "X-Connect-Key: $MOZOSUBZ_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "reference": "MOZO_a1b2c3d4_1731000000000_xyz" }'`}</CodeBlock>
              <CodeBlock lang="json">{`{
  "success": true,
  "type": "deposit",
  "transaction": {
    "payment_reference": "MOZO_a1b2c3d4_1731000000000_xyz",
    "amount": 5000,
    "net_amount": 4950,
    "status": "SUCCESS",
    "paid_at": "2026-05-17T09:01:33.000Z"
  }
}`}</CodeBlock>
            </Section>

            {/* AIRTIME */}
            <Section id="airtime" title="Buy airtime">
              <Endpoint method="POST" path="/v1/airtime/purchase" />
              <p>Charges the wallet and tops up the recipient line.</p>
              <ParamTable
                rows={[
                  { name: "serviceID", type: "string", required: true, description: "mtn, airtel, glo, 9mobile (or etisalat)." },
                  { name: "amount", type: "number", required: true, description: "Naira amount. Min ₦50." },
                  { name: "phone", type: "string", required: true, description: "Recipient phone number, 11 digits." },
                  { name: "requestID", type: "string", description: "Optional client‑side idempotency key (echoed back)." },
                ]}
              />
              <CodeBlock lang="bash">{`curl ${API_BASE}/v1/airtime/purchase \\
  -H "X-Connect-Key: $MOZOSUBZ_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "serviceID": "mtn",
    "amount": 200,
    "phone": "08012345678"
  }'`}</CodeBlock>
              <CodeBlock lang="json">{`{
  "success": true,
  "message": "Airtime purchase successful",
  "transactionId": "TX-1731000000000-abcd",
  "balanceBefore": 5000,
  "balanceAfter": 4800
}`}</CodeBlock>
            </Section>

            {/* DATA PLANS */}
            <Section id="data-plans" title="Data plans">
              <Endpoint method="GET" path="/v1/data/plans" />
              <p>
                Returns the live data plan catalog for the requested network (sourced from the same VTU
                provider that powers the Mozosubz dashboard).
              </p>
              <ParamTable
                rows={[
                  { name: "network", type: "string", required: true, description: "mtn, airtel, glo, 9mobile (or etisalat)." },
                ]}
              />
              <CodeBlock lang="bash">{`curl "${API_BASE}/v1/data/plans?network=mtn" \\
  -H "X-Connect-Key: $MOZOSUBZ_KEY"`}</CodeBlock>
              <CodeBlock lang="json">{`{
  "success": true,
  "network": "mtn",
  "plans": [
    { "name": "MTN 1GB · 30 days", "price": 750 },
    { "name": "MTN 2GB · 30 days", "price": 1200 }
  ]
}`}</CodeBlock>
            </Section>

            {/* DATA PURCHASE */}
            <Section id="data-purchase" title="Buy data">
              <Endpoint method="POST" path="/v1/data/purchase" />
              <ParamTable
                rows={[
                  { name: "serviceID", type: "string", required: true, description: "mtn, airtel, glo, 9mobile (or etisalat)." },
                  { name: "plan", type: "string", required: true, description: "Plan id (key) returned by /v1/data/plans." },
                  { name: "phone", type: "string", required: true, description: "Recipient phone number." },
                  { name: "amount", type: "number", required: true, description: "Plan price in NGN — must match the catalog." },
                  { name: "planDisplayName", type: "string", description: "Optional readable plan name for receipts." },
                  { name: "requestID", type: "string", description: "Optional client‑side idempotency key." },
                ]}
              />
              <CodeBlock lang="bash">{`curl ${API_BASE}/v1/data/purchase \\
  -H "X-Connect-Key: $MOZOSUBZ_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "serviceID": "mtn",
    "plan": "mtn-2gb-30",
    "phone": "08012345678",
    "amount": 1200
  }'`}</CodeBlock>
            </Section>

            {/* CABLE PLANS */}
            <Section id="cable-plans" title="Cable plans">
              <Endpoint method="GET" path="/v1/cable/plans" />
              <ParamTable
                rows={[
                  { name: "provider", type: "string", required: true, description: "dstv, gotv, startimes." },
                ]}
              />
              <CodeBlock lang="bash">{`curl "${API_BASE}/v1/cable/plans?provider=dstv" \\
  -H "X-Connect-Key: $MOZOSUBZ_KEY"`}</CodeBlock>
            </Section>

            {/* CABLE SUBSCRIBE */}
            <Section id="cable-subscribe" title="Subscribe cable">
              <Endpoint method="POST" path="/v1/cable/subscribe" />
              <ParamTable
                rows={[
                  { name: "serviceID", type: "string", required: true, description: "dstv, gotv, startimes." },
                  { name: "plan", type: "string", required: true, description: "Package id from /v1/cable/plans." },
                  { name: "customerID", type: "string", required: true, description: "Smartcard / IUC number." },
                  { name: "phone", type: "string", required: true, description: "Subscriber phone number." },
                  { name: "amount", type: "number", required: true, description: "Package price in NGN — must match the catalog." },
                  { name: "requestID", type: "string", description: "Optional idempotency key." },
                ]}
              />
              <CodeBlock lang="bash">{`curl ${API_BASE}/v1/cable/subscribe \\
  -H "X-Connect-Key: $MOZOSUBZ_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "serviceID": "dstv",
    "plan": "dstv-padi",
    "customerID": "1234567890",
    "phone": "08012345678",
    "amount": 2500
  }'`}</CodeBlock>
            </Section>

            {/* ELECTRICITY */}
            <Section id="electricity" title="Pay electricity">
              <Endpoint method="POST" path="/v1/electricity/purchase" />
              <ParamTable
                rows={[
                  { name: "serviceID", type: "string", required: true, description: "Disco code (e.g. ikeja-electric, eko-electric, ibadan-electric)." },
                  { name: "variation_code", type: "string", required: true, description: "prepaid or postpaid." },
                  { name: "customerID", type: "string", required: true, description: "Meter number." },
                  { name: "amount", type: "number", required: true, description: "Amount in NGN. Min ₦500." },
                  { name: "phone", type: "string", required: true, description: "Customer phone number." },
                  { name: "requestID", type: "string", description: "Optional idempotency key." },
                ]}
              />
              <CodeBlock lang="bash">{`curl ${API_BASE}/v1/electricity/purchase \\
  -H "X-Connect-Key: $MOZOSUBZ_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "serviceID": "ikeja-electric",
    "variation_code": "prepaid",
    "customerID": "1234567890",
    "amount": 2000,
    "phone": "08012345678"
  }'`}</CodeBlock>
              <p>
                Successful prepaid responses include a <code className="font-mono text-[13px]">token</code>{" "}
                you can show to the customer.
              </p>
            </Section>

            {/* PINS */}
            <Section id="pins" title="Generate recharge pins" >
              <Endpoint method="POST" path="/v1/pins/generate" />
              <ParamTable
                rows={[
                  { name: "network", type: "string", required: true, description: "mtn, airtel, glo, 9mobile." },
                  { name: "value", type: "string", required: true, description: "Denomination per pin in NGN, e.g. \"100\", \"200\"." },
                  { name: "number", type: "string", required: true, description: "Number of pins to generate, 1–50." },
                ]}
              />
              <CodeBlock lang="bash">{`curl ${API_BASE}/v1/pins/generate \\
  -H "X-Connect-Key: $MOZOSUBZ_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "network": "mtn",
    "value": "200",
    "number": "5"
  }'`}</CodeBlock>
              <CodeBlock lang="json">{`{
  "success": true,
  "transactionId": "TX-1731000000000-abcd",
  "pins": [
    { "pin": "1234567890123456", "serial": "SR-0001" }
  ],
  "totalCost": 1000,
  "balanceAfter": 4000
}`}</CodeBlock>
            </Section>

          </main>
        </div>
      </div>

      <Footer />
    </div>
  )
}
