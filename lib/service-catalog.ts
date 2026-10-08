import {
  CreditCard,
  Globe,
  GraduationCap,
  MessageSquare,
  Smartphone,
  TrendingUp,
  Tv,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react"

/**
 * Single source of truth for the dashboard service tiles.
 *
 * The home grid, the Services page and the sidebar all read from here, so a new
 * service only has to be added once. Tones are drawn from the existing palette
 * (primary blue, accent orange, success green, neutral slate) so the tiles stay
 * on-brand rather than introducing new colours.
 */
export type ServiceTone = "blue" | "orange" | "emerald" | "slate"

export interface ServiceEntry {
  name: string
  description: string
  href: string
  icon: LucideIcon
  tone: ServiceTone
}

export const SERVICE_TONES: Record<ServiceTone, string> = {
  blue: "bg-[var(--primary-light)] text-[var(--primary)]",
  orange: "bg-[rgba(249,115,22,0.12)] text-[#f97316]",
  emerald: "bg-[rgba(22,163,74,0.12)] text-[#16a34a]",
  slate: "bg-[rgba(100,116,139,0.12)] text-[#64748b]",
}

export const SERVICES: ServiceEntry[] = [
  {
    name: "Airtime",
    description: "All networks instantly",
    href: "/dashboard/airtime",
    icon: Smartphone,
    tone: "blue",
  },
  {
    name: "Data",
    description: "Cheap bundles, all networks",
    href: "/dashboard/data",
    icon: Wifi,
    tone: "blue",
  },
  {
    name: "Cable TV",
    description: "DStv, GOtv, Startimes",
    href: "/dashboard/cable",
    icon: Tv,
    tone: "orange",
  },
  {
    name: "Electricity",
    description: "All DISCOs nationwide",
    href: "/dashboard/electricity",
    icon: Zap,
    tone: "orange",
  },
  {
    name: "Exam Pins",
    description: "WAEC, NECO, NABTEB",
    href: "/dashboard/exam-pins",
    icon: GraduationCap,
    tone: "emerald",
  },
  {
    name: "eSIM",
    description: "Travel data, 240+ countries",
    href: "/dashboard/esim",
    icon: Globe,
    tone: "blue",
  },
  {
    name: "Bulk SMS",
    description: "Message up to 5,000 numbers",
    href: "/dashboard/bulk-sms",
    icon: MessageSquare,
    tone: "orange",
  },
  {
    name: "Social Media",
    description: "Followers, likes and views",
    href: "/dashboard/social",
    icon: TrendingUp,
    tone: "emerald",
  },
  {
    name: "Recharge Pins",
    description: "Generate and print pins",
    href: "/dashboard/recharge-pins",
    icon: CreditCard,
    tone: "slate",
  },
]
