import {
  DownloadIcon,
  LinkIcon,
  ResourceIcon,
} from '@/components/icons'
import { Badge, EmptyState } from '@/components/ui'
import { RESOURCE_LABELS, formatBytes } from '@/lib/format'
import type { Resource } from '@/lib/types'

function ResourceRow({
  resource,
  showKind,
  showDescription,
}: {
  resource: Resource
  showKind: boolean
  showDescription: boolean
}) {
  const external = Boolean(resource.external_url)
  const href = external ? resource.external_url! : `/api/files/${resource.id}`
  const size = formatBytes(resource.file_size)

  return (
    <li>
      <a
        href={href}
        {...(external
          ? { target: '_blank', rel: 'noopener noreferrer' }
          : {})}
        className="group flex items-start gap-3.5 px-4 py-3.5 hover:bg-navy-50 sm:px-5"
      >
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-sm border border-line bg-navy-50 text-navy-600 group-hover:border-teal-200 group-hover:bg-teal-50 group-hover:text-teal-700">
          <ResourceIcon kind={resource.kind} width={18} height={18} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="font-medium text-navy-900 group-hover:text-teal-800">
              {resource.title}
            </p>
            {showKind ? (
              <Badge tone="neutral">{RESOURCE_LABELS[resource.kind]}</Badge>
            ) : null}
            {!resource.is_published ? (
              <Badge tone="amber">Draft</Badge>
            ) : null}
          </div>

          {resource.description && showDescription ? (
            <p className="mt-0.5 text-[13px] text-ink-soft">
              {resource.description
                .replace(/^(certification-pass|capstone-project|theory-exam)\s*·\s*/i, '')
                .trim()}
            </p>
          ) : null}

          {size ? (
            <p className="mt-1 text-[12px] text-ink-faint">{size}</p>
          ) : null}
        </div>

        <span className="mt-1.5 inline-flex shrink-0 items-center gap-1.5 text-[12px] font-medium text-ink-faint group-hover:text-teal-700">
          <span className="hidden sm:inline">
            {external ? 'Open' : 'Download'}
          </span>
          {external ? (
            <LinkIcon width={16} height={16} />
          ) : (
            <DownloadIcon width={16} height={16} />
          )}
          <span className="sr-only">
            {external ? 'Opens in a new tab' : 'Download'}
          </span>
        </span>
      </a>
    </li>
  )
}

export function ResourceList({
  resources,
  showKind = true,
  showDescription = true,
  emptyTitle = 'Nothing published yet',
  emptyDescription = 'Your instructor has not added materials for this day. Check back later.',
}: {
  resources: Resource[]
  showKind?: boolean
  showDescription?: boolean
  emptyTitle?: string
  emptyDescription?: string
}) {
  if (resources.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }

  return (
    <ul className="divide-y divide-line">
      {resources.map((r) => (
        <ResourceRow
          key={r.id}
          resource={r}
          showKind={showKind}
          showDescription={showDescription}
        />
      ))}
    </ul>
  )
}
