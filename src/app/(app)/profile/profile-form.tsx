'use client'

import { useActionState } from 'react'

import { updateProfile } from '@/app/actions/profile'
import {
  Alert,
  Button,
  Field,
  Input,
  Textarea,
} from '@/components/ui'
import type { Profile } from '@/lib/types'

const ROLE_LABEL: Record<Profile['role'], string> = {
  student: 'Learner',
  instructor: 'Instructor',
  admin: 'Administrator',
}

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState(updateProfile, undefined)

  const values = state?.values

  return (
    <form action={action} className="space-y-8" noValidate>
      {state?.message ? <Alert>{state.message}</Alert> : null}
      {state?.notice ? <Alert tone="teal">{state.notice}</Alert> : null}

      <section className="space-y-4">
        <div>
          <h2 className="text-[15px] font-semibold text-navy-900">
            Personal information
          </h2>
          <p className="mt-0.5 text-[12px] text-ink-faint">
            How your name appears across the Academy portal.
          </p>
        </div>

        <Field
          label="Full name"
          htmlFor="full_name"
          error={state?.errors?.full_name}
        >
          <Input
            id="full_name"
            name="full_name"
            required
            autoComplete="name"
            defaultValue={values?.full_name ?? profile.full_name}
            aria-invalid={Boolean(state?.errors?.full_name)}
          />
        </Field>

        <Field
          label="Email"
          htmlFor="email"
          hint="Managed by your sign-in account. Contact an instructor if you need it changed."
        >
          <Input
            id="email"
            name="email"
            type="email"
            value={profile.email}
            disabled
            readOnly
          />
        </Field>

        <div className="rounded-sm border border-line bg-navy-50/50 px-3 py-2.5">
          <p className="text-[11px] font-semibold tracking-wide text-ink-faint uppercase">
            Portal role
          </p>
          <p className="mt-0.5 text-[13px] font-medium text-navy-900">
            {ROLE_LABEL[profile.role]}
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-[15px] font-semibold text-navy-900">
            Professional background
          </h2>
          <p className="mt-0.5 text-[12px] text-ink-faint">
            Help instructors and classmates know your context in data and AI.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Organization"
            htmlFor="organization"
            error={state?.errors?.organization}
            hint="Employer, university, or affiliation"
          >
            <Input
              id="organization"
              name="organization"
              autoComplete="organization"
              defaultValue={
                values?.organization ?? profile.organization ?? ''
              }
              placeholder="e.g. SDAIA, KSU, STC"
            />
          </Field>

          <Field
            label="Job title"
            htmlFor="job_title"
            error={state?.errors?.job_title}
          >
            <Input
              id="job_title"
              name="job_title"
              autoComplete="organization-title"
              defaultValue={values?.job_title ?? profile.job_title ?? ''}
              placeholder="e.g. Data analyst, Engineer"
            />
          </Field>
        </div>

        <Field
          label="Education"
          htmlFor="education"
          error={state?.errors?.education}
          hint="Degree, major, or most relevant qualification"
        >
          <Input
            id="education"
            name="education"
            defaultValue={values?.education ?? profile.education ?? ''}
            placeholder="e.g. BSc Computer Science, KSU"
          />
        </Field>

        <Field label="City" htmlFor="city" error={state?.errors?.city}>
          <Input
            id="city"
            name="city"
            autoComplete="address-level2"
            defaultValue={values?.city ?? profile.city ?? ''}
            placeholder="e.g. Riyadh"
          />
        </Field>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-[15px] font-semibold text-navy-900">About you</h2>
          <p className="mt-0.5 text-[12px] text-ink-faint">
            A short bio for your Academy profile — optional.
          </p>
        </div>

        <Field label="Bio" htmlFor="bio" error={state?.errors?.bio}>
          <Textarea
            id="bio"
            name="bio"
            rows={4}
            defaultValue={values?.bio ?? profile.bio ?? ''}
            placeholder="What you work on, and what you hope to take from this programme."
          />
        </Field>

        <Field
          label="LinkedIn"
          htmlFor="linkedin_url"
          error={state?.errors?.linkedin_url}
          hint="Optional public profile link"
        >
          <Input
            id="linkedin_url"
            name="linkedin_url"
            type="url"
            inputMode="url"
            defaultValue={
              values?.linkedin_url ?? profile.linkedin_url ?? ''
            }
            placeholder="https://linkedin.com/in/…"
          />
        </Field>
      </section>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save profile'}
        </Button>
        <p className="text-[12px] text-ink-faint">
          Changes apply across the portal immediately.
        </p>
      </div>
    </form>
  )
}
