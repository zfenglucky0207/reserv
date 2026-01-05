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
    PostgrestVersion: "14.1"
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
      host_settings: {
        Row: {
          allow_cash_payments: boolean
          auto_close_when_full_default: boolean
          auto_delete_participant_data: boolean
          auto_unpublish_enabled: boolean
          default_payment_instructions: string | null
          host_id: string
          require_payment_proof_default: boolean
          show_guest_list_publicly_default: boolean
          updated_at: string
          waiting_list_default: boolean
        }
        Insert: {
          allow_cash_payments?: boolean
          auto_close_when_full_default?: boolean
          auto_delete_participant_data?: boolean
          auto_unpublish_enabled?: boolean
          default_payment_instructions?: string | null
          host_id: string
          require_payment_proof_default?: boolean
          show_guest_list_publicly_default?: boolean
          updated_at?: string
          waiting_list_default?: boolean
        }
        Update: {
          allow_cash_payments?: boolean
          auto_close_when_full_default?: boolean
          auto_delete_participant_data?: boolean
          auto_unpublish_enabled?: boolean
          default_payment_instructions?: string | null
          host_id?: string
          require_payment_proof_default?: boolean
          show_guest_list_publicly_default?: boolean
          updated_at?: string
          waiting_list_default?: boolean
        }
        Relationships: []
      }
      participants: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          display_name: string
          guest_key: string | null
          id: string
          notes: string | null
          session_id: string
          status: Database["public"]["Enums"]["participant_status"]
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          display_name: string
          guest_key?: string | null
          id?: string
          notes?: string | null
          session_id: string
          status?: Database["public"]["Enums"]["participant_status"]
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          display_name?: string
          guest_key?: string | null
          id?: string
          notes?: string | null
          session_id?: string
          status?: Database["public"]["Enums"]["participant_status"]
        }
        Relationships: [
          {
            foreignKeyName: "participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_proofs: {
        Row: {
          account_name: string | null
          account_number: string | null
          amount: number | null
          bank_name: string | null
          created_at: string
          currency: string | null
          id: string
          ocr_confidence: number | null
          ocr_payload: Json | null
          ocr_status: Database["public"]["Enums"]["ocr_status"]
          participant_id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          processed_at: string | null
          proof_image_url: string | null
          scanned_at: string | null
          session_id: string
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          amount?: number | null
          bank_name?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          ocr_confidence?: number | null
          ocr_payload?: Json | null
          ocr_status?: Database["public"]["Enums"]["ocr_status"]
          participant_id: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          processed_at?: string | null
          proof_image_url?: string | null
          scanned_at?: string | null
          session_id: string
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          amount?: number | null
          bank_name?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          ocr_confidence?: number | null
          ocr_payload?: Json | null
          ocr_status?: Database["public"]["Enums"]["ocr_status"]
          participant_id?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          processed_at?: string | null
          proof_image_url?: string | null
          scanned_at?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_proofs_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_proofs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      session_drafts: {
        Row: {
          created_at: string
          data: Json
          id: string
          name: string
          source_session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data: Json
          id?: string
          name: string
          source_session_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          name?: string
          source_session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          capacity: number | null
          container_overlay_enabled: boolean | null
          court_numbers: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          end_at: string | null
          host_id: string
          host_name: string | null
          host_slug: string | null
          id: string
          location: string | null
          payment_account_name: string | null
          payment_account_number: string | null
          payment_bank_name: string | null
          public_code: string | null
          sport: Database["public"]["Enums"]["sport_type"]
          start_at: string
          status: Database["public"]["Enums"]["session_status"]
          title: string
          updated_at: string
          waitlist_enabled: boolean
        }
        Insert: {
          capacity?: number | null
          container_overlay_enabled?: boolean | null
          court_numbers?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          end_at?: string | null
          host_id: string
          host_name?: string | null
          host_slug?: string | null
          id?: string
          location?: string | null
          payment_account_name?: string | null
          payment_account_number?: string | null
          payment_bank_name?: string | null
          public_code?: string | null
          sport: Database["public"]["Enums"]["sport_type"]
          start_at: string
          status?: Database["public"]["Enums"]["session_status"]
          title: string
          updated_at?: string
          waitlist_enabled?: boolean
        }
        Update: {
          capacity?: number | null
          container_overlay_enabled?: boolean | null
          court_numbers?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          end_at?: string | null
          host_id?: string
          host_name?: string | null
          host_slug?: string | null
          id?: string
          location?: string | null
          payment_account_name?: string | null
          payment_account_number?: string | null
          payment_bank_name?: string | null
          public_code?: string | null
          sport?: Database["public"]["Enums"]["sport_type"]
          start_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          title?: string
          updated_at?: string
          waitlist_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "sessions_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          id: string
        }
        Insert: {
          created_at?: string | null
          id: string
        }
        Update: {
          created_at?: string | null
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      ocr_status: "pending" | "success" | "failed"
      participant_status: "invited" | "confirmed" | "cancelled" | "waitlisted"
      payment_status: "pending_review" | "approved" | "rejected"
      session_status: "draft" | "open" | "closed" | "completed" | "cancelled"
      sport_type: "badminton" | "pickleball" | "volleyball" | "other"
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
    Enums: {
      ocr_status: ["pending", "success", "failed"],
      participant_status: ["invited", "confirmed", "cancelled", "waitlisted"],
      payment_status: ["pending_review", "approved", "rejected"],
      session_status: ["draft", "open", "closed", "completed", "cancelled"],
      sport_type: ["badminton", "pickleball", "volleyball", "other"],
    },
  },
} as const
