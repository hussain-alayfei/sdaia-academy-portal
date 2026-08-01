// Generated from the live Supabase schema (project gfoajqlifmmofswvibzs).
// Regenerate after any migration rather than editing by hand.

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
        Relationships: []
      }
      assessments: {
        Row: {
          closes_at: string | null
          course_id: string
          created_at: string
          day_id: string | null
          description: string | null
          external_url: string | null
          id: string
          is_locked: boolean
          kind: Database['public']['Enums']['assessment_kind']
          max_score: number
          opens_at: string | null
          position: number
          title: string
          updated_at: string
        }
        Insert: {
          closes_at?: string | null
          course_id: string
          created_at?: string
          day_id?: string | null
          description?: string | null
          external_url?: string | null
          id?: string
          is_locked?: boolean
          kind: Database['public']['Enums']['assessment_kind']
          max_score?: number
          opens_at?: string | null
          position?: number
          title: string
          updated_at?: string
        }
        Update: {
          closes_at?: string | null
          course_id?: string
          created_at?: string
          day_id?: string | null
          description?: string | null
          external_url?: string | null
          id?: string
          is_locked?: boolean
          kind?: Database['public']['Enums']['assessment_kind']
          max_score?: number
          opens_at?: string | null
          position?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      course_days: {
        Row: {
          course_id: string
          created_at: string
          day_number: number
          id: string
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
          is_published?: boolean
          scheduled_date?: string | null
          summary?: string | null
          title?: string
          title_ar?: string | null
          updated_at?: string
        }
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          role: Database['public']['Enums']['app_role']
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string
          full_name?: string
          id: string
          role?: Database['public']['Enums']['app_role']
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
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
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      redeem_join_code: { Args: { code: string }; Returns: Json }
    }
    Enums: {
      app_role: 'admin' | 'instructor' | 'student'
      assessment_kind: 'pre' | 'post' | 'quiz'
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

export type Profile = Tables<'profiles'>
export type Course = Tables<'courses'>
export type CourseDay = Tables<'course_days'>
export type Resource = Tables<'resources'>
export type Assessment = Tables<'assessments'>
export type AssessmentScore = Tables<'assessment_scores'>
export type Enrollment = Tables<'enrollments'>

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
