// Generated from the live Supabase schema (project gfoajqlifmmofswvibzs).
// Regenerate after any migration rather than editing by hand.
//
// Three departures from the raw generator output, all deliberate:
//
//  1. The helper generics at the bottom are the single-schema versions rather
//     than the multi-schema ones nobody here needs.
//  2. The convenience aliases are appended by hand.
//  3. Function arguments that genuinely accept null are typed `string | null`.
//     The generator emits every argument as non-null regardless of what the
//     function does with it, and `save_response` takes a null option (a flagged
//     but unanswered question) while `save_assessment_question` takes a null id
//     (a question being created).

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.15'
  }
  public: {
    Tables: {
      account_notices: {
        Row: {
          body: string
          created_at: string
          dismissed_at: string | null
          id: string
          show_after: string
          student_id: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          dismissed_at?: string | null
          id?: string
          show_after?: string
          student_id: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          dismissed_at?: string | null
          id?: string
          show_after?: string
          student_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: 'account_notices_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      assessment_answer_keys: {
        Row: {
          course_id: string
          created_at: string
          option_id: string
          question_id: string
          rationale: string | null
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          option_id: string
          question_id: string
          rationale?: string | null
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          option_id?: string
          question_id?: string
          rationale?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'assessment_answer_keys_course_id_fkey'
            columns: ['course_id']
            isOneToOne: false
            referencedRelation: 'courses'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'assessment_answer_keys_option_id_fkey'
            columns: ['option_id']
            isOneToOne: false
            referencedRelation: 'assessment_options'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'assessment_answer_keys_question_id_fkey'
            columns: ['question_id']
            isOneToOne: true
            referencedRelation: 'assessment_questions'
            referencedColumns: ['id']
          },
        ]
      }
      assessment_attempts: {
        Row: {
          assessment_id: string
          correct_count: number | null
          course_id: string
          expires_at: string
          frozen_at: string | null
          frozen_seconds: number
          id: string
          question_count: number | null
          question_order: Json
          started_at: string
          status: Database['public']['Enums']['attempt_status']
          student_id: string
          submitted_at: string | null
          warning_count: number
        }
        Insert: {
          assessment_id: string
          correct_count?: number | null
          course_id: string
          expires_at: string
          frozen_at?: string | null
          frozen_seconds?: number
          id?: string
          question_count?: number | null
          question_order?: Json
          started_at?: string
          status?: Database['public']['Enums']['attempt_status']
          student_id: string
          submitted_at?: string | null
          warning_count?: number
        }
        Update: {
          assessment_id?: string
          correct_count?: number | null
          course_id?: string
          expires_at?: string
          frozen_at?: string | null
          frozen_seconds?: number
          id?: string
          question_count?: number | null
          question_order?: Json
          started_at?: string
          status?: Database['public']['Enums']['attempt_status']
          student_id?: string
          submitted_at?: string | null
          warning_count?: number
        }
        Relationships: [
          {
            foreignKeyName: 'assessment_attempts_assessment_id_fkey'
            columns: ['assessment_id']
            isOneToOne: false
            referencedRelation: 'assessments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'assessment_attempts_course_id_fkey'
            columns: ['course_id']
            isOneToOne: false
            referencedRelation: 'courses'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'assessment_attempts_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      assessment_integrity_events: {
        Row: {
          attempt_id: string
          course_id: string
          id: string
          kind: Database['public']['Enums']['integrity_event_kind']
          occurred_at: string
          question_id: string | null
          question_warning_number: number | null
          student_id: string
          warning_number: number
        }
        Insert: {
          attempt_id: string
          course_id: string
          id?: string
          kind: Database['public']['Enums']['integrity_event_kind']
          occurred_at?: string
          question_id?: string | null
          question_warning_number?: number | null
          student_id: string
          warning_number: number
        }
        Update: {
          attempt_id?: string
          course_id?: string
          id?: string
          kind?: Database['public']['Enums']['integrity_event_kind']
          occurred_at?: string
          question_id?: string | null
          question_warning_number?: number | null
          student_id?: string
          warning_number?: number
        }
        Relationships: [
          {
            foreignKeyName: 'assessment_integrity_events_attempt_id_fkey'
            columns: ['attempt_id']
            isOneToOne: false
            referencedRelation: 'assessment_attempts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'assessment_integrity_events_course_id_fkey'
            columns: ['course_id']
            isOneToOne: false
            referencedRelation: 'courses'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'assessment_integrity_events_question_id_fkey'
            columns: ['question_id']
            isOneToOne: false
            referencedRelation: 'assessment_questions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'assessment_integrity_events_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      assessment_options: {
        Row: {
          body: string
          course_id: string
          created_at: string
          id: string
          label: string
          position: number
          question_id: string
        }
        Insert: {
          body: string
          course_id: string
          created_at?: string
          id?: string
          label: string
          position?: number
          question_id: string
        }
        Update: {
          body?: string
          course_id?: string
          created_at?: string
          id?: string
          label?: string
          position?: number
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'assessment_options_course_id_fkey'
            columns: ['course_id']
            isOneToOne: false
            referencedRelation: 'courses'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'assessment_options_question_id_fkey'
            columns: ['question_id']
            isOneToOne: false
            referencedRelation: 'assessment_questions'
            referencedColumns: ['id']
          },
        ]
      }
      assessment_questions: {
        Row: {
          assessment_id: string
          course_id: string
          created_at: string
          difficulty: Database['public']['Enums']['question_difficulty']
          format: Database['public']['Enums']['question_format']
          id: string
          position: number
          section: number
          stem: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          assessment_id: string
          course_id: string
          created_at?: string
          difficulty?: Database['public']['Enums']['question_difficulty']
          format?: Database['public']['Enums']['question_format']
          id?: string
          position?: number
          section?: number
          stem: string
          topic?: string | null
          updated_at?: string
        }
        Update: {
          assessment_id?: string
          course_id?: string
          created_at?: string
          difficulty?: Database['public']['Enums']['question_difficulty']
          format?: Database['public']['Enums']['question_format']
          id?: string
          position?: number
          section?: number
          stem?: string
          topic?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'assessment_questions_assessment_id_fkey'
            columns: ['assessment_id']
            isOneToOne: false
            referencedRelation: 'assessments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'assessment_questions_course_id_fkey'
            columns: ['course_id']
            isOneToOne: false
            referencedRelation: 'courses'
            referencedColumns: ['id']
          },
        ]
      }
      assessment_responses: {
        Row: {
          answered_at: string | null
          attempt_id: string
          course_id: string
          created_at: string
          flagged: boolean
          id: string
          is_correct: boolean | null
          question_id: string
          selected_option_id: string | null
        }
        Insert: {
          answered_at?: string | null
          attempt_id: string
          course_id: string
          created_at?: string
          flagged?: boolean
          id?: string
          is_correct?: boolean | null
          question_id: string
          selected_option_id?: string | null
        }
        Update: {
          answered_at?: string | null
          attempt_id?: string
          course_id?: string
          created_at?: string
          flagged?: boolean
          id?: string
          is_correct?: boolean | null
          question_id?: string
          selected_option_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'assessment_responses_attempt_id_fkey'
            columns: ['attempt_id']
            isOneToOne: false
            referencedRelation: 'assessment_attempts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'assessment_responses_course_id_fkey'
            columns: ['course_id']
            isOneToOne: false
            referencedRelation: 'courses'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'assessment_responses_question_id_fkey'
            columns: ['question_id']
            isOneToOne: false
            referencedRelation: 'assessment_questions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'assessment_responses_selected_option_id_fkey'
            columns: ['selected_option_id']
            isOneToOne: false
            referencedRelation: 'assessment_options'
            referencedColumns: ['id']
          },
        ]
      }
      assessment_scores: {
        Row: {
          assessment_id: string
          course_id: string
          id: string
          max_score: number
          notes: string | null
          recorded_at: string
          recorded_by: string | null
          score: number
          student_id: string
        }
        Insert: {
          assessment_id: string
          course_id: string
          id?: string
          max_score?: number
          notes?: string | null
          recorded_at?: string
          recorded_by?: string | null
          score: number
          student_id: string
        }
        Update: {
          assessment_id?: string
          course_id?: string
          id?: string
          max_score?: number
          notes?: string | null
          recorded_at?: string
          recorded_by?: string | null
          score?: number
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'assessment_scores_assessment_id_fkey'
            columns: ['assessment_id']
            isOneToOne: false
            referencedRelation: 'assessments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'assessment_scores_course_id_fkey'
            columns: ['course_id']
            isOneToOne: false
            referencedRelation: 'courses'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'assessment_scores_recorded_by_fkey'
            columns: ['recorded_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'assessment_scores_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      assessments: {
        Row: {
          closes_at: string | null
          course_id: string
          created_at: string
          day_id: string | null
          description: string | null
          duration_minutes: number
          id: string
          instructions: string | null
          integrity_warning_limit: number | null
          is_locked: boolean
          is_published: boolean
          kind: Database['public']['Enums']['assessment_kind']
          opens_at: string | null
          position: number
          required_question_count: number
          results_released: boolean
          sections: Json | null
          shuffle: boolean
          title: string
          updated_at: string
        }
        Insert: {
          closes_at?: string | null
          course_id: string
          created_at?: string
          day_id?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          instructions?: string | null
          integrity_warning_limit?: number | null
          is_locked?: boolean
          is_published?: boolean
          kind: Database['public']['Enums']['assessment_kind']
          opens_at?: string | null
          position?: number
          required_question_count?: number
          results_released?: boolean
          sections?: Json | null
          shuffle?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          closes_at?: string | null
          course_id?: string
          created_at?: string
          day_id?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          instructions?: string | null
          integrity_warning_limit?: number | null
          is_locked?: boolean
          is_published?: boolean
          kind?: Database['public']['Enums']['assessment_kind']
          opens_at?: string | null
          position?: number
          required_question_count?: number
          results_released?: boolean
          sections?: Json | null
          shuffle?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'assessments_course_id_fkey'
            columns: ['course_id']
            isOneToOne: false
            referencedRelation: 'courses'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'assessments_day_id_fkey'
            columns: ['day_id']
            isOneToOne: false
            referencedRelation: 'course_days'
            referencedColumns: ['id']
          },
        ]
      }
      course_days: {
        Row: {
          course_id: string
          created_at: string
          day_number: number
          id: string
          is_current: boolean
          is_published: boolean
          scheduled_date: string | null
          summary: string | null
          title: string
          title_ar: string | null
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          day_number: number
          id?: string
          is_current?: boolean
          is_published?: boolean
          scheduled_date?: string | null
          summary?: string | null
          title: string
          title_ar?: string | null
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          day_number?: number
          id?: string
          is_current?: boolean
          is_published?: boolean
          scheduled_date?: string | null
          summary?: string | null
          title?: string
          title_ar?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'course_days_course_id_fkey'
            columns: ['course_id']
            isOneToOne: false
            referencedRelation: 'courses'
            referencedColumns: ['id']
          },
        ]
      }
      courses: {
        Row: {
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          is_published: boolean
          join_code: string
          owner_id: string
          slug: string
          start_date: string | null
          title: string
          title_ar: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_published?: boolean
          join_code: string
          owner_id: string
          slug: string
          start_date?: string | null
          title: string
          title_ar?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_published?: boolean
          join_code?: string
          owner_id?: string
          slug?: string
          start_date?: string | null
          title?: string
          title_ar?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'courses_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      notification_events: {
        Row: {
          actor_id: string | null
          body: string
          course_id: string
          created_at: string
          day_id: string | null
          entity_id: string
          entity_type: string
          href: string
          id: string
          kind: Database['public']['Enums']['notification_event_kind']
          title: string
        }
        Insert: {
          actor_id?: string | null
          body: string
          course_id: string
          created_at?: string
          day_id?: string | null
          entity_id: string
          entity_type: string
          href: string
          id?: string
          kind: Database['public']['Enums']['notification_event_kind']
          title: string
        }
        Update: {
          actor_id?: string | null
          body?: string
          course_id?: string
          created_at?: string
          day_id?: string | null
          entity_id?: string
          entity_type?: string
          href?: string
          id?: string
          kind?: Database['public']['Enums']['notification_event_kind']
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notification_events_actor_id_fkey'
            columns: ['actor_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notification_events_course_id_fkey'
            columns: ['course_id']
            isOneToOne: false
            referencedRelation: 'courses'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notification_events_day_id_fkey'
            columns: ['day_id']
            isOneToOne: false
            referencedRelation: 'course_days'
            referencedColumns: ['id']
          },
        ]
      }
      notification_reads: {
        Row: {
          event_id: string
          read_at: string
          student_id: string
        }
        Insert: {
          event_id: string
          read_at?: string
          student_id: string
        }
        Update: {
          event_id?: string
          read_at?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notification_reads_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'notification_events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notification_reads_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      enrollments: {
        Row: {
          course_id: string
          enrolled_at: string
          id: string
          student_id: string
        }
        Insert: {
          course_id: string
          enrolled_at?: string
          id?: string
          student_id: string
        }
        Update: {
          course_id?: string
          enrolled_at?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'enrollments_course_id_fkey'
            columns: ['course_id']
            isOneToOne: false
            referencedRelation: 'courses'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'enrollments_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          bio: string | null
          city: string | null
          created_at: string
          education: string | null
          email: string
          full_name: string
          id: string
          job_title: string | null
          linkedin_url: string | null
          organization: string | null
          role: Database['public']['Enums']['app_role']
          updated_at: string
        }
        Insert: {
          bio?: string | null
          city?: string | null
          created_at?: string
          education?: string | null
          email?: string
          full_name?: string
          id: string
          job_title?: string | null
          linkedin_url?: string | null
          organization?: string | null
          role?: Database['public']['Enums']['app_role']
          updated_at?: string
        }
        Update: {
          bio?: string | null
          city?: string | null
          created_at?: string
          education?: string | null
          email?: string
          full_name?: string
          id?: string
          job_title?: string | null
          linkedin_url?: string | null
          organization?: string | null
          role?: Database['public']['Enums']['app_role']
          updated_at?: string
        }
        Relationships: []
      }
      resources: {
        Row: {
          course_id: string
          created_at: string
          day_id: string
          description: string | null
          external_url: string | null
          file_size: number | null
          id: string
          is_published: boolean
          kind: Database['public']['Enums']['resource_kind']
          mime_type: string | null
          position: number
          storage_path: string | null
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          day_id: string
          description?: string | null
          external_url?: string | null
          file_size?: number | null
          id?: string
          is_published?: boolean
          kind?: Database['public']['Enums']['resource_kind']
          mime_type?: string | null
          position?: number
          storage_path?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          day_id?: string
          description?: string | null
          external_url?: string | null
          file_size?: number | null
          id?: string
          is_published?: boolean
          kind?: Database['public']['Enums']['resource_kind']
          mime_type?: string | null
          position?: number
          storage_path?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'resources_course_id_fkey'
            columns: ['course_id']
            isOneToOne: false
            referencedRelation: 'courses'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'resources_day_id_fkey'
            columns: ['day_id']
            isOneToOne: false
            referencedRelation: 'course_days'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      import_assessment_questions: {
        Args: { p_assessment: string; p_questions: Json }
        Returns: number
      }
      record_integrity_event: {
        Args: { p_attempt: string; p_kind: string; p_question: string }
        Returns: Json
      }
      redeem_join_code: { Args: { code: string }; Returns: Json }
      save_assessment_question: {
        Args: {
          p_assessment: string
          p_payload: Json
          p_question_id: string | null
        }
        Returns: string
      }
      save_response: {
        Args: {
          p_attempt: string
          p_flagged: boolean
          p_option: string | null
          p_question: string
        }
        Returns: undefined
      }
      set_assessment_results_released: {
        Args: { p_assessment: string; p_released: boolean }
        Returns: number
      }
      start_attempt: { Args: { p_assessment: string }; Returns: string }
      submit_attempt: {
        Args: { p_attempt: string; p_reason?: string }
        Returns: Json
      }
      unlock_attempt: {
        Args: { p_attempt: string; p_extra_minutes?: number }
        Returns: Json
      }
    }
    Enums: {
      app_role: 'admin' | 'instructor' | 'student'
      assessment_kind: 'pre' | 'post' | 'quiz'
      attempt_status:
        | 'in_progress'
        | 'submitted'
        | 'timed_out'
        | 'integrity_stopped'
      integrity_event_kind:
        | 'tab_hidden'
        | 'window_blur'
        | 'copy'
        | 'paste'
        | 'context_menu'
        | 'fullscreen_exit'
      notification_event_kind:
        | 'resource_added'
        | 'day_published'
        | 'assessment_published'
        | 'assessment_unlocked'
      question_difficulty: 'easy' | 'medium' | 'hard'
      question_format: 'multiple_choice' | 'true_false'
      resource_kind:
        | 'slides'
        | 'pdf'
        | 'notebook'
        | 'lab'
        | 'link'
        | 'dataset'
        | 'file'
    }
    CompositeTypes: { [_ in never]: never }
  }
}

type DefaultSchema = Database['public']

export type Tables<T extends keyof DefaultSchema['Tables']> =
  DefaultSchema['Tables'][T]['Row']
export type TablesInsert<T extends keyof DefaultSchema['Tables']> =
  DefaultSchema['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof DefaultSchema['Tables']> =
  DefaultSchema['Tables'][T]['Update']
export type Enums<T extends keyof DefaultSchema['Enums']> =
  DefaultSchema['Enums'][T]

// ---- Convenience aliases used across the app ----
export type AppRole = Enums<'app_role'>
export type ResourceKind = Enums<'resource_kind'>
export type AssessmentKind = Enums<'assessment_kind'>
export type QuestionDifficulty = Enums<'question_difficulty'>
export type QuestionFormat = Enums<'question_format'>
export type AttemptStatus = Enums<'attempt_status'>
export type IntegrityEventKind = Enums<'integrity_event_kind'>
export type NotificationEventKind = Enums<'notification_event_kind'>

export type Profile = Tables<'profiles'>
export type Course = Tables<'courses'>
export type CourseDay = Tables<'course_days'>
export type Resource = Tables<'resources'>
export type Assessment = Tables<'assessments'>
export type AssessmentScore = Tables<'assessment_scores'>
export type Enrollment = Tables<'enrollments'>
export type NotificationEvent = Tables<'notification_events'>
export type NotificationRead = Tables<'notification_reads'>

export type AssessmentQuestion = Tables<'assessment_questions'>
export type AssessmentOption = Tables<'assessment_options'>
export type AssessmentAnswerKey = Tables<'assessment_answer_keys'>
export type AssessmentAttempt = Tables<'assessment_attempts'>
export type AssessmentResponse = Tables<'assessment_responses'>
export type IntegrityEvent = Tables<'assessment_integrity_events'>

/** Shape returned by the redeem_join_code RPC. */
export type RedeemResult =
  | { ok: true; course_id: string; course_slug: string; course_title: string }
  | {
      ok: false
      error:
        | 'not_authenticated'
        | 'not_a_student'
        | 'invalid_code'
        | 'course_not_open'
    }

/**
 * The paper one student was given, frozen when their attempt started.
 *
 * Stored as jsonb on `assessment_attempts.question_order`, so it comes back
 * through the generated types as `Json` and has to be narrowed at the edge.
 */
export type QuestionOrder = Array<{ q: string; o: string[] }>

/** Shape returned by submit_attempt. */
export type SubmitResult = {
  correct_count: number
  question_count: number
  status: AttemptStatus
}

/** Shape returned by record_integrity_event. */
export type IntegrityResult = {
  active: boolean
  question_invalidated: boolean
  question_warning_count: number
  warning_count: number
  /** Null when the assessment uses the legacy per-question penalty instead. */
  warning_limit: number | null
  /** True once the limit is reached: no answering until an instructor unlocks. */
  frozen: boolean
}

/** Shape returned by unlock_attempt. */
export type UnlockResult = {
  paused_seconds: number
  extra_minutes: number
  warning_count: number
}
