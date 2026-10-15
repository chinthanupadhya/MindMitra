export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          appointment_date: string
          appointment_time: string
          consultation_type: Database["public"]["Enums"]["consultation_type_t"]
          created_at: string
          doctor_name: string
          id: string
          notes: string | null
          patient_id: string
          specialty: string | null
          status: Database["public"]["Enums"]["appointment_status_t"]
          updated_at: string
        }
        Insert: {
          appointment_date: string
          appointment_time: string
          consultation_type?: Database["public"]["Enums"]["consultation_type_t"]
          created_at?: string
          doctor_name: string
          id?: string
          notes?: string | null
          patient_id: string
          specialty?: string | null
          status?: Database["public"]["Enums"]["appointment_status_t"]
          updated_at?: string
        }
        Update: {
          appointment_date?: string
          appointment_time?: string
          consultation_type?: Database["public"]["Enums"]["consultation_type_t"]
          created_at?: string
          doctor_name?: string
          id?: string
          notes?: string | null
          patient_id?: string
          specialty?: string | null
          status?: Database["public"]["Enums"]["appointment_status_t"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      caregivers: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
          preferred_language: string | null
          updated_at: string
          address: string | null
          latitude: number | null
          longitude: number | null
          profile_photo: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          phone?: string | null
          preferred_language?: string | null
          updated_at?: string
          address?: string | null
          latitude?: number | null
          longitude?: number | null
          profile_photo?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          preferred_language?: string | null
          updated_at?: string
          address?: string | null
          latitude?: number | null
          longitude?: number | null
          profile_photo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "caregivers_preferred_language_fkey"
            columns: ["preferred_language"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
        ]
      }
      content: {
        Row: {
          body: string | null
          category: string | null
          content_type: string
          created_at: string
          id: string
          language_code: string
          media_uri: string | null
          region: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          body?: string | null
          category?: string | null
          content_type: string
          created_at?: string
          id?: string
          language_code: string
          media_uri?: string | null
          region?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          body?: string | null
          category?: string | null
          content_type?: string
          created_at?: string
          id?: string
          language_code?: string
          media_uri?: string | null
          region?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
        ]
      }
      doctor_availability: {
        Row: {
          id: string
          doctor_id: string
          day_of_week: number
          start_time: string
          end_time: string
          slot_minutes: number
          consultation_types: string[]
        }
        Insert: {
          id?: string
          doctor_id: string
          day_of_week: number
          start_time: string
          end_time: string
          slot_minutes?: number
          consultation_types?: string[]
        }
        Update: {
          id?: string
          doctor_id?: string
          day_of_week?: number
          start_time?: string
          end_time?: string
          slot_minutes?: number
          consultation_types?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "doctor_availability_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      doctors: {
        Row: {
          id: string
          name: string
          specialty: string | null
          icon: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          specialty?: string | null
          icon?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          specialty?: string | null
          icon?: string | null
          created_at?: string
        }
        Relationships: []
      }
      device_tokens: {
        Row: {
          id: string
          owner_id: string
          owner_type: Database["public"]["Enums"]["owner_type_t"]
          platform: string | null
          push_token: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          owner_type: Database["public"]["Enums"]["owner_type_t"]
          platform?: string | null
          push_token: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          owner_type?: Database["public"]["Enums"]["owner_type_t"]
          platform?: string | null
          push_token?: string
          updated_at?: string
        }
        Relationships: []
      }
      difficulty_adjustments: {
        Row: {
          adjusted_at: string
          adjustment_reason: string | null
          created_at: string
          game_id: string
          id: string
          mode: Database["public"]["Enums"]["ai_mode_t"]
          new_difficulty: string | null
          patient_id: string
          previous_difficulty: string | null
          session_id: string | null
          sync_status: Database["public"]["Enums"]["sync_status_t"]
        }
        Insert: {
          adjusted_at?: string
          adjustment_reason?: string | null
          created_at?: string
          game_id: string
          id?: string
          mode: Database["public"]["Enums"]["ai_mode_t"]
          new_difficulty?: string | null
          patient_id: string
          previous_difficulty?: string | null
          session_id?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status_t"]
        }
        Update: {
          adjusted_at?: string
          adjustment_reason?: string | null
          created_at?: string
          game_id?: string
          id?: string
          mode?: Database["public"]["Enums"]["ai_mode_t"]
          new_difficulty?: string | null
          patient_id?: string
          previous_difficulty?: string | null
          session_id?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status_t"]
        }
        Relationships: [
          {
            foreignKeyName: "difficulty_adjustments_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "difficulty_adjustments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "difficulty_adjustments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      game_sessions: {
        Row: {
          accuracy: number | null
          completed_at: string | null
          created_at: string
          difficulty: string | null
          game_id: string
          hints_used: number | null
          id: string
          mistakes: number | null
          patient_id: string
          score: number | null
          started_at: string | null
          sync_status: Database["public"]["Enums"]["sync_status_t"]
          time_taken: number | null
        }
        Insert: {
          accuracy?: number | null
          completed_at?: string | null
          created_at?: string
          difficulty?: string | null
          game_id: string
          hints_used?: number | null
          id?: string
          mistakes?: number | null
          patient_id: string
          score?: number | null
          started_at?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status_t"]
          time_taken?: number | null
        }
        Update: {
          accuracy?: number | null
          completed_at?: string | null
          created_at?: string
          difficulty?: string | null
          game_id?: string
          hints_used?: number | null
          id?: string
          mistakes?: number | null
          patient_id?: string
          score?: number | null
          started_at?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status_t"]
          time_taken?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "game_sessions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_sessions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          created_at: string
          description: string | null
          game_type: Database["public"]["Enums"]["game_type_t"]
          id: string
          is_active: boolean
          name: string
          version: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          game_type: Database["public"]["Enums"]["game_type_t"]
          id?: string
          is_active?: boolean
          name: string
          version?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          game_type?: Database["public"]["Enums"]["game_type_t"]
          id?: string
          is_active?: boolean
          name?: string
          version?: string | null
        }
        Relationships: []
      }
      languages: {
        Row: {
          code: string
          has_stt_support: boolean
          has_tts_support: boolean
          is_supported: boolean
          name: string
          native_name: string
          script: string | null
        }
        Insert: {
          code: string
          has_stt_support?: boolean
          has_tts_support?: boolean
          is_supported?: boolean
          name: string
          native_name: string
          script?: string | null
        }
        Update: {
          code?: string
          has_stt_support?: boolean
          has_tts_support?: boolean
          is_supported?: boolean
          name?: string
          native_name?: string
          script?: string | null
        }
        Relationships: []
      }
      medication_change_requests: {
        Row: {
          change_type: Database["public"]["Enums"]["change_type_t"]
          created_at: string
          id: string
          medication_id: string | null
          patient_id: string
          proposed_dosage: string | null
          proposed_frequency: string | null
          proposed_instructions: string | null
          proposed_name: string | null
          proposed_unit: string | null
          reason: string | null
          requested_at: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["change_status_t"]
          sync_status: Database["public"]["Enums"]["sync_status_t"]
        }
        Insert: {
          change_type: Database["public"]["Enums"]["change_type_t"]
          created_at?: string
          id?: string
          medication_id?: string | null
          patient_id: string
          proposed_dosage?: string | null
          proposed_frequency?: string | null
          proposed_instructions?: string | null
          proposed_name?: string | null
          proposed_unit?: string | null
          reason?: string | null
          requested_at?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["change_status_t"]
          sync_status?: Database["public"]["Enums"]["sync_status_t"]
        }
        Update: {
          change_type?: Database["public"]["Enums"]["change_type_t"]
          created_at?: string
          id?: string
          medication_id?: string | null
          patient_id?: string
          proposed_dosage?: string | null
          proposed_frequency?: string | null
          proposed_instructions?: string | null
          proposed_name?: string | null
          proposed_unit?: string | null
          reason?: string | null
          requested_at?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["change_status_t"]
          sync_status?: Database["public"]["Enums"]["sync_status_t"]
        }
        Relationships: [
          {
            foreignKeyName: "medication_change_requests_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_change_requests_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_change_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "caregivers"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          created_at: string
          dosage: string | null
          end_date: string | null
          frequency: string | null
          id: string
          instructions: string | null
          is_active: boolean
          name: string
          patient_id: string
          start_date: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          dosage?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean
          name: string
          patient_id: string
          start_date?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          dosage?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean
          name?: string
          patient_id?: string
          start_date?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      mood_checkins: {
        Row: {
          checked_in_at: string
          id: string
          mood_value: string | null
          patient_id: string
          session_id: string | null
          sync_status: Database["public"]["Enums"]["sync_status_t"]
        }
        Insert: {
          checked_in_at?: string
          id?: string
          mood_value?: string | null
          patient_id: string
          session_id?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status_t"]
        }
        Update: {
          checked_in_at?: string
          id?: string
          mood_value?: string | null
          patient_id?: string
          session_id?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status_t"]
        }
        Relationships: [
          {
            foreignKeyName: "mood_checkins_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mood_checkins_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          acknowledged_at: string | null
          caregiver_id: string | null
          created_at: string
          id: string
          message: string | null
          patient_id: string
          sent_at: string | null
          source_id: string | null
          source_type: Database["public"]["Enums"]["notification_source_t"]
          status: Database["public"]["Enums"]["notification_status_t"]
          sync_status: Database["public"]["Enums"]["sync_status_t"]
          title: string
        }
        Insert: {
          acknowledged_at?: string | null
          caregiver_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          patient_id: string
          sent_at?: string | null
          source_id?: string | null
          source_type: Database["public"]["Enums"]["notification_source_t"]
          status?: Database["public"]["Enums"]["notification_status_t"]
          sync_status?: Database["public"]["Enums"]["sync_status_t"]
          title: string
        }
        Update: {
          acknowledged_at?: string | null
          caregiver_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          patient_id?: string
          sent_at?: string | null
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["notification_source_t"]
          status?: Database["public"]["Enums"]["notification_status_t"]
          sync_status?: Database["public"]["Enums"]["sync_status_t"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "caregivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      object_translations: {
        Row: {
          id: string
          language_code: string
          name: string
          object_id: string
        }
        Insert: {
          id?: string
          language_code: string
          name: string
          object_id: string
        }
        Update: {
          id?: string
          language_code?: string
          name?: string
          object_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "object_translations_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "object_translations_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "objects"
            referencedColumns: ["id"]
          },
        ]
      }
      objects: {
        Row: {
          category: string | null
          created_at: string
          id: string
          image_uri: string | null
          is_active: boolean
          region: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          image_uri?: string | null
          is_active?: boolean
          region?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          image_uri?: string | null
          is_active?: boolean
          region?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      patient_caregivers: {
        Row: {
          caregiver_id: string
          consent_notes: string | null
          created_at: string
          id: string
          is_primary: boolean
          status?: any
          patient_id: string
          relationship: string | null
        }
        Insert: {
          caregiver_id: string
          consent_notes?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          status?: any
          patient_id: string
          relationship?: string | null
        }
        Update: {
          caregiver_id?: string
          consent_notes?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          status?: any
          patient_id?: string
          relationship?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_caregivers_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "caregivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_caregivers_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_preferences: {
        Row: {
          high_contrast: boolean
          notification_sound: boolean
          patient_id: string
          personalization_enabled: boolean
          preferred_game_difficulty: string | null
          preferred_language: string | null
          text_size: string | null
          updated_at: string
          voice_enabled: boolean
          voice_speed: number
        }
        Insert: {
          high_contrast?: boolean
          notification_sound?: boolean
          patient_id: string
          personalization_enabled?: boolean
          preferred_game_difficulty?: string | null
          preferred_language?: string | null
          text_size?: string | null
          updated_at?: string
          voice_enabled?: boolean
          voice_speed?: number
        }
        Update: {
          high_contrast?: boolean
          notification_sound?: boolean
          patient_id?: string
          personalization_enabled?: boolean
          preferred_game_difficulty?: string | null
          preferred_language?: string | null
          text_size?: string | null
          updated_at?: string
          voice_enabled?: boolean
          voice_speed?: number
        }
        Relationships: [
          {
            foreignKeyName: "patient_preferences_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: true
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_preferences_preferred_language_fkey"
            columns: ["preferred_language"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
        ]
      }
      patient_reports: {
        Row: {
          caregiver_id: string | null
          created_at: string
          generated_at: string
          id: string
          metrics_snapshot: Json | null
          mode: Database["public"]["Enums"]["ai_mode_t"]
          patient_id: string
          period_end: string
          period_start: string
          period_type: Database["public"]["Enums"]["report_period_t"]
          summary: string | null
          sync_status: Database["public"]["Enums"]["sync_status_t"]
        }
        Insert: {
          caregiver_id?: string | null
          created_at?: string
          generated_at?: string
          id?: string
          metrics_snapshot?: Json | null
          mode: Database["public"]["Enums"]["ai_mode_t"]
          patient_id: string
          period_end: string
          period_start: string
          period_type: Database["public"]["Enums"]["report_period_t"]
          summary?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status_t"]
        }
        Update: {
          caregiver_id?: string | null
          created_at?: string
          generated_at?: string
          id?: string
          metrics_snapshot?: Json | null
          mode?: Database["public"]["Enums"]["ai_mode_t"]
          patient_id?: string
          period_end?: string
          period_start?: string
          period_type?: Database["public"]["Enums"]["report_period_t"]
          summary?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status_t"]
        }
        Relationships: [
          {
            foreignKeyName: "patient_reports_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "caregivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_reports_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          created_at: string
          date_of_birth: string | null
          emergency_contact: string | null
          gender: Database["public"]["Enums"]["gender_t"] | null
          id: string
          name: string
          phone: string | null
          preferred_language: string | null
          profile_photo: string | null
          screening_assigned_level: string | null
          sync_status: Database["public"]["Enums"]["sync_status_t"]
          updated_at: string
          address: string | null
          latitude: number | null
          longitude: number | null
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          emergency_contact?: string | null
          gender?: Database["public"]["Enums"]["gender_t"] | null
          id?: string
          name: string
          phone?: string | null
          preferred_language?: string | null
          profile_photo?: string | null
          screening_assigned_level?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status_t"]
          updated_at?: string
          address?: string | null
          latitude?: number | null
          longitude?: number | null
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          emergency_contact?: string | null
          gender?: Database["public"]["Enums"]["gender_t"] | null
          id?: string
          name?: string
          phone?: string | null
          preferred_language?: string | null
          profile_photo?: string | null
          screening_assigned_level?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status_t"]
          updated_at?: string
          address?: string | null
          latitude?: number | null
          longitude?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_preferred_language_fkey"
            columns: ["preferred_language"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
        ]
      }
      progress: {
        Row: {
          attention_score: number | null
          average_accuracy: number | null
          current_level: string | null
          games_completed: number
          games_played: number
          id: string
          last_activity_at: string | null
          memory_score: number | null
          patient_id: string
          pattern_score: number | null
          streak_days: number
          updated_at: string
        }
        Insert: {
          attention_score?: number | null
          average_accuracy?: number | null
          current_level?: string | null
          games_completed?: number
          games_played?: number
          id?: string
          last_activity_at?: string | null
          memory_score?: number | null
          patient_id: string
          pattern_score?: number | null
          streak_days?: number
          updated_at?: string
        }
        Update: {
          attention_score?: number | null
          average_accuracy?: number | null
          current_level?: string | null
          games_completed?: number
          games_played?: number
          id?: string
          last_activity_at?: string | null
          memory_score?: number | null
          patient_id?: string
          pattern_score?: number | null
          streak_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: true
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_logs: {
        Row: {
          attention_score: number | null
          average_accuracy: number | null
          created_at: string
          games_completed: number
          games_played: number
          id: string
          log_date: string
          memory_score: number | null
          patient_id: string
          pattern_score: number | null
        }
        Insert: {
          attention_score?: number | null
          average_accuracy?: number | null
          created_at?: string
          games_completed?: number
          games_played?: number
          id?: string
          log_date: string
          memory_score?: number | null
          patient_id: string
          pattern_score?: number | null
        }
        Update: {
          attention_score?: number | null
          average_accuracy?: number | null
          created_at?: string
          games_completed?: number
          games_played?: number
          id?: string
          log_date?: string
          memory_score?: number | null
          patient_id?: string
          pattern_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "progress_logs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          last_triggered_at: string | null
          patient_id: string
          reminder_type: Database["public"]["Enums"]["reminder_type_t"]
          repeat_pattern: string | null
          scheduled_time: string
          sync_status: Database["public"]["Enums"]["sync_status_t"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          patient_id: string
          reminder_type: Database["public"]["Enums"]["reminder_type_t"]
          repeat_pattern?: string | null
          scheduled_time: string
          sync_status?: Database["public"]["Enums"]["sync_status_t"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          patient_id?: string
          reminder_type?: Database["public"]["Enums"]["reminder_type_t"]
          repeat_pattern?: string | null
          scheduled_time?: string
          sync_status?: Database["public"]["Enums"]["sync_status_t"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          generated_at: string
          opening_id: string
          report_id: string
          slots: Json
          strength_id: string
          suggestion_id: string
          trend_id: string
          user_id: string
          weakness_id: string
          window_end: string
          window_start: string
        }
        Insert: {
          generated_at?: string
          opening_id: string
          report_id?: string
          slots?: Json
          strength_id: string
          suggestion_id: string
          trend_id: string
          user_id: string
          weakness_id: string
          window_end: string
          window_start: string
        }
        Update: {
          generated_at?: string
          opening_id?: string
          report_id?: string
          slots?: Json
          strength_id?: string
          suggestion_id?: string
          trend_id?: string
          user_id?: string
          weakness_id?: string
          window_end?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      rounds: {
        Row: {
          accuracy: number | null
          completed: boolean
          correct_count: number
          difficulty_source: Database["public"]["Enums"]["difficulty_source_t"]
          difficulty_value: number
          error_count: number
          error_types: Json
          expected_time_sec: number | null
          game_id: string
          round_id: string
          synced: boolean
          time_taken_sec: number | null
          timestamp: string
          total_attempts: number
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          completed?: boolean
          correct_count?: number
          difficulty_source: Database["public"]["Enums"]["difficulty_source_t"]
          difficulty_value: Json
          error_count?: number
          error_types?: Json
          expected_time_sec?: number | null
          game_id: string
          round_id?: string
          synced?: boolean
          time_taken_sec?: number | null
          timestamp?: string
          total_attempts?: number
          user_id: string
        }
        Update: {
          accuracy?: number | null
          completed?: boolean
          correct_count?: number
          difficulty_source?: Database["public"]["Enums"]["difficulty_source_t"]
          difficulty_value?: Json
          error_count?: number
          error_types?: Json
          expected_time_sec?: number | null
          game_id?: string
          round_id?: string
          synced?: boolean
          time_taken_sec?: number | null
          timestamp?: string
          total_attempts?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rounds_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      sound_profile_translations: {
        Row: {
          id: string
          label: string
          language_code: string
          sound_profile_id: string
        }
        Insert: {
          id?: string
          label: string
          language_code: string
          sound_profile_id: string
        }
        Update: {
          id?: string
          label?: string
          language_code?: string
          sound_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sound_profile_translations_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "sound_profile_translations_sound_profile_id_fkey"
            columns: ["sound_profile_id"]
            isOneToOne: false
            referencedRelation: "sound_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sound_profiles: {
        Row: {
          audio_uri: string | null
          category: Database["public"]["Enums"]["sound_category_t"]
          created_at: string
          id: string
          is_active: boolean
          patient_id: string | null
          region: string | null
          sync_status: Database["public"]["Enums"]["sync_status_t"]
          updated_at: string
        }
        Insert: {
          audio_uri?: string | null
          category: Database["public"]["Enums"]["sound_category_t"]
          created_at?: string
          id?: string
          is_active?: boolean
          patient_id?: string | null
          region?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status_t"]
          updated_at?: string
        }
        Update: {
          audio_uri?: string | null
          category?: Database["public"]["Enums"]["sound_category_t"]
          created_at?: string
          id?: string
          is_active?: boolean
          patient_id?: string | null
          region?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status_t"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sound_profiles_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          category: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          patient_id: string
          repeat_pattern: string | null
          scheduled_time: string | null
          status: Database["public"]["Enums"]["task_status_t"]
          sync_status: Database["public"]["Enums"]["sync_status_t"]
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          patient_id: string
          repeat_pattern?: string | null
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["task_status_t"]
          sync_status?: Database["public"]["Enums"]["sync_status_t"]
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          patient_id?: string
          repeat_pattern?: string | null
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["task_status_t"]
          sync_status?: Database["public"]["Enums"]["sync_status_t"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      vitals: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          patient_id: string
          recorded_at: string
          recorded_by: string | null
          sync_status: Database["public"]["Enums"]["sync_status_t"]
          unit: string
          value_primary: number
          value_secondary: number | null
          vital_type: Database["public"]["Enums"]["vital_type_t"]
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          patient_id: string
          recorded_at?: string
          recorded_by?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status_t"]
          unit: string
          value_primary: number
          value_secondary?: number | null
          vital_type: Database["public"]["Enums"]["vital_type_t"]
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          patient_id?: string
          recorded_at?: string
          recorded_by?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status_t"]
          unit?: string
          value_primary?: number
          value_secondary?: number | null
          vital_type?: Database["public"]["Enums"]["vital_type_t"]
        }
        Relationships: [
          {
            foreignKeyName: "vitals_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      find_patient_by_email: any
      find_caregiver_by_email: {
        Args: { p_email: string }
        Returns: { id: string; name: string }[]
      }
      generate_due_notifications: { Args: never; Returns: undefined }
      is_linked_caregiver: { Args: { p_patient_id: string }; Returns: boolean }
      is_own_patient: { Args: { p_patient_id: string }; Returns: boolean }
    }
    Enums: {
      ai_mode_t: "offline" | "online"
      appointment_status_t: "scheduled" | "completed" | "cancelled"
      change_status_t: "pending" | "approved" | "rejected"
      change_type_t: "add" | "update" | "discontinue"
      consultation_type_t: "in_person" | "video_call"
      difficulty_source_t: "ai_recommended" | "user_selected_preset"
      game_type_t:
        | "match_pairs"
        | "face_recog"
        | "sound_recog"
        | "missing_object"
        | "sequence_match"
      gender_t: "male" | "female" | "other" | "prefer_not_to_say"
      location_type_t: "personal" | "landmark" | "regional" | "generic"
      mitra_trigger_t:
        | "onboarding"
        | "idle"
        | "game_intro"
        | "game_win"
        | "game_fail"
        | "reminder_nudge"
        | "daily_greeting"
      notification_source_t:
        | "reminder"
        | "medication"
        | "task"
        | "progress_alert"
      notification_status_t: "pending" | "sent" | "acknowledged" | "missed"
      owner_type_t: "patient" | "caregiver"
      reminder_type_t: "medicine" | "hydration" | "appointment" | "activity"
      report_period_t: "weekly" | "monthly"
      sound_category_t:
        | "animal"
        | "nature"
        | "household"
        | "voice"
        | "instrument"
      sync_status_t: "pending" | "synced" | "failed"
      task_status_t: "pending" | "completed"
      vital_type_t:
        | "heart_rate"
        | "blood_pressure"
        | "sleep"
        | "weight"
        | "temperature"
        | "oxygen_saturation"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      ai_mode_t: ["offline", "online"],
      appointment_status_t: ["scheduled", "completed", "cancelled"],
      change_status_t: ["pending", "approved", "rejected"],
      change_type_t: ["add", "update", "discontinue"],
      consultation_type_t: ["in_person", "video_call"],
      difficulty_source_t: ["ai_recommended", "user_selected_preset"],
      game_type_t: [
        "match_pairs",
        "face_recog",
        "sound_recog",
        "missing_object",
        "sequence_match",
      ],
      gender_t: ["male", "female", "other", "prefer_not_to_say"],
      location_type_t: ["personal", "landmark", "regional", "generic"],
      mitra_trigger_t: [
        "onboarding",
        "idle",
        "game_intro",
        "game_win",
        "game_fail",
        "reminder_nudge",
        "daily_greeting",
      ],
      notification_source_t: [
        "reminder",
        "medication",
        "task",
        "progress_alert",
      ],
      notification_status_t: ["pending", "sent", "acknowledged", "missed"],
      owner_type_t: ["patient", "caregiver"],
      reminder_type_t: ["medicine", "hydration", "appointment", "activity"],
      report_period_t: ["weekly", "monthly"],
      sound_category_t: [
        "animal",
        "nature",
        "household",
        "voice",
        "instrument",
      ],
      sync_status_t: ["pending", "synced", "failed"],
      task_status_t: ["pending", "completed"],
      vital_type_t: [
        "heart_rate",
        "blood_pressure",
        "sleep",
        "weight",
        "temperature",
        "oxygen_saturation",
      ],
    },
  },
} as const
