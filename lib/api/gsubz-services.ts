export const CABLE_SERVICE_IDS = {
  dstv: 'dstv',
  gotv: 'gotv',
  startimes: 'startimes',
} as const

const ELECTRICITY_SERVICE_IDS: Record<string, string> = {
  'ikeja electric': 'ikeja-electric',
  'ikeja electricity distribution company': 'ikeja-electric',
  'eko electric': 'eko-electric',
  'eko electricity distribution company': 'eko-electric',
  'kano electric': 'kano-electric',
  'kano electricity distribution company': 'kano-electric',
  'port harcourt electric': 'phed',
  'port harcourt electricity distribution company': 'phed',
  phed: 'phed',
  'jos electric': 'jos-electric',
  'jos electricity distribution company': 'jos-electric',
  'ibadan electric': 'ibadan-electric',
  'ibadan electricity distribution company': 'ibadan-electric',
  'kaduna electric': 'kaduna-electric',
  'kaduna electricity distribution company': 'kaduna-electric',
  'abuja electric': 'abuja-electric',
  'abuja electricity distribution company': 'abuja-electric',
  aedc: 'abuja-electric',
  'enugu electric': 'enugu-electric',
  'enugu electricity distribution company': 'enugu-electric',
  'benin electric': 'benin-electric',
  'benin electricity distribution company': 'benin-electric',
}

export function resolveCableServiceId(provider: string): string | null {
  return CABLE_SERVICE_IDS[provider.trim().toLowerCase() as keyof typeof CABLE_SERVICE_IDS] ?? null
}

export function resolveElectricityServiceId(disco: string): string | null {
  return ELECTRICITY_SERVICE_IDS[disco.trim().toLowerCase()] ?? null
}

export function isGsubzSuccess(response: {
  code: number | string
  status?: string
  description?: string
}): boolean {
  const code = String(response.code)
  const status = String(response.status ?? '').toUpperCase()
  const description = String(response.description ?? '').toUpperCase()
  return (code === '200' || code === '000') &&
    (status === 'TRANSACTION_SUCCESSFUL' || status === 'SUCCESS' || status === 'SUCCESSFUL' || description === 'TRANSACTION_SUCCESSFUL')
}
