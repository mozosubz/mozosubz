import Link from "next/link"
import { NotificationBell } from "@/components/notification-bell"
import { SERVICES, SERVICE_TONES } from "@/lib/service-catalog"

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="topbar">
        <span className="topbar-title">Services</span>
        <NotificationBell />
      </div>

      <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto">
        <p className="text-xs text-[var(--text-3)] mb-4">Everything you can buy with your Mozosubz wallet.</p>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {SERVICES.map((service) => {
            const Icon = service.icon
            return (
              <Link
                key={service.name}
                href={service.href}
                className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3 transition hover:border-[var(--primary)]/40 hover:shadow-sm active:scale-[0.98]"
              >
                <span
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105 ${SERVICE_TONES[service.tone]}`}
                >
                  <Icon className="w-5 h-5" strokeWidth={1.9} />
                </span>
                <div>
                  <p className="text-sm font-bold text-[var(--text-1)]">{service.name}</p>
                  <p className="text-[11px] text-[var(--text-3)] mt-0.5 leading-snug">{service.description}</p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
