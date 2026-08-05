'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireProfile } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'

export type ProfileState =
  | {
      errors?: Record<string, string[]>
      message?: string
      notice?: string
      values?: Record<string, string>
    }
  | undefined

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .optional()
    .or(z.literal(''))

const ProfileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, 'Enter your full name.')
    .max(120, 'Name is too long.'),
  bio: optionalText(600),
  organization: optionalText(120),
  job_title: optionalText(120),
  education: optionalText(160),
  city: optionalText(80),
  linkedin_url: z
    .string()
    .trim()
    .max(200)
    .optional()
    .or(z.literal(''))
    .refine(
      (value) =>
        !value ||
        /^https?:\/\/(www\.)?linkedin\.com\//i.test(value) ||
        /^linkedin\.com\//i.test(value),
      'Use a LinkedIn URL, for example https://linkedin.com/in/your-name'
    ),
})

function normalizeLinkedIn(value: string | undefined) {
  if (!value) return null
  if (value.startsWith('http://') || value.startsWith('https://')) return value
  return `https://${value}`
}

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const profile = await requireProfile()

  const raw = {
    full_name: String(formData.get('full_name') ?? ''),
    bio: String(formData.get('bio') ?? ''),
    organization: String(formData.get('organization') ?? ''),
    job_title: String(formData.get('job_title') ?? ''),
    education: String(formData.get('education') ?? ''),
    city: String(formData.get('city') ?? ''),
    linkedin_url: String(formData.get('linkedin_url') ?? ''),
  }

  const parsed = ProfileSchema.safeParse(raw)
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values: raw }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: parsed.data.full_name,
      bio: parsed.data.bio || null,
      organization: parsed.data.organization || null,
      job_title: parsed.data.job_title || null,
      education: parsed.data.education || null,
      city: parsed.data.city || null,
      linkedin_url: normalizeLinkedIn(parsed.data.linkedin_url || undefined),
    })
    .eq('id', profile.id)

  if (error) {
    return {
      message: 'Could not save your profile. Please try again.',
      values: raw,
    }
  }

  revalidatePath('/profile')
  revalidatePath('/home')

  return {
    notice: 'Profile saved.',
    values: {
      ...raw,
      linkedin_url: normalizeLinkedIn(parsed.data.linkedin_url || undefined) ?? '',
    },
  }
}
