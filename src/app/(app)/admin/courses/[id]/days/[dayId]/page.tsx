import { notFound } from 'next/navigation'

import {
  deleteDay,
  deleteResource,
  toggleResourcePublished,
} from '@/app/actions/admin'
import {
  AddLinkForm,
  UploadFileForm,
} from '@/components/admin/resource-forms'
import {
  LinkIcon,
  ResourceIcon,
  TrashIcon,
  UploadIcon,
} from '@/components/icons'
import {
  Arabic,
  BackLink,
  Badge,
  Button,
  EmptyState,
  Panel,
  PanelHeader,
} from '@/components/ui'
import { canManageCourse, getCourseById } from '@/lib/dal'
import { RESOURCE_LABELS, formatBytes, formatDate } from '@/lib/format'
import { getResourcesForDay } from '@/lib/queries'
import { createClient } from '@/lib/supabase/server'

export default async function ManageDayPage({
  params,
}: {
  params: Promise<{ id: string; dayId: string }>
}) {
  const { id, dayId } = await params

  const course = await getCourseById(id)
  if (!course || !(await canManageCourse(course))) notFound()

  const supabase = await createClient()
  const { data: day } = await supabase
    .from('course_days')
    .select('*')
    .eq('id', dayId)
    .eq('course_id', course.id)
    .maybeSingle()

  if (!day) notFound()

  const resources = await getResourcesForDay(day.id)

  return (
    <div className="space-y-6">
      <BackLink href={`/admin/courses/${course.id}`}>Schedule</BackLink>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[19px] font-semibold text-navy-900">
            Day {day.day_number} · {day.title}
          </h2>
          <Badge tone={day.is_published ? 'teal' : 'amber'}>
            {day.is_published ? 'Published' : 'Draft'}
          </Badge>
        </div>
        {day.title_ar ? (
          <p className="mt-0.5 text-[14px] text-ink-soft">
            <Arabic>{day.title_ar}</Arabic>
          </p>
        ) : null}
        {day.scheduled_date ? (
          <p className="mt-1 text-[12px] text-ink-faint">
            {formatDate(day.scheduled_date)}
          </p>
        ) : null}
      </div>

      <Panel>
        <PanelHeader
          title="Materials"
          description="Drafts stay hidden from students even when the day is published."
        />

        {resources.length === 0 ? (
          <EmptyState
            title="Nothing added yet"
            description="Upload the slides or paste a Colab link using the forms below."
          />
        ) : (
          <ul className="divide-y divide-line">
            {resources.map((resource) => (
              <li
                key={resource.id}
                className="flex items-start gap-3 px-4 py-3.5 sm:px-5"
              >
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-sm border border-line bg-navy-50 text-navy-600">
                  <ResourceIcon
                    kind={resource.kind}
                    width={18}
                    height={18}
                  />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="font-medium text-navy-900">
                      {resource.title}
                    </p>
                    <Badge tone="neutral">
                      {RESOURCE_LABELS[resource.kind]}
                    </Badge>
                    <Badge tone={resource.is_published ? 'teal' : 'amber'}>
                      {resource.is_published ? 'Visible' : 'Draft'}
                    </Badge>
                  </div>

                  {resource.description ? (
                    <p className="mt-0.5 text-[13px] text-ink-soft">
                      {resource.description}
                    </p>
                  ) : null}

                  <p className="mt-1 truncate text-[12px] text-ink-faint">
                    {resource.external_url ? (
                      <a
                        href={resource.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 hover:text-teal-700"
                      >
                        <LinkIcon width={12} height={12} />
                        {resource.external_url}
                      </a>
                    ) : (
                      (formatBytes(resource.file_size) ?? 'Uploaded file')
                    )}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <form action={toggleResourcePublished}>
                    <input type="hidden" name="course_id" value={course.id} />
                    <input type="hidden" name="day_id" value={day.id} />
                    <input
                      type="hidden"
                      name="resource_id"
                      value={resource.id}
                    />
                    <input
                      type="hidden"
                      name="next"
                      value={resource.is_published ? 'false' : 'true'}
                    />
                    <Button type="submit" variant="secondary" size="sm">
                      {resource.is_published ? 'Hide' : 'Show'}
                    </Button>
                  </form>

                  <form action={deleteResource}>
                    <input type="hidden" name="course_id" value={course.id} />
                    <input type="hidden" name="day_id" value={day.id} />
                    <input
                      type="hidden"
                      name="resource_id"
                      value={resource.id}
                    />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      aria-label={`Delete ${resource.title}`}
                    >
                      <TrashIcon width={15} height={15} />
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Panel className="p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <UploadIcon width={16} height={16} className="text-teal-700" />
            <h3 className="text-[15px] font-semibold text-navy-900">
              Upload a file
            </h3>
          </div>
          <UploadFileForm courseId={course.id} dayId={day.id} />
        </Panel>

        <Panel className="p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <LinkIcon width={16} height={16} className="text-teal-700" />
            <h3 className="text-[15px] font-semibold text-navy-900">
              Add a link
            </h3>
          </div>
          <AddLinkForm courseId={course.id} dayId={day.id} />
        </Panel>
      </div>

      <Panel className="border-danger-500/25 p-5 sm:p-6">
        <h3 className="text-[15px] font-semibold text-navy-900">
          Delete this day
        </h3>
        <p className="mt-1 mb-4 max-w-lg text-[13px] text-ink-soft">
          Removes the day, its {resources.length} item
          {resources.length === 1 ? '' : 's'} and any uploaded files. This cannot
          be undone.
        </p>
        <form action={deleteDay}>
          <input type="hidden" name="course_id" value={course.id} />
          <input type="hidden" name="day_id" value={day.id} />
          <Button type="submit" variant="danger" size="sm">
            <TrashIcon width={15} height={15} />
            Delete day {day.day_number}
          </Button>
        </form>
      </Panel>
    </div>
  )
}
