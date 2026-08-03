/** Remounts beneath the persistent course header so every admin tab fades in. */
export default function CourseAdminTemplate({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="animate-page">{children}</div>
}
