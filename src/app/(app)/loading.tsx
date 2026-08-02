import { LoadingPanel } from '@/components/ui'

/**
 * Shown while a portal page streams in. Next renders this instantly on
 * navigation, so a slow day page never leaves a blank frame.
 */
export default function AppLoading() {
  return <LoadingPanel />
}
