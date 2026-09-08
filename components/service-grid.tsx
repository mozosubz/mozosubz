"use client"

import Link from "next/link"
import { Smartphone, Wifi, Tv, Zap, Ticket, ChevronRight } from "lucide-react"

// Per-service accent tints — one hue per product line so each tile is
// recognizable at a glance before the label is even read.
const services = [
  {
    name: "Airtime",
    href: "/dashboard/airtime",
    icon: Smartphone,
    tile: "bg-gradient-to-br from-orange-100 to-orange-50 text-orange-600 border-orange-100",
  },
  {
    name: "Data",
    href: "/dashboard/data",
    icon: Wifi,
    tile: "bg-gradient-to-br from-blue-100 to-blue-50 text-blue-600 border-blue-100",
  },
  {
    name: "Cable",
    href: "/dashboard/cable",
    icon: Tv,
    tile: "bg-gradient-to-br from-purple-100 to-purple-50 text-purple-600 border-purple-100",
  },
  {
    name: "Electricity",
    href: "/dashboard/electricity",
    icon: Zap,
    tile: "bg-gradient-to-br from-amber-100 to-amber-50 text-amber-600 border-amber-100",
  },
  {
    name: "Pins",
    href: "/dashboard/recharge-pins",
    icon: Ticket,
    tile: "bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-600 border-emerald-100",
  },
]

export function ServiceGrid() {
  return (
    <div className="services-card">
      <div className="services-grid">
        {services.map((service) => {
          const Icon = service.icon
          return (
            <Link key={service.name} href={service.href} className="service-btn group">
              <div
                className={`service-icon ${service.tile} border transition-transform duration-150 group-hover:scale-105 group-active:scale-95`}
              >
                <Icon style={{ width: 24, height: 24, strokeWidth: 1.8 }} />
              </div>
              <span className="service-label flex items-center gap-0.5">
                {service.name}
                <ChevronRight
                  size={11}
                  className="opacity-0 -ml-1 group-hover:opacity-60 group-hover:ml-0 transition-all"
                />
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
