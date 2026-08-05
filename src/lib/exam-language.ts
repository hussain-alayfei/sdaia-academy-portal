/**
 * Sitting one exam in two languages.
 *
 * English is the source of truth. Every Arabic string is optional, and anything
 * missing falls back to English rather than rendering blank — a half-translated
 * paper must still be a sittable paper.
 *
 * The choice is **not** stored on the server. It lives in the browser, so
 * switching is instant and cannot fail against the database while the clock is
 * running. Nothing about grading depends on it: answers are recorded by option
 * id, so a student may read a question in Arabic, answer, switch to English and
 * still have exactly one recorded answer.
 */

export type ExamLanguage = 'en' | 'ar'

export const EXAM_LANGUAGES: readonly ExamLanguage[] = ['en', 'ar']

/** What each language calls itself. Never translated. */
export const LANGUAGE_LABELS: Record<ExamLanguage, string> = {
  en: 'English',
  ar: 'العربية',
}

export const STORAGE_KEY = 'sdaia-exam-language'

export function isExamLanguage(value: unknown): value is ExamLanguage {
  return value === 'en' || value === 'ar'
}

export function dirFor(language: ExamLanguage): 'ltr' | 'rtl' {
  return language === 'ar' ? 'rtl' : 'ltr'
}

/**
 * The Arabic string when there is one, the English otherwise.
 *
 * Blank and whitespace-only Arabic counts as missing. A translation that was
 * started and left empty should read as English, not as an empty question.
 */
export function pickText(
  english: string,
  arabic: string | null | undefined,
  language: ExamLanguage
): string {
  if (language !== 'ar') return english
  if (typeof arabic !== 'string' || arabic.trim() === '') return english
  return arabic
}

/** Reads the stored preference. Safe to call before hydration. */
export function readStoredLanguage(): ExamLanguage | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return isExamLanguage(stored) ? stored : null
  } catch {
    // Private browsing and blocked storage both throw. The exam still runs.
    return null
  }
}

export function storeLanguage(language: ExamLanguage): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, language)
  } catch {
    // Not being able to remember the choice is survivable; failing is not.
  }
}

/**
 * Interface copy that sits alongside the paper.
 *
 * Deliberately small and hand-held rather than a general i18n framework. Only
 * the exam runner is bilingual, the set of strings is closed, and a missing key
 * here should be a type error rather than a silent English fallback at runtime.
 */
export const UI = {
  answered: { en: 'answered', ar: 'مُجاب' },
  of: { en: 'of', ar: 'من' },
  flagged: { en: 'flagged', ar: 'مُعلَّم' },
  question: { en: 'Question', ar: 'سؤال' },
  previous: { en: 'Previous', ar: 'السابق' },
  next: { en: 'Next', ar: 'التالي' },
  nextQuestion: { en: 'Next question', ar: 'السؤال التالي' },
  reviewAndSubmit: { en: 'Review and submit', ar: 'المراجعة والتسليم' },
  finishEarly: { en: 'Finish early and submit', ar: 'إنهاء مبكر وتسليم' },
  flagForLater: { en: 'Flag for later', ar: 'وضع علامة للعودة' },
  flaggedForLater: { en: 'Flagged for later', ar: 'موضوع عليه علامة' },
  saving: { en: 'Saving…', ar: 'جارٍ الحفظ…' },
  saved: { en: 'Answers saved', ar: 'تم حفظ الإجابات' },
  savesAsYouGo: {
    en: 'Every answer saves as you go',
    ar: 'تُحفظ كل إجابة فور اختيارها',
  },
  notSaved: { en: 'Not saved', ar: 'لم يتم الحفظ' },
  submitTitle: { en: 'Submit this attempt?', ar: 'تسليم هذه المحاولة؟' },
  answeredLabel: { en: 'Answered', ar: 'الإجابات' },
  leftBlank: { en: 'Left blank', ar: 'تُركت فارغة' },
  stillFlagged: { en: 'Still flagged', ar: 'ما زالت معلَّمة' },
  submitForMarking: { en: 'Submit for marking', ar: 'تسليم للتصحيح' },
  keepWorking: { en: 'Keep working', ar: 'متابعة الحل' },
  goToFirstBlank: { en: 'Go to the first blank', ar: 'الانتقال لأول سؤال فارغ' },
  submitting: { en: 'Submitting…', ar: 'جارٍ التسليم…' },
  blankCountAsWrong: {
    en: 'Blank answers count as wrong. You can go back and fill them in.',
    ar: 'الأسئلة الفارغة تُحتسب خاطئة. يمكنك العودة وتعبئتها.',
  },
  answeredEverything: {
    en: 'You have answered everything.',
    ar: 'لقد أجبت عن جميع الأسئلة.',
  },
  oneAttemptNote: {
    en: 'This is your one attempt, so it cannot be reopened.',
    ar: 'هذه محاولتك الوحيدة، ولا يمكن إعادة فتحها.',
  },
  scoreHiddenNote: {
    en: 'Your score is not shown when you submit; your instructor releases marks after the exam.',
    ar: 'لا تظهر درجتك عند التسليم؛ سيتيح المدرّب الدرجات بعد الاختبار.',
  },
  warnings: { en: 'warnings', ar: 'إنذارات' },
  timeLeftLow: { en: 'Less than five minutes left.', ar: 'بقي أقل من خمس دقائق.' },
  timeLeftCritical: {
    en: 'Less than one minute left. Your answers are already saved.',
    ar: 'بقي أقل من دقيقة. إجاباتك محفوظة بالفعل.',
  },
  examLanguage: { en: 'Exam language', ar: 'لغة الاختبار' },
} as const

export function t(
  key: keyof typeof UI,
  language: ExamLanguage
): string {
  return UI[key][language]
}
