import { Metadata } from 'next'
import { StartupSpotlightForm } from '@/components/startup-spotlight-form'

export const metadata: Metadata = {
  title: 'Submit Your Startup - Gamms Spotlight',
  description: 'Share your innovation with the community and get discovered through votes',
}

export default function SpotlightPage() {
  return <StartupSpotlightForm />
}
