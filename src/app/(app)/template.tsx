/**
 * A template, not a layout, because Next remounts templates on every navigation
 * while layouts persist. That remount is what restarts the animation, so one
 * file covers every page in the group instead of a class repeated on each of
 * them. The header and footer stay put in the layout, as they should.
 */
export default function AppTemplate({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="animate-page">{children}</div>
}
