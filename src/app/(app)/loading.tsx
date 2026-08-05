import { LoadingPanel } from '@/components/ui'

/** Fallback for profile, notifications, and other app routes without a local loader. */
export default function AppLoading() {
  return <LoadingPanel />
}
