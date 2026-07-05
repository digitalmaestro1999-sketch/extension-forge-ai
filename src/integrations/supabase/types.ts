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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      batch_queue: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          idea: string
          project_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          idea: string
          project_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          idea?: string
          project_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_queue_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "extension_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      extension_events: {
        Row: {
          action_name: string | null
          duration_ms: number | null
          error_message: string | null
          event_type: string
          id: number
          install_id: string
          owner_id: string
          payload: Json | null
          ts: string
        }
        Insert: {
          action_name?: string | null
          duration_ms?: number | null
          error_message?: string | null
          event_type: string
          id?: number
          install_id: string
          owner_id: string
          payload?: Json | null
          ts?: string
        }
        Update: {
          action_name?: string | null
          duration_ms?: number | null
          error_message?: string | null
          event_type?: string
          id?: number
          install_id?: string
          owner_id?: string
          payload?: Json | null
          ts?: string
        }
        Relationships: [
          {
            foreignKeyName: "extension_events_install_id_fkey"
            columns: ["install_id"]
            isOneToOne: false
            referencedRelation: "extension_installs"
            referencedColumns: ["id"]
          },
        ]
      }
      extension_installs: {
        Row: {
          created_at: string
          daily_quota_minutes: number | null
          extension_name: string
          extension_version: string | null
          fingerprint: string | null
          id: string
          kill_switch: boolean
          last_seen_at: string | null
          license_expires_at: string | null
          notes: string | null
          owner_id: string
          schedule_json: Json | null
          source: string
          status: string
          token_hash: string
          updated_at: string
          weekly_quota_minutes: number | null
        }
        Insert: {
          created_at?: string
          daily_quota_minutes?: number | null
          extension_name: string
          extension_version?: string | null
          fingerprint?: string | null
          id?: string
          kill_switch?: boolean
          last_seen_at?: string | null
          license_expires_at?: string | null
          notes?: string | null
          owner_id: string
          schedule_json?: Json | null
          source?: string
          status?: string
          token_hash: string
          updated_at?: string
          weekly_quota_minutes?: number | null
        }
        Update: {
          created_at?: string
          daily_quota_minutes?: number | null
          extension_name?: string
          extension_version?: string | null
          fingerprint?: string | null
          id?: string
          kill_switch?: boolean
          last_seen_at?: string | null
          license_expires_at?: string | null
          notes?: string | null
          owner_id?: string
          schedule_json?: Json | null
          source?: string
          status?: string
          token_hash?: string
          updated_at?: string
          weekly_quota_minutes?: number | null
        }
        Relationships: []
      }
      extension_projects: {
        Row: {
          compliance_report: Json | null
          created_at: string
          description: string | null
          files: Json
          id: string
          name: string
          security_audit: Json | null
          spec: Json
          status: string
          store_assets: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          compliance_report?: Json | null
          created_at?: string
          description?: string | null
          files?: Json
          id?: string
          name: string
          security_audit?: Json | null
          spec?: Json
          status?: string
          store_assets?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          compliance_report?: Json | null
          created_at?: string
          description?: string | null
          files?: Json
          id?: string
          name?: string
          security_audit?: Json | null
          spec?: Json
          status?: string
          store_assets?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      extension_usage_daily: {
        Row: {
          actions_count: number
          day: string
          errors_count: number
          install_id: string
          minutes_used: number
          owner_id: string
        }
        Insert: {
          actions_count?: number
          day: string
          errors_count?: number
          install_id: string
          minutes_used?: number
          owner_id: string
        }
        Update: {
          actions_count?: number
          day?: string
          errors_count?: number
          install_id?: string
          minutes_used?: number
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "extension_usage_daily_install_id_fkey"
            columns: ["install_id"]
            isOneToOne: false
            referencedRelation: "extension_installs"
            referencedColumns: ["id"]
          },
        ]
      }
      intel_analyses: {
        Row: {
          competitor_id: string | null
          created_at: string
          id: string
          module_key: string
          payload: Json
          report_id: string
        }
        Insert: {
          competitor_id?: string | null
          created_at?: string
          id?: string
          module_key: string
          payload?: Json
          report_id: string
        }
        Update: {
          competitor_id?: string | null
          created_at?: string
          id?: string
          module_key?: string
          payload?: Json
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intel_analyses_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "intel_competitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intel_analyses_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "intel_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      intel_competitors: {
        Row: {
          category: string | null
          chrome_id: string | null
          created_at: string
          developer: string | null
          id: string
          name: string
          rank: number | null
          rating: number | null
          raw: Json
          report_id: string
          review_count: number | null
          url: string | null
          users_count: string | null
        }
        Insert: {
          category?: string | null
          chrome_id?: string | null
          created_at?: string
          developer?: string | null
          id?: string
          name: string
          rank?: number | null
          rating?: number | null
          raw?: Json
          report_id: string
          review_count?: number | null
          url?: string | null
          users_count?: string | null
        }
        Update: {
          category?: string | null
          chrome_id?: string | null
          created_at?: string
          developer?: string | null
          id?: string
          name?: string
          rank?: number | null
          rating?: number | null
          raw?: Json
          report_id?: string
          review_count?: number | null
          url?: string | null
          users_count?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intel_competitors_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "intel_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      intel_reports: {
        Row: {
          created_at: string
          id: string
          input_type: string
          input_value: string
          status: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          input_type: string
          input_value: string
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          input_type?: string
          input_value?: string
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_conversations: {
        Row: {
          answer: string
          audio_ms: number | null
          created_at: string
          id: string
          model: string | null
          question: string
          user_id: string
        }
        Insert: {
          answer: string
          audio_ms?: number | null
          created_at?: string
          id?: string
          model?: string | null
          question: string
          user_id: string
        }
        Update: {
          answer?: string
          audio_ms?: number | null
          created_at?: string
          id?: string
          model?: string | null
          question?: string
          user_id?: string
        }
        Relationships: []
      }
      trend_discoveries: {
        Row: {
          category: string | null
          competition_score: number
          created_at: string
          demand_score: number
          description: string | null
          id: string
          opportunity: string
          revenue_potential: string
          sources: Json | null
          status: string
          user_id: string
        }
        Insert: {
          category?: string | null
          competition_score?: number
          created_at?: string
          demand_score?: number
          description?: string | null
          id?: string
          opportunity: string
          revenue_potential?: string
          sources?: Json | null
          status?: string
          user_id: string
        }
        Update: {
          category?: string | null
          competition_score?: number
          created_at?: string
          demand_score?: number
          description?: string | null
          id?: string
          opportunity?: string
          revenue_potential?: string
          sources?: Json | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      user_api_keys: {
        Row: {
          ciphertext: string
          created_at: string
          hint: string | null
          id: string
          iv: string
          label: string
          service: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ciphertext: string
          created_at?: string
          hint?: string | null
          id?: string
          iv: string
          label: string
          service: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ciphertext?: string
          created_at?: string
          hint?: string | null
          id?: string
          iv?: string
          label?: string
          service?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_list_users: {
        Args: never
        Returns: {
          created_at: string
          display_name: string
          email: string
          last_sign_in_at: string
          roles: Database["public"]["Enums"]["app_role"][]
          status: Database["public"]["Enums"]["user_status"]
          user_id: string
        }[]
      }
      admin_set_user_status: {
        Args: {
          _status: Database["public"]["Enums"]["user_status"]
          _user_id: string
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "superadmin" | "admin" | "user"
      user_status: "pending" | "active" | "declined"
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
  public: {
    Enums: {
      app_role: ["superadmin", "admin", "user"],
      user_status: ["pending", "active", "declined"],
    },
  },
} as const
