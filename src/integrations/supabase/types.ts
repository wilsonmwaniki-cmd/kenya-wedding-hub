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
          budget_scope: string
          client_id: string | null
          created_at: string
          id: string
          name: string
          spent: number
          user_id: string
          visibility: string
        }
        Insert: {
          allocated?: number
          budget_scope?: string
          client_id?: string | null
          created_at?: string
          id?: string
          name: string
          spent?: number
          user_id: string
          visibility?: string
        }
        Update: {
          allocated?: number
          budget_scope?: string
          client_id?: string | null
          created_at?: string
          id?: string
          name?: string
          spent?: number
          user_id?: string
          visibility?: string
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
          category: string | null
          checked_in: boolean
          checked_in_at: string | null
          client_id: string | null
          created_at: string
          email: string | null
          group_name: string | null
          id: string
          meal_preference: string | null
          name: string
          phone: string | null
          plus_one: boolean | null
          rsvp_status: string | null
          rsvp_token: string
          table_number: number | null
          user_id: string
        }
        Insert: {
          category?: string | null
          checked_in?: boolean
          checked_in_at?: string | null
          client_id?: string | null
          created_at?: string
          email?: string | null
          group_name?: string | null
          id?: string
          meal_preference?: string | null
          name: string
          phone?: string | null
          plus_one?: boolean | null
          rsvp_status?: string | null
          rsvp_token?: string
          table_number?: number | null
          user_id: string
        }
        Update: {
          category?: string | null
          checked_in?: boolean
          checked_in_at?: string | null
          client_id?: string | null
          created_at?: string
          email?: string | null
          group_name?: string | null
          id?: string
          meal_preference?: string | null
          name?: string
          phone?: string | null
          plus_one?: boolean | null
          rsvp_status?: string | null
          rsvp_token?: string
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
          message: string | null
          planner_user_id: string
          status: string
          updated_at: string
        }
        Insert: {
          couple_user_id: string
          created_at?: string
          id?: string
          message?: string | null
          planner_user_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          couple_user_id?: string
          created_at?: string
          id?: string
          message?: string | null
          planner_user_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      wedding_committee_members: {
        Row: {
          chair_user_id: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          permission_level: string
          phone: string
          responsibility: string
          status: string
          updated_at: string
        }
        Insert: {
          chair_user_id: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          permission_level?: string
          phone: string
          responsibility: string
          status?: string
          updated_at?: string
        }
        Update: {
          chair_user_id?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          permission_level?: string
          phone?: string
          responsibility?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      portfolio_vendors: {
        Row: {
          created_at: string
          id: string
          portfolio_id: string
          vendor_category: string
          vendor_listing_id: string | null
          vendor_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          portfolio_id: string
          vendor_category: string
          vendor_listing_id?: string | null
          vendor_name: string
        }
        Update: {
          created_at?: string
          id?: string
          portfolio_id?: string
          vendor_category?: string
          vendor_listing_id?: string | null
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_vendors_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "wedding_portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_vendors_vendor_listing_id_fkey"
            columns: ["vendor_listing_id"]
            isOneToOne: false
            referencedRelation: "vendor_listings"
            referencedColumns: ["id"]
          },
        ]
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
          committee_name: string | null
          partner_name: string | null
          planner_type: string | null
          planner_subscription_expires_at: string | null
          planner_subscription_started_at: string | null
          planner_subscription_status: string
          planner_verification_requested: boolean
          planner_verification_requested_at: string | null
          planner_verified: boolean
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
          committee_name?: string | null
          partner_name?: string | null
          planner_type?: string | null
          planner_subscription_expires_at?: string | null
          planner_subscription_started_at?: string | null
          planner_subscription_status?: string
          planner_verification_requested?: boolean
          planner_verification_requested_at?: string | null
          planner_verified?: boolean
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
          committee_name?: string | null
          partner_name?: string | null
          planner_type?: string | null
          planner_subscription_expires_at?: string | null
          planner_subscription_started_at?: string | null
          planner_subscription_status?: string
          planner_verification_requested?: boolean
          planner_verification_requested_at?: string | null
          planner_verified?: boolean
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
          delegatable: boolean
          description: string | null
          due_date: string | null
          id: string
          phase: string | null
          priority_level: number | null
          recommended_role: string | null
          source_vendor_id: string | null
          template_source: string | null
          title: string
          user_id: string
          visibility: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string | null
          client_id?: string | null
          completed?: boolean
          created_at?: string
          delegatable?: boolean
          description?: string | null
          due_date?: string | null
          id?: string
          phase?: string | null
          priority_level?: number | null
          recommended_role?: string | null
          source_vendor_id?: string | null
          template_source?: string | null
          title: string
          user_id: string
          visibility?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string | null
          client_id?: string | null
          completed?: boolean
          created_at?: string
          delegatable?: boolean
          description?: string | null
          due_date?: string | null
          id?: string
          phase?: string | null
          priority_level?: number | null
          recommended_role?: string | null
          source_vendor_id?: string | null
          template_source?: string | null
          title?: string
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "planner_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_source_vendor_id_fkey"
            columns: ["source_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_events: {
        Row: {
          assigned_people: string[]
          category: string | null
          created_at: string
          description: string | null
          event_time: string
          id: string
          sort_order: number
          timeline_id: string
          title: string
        }
        Insert: {
          assigned_people?: string[]
          category?: string | null
          created_at?: string
          description?: string | null
          event_time: string
          id?: string
          sort_order?: number
          timeline_id: string
          title: string
        }
        Update: {
          assigned_people?: string[]
          category?: string | null
          created_at?: string
          description?: string | null
          event_time?: string
          id?: string
          sort_order?: number
          timeline_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeline_events_timeline_id_fkey"
            columns: ["timeline_id"]
            isOneToOne: false
            referencedRelation: "timelines"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_share_links: {
        Row: {
          assignee_name: string
          created_at: string
          email: string | null
          id: string
          share_token: string
          timeline_id: string
          vendor_role: string | null
        }
        Insert: {
          assignee_name: string
          created_at?: string
          email?: string | null
          id?: string
          share_token?: string
          timeline_id: string
          vendor_role?: string | null
        }
        Update: {
          assignee_name?: string
          created_at?: string
          email?: string | null
          id?: string
          share_token?: string
          timeline_id?: string
          vendor_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timeline_share_links_timeline_id_fkey"
            columns: ["timeline_id"]
            isOneToOne: false
            referencedRelation: "timelines"
            referencedColumns: ["id"]
          },
        ]
      }
      timelines: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          is_template: boolean
          share_token: string
          timeline_date: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          is_template?: boolean
          share_token?: string
          timeline_date?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          is_template?: boolean
          share_token?: string
          timeline_date?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timelines_client_id_fkey"
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
      vendor_connection_requests: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          message: string | null
          requester_user_id: string
          status: string
          updated_at: string
          vendor_listing_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          requester_user_id: string
          status?: string
          updated_at?: string
          vendor_listing_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          requester_user_id?: string
          status?: string
          updated_at?: string
          vendor_listing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_connection_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "planner_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_connection_requests_vendor_listing_id_fkey"
            columns: ["vendor_listing_id"]
            isOneToOne: false
            referencedRelation: "vendor_listings"
            referencedColumns: ["id"]
          },
        ]
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
          subscription_expires_at: string | null
          subscription_started_at: string | null
          subscription_status: string
          services: string[] | null
          social_facebook: string | null
          social_instagram: string | null
          social_tiktok: string | null
          social_twitter: string | null
          updated_at: string
          user_id: string
          verification_requested: boolean
          verification_requested_at: string | null
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
          subscription_expires_at?: string | null
          subscription_started_at?: string | null
          subscription_status?: string
          services?: string[] | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_tiktok?: string | null
          social_twitter?: string | null
          updated_at?: string
          user_id: string
          verification_requested?: boolean
          verification_requested_at?: string | null
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
          subscription_expires_at?: string | null
          subscription_started_at?: string | null
          subscription_status?: string
          services?: string[] | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_tiktok?: string | null
          social_twitter?: string | null
          updated_at?: string
          user_id?: string
          verification_requested?: boolean
          verification_requested_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      vendor_price_observations: {
        Row: {
          amount: number
          category: string
          client_id: string | null
          created_at: string
          currency: string
          event_date: string | null
          guest_count: number | null
          id: string
          is_anonymized: boolean
          location_county: string | null
          notes: string | null
          price_type: string
          recorded_by_user_id: string
          source: string
          source_vendor_id: string | null
          updated_at: string
          user_id: string
          vendor_listing_id: string | null
          vendor_name_snapshot: string
          venue_name: string | null
          wedding_style: string | null
        }
        Insert: {
          amount: number
          category: string
          client_id?: string | null
          created_at?: string
          currency?: string
          event_date?: string | null
          guest_count?: number | null
          id?: string
          is_anonymized?: boolean
          location_county?: string | null
          notes?: string | null
          price_type?: string
          recorded_by_user_id?: string
          source?: string
          source_vendor_id?: string | null
          updated_at?: string
          user_id: string
          vendor_listing_id?: string | null
          vendor_name_snapshot: string
          venue_name?: string | null
          wedding_style?: string | null
        }
        Update: {
          amount?: number
          category?: string
          client_id?: string | null
          created_at?: string
          currency?: string
          event_date?: string | null
          guest_count?: number | null
          id?: string
          is_anonymized?: boolean
          location_county?: string | null
          notes?: string | null
          price_type?: string
          recorded_by_user_id?: string
          source?: string
          source_vendor_id?: string | null
          updated_at?: string
          user_id?: string
          vendor_listing_id?: string | null
          vendor_name_snapshot?: string
          venue_name?: string | null
          wedding_style?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_price_observations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "planner_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_price_observations_source_vendor_id_fkey"
            columns: ["source_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_price_observations_vendor_listing_id_fkey"
            columns: ["vendor_listing_id"]
            isOneToOne: false
            referencedRelation: "vendor_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_reputation_reviews: {
        Row: {
          client_id: string | null
          communication_rating: number
          created_at: string
          delivered_on_time: boolean | null
          event_date: string | null
          id: string
          is_anonymized: boolean
          issue_flags: string[]
          overall_rating: number
          private_notes: string | null
          punctuality_rating: number
          quality_rating: number
          reliability_rating: number
          review_source: string
          review_source_role: string | null
          reviewer_user_id: string
          source_vendor_id: string | null
          updated_at: string
          user_id: string
          value_rating: number
          vendor_category_snapshot: string
          vendor_listing_id: string | null
          vendor_name_snapshot: string
          visibility: string
          would_hire_again: boolean
        }
        Insert: {
          client_id?: string | null
          communication_rating: number
          created_at?: string
          delivered_on_time?: boolean | null
          event_date?: string | null
          id?: string
          is_anonymized?: boolean
          issue_flags?: string[]
          overall_rating: number
          private_notes?: string | null
          punctuality_rating: number
          quality_rating: number
          reliability_rating: number
          review_source?: string
          review_source_role?: string | null
          reviewer_user_id?: string
          source_vendor_id?: string | null
          updated_at?: string
          user_id: string
          value_rating: number
          vendor_category_snapshot: string
          vendor_listing_id?: string | null
          vendor_name_snapshot: string
          visibility?: string
          would_hire_again?: boolean
        }
        Update: {
          client_id?: string | null
          communication_rating?: number
          created_at?: string
          delivered_on_time?: boolean | null
          event_date?: string | null
          id?: string
          is_anonymized?: boolean
          issue_flags?: string[]
          overall_rating?: number
          private_notes?: string | null
          punctuality_rating?: number
          quality_rating?: number
          reliability_rating?: number
          review_source?: string
          review_source_role?: string | null
          reviewer_user_id?: string
          source_vendor_id?: string | null
          updated_at?: string
          user_id?: string
          value_rating?: number
          vendor_category_snapshot?: string
          vendor_listing_id?: string | null
          vendor_name_snapshot?: string
          visibility?: string
          would_hire_again?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "vendor_reputation_reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "planner_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_reputation_reviews_source_vendor_id_fkey"
            columns: ["source_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_reputation_reviews_vendor_listing_id_fkey"
            columns: ["vendor_listing_id"]
            isOneToOne: false
            referencedRelation: "vendor_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_reviews: {
        Row: {
          created_at: string
          id: string
          portfolio_id: string | null
          rating: number
          review_text: string | null
          reviewer_name: string | null
          reviewer_role: string | null
          reviewer_user_id: string
          updated_at: string
          vendor_listing_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          portfolio_id?: string | null
          rating: number
          review_text?: string | null
          reviewer_name?: string | null
          reviewer_role?: string | null
          reviewer_user_id: string
          updated_at?: string
          vendor_listing_id: string
        }
        Update: {
          created_at?: string
          id?: string
          portfolio_id?: string | null
          rating?: number
          review_text?: string | null
          reviewer_name?: string | null
          reviewer_role?: string | null
          reviewer_user_id?: string
          updated_at?: string
          vendor_listing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_reviews_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "wedding_portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_reviews_vendor_listing_id_fkey"
            columns: ["vendor_listing_id"]
            isOneToOne: false
            referencedRelation: "vendor_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          amount_paid: number
          category: string
          client_id: string | null
          created_at: string
          deposit_amount: number
          email: string | null
          id: string
          last_payment_at: string | null
          name: string
          notes: string | null
          payment_due_date: string | null
          payment_status: string
          phone: string | null
          price: number | null
          selection_status: string
          selection_updated_at: string
          status: string | null
          user_id: string
          vendor_listing_id: string | null
        }
        Insert: {
          amount_paid?: number
          category: string
          client_id?: string | null
          created_at?: string
          deposit_amount?: number
          email?: string | null
          id?: string
          last_payment_at?: string | null
          name: string
          notes?: string | null
          payment_due_date?: string | null
          payment_status?: string
          phone?: string | null
          price?: number | null
          selection_status?: string
          selection_updated_at?: string
          status?: string | null
          user_id: string
          vendor_listing_id?: string | null
        }
        Update: {
          amount_paid?: number
          category?: string
          client_id?: string | null
          created_at?: string
          deposit_amount?: number
          email?: string | null
          id?: string
          last_payment_at?: string | null
          name?: string
          notes?: string | null
          payment_due_date?: string | null
          payment_status?: string
          phone?: string | null
          price?: number | null
          selection_status?: string
          selection_updated_at?: string
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
      wedding_portfolios: {
        Row: {
          client_id: string | null
          cover_photo_url: string | null
          created_at: string
          description: string | null
          guest_count: number | null
          id: string
          is_published: boolean
          share_token: string
          style_tags: string[] | null
          title: string
          updated_at: string
          user_id: string
          wedding_date: string | null
          wedding_location: string | null
        }
        Insert: {
          client_id?: string | null
          cover_photo_url?: string | null
          created_at?: string
          description?: string | null
          guest_count?: number | null
          id?: string
          is_published?: boolean
          share_token?: string
          style_tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
          wedding_date?: string | null
          wedding_location?: string | null
        }
        Update: {
          client_id?: string | null
          cover_photo_url?: string | null
          created_at?: string
          description?: string | null
          guest_count?: number | null
          id?: string
          is_published?: boolean
          share_token?: string
          style_tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
          wedding_date?: string | null
          wedding_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wedding_portfolios_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "planner_clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_planner_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          company_email: string | null
          company_name: string | null
          company_phone: string | null
          company_website: string | null
          full_name: string | null
          id: string | null
          specialties: string[] | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          company_email?: string | null
          company_name?: string | null
          company_phone?: string | null
          company_website?: string | null
          full_name?: string | null
          id?: string | null
          specialties?: string[] | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          company_email?: string | null
          company_name?: string | null
          company_phone?: string | null
          company_website?: string | null
          full_name?: string | null
          id?: string | null
          specialties?: string[] | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_dashboard_metrics: { Args: never; Returns: Json }
      admin_list_vendor_reputation_reviews: {
        Args: {
          issue_filter?: string
          limit_rows?: number
          offset_rows?: number
          search_query?: string
          visibility_filter?: string
        }
        Returns: Json
      }
      admin_list_users: {
        Args: {
          limit_rows?: number
          offset_rows?: number
          role_filter?: string
          search_query?: string
        }
        Returns: Json
      }
      admin_list_vendor_listings: {
        Args: {
          limit_rows?: number
          offset_rows?: number
          search_query?: string
          status_filter?: string
        }
        Returns: Json
      }
      admin_review_vendor_listing: {
        Args: { approve: boolean; listing_id: string; verify: boolean }
        Returns: undefined
      }
      admin_reputation_review_metrics: { Args: never; Returns: Json }
      admin_set_vendor_subscription: {
        Args: {
          listing_id: string
          new_subscription_expires_at?: string | null
          new_subscription_status: string
        }
        Returns: undefined
      }
      admin_list_planner_profiles: {
        Args: {
          limit_rows?: number
          offset_rows?: number
          search_query?: string
          verification_filter?: string
        }
        Returns: Json
      }
      admin_set_planner_access: {
        Args: {
          new_subscription_expires_at?: string | null
          new_subscription_status: string
          new_verified: boolean
          target_user_id: string
        }
        Returns: undefined
      }
      admin_set_vendor_reputation_visibility: {
        Args: { new_visibility: string; review_id: string }
        Returns: undefined
      }
      admin_set_user_role: {
        Args: {
          new_role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
        }
        Returns: undefined
      }
      can_access_vendor_price_observation: {
        Args: { _client_id: string | null; _user_id: string }
        Returns: boolean
      }
      can_manage_vendor_reputation_review: {
        Args: {
          _owner_user_id: string
          _reviewer_user_id: string
          _client_id: string | null
          _source_vendor_id: string | null
        }
        Returns: boolean
      }
      get_vendor_price_benchmark: {
        Args: {
          category_filter?: string | null
          county_filter?: string | null
          min_sample_size?: number | null
          vendor_listing_filter?: string | null
          venue_filter?: string | null
        }
        Returns: {
          average_amount: number | null
          benchmark_visible: boolean
          last_observation_at: string | null
          maximum_amount: number | null
          median_amount: number | null
          minimum_amount: number | null
          percentile_25_amount: number | null
          percentile_75_amount: number | null
          sample_size: number
          vendor_count: number
        }[]
      }
      get_vendor_reputation_benchmark: {
        Args: {
          category_filter?: string | null
          min_sample_size?: number | null
          vendor_listing_filter?: string | null
        }
        Returns: {
          average_communication_rating: number | null
          average_overall_rating: number | null
          average_punctuality_rating: number | null
          average_quality_rating: number | null
          average_reliability_rating: number | null
          average_value_rating: number | null
          benchmark_visible: boolean
          flagged_review_count: number | null
          hire_again_rate: number | null
          last_review_at: string | null
          on_time_rate: number | null
          sample_size: number
          vendor_count: number
        }[]
      }
      get_vendor_reputation_overview: {
        Args: {
          listing_id_input: string
          min_sample_size?: number | null
        }
        Returns: {
          average_communication_rating: number | null
          average_overall_rating: number | null
          average_punctuality_rating: number | null
          average_quality_rating: number | null
          average_reliability_rating: number | null
          average_value_rating: number | null
          benchmark_visible: boolean
          flagged_review_count: number | null
          hire_again_rate: number | null
          last_review_at: string | null
          on_time_rate: number | null
          sample_size: number
        }[]
      }
      request_vendor_verification: { Args: never; Returns: undefined }
      request_planner_verification: { Args: never; Returns: undefined }
      planner_profile_has_full_access: {
        Args: { target_planner_user_id: string }
        Returns: boolean
      }
      vendor_listing_has_full_access: {
        Args: { target_listing_id: string }
        Returns: boolean
      }
      get_public_budget_estimate: {
        Args: {
          county_input?: string | null
          guest_count_input?: number | null
          min_sample_size?: number | null
          venue_tier_input?: string | null
          wedding_style_input?: string | null
        }
        Returns: {
          benchmark_visible: boolean
          category: string
          high_amount: number
          low_amount: number
          sample_size: number
          source: string
          suggested_amount: number
        }[]
      }
      get_assignee_timeline: { Args: { _share_token: string }; Returns: Json }
      get_shared_timeline: { Args: { _share_token: string }; Returns: Json }
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
      owns_timeline: { Args: { _timeline_id: string }; Returns: boolean }
      public_rsvp_lookup: { Args: { _token: string }; Returns: Json }
      public_rsvp_respond: {
        Args: { _status: string; _token: string }
        Returns: Json
      }
      record_vendor_price_observation: {
        Args: {
          client?: string | null
          county_input?: string | null
          event_date_input?: string | null
          guest_count_input?: number | null
          is_anonymized_input?: boolean | null
          notes_input?: string | null
          observation_amount: number
          observation_category: string
          price_type_input?: string | null
          source_input?: string | null
          vendor_listing?: string | null
          vendor_name: string
          venue_input?: string | null
          wedding_style_input?: string | null
        }
        Returns: string
      }
      record_vendor_reputation_review: {
        Args: {
          client_input?: string | null
          communication_input: number
          delivered_on_time_input?: boolean | null
          event_date_input?: string | null
          is_anonymized_input?: boolean | null
          issue_flags_input?: string[] | null
          overall_rating_input: number
          private_notes_input?: string | null
          punctuality_input: number
          quality_input: number
          reliability_input: number
          source_vendor_input?: string | null
          value_input: number
          vendor_category_input?: string | null
          vendor_listing_input?: string | null
          vendor_name_input?: string | null
          visibility_input?: string | null
          would_hire_again_input?: boolean | null
        }
        Returns: string
      }
      set_vendor_selection_status: {
        Args: {
          selection_status_input: string
          vendor_id_input: string
        }
        Returns: string
      }
      update_vendor_payment_state: {
        Args: {
          amount_paid_input?: number | null
          contract_amount_input?: number | null
          deposit_amount_input?: number | null
          payment_due_date_input?: string | null
          payment_status_input?: string | null
          vendor_id_input: string
        }
        Returns: {
          amount_paid: number
          category: string
          client_id: string | null
          created_at: string
          deposit_amount: number
          email: string | null
          id: string
          last_payment_at: string | null
          name: string
          notes: string | null
          payment_due_date: string | null
          payment_status: string
          phone: string | null
          price: number | null
          selection_status: string
          selection_updated_at: string
          status: string | null
          user_id: string
          vendor_listing_id: string | null
        }
      }
      require_planner_or_admin: { Args: never; Returns: undefined }
      can_manage_committee_members: {
        Args: { target_chair_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "couple" | "planner" | "vendor" | "admin"
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
      app_role: ["couple", "planner", "vendor", "admin"],
    },
  },
} as const
