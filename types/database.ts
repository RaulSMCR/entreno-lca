export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      day_templates: {
        Row: {
          code: string
          created_at: string
          focus: string | null
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          focus?: string | null
          id?: string
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          code?: string
          created_at?: string
          focus?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      e1rm_estimates: {
        Row: {
          created_at: string
          date: string
          e1rm_kg: number
          exercise_id: string
          id: string
          method: string | null
          source_session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          e1rm_kg: number
          exercise_id: string
          id?: string
          method?: string | null
          source_session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          date?: string
          e1rm_kg?: number
          exercise_id?: string
          id?: string
          method?: string | null
          source_session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "e1rm_estimates_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "e1rm_estimates_source_session_id_fkey"
            columns: ["source_session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          available_loads: number[] | null
          bar_kg: number | null
          created_at: string
          id: string
          load_mode: string
          max_kg: number | null
          micro_plates: number[] | null
          min_kg: number | null
          name: string
          plate_pairs: number[] | null
          step_kg: number | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          available_loads?: number[] | null
          bar_kg?: number | null
          created_at?: string
          id?: string
          load_mode: string
          max_kg?: number | null
          micro_plates?: number[] | null
          min_kg?: number | null
          name: string
          plate_pairs?: number[] | null
          step_kg?: number | null
          type: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          available_loads?: number[] | null
          bar_kg?: number | null
          created_at?: string
          id?: string
          load_mode?: string
          max_kg?: number | null
          micro_plates?: number[] | null
          min_kg?: number | null
          name?: string
          plate_pairs?: number[] | null
          step_kg?: number | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      exercises: {
        Row: {
          biomech_note: string | null
          block: string
          category: string | null
          created_at: string
          e1rm_kg: number | null
          equipment_id: string | null
          id: string
          is_active: boolean
          name: string
          rm_base_kg: number | null
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          biomech_note?: string | null
          block: string
          category?: string | null
          created_at?: string
          e1rm_kg?: number | null
          equipment_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          rm_base_kg?: number | null
          unit: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          biomech_note?: string | null
          block?: string
          category?: string | null
          created_at?: string
          e1rm_kg?: number | null
          equipment_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          rm_base_kg?: number | null
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercises_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      session_exercise_statuses: {
        Row: {
          actual_duration_seconds: number | null
          completed_at: string | null
          created_at: string
          exercise_id: string
          execution_order: number | null
          id: string
          session_id: string
          sets_completed: number
          sets_planned: number
          skip_note: string | null
          skip_reason: string | null
          started_at: string | null
          status: string
          template_slot_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_duration_seconds?: number | null
          completed_at?: string | null
          created_at?: string
          exercise_id: string
          execution_order?: number | null
          id?: string
          session_id: string
          sets_completed?: number
          sets_planned: number
          skip_note?: string | null
          skip_reason?: string | null
          started_at?: string | null
          status?: string
          template_slot_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          actual_duration_seconds?: number | null
          completed_at?: string | null
          created_at?: string
          exercise_id?: string
          execution_order?: number | null
          id?: string
          session_id?: string
          sets_completed?: number
          sets_planned?: number
          skip_note?: string | null
          skip_reason?: string | null
          started_at?: string | null
          status?: string
          template_slot_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_exercise_statuses_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_exercise_statuses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_exercise_statuses_template_slot_id_fkey"
            columns: ["template_slot_id"]
            isOneToOne: false
            referencedRelation: "template_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          bodyweight_kg: number | null
          created_at: string
          date: string
          day_template_id: string | null
          id: string
          notes: string | null
          readiness: number | null
          session_duration_variance_pct: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bodyweight_kg?: number | null
          created_at?: string
          date: string
          day_template_id?: string | null
          id?: string
          notes?: string | null
          readiness?: number | null
          session_duration_variance_pct?: number | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          bodyweight_kg?: number | null
          created_at?: string
          date?: string
          day_template_id?: string | null
          id?: string
          notes?: string | null
          readiness?: number | null
          session_duration_variance_pct?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_day_template_id_fkey"
            columns: ["day_template_id"]
            isOneToOne: false
            referencedRelation: "day_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      set_logs: {
        Row: {
          actual_load_kg: number | null
          actual_reps: number | null
          created_at: string
          exercise_id: string
          id: string
          is_failure: boolean
          note: string | null
          rpe_at_rep: number | null
          rpe_reported: number | null
          session_id: string
          set_number: number
          synced_from_local: boolean
          target_load_kg: number | null
          target_reps: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_load_kg?: number | null
          actual_reps?: number | null
          created_at?: string
          exercise_id: string
          id?: string
          is_failure?: boolean
          note?: string | null
          rpe_at_rep?: number | null
          rpe_reported?: number | null
          session_id: string
          set_number: number
          synced_from_local?: boolean
          target_load_kg?: number | null
          target_reps?: number | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          actual_load_kg?: number | null
          actual_reps?: number | null
          created_at?: string
          exercise_id?: string
          id?: string
          is_failure?: boolean
          note?: string | null
          rpe_at_rep?: number | null
          rpe_reported?: number | null
          session_id?: string
          set_number?: number
          synced_from_local?: boolean
          target_load_kg?: number | null
          target_reps?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "set_logs_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "set_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      template_slots: {
        Row: {
          block: string
          created_at: string
          day_template_id: string
          exercise_id: string
          id: string
          intensity_note: string | null
          pct_max: number | null
          reps: number | null
          reps_or_time: string | null
          rpe_target: number | null
          scheme_raw: string | null
          sets: number | null
          slot_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          block: string
          created_at?: string
          day_template_id: string
          exercise_id: string
          id?: string
          intensity_note?: string | null
          pct_max?: number | null
          reps?: number | null
          reps_or_time?: string | null
          rpe_target?: number | null
          scheme_raw?: string | null
          sets?: number | null
          slot_order: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          block?: string
          created_at?: string
          day_template_id?: string
          exercise_id?: string
          id?: string
          intensity_note?: string | null
          pct_max?: number | null
          reps?: number | null
          reps_or_time?: string | null
          rpe_target?: number | null
          scheme_raw?: string | null
          sets?: number | null
          slot_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_slots_day_template_id_fkey"
            columns: ["day_template_id"]
            isOneToOne: false
            referencedRelation: "day_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_slots_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_schedule: {
        Row: {
          created_at: string
          day_template_id: string | null
          id: string
          label: string | null
          updated_at: string
          user_id: string
          weekday: string
        }
        Insert: {
          created_at?: string
          day_template_id?: string | null
          id?: string
          label?: string | null
          updated_at?: string
          user_id?: string
          weekday: string
        }
        Update: {
          created_at?: string
          day_template_id?: string | null
          id?: string
          label?: string | null
          updated_at?: string
          user_id?: string
          weekday?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_schedule_day_template_id_fkey"
            columns: ["day_template_id"]
            isOneToOne: false
            referencedRelation: "day_templates"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
