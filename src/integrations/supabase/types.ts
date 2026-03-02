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
  public: {
    Tables: {
      budget_categories: {
        Row: {
          allocated: number
          client_id: string | null
          created_at: string
          id: string
          name: string
          spent: number
          user_id: string
        }
        Insert: {
          allocated?: number
          client_id?: string | null
          created_at?: string
          id?: string
          name: string
          spent?: number
          user_id: string
        }
        Update: {
          allocated?: number
          client_id?: string | null
          created_at?: string
          id?: string
          name?: string
          spent?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_categories_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "planner_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          client_id: string | null
          created_at: string
          email: string | null
          id: string
          meal_preference: string | null
          name: string
          phone: string | null
          plus_one: boolean | null
          rsvp_status: string | null
          table_number: number | null
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          meal_preference?: string | null
          name: string
          phone?: string | null
          plus_one?: boolean | null
          rsvp_status?: string | null
          table_number?: number | null
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          meal_preference?: string | null
          name?: string
          phone?: string | null
          plus_one?: boolean | null
          rsvp_status?: string | null
          table_number?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "planner_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      planner_clients: {
        Row: {
          client_name: string
          created_at: string
          email: string | null
          id: string
          linked_user_id: string | null
          notes: string | null
          partner_name: string | null
          phone: string | null
          planner_user_id: string
          updated_at: string
          wedding_date: string | null
          wedding_location: string | null
        }
        Insert: {
          client_name: string
          created_at?: string
          email?: string | null
          id?: string
          linked_user_id?: string | null
          notes?: string | null
          partner_name?: string | null
          phone?: string | null
          planner_user_id: string
          updated_at?: string
          wedding_date?: string | null
          wedding_location?: string | null
        }
        Update: {
          client_name?: string
          created_at?: string
          email?: string | null
          id?: string
          linked_user_id?: string | null
          notes?: string | null
          partner_name?: string | null
          phone?: string | null
          planner_user_id?: string
          updated_at?: string
          wedding_date?: string | null
          wedding_location?: string | null
        }
        Relationships: []
      }
      planner_link_requests: {
        Row: {
          couple_user_id: string
          created_at: string
          id: string
          planner_user_id: string
          status: string
          updated_at: string
        }
        Insert: {
          couple_user_id: string
          created_at?: string
          id?: string
          planner_user_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          couple_user_id?: string
          created_at?: string
          id?: string
          planner_user_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          company_email: string | null
          company_name: string | null
          company_phone: string | null
          company_website: string | null
          created_at: string
          full_name: string | null
          id: string
          partner_name: string | null
          role: Database["public"]["Enums"]["app_role"]
          specialties: string[] | null
          updated_at: string
          user_id: string
          wedding_date: string | null
          wedding_location: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          company_email?: string | null
          company_name?: string | null
          company_phone?: string | null
          company_website?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          partner_name?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          specialties?: string[] | null
          updated_at?: string
          user_id: string
          wedding_date?: string | null
          wedding_location?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          company_email?: string | null
          company_name?: string | null
          company_phone?: string | null
          company_website?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          partner_name?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          specialties?: string[] | null
          updated_at?: string
          user_id?: string
          wedding_date?: string | null
          wedding_location?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          category: string | null
          client_id: string | null
          completed: boolean
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          title: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string | null
          client_id?: string | null
          completed?: boolean
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          title: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          category?: string | null
          client_id?: string | null
          completed?: boolean
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "planner_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendor_listings: {
        Row: {
          business_name: string
          category: string
          created_at: string
          description: string | null
          email: string | null
          id: string
          is_approved: boolean
          is_verified: boolean
          location: string | null
          logo_url: string | null
          phone: string | null
          services: string[] | null
          social_facebook: string | null
          social_instagram: string | null
          social_tiktok: string | null
          social_twitter: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          business_name: string
          category: string
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          is_approved?: boolean
          is_verified?: boolean
          location?: string | null
          logo_url?: string | null
          phone?: string | null
          services?: string[] | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_tiktok?: string | null
          social_twitter?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          business_name?: string
          category?: string
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          is_approved?: boolean
          is_verified?: boolean
          location?: string | null
          logo_url?: string | null
          phone?: string | null
          services?: string[] | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_tiktok?: string | null
          social_twitter?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      vendors: {
        Row: {
          category: string
          client_id: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          price: number | null
          status: string | null
          user_id: string
          vendor_listing_id: string | null
        }
        Insert: {
          category: string
          client_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          price?: number | null
          status?: string | null
          user_id: string
          vendor_listing_id?: string | null
        }
        Update: {
          category?: string
          client_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          price?: number | null
          status?: string | null
          user_id?: string
          vendor_listing_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "planner_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendors_vendor_listing_id_fkey"
            columns: ["vendor_listing_id"]
            isOneToOne: false
            referencedRelation: "vendor_listings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_linked_couple_of: { Args: { _client_id: string }; Returns: boolean }
      is_linked_planner_of: {
        Args: { _data_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "couple" | "planner" | "vendor"
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
      app_role: ["couple", "planner", "vendor"],
    },
  },
} as const
