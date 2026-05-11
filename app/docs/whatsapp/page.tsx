import type { Metadata } from "next"
import { SiteHeader } from "@/components/site-header"
import { Footer } from "@/components/footer"
import { WhatsAppDocsClient } from "@/components/whatsapp-docs-client"

export const metadata: Metadata = {
  title: "WhatsApp API - Mozosubz",
  description:
    "Integrate the Mozosubz WhatsApp bot with our existing airtime, data, cable, electricity, wallet and payments APIs.",
}

export default function WhatsAppDocsPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans flex flex-col">
      <SiteHeader />
      <WhatsAppDocsClient />
      <Footer />
    </div>
  )
}
