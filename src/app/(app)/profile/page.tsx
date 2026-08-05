import type { Metadata } from 'next'
import Link from 'next/link'

import { ProfileForm } from '@/app/(app)/profile/profile-form'
import {
  Arabic,
  BackLink,
  Badge,
  Panel,
  PanelHeader,
} from '@/components/ui'
import { isManager, requireProfile } from '@/lib/dal'

export const metadata: Metadata = { title: 'My profile' }

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '·'
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}

const ROLE_LABEL = {
  student: 'Learner',
  instructor: 'Instructor',
  admin: 'Administrator',
} as const

export default async function ProfilePage() {
  const profile = await requireProfile()
  const manager = isManager(profile)
  const backHref = manager ? '/admin' : '/home'
  const backLabel = manager ? 'Instructor home' : 'My courses'

  const headline = [profile.job_title, profile.organization]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="space-y-6">
      <BackLink href={backHref}>{backLabel}</BackLink>

      <div>
        <p className="text-[10px] font-semibold tracking-[0.16em] text-teal-700 uppercase">
          SDAIA Academy
        </p>
        <h1 className="mt-1 text-[24px] font-semibold text-navy-900 sm:text-[28px]">
          My profile
        </h1>
        <p className="mt-1 max-w-2xl text-[14px] text-ink-soft">
          Keep your details current so instructors and the Academy can recognise
          you across programmes.
        </p>
      </div>

      <Panel className="overflow-hidden">
        <div className="border-b border-line bg-gradient-to-br from-navy-900 via-navy-800 to-teal-900 px-5 py-6 sm:px-6">
          <div className="flex flex-wrap items-center gap-4">
            <span
              className="grid size-16 place-items-center rounded-full border-2 border-teal-400/60 bg-navy-700 text-[18px] font-semibold text-white"
              aria-hidden
            >
              {initials(profile.full_name || profile.email)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[20px] font-semibold text-white">
                  {profile.full_name || 'Your name'}
                </h2>
                <Badge tone="teal">{ROLE_LABEL[profile.role]}</Badge>
              </div>
              {headline ? (
                <p className="mt-0.5 text-[13px] text-navy-100">{headline}</p>
              ) : (
                <p className="mt-0.5 text-[13px] text-navy-300">
                  Add your role and organization below
                </p>
              )}
              <p className="mt-1 text-[12px] text-navy-200">{profile.email}</p>
              {profile.city ? (
                <p className="mt-0.5 text-[12px] text-navy-300">{profile.city}</p>
              ) : null}
            </div>
          </div>
          {profile.bio ? (
            <p className="mt-4 max-w-2xl text-[13px] leading-relaxed text-navy-100">
              {profile.bio}
            </p>
          ) : null}
          {profile.linkedin_url ? (
            <p className="mt-3">
              <a
                href={profile.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] font-medium text-teal-200 underline underline-offset-2 hover:text-white"
              >
                LinkedIn profile
              </a>
            </p>
          ) : null}
        </div>

        <div className="px-5 py-6 sm:px-6">
          <PanelHeader
            title="Edit profile"
            description="Essential details only — name, affiliation, education, and a short bio."
          />
          <div className="mt-5">
            <ProfileForm profile={profile} />
          </div>
        </div>
      </Panel>

      <p className="text-[12px] text-ink-faint">
        Need a new password?{' '}
        <Link
          href="/forgot-password"
          className="font-medium text-teal-800 underline hover:text-teal-900"
        >
          Reset it here
        </Link>
        . Arabic name optional in your bio:{' '}
        <Arabic className="text-ink-soft">يمكنك كتابة اسمك بالعربية في النبذة.</Arabic>
      </p>
    </div>
  )
}
