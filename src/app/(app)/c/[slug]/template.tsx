/** Keeps course-to-day navigation visually continuous without moving the shell. */
export default function CourseTemplate({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="animate-page">{children}</div>
}
