/** Quiz pages use separate chrome, so they need their own navigation entrance. */
export default function QuizTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-page">{children}</div>
}
