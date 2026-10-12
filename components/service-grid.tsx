"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { SERVICES, SERVICE_TONES } from "@/lib/service-catalog"

export function ServiceGrid() {
  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-[var(--text-1)]">Services</h2>
        <Link
          href="/dashboard/services"
          className="text-xs font-semibold text-[var(--primary)] flex items-center gap-1 hover:gap-1.5 transition-all"
        >
          See all <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-4 gap-2 sm:gap-3">
        {SERVICES.map((service) => {
          const Icon = service.icon
          return (
            <Link
              key={service.name}
              href={service.href}
              className="group flex flex-col items-center gap-2.5 rounded-2xl p-3 transition hover:bg-[var(--bg)] active:scale-95"
            >
              <span
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105 ${SERVICE_TONES[service.tone]}`}
              >
                <Icon className="w-5 h-5" strokeWidth={1.9} />
              </span>
              <span className="text-[11px] font-semibold text-[var(--text-2)] text-center leading-tight">
                {service.name}
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
