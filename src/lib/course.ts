/**
 * Shape of a course, in one place.
 *
 * This lives here rather than in `actions/admin.ts` because a `'use server'`
 * module may only export async functions — exporting a plain constant from one
 * fails the build. A pure module is also importable from client components,
 * which is what the day picker needs.
 */

/**
 * Every course this portal runs is a five-day week. The database check
 * constraint stays permissive so a longer course is possible without a
 * migration, but offering day 6 in the UI only invited mistakes.
 */
export const MAX_COURSE_DAYS = 5
