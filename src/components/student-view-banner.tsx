import { ButtonLink } from '@/components/ui'

/**
 * Manager-only preview marker. The pages themselves decide whether preview is
 * allowed and switch to the exact published-only readers students use.
 */
export function StudentViewBanner({ exitHref }: { exitHref: string }) {
  return (
    <aside
      role="status"
      className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border-2 border-teal-500 bg-teal-50 px-4 py-3 sm:px-5"
    >
      <div>
        <p className="text-[14px] font-semibold text-teal-900">Student view</p>
        <p className="mt-0.5 text-[12.5px] text-teal-800">
          You are seeing published student content only. Draft days, materials
          and assessments are hidden.
        </p>
      </div>
      <ButtonLink href={exitHref} variant="secondary" size="sm">
        Exit student view
      </ButtonLink>
    </aside>
  )
}
