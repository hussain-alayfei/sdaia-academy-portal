/**
 * Templates remount on every navigation where layouts persist, and that
 * remount is what restarts the animation. Without this file the auth pages
 * were the only signed-out surface that appeared instantly, so arriving at
 * /login from the landing page felt like a hard cut while every page inside
 * the portal eased in.
 *
 * Scoped to the form column on purpose: the navy rail lives in the layout and
 * should stay put as you move between sign in and sign up.
 */
export default function AuthTemplate({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="animate-page">{children}</div>
}
