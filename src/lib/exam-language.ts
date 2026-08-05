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
  questionsNav: { en: 'Questions', ar: 'الأسئلة' },
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
  didNotSave: { en: 'That did not save.', ar: 'لم يتم الحفظ.' },
  submitTitle: { en: 'Submit this attempt?', ar: 'تسليم هذه المحاولة؟' },
  answeredLabel: { en: 'Answered', ar: 'الإجابات' },
  leftBlank: { en: 'Left blank', ar: 'تُركت فارغة' },
  stillFlagged: { en: 'Still flagged', ar: 'ما زالت معلَّمة' },
  submitForMarking: { en: 'Submit for marking', ar: 'تسليم للتصحيح' },
  keepWorking: { en: 'Keep working', ar: 'متابعة الحل' },
  goToFirstBlank: { en: 'Go to the first blank', ar: 'الانتقال لأول سؤال فارغ' },
  goToFirstFlagged: {
    en: 'Go to first flagged',
    ar: 'الانتقال لأول سؤال معلَّم',
  },
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
  warning: { en: 'Warning', ar: 'إنذار' },
  warningsTitle: {
    en: 'Integrity warnings recorded during this attempt',
    ar: 'إنذارات النزاهة المسجّلة في هذه المحاولة',
  },
  integrityEvents: { en: 'integrity events', ar: 'أحداث نزاهة' },
  timeLeftLow: { en: 'Less than five minutes left.', ar: 'بقي أقل من خمس دقائق.' },
  timeLeftCritical: {
    en: 'Less than one minute left. Your answers are already saved.',
    ar: 'بقي أقل من دقيقة. إجاباتك محفوظة بالفعل.',
  },
  examLanguage: { en: 'Exam language', ar: 'لغة الاختبار' },

  /* ---- integrity modal (attempt-level) ---- */
  eventTabHidden: {
    en: 'you left this page for another tab or application',
    ar: 'غادرت هذه الصفحة إلى تبويب أو تطبيق آخر',
  },
  eventWindowBlur: {
    en: 'this window lost focus',
    ar: 'فقدت هذه النافذة التركيز',
  },
  eventCopy: {
    en: 'you tried to copy the exam text',
    ar: 'حاولت نسخ نص الاختبار',
  },
  eventPaste: {
    en: 'you tried to paste into an answer',
    ar: 'حاولت اللصق في إجابة',
  },
  eventFullscreenExit: {
    en: 'you left fullscreen mode and did not come back',
    ar: 'خرجت من وضع ملء الشاشة ولم تعد',
  },
  eventUnexpected: {
    en: 'something unexpected happened',
    ar: 'حدث أمر غير متوقع',
  },
  warningRecordedLead: {
    en: 'This exam recorded that',
    ar: 'سجّل هذا الاختبار أن',
  },
  warningInstructorSees: {
    en: 'Your instructor can see it.',
    ar: 'يمكن لمدرّبك الاطلاع عليه.',
  },
  lastChanceFreeze: {
    en: 'One more warning will freeze your exam. You will not be able to answer anything until an instructor unlocks it.',
    ar: 'إنذار واحد إضافي سيجمّد اختبارك. لن تتمكن من الإجابة حتى يفتحه المدرّب.',
  },
  warningsLeftBeforeFreeze: {
    en: 'left before your exam freezes.',
    ar: 'متبقية قبل تجميد الاختبار.',
  },
  stayOnPage: {
    en: 'Stay on this page for the rest of the exam.',
    ar: 'ابقَ في هذه الصفحة لبقية الاختبار.',
  },
  backToExam: { en: 'Back to the exam', ar: 'العودة إلى الاختبار' },
  youHave: { en: 'You have', ar: 'لديك' },

  /* ---- per-question legacy integrity ---- */
  questionWorthZero: {
    en: 'is now worth zero points',
    ar: 'أصبحت درجته صفرًا',
  },
  warningForQuestion: {
    en: 'for question',
    ar: 'للسؤال',
  },
  continueOtherQuestions: {
    en: 'You may continue and answer every other question. This question cannot earn a point.',
    ar: 'يمكنك المتابعة والإجابة عن بقية الأسئلة. هذا السؤال لا يمكن أن يحصل على درجة.',
  },
  threeEventsZero: {
    en: 'Three events on the same question make only that question worth zero points.',
    ar: 'ثلاثة أحداث على السؤال نفسه تجعل درجته فقط صفرًا.',
  },

  /* ---- fullscreen gate ---- */
  returnToFullscreen: {
    en: 'Return to fullscreen',
    ar: 'العودة إلى وضع ملء الشاشة',
  },
  fullscreenRequired: {
    en: 'Fullscreen is required',
    ar: 'وضع ملء الشاشة مطلوب',
  },
  fullscreenHiddenPaper: {
    en: 'This exam runs in fullscreen. Your questions are hidden until you go back.',
    ar: 'يعمل هذا الاختبار في وضع ملء الشاشة. أسئلتك مخفية حتى تعود إليه.',
  },
  returnWithin: { en: 'Return within', ar: 'عُد خلال' },
  seconds: { en: 'seconds', ar: 'ثوانٍ' },
  second: { en: 'second', ar: 'ثانية' },
  nothingRecorded: {
    en: 'and nothing is recorded.',
    ar: 'ولن يُسجَّل شيء.',
  },
  fullscreenWarningRecorded: {
    en: 'One warning was recorded for leaving fullscreen. Going back now costs you nothing more.',
    ar: 'سُجِّل إنذار واحد لمغادرة وضع ملء الشاشة. العودة الآن لا تكلّفك شيئًا إضافيًا.',
  },
  enterFullscreen: {
    en: 'Enter fullscreen and continue',
    ar: 'الدخول إلى ملء الشاشة والمتابعة',
  },
  answersSavedTimeRunning: {
    en: 'Your answers are all saved, and your time is still running.',
    ar: 'إجاباتك محفوظة كلها، وما زال وقتك يعمل.',
  },

  /* ---- frozen attempt ---- */
  examFrozen: { en: 'Your exam is frozen', ar: 'اختبارك مجمّد' },
  examFrozenBody: {
    en: 'integrity warnings, so this exam has stopped. You cannot answer any more questions until an instructor unlocks it.',
    ar: 'من إنذارات النزاهة، فتوقف الاختبار. لا يمكنك الإجابة عن أي سؤال حتى يفتحه المدرّب.',
  },
  youReached: { en: 'You reached', ar: 'وصلت إلى' },
  raiseHand: {
    en: 'Raise your hand and tell your instructor now.',
    ar: 'ارفع يدك وأخبر مدرّبك الآن.',
  },
  clockPaused: {
    en: 'Your clock is paused. The time you spend waiting is added back, so you will not lose any exam time.',
    ar: 'مؤقّتك متوقف. يُعاد وقت الانتظار إليك، فلا تفقد أي زمن من الاختبار.',
  },
  frozenSavedNote: {
    en: 'Every answer you had already chosen is saved. When your instructor unlocks the exam it reopens here automatically, on the same question, with a fresh set of warnings.',
    ar: 'كل إجابة اخترتها محفوظة. عندما يفتح المدرّب الاختبار يعود هنا تلقائيًا، على السؤال نفسه، مع مجموعة إنذارات جديدة.',
  },
  checking: { en: 'Checking…', ar: 'جارٍ التحقق…' },
  waitingInstructor: {
    en: 'Waiting for your instructor.',
    ar: 'بانتظار مدرّبك.',
  },
  keepPageOpen: { en: 'Keep this page open.', ar: 'أبقِ هذه الصفحة مفتوحة.' },
} as const

export type UiKey = keyof typeof UI

export function t(key: UiKey, language: ExamLanguage): string {
  return UI[key][language]
}

/** Human description of one integrity event kind. */
export function describeIntegrityEvent(
  kind: string,
  language: ExamLanguage
): string {
  switch (kind) {
    case 'tab_hidden':
      return t('eventTabHidden', language)
    case 'window_blur':
      return t('eventWindowBlur', language)
    case 'copy':
      return t('eventCopy', language)
    case 'paste':
      return t('eventPaste', language)
    case 'fullscreen_exit':
      return t('eventFullscreenExit', language)
    default:
      return t('eventUnexpected', language)
  }
}
