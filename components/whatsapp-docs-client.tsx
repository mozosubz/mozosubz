"use client"

import { useState } from "react"
import {
  ShieldCheck,
  Zap,
  Link as LinkIcon,
  Unplug,
  ScanLine,
  Lock,
  KeyRound,
  Copy,
  Check,
} from "lucide-react"

type Method = "POST" | "GET"

interface Endpoint {
  method: Method
  path: string
  summary: string
  auth: string
  body?: string
  headers?: string
  successExample: string
  errorExample?: string
  curl: string
}

const SECTION_IDS = {
  overview: "overview",
  flow: "flow",
  security: "security",
  base: "base-url",
  ep_token: "ep-connect-token",
  ep_connect: "ep-connect",
  ep_disconnect: "ep-disconnect",
  ep_auth: "ep-authenticate",
  using_apis: "using-existing-apis",
} as const

const ENDPOINTS: Endpoint[] = [
  {
    method: "POST",
    path: "/api/whatsapp/connect-token",
    summary:
      "Issue a one-time, 10-minute connect token to the signed-in Mozosubz user. The user forwards it to the WhatsApp bot.",
    auth: "Supabase session cookie (signed-in Mozosubz user)",
    headers: `Cookie: <supabase session cookies>`,
    body: `// no body required`,
    successExample: `{
  "success": true,
  "token": "MZ_4XJ9K2Q...32 chars total",
  "expires_in_minutes": 10,
  "expires_at": "2025-05-11T14:32:11.000Z",
  "instructions": "Send the message 'CONNECT MZ_4XJ9K2Q...' to the Mozosubz WhatsApp bot to finish linking your account."
}

// If the user is already linked:
{
  "success": true,
  "already_connected": true,
  "whatsapp_phone_masked": "+234801***678",
  "verified_at": "2025-05-01T10:11:22.000Z"
}`,
    errorExample: `// 401 - not signed in
{ "success": false, "error": "Unauthorized" }`,
    curl: `curl -X POST https://YOUR_DOMAIN/api/whatsapp/connect-token \\
  -H "Cookie: sb-access-token=..."`,
  },
  {
    method: "POST",
    path: "/api/whatsapp/connect",
    summary:
      "Called by the WhatsApp bot when a user sends 'CONNECT <token>'. Verifies the token and links the WhatsApp number to the Mozosubz user.",
    auth:
      "Bot API key. Send 'Authorization: Bearer <WHATSAPP_BOT_API_KEY>'. If the env var is unset, any caller is accepted (use in dev only).",
    headers: `Authorization: Bearer <WHATSAPP_BOT_API_KEY>
Content-Type: application/json`,
    body: `{
  "whatsapp_phone": "+2348012345678",
  "token": "MZ_4XJ9K2Q..."
}`,
    successExample: `{
  "success": true,
  "user_id": "9a2e...uuid",
  "whatsapp_phone": "+2348012345678",
  "verified_at": "2025-05-11T14:25:03.000Z"
}`,
    errorExample: `// 400 - token invalid / expired
{ "success": false, "error": "Invalid or expired token" }

// 409 - phone already linked to another account
{ "success": false, "error": "This WhatsApp number is already linked to another account" }

// 401 - bot key wrong
{ "success": false, "error": "Unauthorized" }`,
    curl: `curl -X POST https://YOUR_DOMAIN/api/whatsapp/connect \\
  -H "Authorization: Bearer $WHATSAPP_BOT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "whatsapp_phone": "+2348012345678", "token": "MZ_4XJ9K2Q..." }'`,
  },
  {
    method: "POST",
    path: "/api/whatsapp/disconnect",
    summary:
      "Removes the WhatsApp link for the signed-in Mozosubz user. The same number can be re-linked later.",
    auth: "Supabase session cookie (signed-in Mozosubz user)",
    headers: `Cookie: <supabase session cookies>`,
    body: `// no body required`,
    successExample: `{ "success": true, "message": "WhatsApp disconnected" }

// If the user wasn't linked:
{ "success": true, "already_disconnected": true }`,
    errorExample: `// 401 - not signed in
{ "success": false, "error": "Unauthorized" }`,
    curl: `curl -X POST https://YOUR_DOMAIN/api/whatsapp/disconnect \\
  -H "Cookie: sb-access-token=..."`,
  },
  {
    method: "POST",
    path: "/api/whatsapp/authenticate",
    summary:
      "The bot's entry point for every WhatsApp request. Resolves a WhatsApp number to the Mozosubz user_id + profile snapshot. Returns authenticated:false if the number isn't linked.",
    auth:
      "Bot API key. Send 'Authorization: Bearer <WHATSAPP_BOT_API_KEY>'. If the env var is unset, any caller is accepted (use in dev only).",
    headers: `Authorization: Bearer <WHATSAPP_BOT_API_KEY>
Content-Type: application/json`,
    body: `{ "whatsapp_phone": "+2348012345678" }`,
    successExample: `// Linked
{
  "success": true,
  "authenticated": true,
  "user_id": "9a2e...uuid",
  "verified_at": "2025-05-01T10:11:22.000Z",
  "profile": {
    "id": "9a2e...uuid",
    "email": "user@example.com",
    "full_name": "Ada Lovelace",
    "username": "ada",
    "phone_number": "+2348012345678",
    "wallet_balance": 15250.5,
    "is_admin": false
  }
}

// Not linked
{ "success": true, "authenticated": false }`,
    errorExample: `// 400 - bad phone
{ "success": false, "error": "whatsapp_phone is invalid or missing" }

// 401 - bot key wrong
{ "success": false, "error": "Unauthorized" }`,
    curl: `curl -X POST https://YOUR_DOMAIN/api/whatsapp/authenticate \\
  -H "Authorization: Bearer $WHATSAPP_BOT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "whatsapp_phone": "+2348012345678" }'`,
  },
]

export function WhatsAppDocsClient() {
  return (
    <>
      <Hero />
      <main className="px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="max-w-6xl mx-auto grid gap-10 lg:grid-cols-[220px_1fr]">
          <SideNav />
          <div className="space-y-16 min-w-0">
            <Overview />
            <FlowSection />
            <SecuritySection />
            <BaseUrlSection />
            <section className="space-y-8">
              <h2 className="text-2xl font-bold text-slate-900">Endpoints</h2>
              <EndpointCard endpoint={ENDPOINTS[0]} anchor={SECTION_IDS.ep_token} />
              <EndpointCard endpoint={ENDPOINTS[1]} anchor={SECTION_IDS.ep_connect} />
              <EndpointCard endpoint={ENDPOINTS[2]} anchor={SECTION_IDS.ep_disconnect} />
              <EndpointCard endpoint={ENDPOINTS[3]} anchor={SECTION_IDS.ep_auth} />
            </section>
            <UsingExistingApis />
          </div>
        </div>
      </main>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="px-4 sm:px-6 lg:px-8 pt-14 pb-12 md:pt-20 md:pb-16 border-b border-slate-100">
      <div className="max-w-6xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-xs font-semibold text-emerald-700 mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          WhatsApp integration
        </div>
        <h1 className="text-3xl md:text-5xl font-bold text-slate-900 leading-tight max-w-3xl">
          WhatsApp API
        </h1>
        <p className="mt-4 text-base md:text-lg text-slate-600 leading-relaxed max-w-3xl">
          A thin authentication layer for the Mozosubz WhatsApp bot. It links a
          WhatsApp number to a Mozosubz user and resolves that number back to a{" "}
          <code className="text-sm bg-slate-100 rounded px-1.5 py-0.5">
            user_id
          </code>
          . All airtime, data, cable, electricity, wallet and payment APIs are
          unchanged — the bot calls them on the user&apos;s behalf after
          authenticating.
        </p>
      </div>
    </section>
  )
}

function SideNav() {
  const items: { id: string; label: string }[] = [
    { id: SECTION_IDS.overview, label: "Overview" },
    { id: SECTION_IDS.flow, label: "Auth flow" },
    { id: SECTION_IDS.security, label: "Security" },
    { id: SECTION_IDS.base, label: "Base URL" },
    { id: SECTION_IDS.ep_token, label: "POST connect-token" },
    { id: SECTION_IDS.ep_connect, label: "POST connect" },
    { id: SECTION_IDS.ep_disconnect, label: "POST disconnect" },
    { id: SECTION_IDS.ep_auth, label: "POST authenticate" },
    { id: SECTION_IDS.using_apis, label: "Call existing APIs" },
  ]
  return (
    <aside className="lg:sticky lg:top-24 self-start">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
        Contents
      </p>
      <nav className="flex flex-col gap-1 text-sm">
        {items.map((i) => (
          <a
            key={i.id}
            href={"#" + i.id}
            className="text-slate-600 hover:text-blue-600 transition px-2 py-1.5 rounded-md hover:bg-slate-50"
          >
            {i.label}
          </a>
        ))}
      </nav>
    </aside>
  )
}

function Overview() {
  return (
    <section id={SECTION_IDS.overview} className="scroll-mt-24">
      <h2 className="text-2xl font-bold text-slate-900 mb-3">Overview</h2>
      <p className="text-slate-600 leading-relaxed mb-6 max-w-3xl">
        The WhatsApp layer does exactly four things. Nothing else, no business
        logic, no payments code — your existing Mozosubz APIs continue to run
        unchanged.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <FeatureCard
          icon={<KeyRound className="w-4 h-4" />}
          title="Connect token"
          desc="Mozosubz users generate a 10-minute one-time code in their account."
        />
        <FeatureCard
          icon={<LinkIcon className="w-4 h-4" />}
          title="Connect"
          desc="Bot redeems the code and links the WhatsApp number to the user."
        />
        <FeatureCard
          icon={<ScanLine className="w-4 h-4" />}
          title="Authenticate"
          desc="Bot resolves a WhatsApp number to a Mozosubz user_id on every request."
        />
        <FeatureCard
          icon={<Unplug className="w-4 h-4" />}
          title="Disconnect"
          desc="Users unlink WhatsApp from the Mozosubz profile page."
        />
      </div>
    </section>
  )
}

function FlowSection() {
  return (
    <section id={SECTION_IDS.flow} className="scroll-mt-24">
      <h2 className="text-2xl font-bold text-slate-900 mb-3">Auth flow</h2>
      <p className="text-slate-600 leading-relaxed mb-6 max-w-3xl">
        The bot never touches passwords or sessions. It only ever knows a
        WhatsApp phone number, which is exchanged server-side for a Mozosubz{" "}
        <code className="text-sm bg-slate-100 rounded px-1.5 py-0.5">user_id</code>.
      </p>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 overflow-x-auto">
        <pre className="text-xs leading-6 font-mono text-slate-700">{`User (signed in)            WhatsApp bot               Mozosubz API
──────────────────          ────────────               ────────────
1.  generate code  ───────►                  ────►  POST /connect-token
                                                       (returns "MZ_xxx")
2.  send "CONNECT MZ_xxx" ─►  recieves msg
3.                            POST /connect   ────►  link phone ↔ user_id
                              (phone, token)         (verified)

4.  any WhatsApp request  ─►  POST /authenticate ──►  phone ↔ user_id
                              (phone)                   (returns profile)

5.                            call existing
                              Mozosubz APIs    ────►  /api/airtime/purchase
                              with user_id            /api/data/purchase
                                                      /api/cable/subscribe
                                                      /api/electricity/...
                                                      /api/wallet/...
                                                      /api/payments/verify`}</pre>
      </div>
    </section>
  )
}

function SecuritySection() {
  return (
    <section id={SECTION_IDS.security} className="scroll-mt-24">
      <h2 className="text-2xl font-bold text-slate-900 mb-3">Security notes</h2>
      <ul className="space-y-3 text-sm text-slate-700 max-w-3xl">
        <Bullet>
          <strong>Tokens are one-time and short-lived.</strong> Each connect
          token expires after 10 minutes and is invalidated as soon as it&apos;s
          used.
        </Bullet>
        <Bullet>
          <strong>One WhatsApp number per Mozosubz account.</strong> A number
          already linked elsewhere is rejected with HTTP 409.
        </Bullet>
        <Bullet>
          <strong>Bot key in production.</strong> Set{" "}
          <code className="text-xs bg-slate-100 rounded px-1.5 py-0.5">
            WHATSAPP_BOT_API_KEY
          </code>{" "}
          and have your bot send it as{" "}
          <code className="text-xs bg-slate-100 rounded px-1.5 py-0.5">
            Authorization: Bearer ...
          </code>
          . Without it, the connect and authenticate endpoints are publicly
          callable — only acceptable for local dev.
        </Bullet>
        <Bullet>
          <strong>Audit trail.</strong> Every token issue, connect attempt,
          authenticate, and disconnect is recorded in{" "}
          <code className="text-xs bg-slate-100 rounded px-1.5 py-0.5">
            whatsapp_audit_logs
          </code>
          .
        </Bullet>
        <Bullet>
          <strong>RLS.</strong> Users can only read their own session and audit
          rows; writes go through service-role only.
        </Bullet>
      </ul>
    </section>
  )
}

function BaseUrlSection() {
  return (
    <section id={SECTION_IDS.base} className="scroll-mt-24">
      <h2 className="text-2xl font-bold text-slate-900 mb-3">Base URL</h2>
      <CodeBlock
        code={`https://YOUR_DOMAIN`}
        caption="All endpoints below are relative to this base."
      />
    </section>
  )
}

function UsingExistingApis() {
  return (
    <section id={SECTION_IDS.using_apis} className="scroll-mt-24">
      <h2 className="text-2xl font-bold text-slate-900 mb-3">
        Call existing Mozosubz APIs after authenticating
      </h2>
      <p className="text-slate-600 leading-relaxed mb-6 max-w-3xl">
        After{" "}
        <code className="text-sm bg-slate-100 rounded px-1.5 py-0.5">
          /api/whatsapp/authenticate
        </code>{" "}
        returns a{" "}
        <code className="text-sm bg-slate-100 rounded px-1.5 py-0.5">
          user_id
        </code>
        , the bot calls the same Mozosubz business APIs the dashboard uses —
        nothing about them changes. Pass the resolved{" "}
        <code className="text-sm bg-slate-100 rounded px-1.5 py-0.5">
          user_id
        </code>{" "}
        in the request body and authorize the call with the same bot API key.
      </p>

      <div className="space-y-5">
        <ApiExample
          title="Buy airtime"
          code={`# 1. Authenticate
curl -X POST https://YOUR_DOMAIN/api/whatsapp/authenticate \\
  -H "Authorization: Bearer $WHATSAPP_BOT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "whatsapp_phone": "+2348012345678" }'
# → { "authenticated": true, "user_id": "9a2e...uuid", ... }

# 2. Call the existing airtime endpoint with that user_id
curl -X POST https://YOUR_DOMAIN/api/airtime/purchase \\
  -H "Authorization: Bearer $WHATSAPP_BOT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "user_id": "9a2e...uuid",
    "network": "MTN",
    "phone": "08012345678",
    "amount": 500
  }'`}
        />
        <ApiExample
          title="Buy a data bundle"
          code={`curl -X POST https://YOUR_DOMAIN/api/data/purchase \\
  -H "Authorization: Bearer $WHATSAPP_BOT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "user_id": "9a2e...uuid",
    "network": "MTN",
    "plan_id": "mtn-sme-1gb",
    "phone": "08012345678"
  }'`}
        />
        <ApiExample
          title="Pay a cable bill"
          code={`curl -X POST https://YOUR_DOMAIN/api/cable/subscribe \\
  -H "Authorization: Bearer $WHATSAPP_BOT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "user_id": "9a2e...uuid",
    "provider": "DSTV",
    "smartcard": "1234567890",
    "plan_id": "dstv-compact"
  }'`}
        />
        <ApiExample
          title="Buy electricity"
          code={`curl -X POST https://YOUR_DOMAIN/api/electricity/purchase \\
  -H "Authorization: Bearer $WHATSAPP_BOT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "user_id": "9a2e...uuid",
    "disco": "IKEDC",
    "meter_number": "12345678901",
    "meter_type": "prepaid",
    "amount": 2000
  }'`}
        />
        <ApiExample
          title="Wallet balance"
          code={`curl -X POST https://YOUR_DOMAIN/api/wallet/balance \\
  -H "Authorization: Bearer $WHATSAPP_BOT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "user_id": "9a2e...uuid" }'`}
        />
        <ApiExample
          title="Verify a Monnify deposit"
          code={`curl -X POST https://YOUR_DOMAIN/api/payments/verify \\
  -H "Authorization: Bearer $WHATSAPP_BOT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "user_id": "9a2e...uuid",
    "reference": "MNFY|..."
  }'`}
        />
      </div>
      <p className="text-xs text-slate-500 mt-6 max-w-3xl">
        The exact request schema for each business endpoint is whatever it
        already accepts in the Mozosubz dashboard. The WhatsApp layer does not
        change those schemas — it only resolves a WhatsApp number to a{" "}
        <code className="text-xs bg-slate-100 rounded px-1.5 py-0.5">
          user_id
        </code>{" "}
        you can pass through.
      </p>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Endpoint card                                                       */
/* ------------------------------------------------------------------ */

function EndpointCard({ endpoint, anchor }: { endpoint: Endpoint; anchor: string }) {
  return (
    <article
      id={anchor}
      className="scroll-mt-24 border border-slate-200 rounded-xl overflow-hidden bg-white"
    >
      <header className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-3 flex-wrap">
        <MethodBadge method={endpoint.method} />
        <code className="text-sm font-mono font-semibold text-slate-900 break-all">
          {endpoint.path}
        </code>
      </header>

      <div className="px-5 py-5 space-y-5">
        <p className="text-sm text-slate-700 leading-relaxed">{endpoint.summary}</p>

        <KeyValueRow label="Auth" value={endpoint.auth} />

        {endpoint.headers && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Headers
            </p>
            <CodeBlock code={endpoint.headers} />
          </div>
        )}

        {endpoint.body && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Request body
            </p>
            <CodeBlock code={endpoint.body} />
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Example success
          </p>
          <CodeBlock code={endpoint.successExample} />
        </div>

        {endpoint.errorExample && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Example errors
            </p>
            <CodeBlock code={endpoint.errorExample} tone="warn" />
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            cURL
          </p>
          <CodeBlock code={endpoint.curl} />
        </div>
      </div>
    </article>
  )
}

/* ------------------------------------------------------------------ */
/* Building blocks                                                      */
/* ------------------------------------------------------------------ */

function MethodBadge({ method }: { method: Method }) {
  const styles =
    method === "GET"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : "bg-emerald-50 text-emerald-700 border-emerald-200"
  return (
    <span
      className={`text-xs font-mono font-bold px-2 py-1 rounded border ${styles}`}
    >
      {method}
    </span>
  )
}

function KeyValueRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 text-sm">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider sm:w-24 flex-shrink-0">
        {label}
      </span>
      <span className="text-slate-700">{value}</span>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode
  title: string
  desc: string
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-4 flex items-start gap-3">
      <div className="w-8 h-8 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-xs text-slate-600 mt-0.5">{desc}</p>
      </div>
    </div>
  )
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
      <span className="leading-relaxed">{children}</span>
    </li>
  )
}

function ApiExample({ title, code }: { title: string; code: string }) {
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <header className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
        <Zap className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-sm font-semibold text-slate-900">{title}</span>
      </header>
      <div className="p-3">
        <CodeBlock code={code} />
      </div>
    </div>
  )
}

function CodeBlock({
  code,
  caption,
  tone = "default",
}: {
  code: string
  caption?: string
  tone?: "default" | "warn"
}) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }
  const bg = tone === "warn" ? "bg-slate-900" : "bg-slate-900"
  return (
    <div>
      <div className={`relative rounded-lg ${bg} text-slate-100 overflow-hidden`}>
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 text-xs px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition"
          aria-label="Copy code"
          type="button"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              Copy
            </>
          )}
        </button>
        <pre className="text-xs font-mono leading-6 p-4 pr-20 overflow-x-auto whitespace-pre">
          {code}
        </pre>
      </div>
      {caption && (
        <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
          <Lock className="w-3 h-3" />
          {caption}
        </p>
      )}
    </div>
  )
}
