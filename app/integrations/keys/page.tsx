import { ConnectKeysManager } from '@/components/integrations/connect-keys-manager'

export const metadata = {
  title: 'Connect Key | Mozosubz',
  description: 'Generate and copy your Mozosubz API Connect Key.',
}

export default function ConnectKeysPage() {
  return <ConnectKeysManager />
}
