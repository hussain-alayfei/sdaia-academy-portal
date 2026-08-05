import { readFileSync } from 'fs'
import { resolve } from 'path'

const env = Object.fromEntries(
  readFileSync(resolve('.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const i = line.indexOf('=')
      let value = line.slice(i + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      return [line.slice(0, i).trim(), value]
    })
)

const token =
  env.CRON_SECRET || env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY
const site = 'https://sdaia-genai-portal.vercel.app'

const res = await fetch(`${site}/api/revalidate-course`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    courseId: 'b774a21a-53c4-4eee-b24e-1d82598ccce8',
  }),
})

console.log(res.status, await res.text())
