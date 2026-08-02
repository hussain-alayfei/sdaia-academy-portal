/**
 * The quiz shell: no header, no navigation, no footer.
 *
 * Starting an attempt drops the portal chrome deliberately. There is nowhere
 * else to click, which is the honest version of a page that also records when
 * you leave it.
 */
export default function QuizLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="min-h-dvh bg-canvas">{children}</div>
}
