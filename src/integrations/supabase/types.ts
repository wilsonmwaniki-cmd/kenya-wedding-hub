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
  public: {
    Tables: {
      account_audit_events: {
        Row: {
          created_at: string
          device_session_id: string | null
          event_type: string
          id: string
          metadata: Json
          user_id: string | null
          wedding_id: string | null
        }
        Insert: {
          created_at?: string
          device_session_id?: string | null
          event_type: string
          id?: string
          metadata?: Json
          user_id?: string | null
          wedding_id?: string | null
        }
        Update: {
          created_at?: string
          device_session_id?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          user_id?: string | null
          wedding_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_audit_events_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_assistant_memories: {
        Row: {
          created_at: string
          id: string
          memory_key: string
          memory_type: string
          memory_value: Json
          owner_user_id: string
          source: string
          updated_at: string
          workspace_key: string
        }
        Insert: {
          created_at?: string
          id?: string
          memory_key: string
          memory_type: string
          memory_value: Json
          owner_user_id: string
          source?: string
          updated_at?: string
          workspace_key?: string
        }
        Update: {
          created_at?: string
          id?: string
          memory_key?: string
          memory_type?: string
          memory_value?: Json
          owner_user_id?: string
          source?: string
          updated_at?: string
          workspace_key?: string
        }
        Relationships: []
      }
      ai_assistant_usage_logs: {
        Row: {
          audience: string
          cached_input_tokens: number
          created_at: string
          estimated_cost_usd: number
          feature: string
          id: string
          input_tokens: number
          model: string | null
          month_start: string
          output_tokens: number
          provider_request_count: number
          role: string
          user_id: string
        }
        Insert: {
          audience: string
          cached_input_tokens?: number
          created_at?: string
          estimated_cost_usd?: number
          feature?: string
          id?: string
          input_tokens?: number
          model?: string | null
          month_start: string
          output_tokens?: number
          provider_request_count?: number
          role: string
          user_id: string
        }
        Update: {
          audience?: string
          cached_input_tokens?: number
          created_at?: string
          estimated_cost_usd?: number
          feature?: string
          id?: string
          input_tokens?: number
          model?: string | null
          month_start?: string
          output_tokens?: number
          provider_request_count?: number
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_plan_configs: {
        Row: {
          add_on_annual_lookup_key: string | null
          add_on_lookup_key: string | null
          add_on_separate: boolean
          ai_enabled: boolean
          audience: string
          created_at: string
          monthly_cost_cap_usd: number
          monthly_message_cap: number
          updated_at: string
        }
        Insert: {
          add_on_annual_lookup_key?: string | null
          add_on_lookup_key?: string | null
          add_on_separate?: boolean
          ai_enabled?: boolean
          audience: string
          created_at?: string
          monthly_cost_cap_usd: number
          monthly_message_cap: number
          updated_at?: string
        }
        Update: {
          add_on_annual_lookup_key?: string | null
          add_on_lookup_key?: string | null
          add_on_separate?: boolean
          ai_enabled?: boolean
          audience?: string
          created_at?: string
          monthly_cost_cap_usd?: number
          monthly_message_cap?: number
          updated_at?: string
        }
        Relationships: []
      }
      attention_items: {
        Row: {
          action_label: string | null
          action_path: string | null
          attention_kind: string
          completed_at: string | null
          created_at: string
          dedupe_key: string
          dismissed_at: string | null
          due_at: string | null
          event_id: string | null
          id: string
          metadata: Json
          priority: string
          read_at: string | null
          recipient_role: string
          recipient_user_id: string
          source_id: string | null
          source_type: string
          status: string
          summary: string | null
          title: string
          updated_at: string
          wedding_id: string | null
        }
        Insert: {
          action_label?: string | null
          action_path?: string | null
          attention_kind: string
          completed_at?: string | null
          created_at?: string
          dedupe_key: string
          dismissed_at?: string | null
          due_at?: string | null
          event_id?: string | null
          id?: string
          metadata?: Json
          priority?: string
          read_at?: string | null
          recipient_role: string
          recipient_user_id: string
          source_id?: string | null
          source_type: string
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
          wedding_id?: string | null
        }
        Update: {
          action_label?: string | null
          action_path?: string | null
          attention_kind?: string
          completed_at?: string | null
          created_at?: string
          dedupe_key?: string
          dismissed_at?: string | null
          due_at?: string | null
          event_id?: string | null
          id?: string
          metadata?: Json
          priority?: string
          read_at?: string | null
          recipient_role?: string
          recipient_user_id?: string
          source_id?: string | null
          source_type?: string
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
          wedding_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attention_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "workspace_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attention_items_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_categories: {
        Row: {
          allocated: number
          allocation_last_edited_field: string | null
          allocation_manually_edited: boolean
          budget_scope: string
          client_id: string | null
          committee_role_in_charge: string | null
          contract_status: string
          created_at: string
          id: string
          name: string
          spent: number
          suggested_allocated: number | null
          suggested_percentage: number | null
          user_id: string
          visibility: string
          wedding_id: string | null
        }
        Insert: {
          allocated?: number
          allocation_last_edited_field?: string | null
          allocation_manually_edited?: boolean
          budget_scope?: string
          client_id?: string | null
          committee_role_in_charge?: string | null
          contract_status?: string
          created_at?: string
          id?: string
          name: string
          spent?: number
          suggested_allocated?: number | null
          suggested_percentage?: number | null
          user_id: string
          visibility?: string
          wedding_id?: string | null
        }
        Update: {
          allocated?: number
          allocation_last_edited_field?: string | null
          allocation_manually_edited?: boolean
          budget_scope?: string
          client_id?: string | null
          committee_role_in_charge?: string | null
          contract_status?: string
          created_at?: string
          id?: string
          name?: string
          spent?: number
          suggested_allocated?: number | null
          suggested_percentage?: number | null
          user_id?: string
          visibility?: string
          wedding_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_categories_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "planner_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_categories_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_payments: {
        Row: {
          amount: number
          budget_category_id: string | null
          budget_scope: string
          category_name: string
          client_id: string | null
          created_at: string
          id: string
          notes: string | null
          payee_name: string
          payment_date: string
          reference: string | null
          user_id: string
          vendor_id: string | null
          wedding_id: string | null
        }
        Insert: {
          amount?: number
          budget_category_id?: string | null
          budget_scope?: string
          category_name: string
          client_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          payee_name: string
          payment_date?: string
          reference?: string | null
          user_id: string
          vendor_id?: string | null
          wedding_id?: string | null
        }
        Update: {
          amount?: number
          budget_category_id?: string | null
          budget_scope?: string
          category_name?: string
          client_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          payee_name?: string
          payment_date?: string
          reference?: string | null
          user_id?: string
          vendor_id?: string | null
          wedding_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_payments_budget_category_id_fkey"
            columns: ["budget_category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "planner_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_payments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_payments_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_document_items: {
        Row: {
          created_at: string
          description: string
          document_id: string
          id: string
          line_total: number
          metadata: Json
          quantity: number
          sort_order: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          document_id: string
          id?: string
          line_total?: number
          metadata?: Json
          quantity?: number
          sort_order?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          document_id?: string
          id?: string
          line_total?: number
          metadata?: Json
          quantity?: number
          sort_order?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_document_items_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "commercial_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_document_payments: {
        Row: {
          amount: number
          budget_payment_id: string | null
          created_at: string
          document_id: string
          id: string
          notes: string | null
          payment_date: string
          payment_method: string
          recorded_by: string
          reference: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          budget_payment_id?: string | null
          created_at?: string
          document_id: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method: string
          recorded_by: string
          reference?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          budget_payment_id?: string | null
          created_at?: string
          document_id?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          recorded_by?: string
          reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_document_payments_budget_payment_id_fkey"
            columns: ["budget_payment_id"]
            isOneToOne: false
            referencedRelation: "budget_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_document_payments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "commercial_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_document_shares: {
        Row: {
          access_count: number
          created_at: string
          document_id: string
          expires_at: string
          id: string
          last_accessed_at: string | null
          revoked_at: string | null
          share_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_count?: number
          created_at?: string
          document_id: string
          expires_at?: string
          id?: string
          last_accessed_at?: string | null
          revoked_at?: string | null
          share_token?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_count?: number
          created_at?: string
          document_id?: string
          expires_at?: string
          id?: string
          last_accessed_at?: string | null
          revoked_at?: string | null
          share_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_document_shares_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "commercial_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_documents: {
        Row: {
          amount_paid: number
          balance_due: number
          client_id: string | null
          created_at: string
          currency: string
          discount_amount: number
          document_number: string
          document_type: string
          due_date: string | null
          id: string
          issue_date: string
          metadata: Json
          notes: string | null
          paid_date: string | null
          quote_source_id: string | null
          recipient_email: string | null
          recipient_name: string
          recipient_phone: string | null
          role: string
          status: string
          subtotal: number
          tax_amount: number
          terms: string | null
          title: string
          total_amount: number
          updated_at: string
          user_id: string
          vendor_id: string | null
          vendor_listing_id: string | null
          wedding_name: string | null
        }
        Insert: {
          amount_paid?: number
          balance_due?: number
          client_id?: string | null
          created_at?: string
          currency?: string
          discount_amount?: number
          document_number: string
          document_type: string
          due_date?: string | null
          id?: string
          issue_date?: string
          metadata?: Json
          notes?: string | null
          paid_date?: string | null
          quote_source_id?: string | null
          recipient_email?: string | null
          recipient_name: string
          recipient_phone?: string | null
          role: string
          status: string
          subtotal?: number
          tax_amount?: number
          terms?: string | null
          title: string
          total_amount?: number
          updated_at?: string
          user_id: string
          vendor_id?: string | null
          vendor_listing_id?: string | null
          wedding_name?: string | null
        }
        Update: {
          amount_paid?: number
          balance_due?: number
          client_id?: string | null
          created_at?: string
          currency?: string
          discount_amount?: number
          document_number?: string
          document_type?: string
          due_date?: string | null
          id?: string
          issue_date?: string
          metadata?: Json
          notes?: string | null
          paid_date?: string | null
          quote_source_id?: string | null
          recipient_email?: string | null
          recipient_name?: string
          recipient_phone?: string | null
          role?: string
          status?: string
          subtotal?: number
          tax_amount?: number
          terms?: string | null
          title?: string
          total_amount?: number
          updated_at?: string
          user_id?: string
          vendor_id?: string | null
          vendor_listing_id?: string | null
          wedding_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commercial_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "planner_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_documents_quote_source_id_fkey"
            columns: ["quote_source_id"]
            isOneToOne: false
            referencedRelation: "commercial_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_documents_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_documents_vendor_listing_id_fkey"
            columns: ["vendor_listing_id"]
            isOneToOne: false
            referencedRelation: "vendor_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      contribution_rounds: {
        Row: {
          client_id: string | null
          created_at: string
          ends_on: string | null
          goal_amount: number
          id: string
          is_active: boolean
          notes: string | null
          starts_on: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          ends_on?: string | null
          goal_amount?: number
          id?: string
          is_active?: boolean
          notes?: string | null
          starts_on?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          ends_on?: string | null
          goal_amount?: number
          id?: string
          is_active?: boolean
          notes?: string | null
          starts_on?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contribution_rounds_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "planner_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      contribution_summary_shares: {
        Row: {
          access_count: number
          client_id: string | null
          created_at: string
          expires_at: string
          id: string
          last_accessed_at: string | null
          revoked_at: string | null
          share_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_count?: number
          client_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          last_accessed_at?: string | null
          revoked_at?: string | null
          share_token?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_count?: number
          client_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          last_accessed_at?: string | null
          revoked_at?: string | null
          share_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contribution_summary_shares_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "planner_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      device_sessions: {
        Row: {
          app_installation_id: string | null
          browser: string | null
          device_id: string
          device_name: string | null
          first_seen_at: string
          id: string
          is_current: boolean
          last_approximate_location: string | null
          last_ip_hash: string | null
          last_seen_at: string
          metadata: Json
          platform: string | null
          push_token: string | null
          revoked_at: string | null
          trusted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          app_installation_id?: string | null
          browser?: string | null
          device_id: string
          device_name?: string | null
          first_seen_at?: string
          id?: string
          is_current?: boolean
          last_approximate_location?: string | null
          last_ip_hash?: string | null
          last_seen_at?: string
          metadata?: Json
          platform?: string | null
          push_token?: string | null
          revoked_at?: string | null
          trusted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          app_installation_id?: string | null
          browser?: string | null
          device_id?: string
          device_name?: string | null
          first_seen_at?: string
          id?: string
          is_current?: boolean
          last_approximate_location?: string | null
          last_ip_hash?: string | null
          last_seen_at?: string
          metadata?: Json
          platform?: string | null
          push_token?: string | null
          revoked_at?: string | null
          trusted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      device_verification_challenges: {
        Row: {
          attempt_count: number
          auth_session_id: string | null
          created_at: string
          device_session_id: string
          expires_at: string
          id: string
          last_attempt_at: string | null
          max_attempts: number
          metadata: Json
          otp_code_hash: string
          otp_purpose: string
          resend_available_at: string
          status: string
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          attempt_count?: number
          auth_session_id?: string | null
          created_at?: string
          device_session_id: string
          expires_at: string
          id?: string
          last_attempt_at?: string | null
          max_attempts?: number
          metadata?: Json
          otp_code_hash: string
          otp_purpose?: string
          resend_available_at: string
          status?: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          attempt_count?: number
          auth_session_id?: string | null
          created_at?: string
          device_session_id?: string
          expires_at?: string
          id?: string
          last_attempt_at?: string | null
          max_attempts?: number
          metadata?: Json
          otp_code_hash?: string
          otp_purpose?: string
          resend_available_at?: string
          status?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_verification_challenges_device_session_id_fkey"
            columns: ["device_session_id"]
            isOneToOne: false
            referencedRelation: "device_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      document_requests: {
        Row: {
          budget_amount: number | null
          client_id: string | null
          created_at: string
          due_at: string | null
          event_date: string | null
          id: string
          message: string | null
          metadata: Json
          recipient_name: string
          recipient_role: string
          recipient_user_id: string
          request_type: string
          requester_email: string | null
          requester_name: string
          requester_phone: string | null
          requester_role: string
          requester_user_id: string
          responded_at: string | null
          response_contract_id: string | null
          response_document_id: string | null
          service_category: string | null
          status: string
          title: string
          updated_at: string
          vendor_id: string | null
          vendor_listing_id: string | null
          viewed_at: string | null
          wedding_id: string | null
          wedding_name: string | null
        }
        Insert: {
          budget_amount?: number | null
          client_id?: string | null
          created_at?: string
          due_at?: string | null
          event_date?: string | null
          id?: string
          message?: string | null
          metadata?: Json
          recipient_name: string
          recipient_role: string
          recipient_user_id: string
          request_type: string
          requester_email?: string | null
          requester_name: string
          requester_phone?: string | null
          requester_role: string
          requester_user_id: string
          responded_at?: string | null
          response_contract_id?: string | null
          response_document_id?: string | null
          service_category?: string | null
          status?: string
          title: string
          updated_at?: string
          vendor_id?: string | null
          vendor_listing_id?: string | null
          viewed_at?: string | null
          wedding_id?: string | null
          wedding_name?: string | null
        }
        Update: {
          budget_amount?: number | null
          client_id?: string | null
          created_at?: string
          due_at?: string | null
          event_date?: string | null
          id?: string
          message?: string | null
          metadata?: Json
          recipient_name?: string
          recipient_role?: string
          recipient_user_id?: string
          request_type?: string
          requester_email?: string | null
          requester_name?: string
          requester_phone?: string | null
          requester_role?: string
          requester_user_id?: string
          responded_at?: string | null
          response_contract_id?: string | null
          response_document_id?: string | null
          service_category?: string | null
          status?: string
          title?: string
          updated_at?: string
          vendor_id?: string | null
          vendor_listing_id?: string | null
          viewed_at?: string | null
          wedding_id?: string | null
          wedding_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "planner_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requests_response_contract_id_fkey"
            columns: ["response_contract_id"]
            isOneToOne: false
            referencedRelation: "professional_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requests_response_document_id_fkey"
            columns: ["response_document_id"]
            isOneToOne: false
            referencedRelation: "commercial_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requests_vendor_listing_id_fkey"
            columns: ["vendor_listing_id"]
            isOneToOne: false
            referencedRelation: "vendor_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requests_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      function_event_logs: {
        Row: {
          audience: string | null
          created_at: string
          details: Json
          entity_id: string | null
          event_type: string
          function_name: string
          id: string
          message: string
          request_id: string | null
          severity: string
          status: string
          user_id: string | null
        }
        Insert: {
          audience?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          event_type: string
          function_name: string
          id?: string
          message: string
          request_id?: string | null
          severity: string
          status: string
          user_id?: string | null
        }
        Update: {
          audience?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          event_type?: string
          function_name?: string
          id?: string
          message?: string
          request_id?: string | null
          severity?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      guest_check_in_events: {
        Row: {
          action: string
          created_at: string
          guest_id: string
          id: string
          idempotency_key: string
          metadata: Json
          performed_by_device_id: string | null
          performed_by_user_id: string | null
          source: string
          wedding_id: string
        }
        Insert: {
          action: string
          created_at?: string
          guest_id: string
          id?: string
          idempotency_key: string
          metadata?: Json
          performed_by_device_id?: string | null
          performed_by_user_id?: string | null
          source?: string
          wedding_id: string
        }
        Update: {
          action?: string
          created_at?: string
          guest_id?: string
          id?: string
          idempotency_key?: string
          metadata?: Json
          performed_by_device_id?: string | null
          performed_by_user_id?: string | null
          source?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_check_in_events_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_check_in_events_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
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
          invite_last_sent_at: string | null
          invite_last_sent_by_user_id: string | null
          invite_send_count: number
          meal_preference: string | null
          name: string
          phone: string | null
          plus_one: boolean | null
          rsvp_last_responded_at: string | null
          rsvp_last_viewed_at: string | null
          rsvp_status: string | null
          rsvp_token: string
          rsvp_token_expires_at: string | null
          rsvp_token_revoked_at: string | null
          table_number: number | null
          user_id: string
          wedding_id: string | null
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
          invite_last_sent_at?: string | null
          invite_last_sent_by_user_id?: string | null
          invite_send_count?: number
          meal_preference?: string | null
          name: string
          phone?: string | null
          plus_one?: boolean | null
          rsvp_last_responded_at?: string | null
          rsvp_last_viewed_at?: string | null
          rsvp_status?: string | null
          rsvp_token?: string
          rsvp_token_expires_at?: string | null
          rsvp_token_revoked_at?: string | null
          table_number?: number | null
          user_id: string
          wedding_id?: string | null
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
          invite_last_sent_at?: string | null
          invite_last_sent_by_user_id?: string | null
          invite_send_count?: number
          meal_preference?: string | null
          name?: string
          phone?: string | null
          plus_one?: boolean | null
          rsvp_last_responded_at?: string | null
          rsvp_last_viewed_at?: string | null
          rsvp_status?: string | null
          rsvp_token?: string
          rsvp_token_expires_at?: string | null
          rsvp_token_revoked_at?: string | null
          table_number?: number | null
          user_id?: string
          wedding_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "planner_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guests_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_briefs: {
        Row: {
          budget_max_kes: number | null
          budget_min_kes: number | null
          created_at: string
          estimated_guest_count: number | null
          lead_request_id: string
          location_county: string | null
          location_town: string | null
          request_note: string | null
          top_priorities: string[]
          wedding_date: string
          wedding_type: string | null
        }
        Insert: {
          budget_max_kes?: number | null
          budget_min_kes?: number | null
          created_at?: string
          estimated_guest_count?: number | null
          lead_request_id: string
          location_county?: string | null
          location_town?: string | null
          request_note?: string | null
          top_priorities?: string[]
          wedding_date: string
          wedding_type?: string | null
        }
        Update: {
          budget_max_kes?: number | null
          budget_min_kes?: number | null
          created_at?: string
          estimated_guest_count?: number | null
          lead_request_id?: string
          location_county?: string | null
          location_town?: string | null
          request_note?: string | null
          top_priorities?: string[]
          wedding_date?: string
          wedding_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_briefs_lead_request_id_fkey"
            columns: ["lead_request_id"]
            isOneToOne: true
            referencedRelation: "lead_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_contact_reveals: {
        Row: {
          couple_email: string | null
          couple_name: string | null
          couple_phone: string | null
          match_id: string
          revealed_at: string
        }
        Insert: {
          couple_email?: string | null
          couple_name?: string | null
          couple_phone?: string | null
          match_id: string
          revealed_at?: string
        }
        Update: {
          couple_email?: string | null
          couple_name?: string | null
          couple_phone?: string | null
          match_id?: string
          revealed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_contact_reveals_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "lead_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_match_notification_deliveries: {
        Row: {
          action_path: string
          attempts: number
          available_at: string
          category_key: string
          created_at: string
          id: string
          last_error: string | null
          lead_request_id: string
          recipient_role: string
          recipient_user_id: string
          resend_email_id: string | null
          sent_at: string | null
          status: string
          updated_at: string
          wedding_name: string
        }
        Insert: {
          action_path: string
          attempts?: number
          available_at?: string
          category_key: string
          created_at?: string
          id?: string
          last_error?: string | null
          lead_request_id: string
          recipient_role: string
          recipient_user_id: string
          resend_email_id?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          wedding_name: string
        }
        Update: {
          action_path?: string
          attempts?: number
          available_at?: string
          category_key?: string
          created_at?: string
          id?: string
          last_error?: string | null
          lead_request_id?: string
          recipient_role?: string
          recipient_user_id?: string
          resend_email_id?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          wedding_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_match_notification_deliveries_lead_request_id_fkey"
            columns: ["lead_request_id"]
            isOneToOne: false
            referencedRelation: "lead_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_matches: {
        Row: {
          id: string
          invited_at: string
          lead_request_id: string
          match_reasons: string[]
          match_score: number
          provider_category: string
          provider_name: string
          provider_type: string
          provider_user_id: string
          responded_at: string | null
          selected_at: string | null
          status: string
          vendor_listing_id: string | null
        }
        Insert: {
          id?: string
          invited_at?: string
          lead_request_id: string
          match_reasons?: string[]
          match_score?: number
          provider_category: string
          provider_name: string
          provider_type: string
          provider_user_id: string
          responded_at?: string | null
          selected_at?: string | null
          status?: string
          vendor_listing_id?: string | null
        }
        Update: {
          id?: string
          invited_at?: string
          lead_request_id?: string
          match_reasons?: string[]
          match_score?: number
          provider_category?: string
          provider_name?: string
          provider_type?: string
          provider_user_id?: string
          responded_at?: string | null
          selected_at?: string | null
          status?: string
          vendor_listing_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_matches_lead_request_id_fkey"
            columns: ["lead_request_id"]
            isOneToOne: false
            referencedRelation: "lead_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_matches_vendor_listing_id_fkey"
            columns: ["vendor_listing_id"]
            isOneToOne: false
            referencedRelation: "vendor_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          match_id: string
          sender_side: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          match_id: string
          sender_side: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          match_id?: string
          sender_side?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_messages_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "lead_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_offers: {
        Row: {
          amount_kes: number
          created_at: string
          id: string
          match_id: string
          status: string
          summary: string
          valid_until: string | null
        }
        Insert: {
          amount_kes: number
          created_at?: string
          id?: string
          match_id: string
          status?: string
          summary: string
          valid_until?: string | null
        }
        Update: {
          amount_kes?: number
          created_at?: string
          id?: string
          match_id?: string
          status?: string
          summary?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_offers_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "lead_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_prompt_states: {
        Row: {
          category_key: string
          next_prompt_at: string | null
          provider_type: string
          state: string
          updated_at: string
          wedding_id: string
        }
        Insert: {
          category_key: string
          next_prompt_at?: string | null
          provider_type: string
          state: string
          updated_at?: string
          wedding_id: string
        }
        Update: {
          category_key?: string
          next_prompt_at?: string | null
          provider_type?: string
          state?: string
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_prompt_states_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_requests: {
        Row: {
          category_key: string
          created_at: string
          expires_at: string
          id: string
          max_invites: number
          max_matches: number
          provider_type: string
          requested_by_user_id: string
          status: string
          updated_at: string
          wedding_id: string
        }
        Insert: {
          category_key: string
          created_at?: string
          expires_at?: string
          id?: string
          max_invites?: number
          max_matches?: number
          provider_type: string
          requested_by_user_id: string
          status?: string
          updated_at?: string
          wedding_id: string
        }
        Update: {
          category_key?: string
          created_at?: string
          expires_at?: string
          id?: string
          max_invites?: number
          max_matches?: number
          provider_type?: string
          requested_by_user_id?: string
          status?: string
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_requests_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_audit_events: {
        Row: {
          attempt_count: number
          created_at: string
          delivery_channel: string | null
          device_session_id: string | null
          id: string
          ip_hash: string | null
          metadata: Json
          otp_purpose: string
          phone_number_hash: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          delivery_channel?: string | null
          device_session_id?: string | null
          id?: string
          ip_hash?: string | null
          metadata?: Json
          otp_purpose: string
          phone_number_hash?: string | null
          status: string
          user_id?: string | null
        }
        Update: {
          attempt_count?: number
          created_at?: string
          delivery_channel?: string | null
          device_session_id?: string | null
          id?: string
          ip_hash?: string | null
          metadata?: Json
          otp_purpose?: string
          phone_number_hash?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          amount: number
          audience: string
          callback_url: string | null
          cancel_url: string | null
          confirmation_code: string | null
          created_at: string
          currency: string
          feature: string | null
          id: string
          lookup_key: string
          merchant_reference: string
          metadata: Json
          notification_id: string | null
          payment_account: string | null
          payment_method: string | null
          provider: string
          provider_created_at: string | null
          provider_reference: string | null
          provider_status_code: string | null
          provider_status_description: string | null
          raw_request: Json
          raw_response: Json
          redirect_url: string | null
          status: string
          updated_at: string
          user_id: string
          wedding_id: string | null
        }
        Insert: {
          amount: number
          audience: string
          callback_url?: string | null
          cancel_url?: string | null
          confirmation_code?: string | null
          created_at?: string
          currency?: string
          feature?: string | null
          id?: string
          lookup_key: string
          merchant_reference: string
          metadata?: Json
          notification_id?: string | null
          payment_account?: string | null
          payment_method?: string | null
          provider: string
          provider_created_at?: string | null
          provider_reference?: string | null
          provider_status_code?: string | null
          provider_status_description?: string | null
          raw_request?: Json
          raw_response?: Json
          redirect_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
          wedding_id?: string | null
        }
        Update: {
          amount?: number
          audience?: string
          callback_url?: string | null
          cancel_url?: string | null
          confirmation_code?: string | null
          created_at?: string
          currency?: string
          feature?: string | null
          id?: string
          lookup_key?: string
          merchant_reference?: string
          metadata?: Json
          notification_id?: string | null
          payment_account?: string | null
          payment_method?: string | null
          provider?: string
          provider_created_at?: string | null
          provider_reference?: string | null
          provider_status_code?: string | null
          provider_status_description?: string | null
          raw_request?: Json
          raw_response?: Json
          redirect_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          wedding_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      planner_change_requests: {
        Row: {
          change_type: string
          client_id: string
          couple_user_id: string
          created_at: string
          current_payload: Json | null
          id: string
          note: string | null
          planner_user_id: string
          proposed_payload: Json
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_id: string | null
          target_table: string
          updated_at: string
        }
        Insert: {
          change_type: string
          client_id: string
          couple_user_id: string
          created_at?: string
          current_payload?: Json | null
          id?: string
          note?: string | null
          planner_user_id: string
          proposed_payload?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_id?: string | null
          target_table: string
          updated_at?: string
        }
        Update: {
          change_type?: string
          client_id?: string
          couple_user_id?: string
          created_at?: string
          current_payload?: Json | null
          id?: string
          note?: string | null
          planner_user_id?: string
          proposed_payload?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_id?: string | null
          target_table?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planner_change_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "planner_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      planner_clients: {
        Row: {
          archived_at: string | null
          archived_by_user_id: string | null
          client_name: string
          created_at: string
          email: string | null
          expected_guest_count: number | null
          id: string
          is_archived: boolean
          linked_user_id: string | null
          notes: string | null
          partner_name: string | null
          phone: string | null
          planner_user_id: string
          updated_at: string
          wedding_budget_goal: number | null
          wedding_date: string | null
          wedding_id: string | null
          wedding_location: string | null
          workspace_status: string
        }
        Insert: {
          archived_at?: string | null
          archived_by_user_id?: string | null
          client_name: string
          created_at?: string
          email?: string | null
          expected_guest_count?: number | null
          id?: string
          is_archived?: boolean
          linked_user_id?: string | null
          notes?: string | null
          partner_name?: string | null
          phone?: string | null
          planner_user_id: string
          updated_at?: string
          wedding_budget_goal?: number | null
          wedding_date?: string | null
          wedding_id?: string | null
          wedding_location?: string | null
          workspace_status?: string
        }
        Update: {
          archived_at?: string | null
          archived_by_user_id?: string | null
          client_name?: string
          created_at?: string
          email?: string | null
          expected_guest_count?: number | null
          id?: string
          is_archived?: boolean
          linked_user_id?: string | null
          notes?: string | null
          partner_name?: string | null
          phone?: string | null
          planner_user_id?: string
          updated_at?: string
          wedding_budget_goal?: number | null
          wedding_date?: string | null
          wedding_id?: string | null
          wedding_location?: string | null
          workspace_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "planner_clients_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      planner_free_wedding_entitlements: {
        Row: {
          business_identity_key: string
          created_at: string
          locked_became_meaningful_at: string | null
          locked_client_id: string | null
          locked_relationship_key: string | null
          locked_wedding_id: string | null
          planner_user_id: string
          released_at: string | null
          released_test_client_id: string | null
          replacement_used: boolean
          updated_at: string
        }
        Insert: {
          business_identity_key: string
          created_at?: string
          locked_became_meaningful_at?: string | null
          locked_client_id?: string | null
          locked_relationship_key?: string | null
          locked_wedding_id?: string | null
          planner_user_id: string
          released_at?: string | null
          released_test_client_id?: string | null
          replacement_used?: boolean
          updated_at?: string
        }
        Update: {
          business_identity_key?: string
          created_at?: string
          locked_became_meaningful_at?: string | null
          locked_client_id?: string | null
          locked_relationship_key?: string | null
          locked_wedding_id?: string | null
          planner_user_id?: string
          released_at?: string | null
          released_test_client_id?: string | null
          replacement_used?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planner_free_wedding_entitlements_locked_client_id_fkey"
            columns: ["locked_client_id"]
            isOneToOne: false
            referencedRelation: "planner_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planner_free_wedding_entitlements_locked_wedding_id_fkey"
            columns: ["locked_wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planner_free_wedding_entitlements_released_test_client_id_fkey"
            columns: ["released_test_client_id"]
            isOneToOne: false
            referencedRelation: "planner_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      planner_link_requests: {
        Row: {
          couple_user_id: string
          created_at: string
          id: string
          message: string | null
          planner_user_id: string
          request_source: string
          status: string
          updated_at: string
        }
        Insert: {
          couple_user_id: string
          created_at?: string
          id?: string
          message?: string | null
          planner_user_id: string
          request_source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          couple_user_id?: string
          created_at?: string
          id?: string
          message?: string | null
          planner_user_id?: string
          request_source?: string
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
      pricing_catalog: {
        Row: {
          catalog_key: string
          config: Json
          created_at: string
          display_name: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          catalog_key: string
          config?: Json
          created_at?: string
          display_name: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          catalog_key?: string
          config?: Json
          created_at?: string
          display_name?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      pricing_catalog_revisions: {
        Row: {
          catalog_key: string
          change_source: string
          config: Json
          created_at: string
          created_by_user_id: string | null
          display_name: string
          id: string
        }
        Insert: {
          catalog_key: string
          change_source?: string
          config?: Json
          created_at?: string
          created_by_user_id?: string | null
          display_name: string
          id?: string
        }
        Update: {
          catalog_key?: string
          change_source?: string
          config?: Json
          created_at?: string
          created_by_user_id?: string | null
          display_name?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_catalog_revisions_catalog_key_fkey"
            columns: ["catalog_key"]
            isOneToOne: false
            referencedRelation: "pricing_catalog"
            referencedColumns: ["catalog_key"]
          },
        ]
      }
      professional_contract_events: {
        Row: {
          actor_email: string | null
          actor_name: string | null
          actor_source: string
          contract_id: string
          created_at: string
          event_type: string
          id: string
          payload: Json
        }
        Insert: {
          actor_email?: string | null
          actor_name?: string | null
          actor_source?: string
          contract_id: string
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
        }
        Update: {
          actor_email?: string | null
          actor_name?: string | null
          actor_source?: string
          contract_id?: string
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "professional_contract_events_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "professional_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_contract_shares: {
        Row: {
          access_count: number
          contract_id: string
          created_at: string
          expires_at: string | null
          id: string
          last_accessed_at: string | null
          revoked_at: string | null
          share_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_count?: number
          contract_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          last_accessed_at?: string | null
          revoked_at?: string | null
          share_token?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_count?: number
          contract_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          last_accessed_at?: string | null
          revoked_at?: string | null
          share_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_contract_shares_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: true
            referencedRelation: "professional_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_contract_signers: {
        Row: {
          contract_id: string
          created_at: string
          id: string
          metadata: Json
          signature_method: string
          signed_at: string | null
          signed_name: string | null
          signer_email: string | null
          signer_name: string
          signer_role: string
          signer_title: string | null
          updated_at: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          id?: string
          metadata?: Json
          signature_method?: string
          signed_at?: string | null
          signed_name?: string | null
          signer_email?: string | null
          signer_name: string
          signer_role: string
          signer_title?: string | null
          updated_at?: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          signature_method?: string
          signed_at?: string | null
          signed_name?: string | null
          signer_email?: string | null
          signer_name?: string
          signer_role?: string
          signer_title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_contract_signers_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "professional_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_contracts: {
        Row: {
          cancelled_at: string | null
          client_id: string | null
          created_at: string
          event_date: string | null
          id: string
          metadata: Json
          notes: string | null
          recipient_email: string | null
          recipient_name: string
          recipient_phone: string | null
          role: string
          sent_at: string | null
          signed_at: string | null
          status: string
          summary: string | null
          terms: string | null
          title: string
          updated_at: string
          user_id: string
          vendor_id: string | null
          vendor_listing_id: string | null
          wedding_name: string | null
        }
        Insert: {
          cancelled_at?: string | null
          client_id?: string | null
          created_at?: string
          event_date?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          recipient_email?: string | null
          recipient_name: string
          recipient_phone?: string | null
          role: string
          sent_at?: string | null
          signed_at?: string | null
          status?: string
          summary?: string | null
          terms?: string | null
          title: string
          updated_at?: string
          user_id?: string
          vendor_id?: string | null
          vendor_listing_id?: string | null
          wedding_name?: string | null
        }
        Update: {
          cancelled_at?: string | null
          client_id?: string | null
          created_at?: string
          event_date?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          recipient_email?: string | null
          recipient_name?: string
          recipient_phone?: string | null
          role?: string
          sent_at?: string | null
          signed_at?: string | null
          status?: string
          summary?: string | null
          terms?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          vendor_id?: string | null
          vendor_listing_id?: string | null
          wedding_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professional_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "planner_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_contracts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_contracts_vendor_listing_id_fkey"
            columns: ["vendor_listing_id"]
            isOneToOne: false
            referencedRelation: "vendor_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_document_templates: {
        Row: {
          created_at: string
          default_items: Json
          default_notes: string | null
          default_terms: string | null
          default_title: string | null
          description: string | null
          id: string
          metadata: Json
          name: string
          role: string
          template_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_items?: Json
          default_notes?: string | null
          default_terms?: string | null
          default_title?: string | null
          description?: string | null
          id?: string
          metadata?: Json
          name: string
          role: string
          template_type: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          default_items?: Json
          default_notes?: string | null
          default_terms?: string | null
          default_title?: string | null
          description?: string | null
          id?: string
          metadata?: Json
          name?: string
          role?: string
          template_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      professional_entitlements: {
        Row: {
          audience: string
          created_at: string
          effective_from: string
          effective_to: string | null
          feature_key: string
          id: string
          metadata: Json
          seat_limit: number | null
          source_bundle_code: string | null
          source_lookup_key: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          audience: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          feature_key: string
          id?: string
          metadata?: Json
          seat_limit?: number | null
          source_bundle_code?: string | null
          source_lookup_key?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          audience?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          feature_key?: string
          id?: string
          metadata?: Json
          seat_limit?: number | null
          source_bundle_code?: string | null
          source_lookup_key?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      professional_exchange_answers: {
        Row: {
          author_role: Database["public"]["Enums"]["app_role"]
          author_user_id: string
          author_vendor_listing_id: string | null
          body: string
          created_at: string
          id: string
          question_id: string
          updated_at: string
        }
        Insert: {
          author_role: Database["public"]["Enums"]["app_role"]
          author_user_id: string
          author_vendor_listing_id?: string | null
          body: string
          created_at?: string
          id?: string
          question_id: string
          updated_at?: string
        }
        Update: {
          author_role?: Database["public"]["Enums"]["app_role"]
          author_user_id?: string
          author_vendor_listing_id?: string | null
          body?: string
          created_at?: string
          id?: string
          question_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_exchange_answers_author_vendor_listing_id_fkey"
            columns: ["author_vendor_listing_id"]
            isOneToOne: false
            referencedRelation: "vendor_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_exchange_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "professional_exchange_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_exchange_questions: {
        Row: {
          author_role: Database["public"]["Enums"]["app_role"]
          author_user_id: string
          author_vendor_listing_id: string | null
          best_answer_id: string | null
          body: string
          category: string
          created_at: string
          id: string
          is_resolved: boolean
          location_county: string | null
          title: string
          updated_at: string
          urgency: string
        }
        Insert: {
          author_role: Database["public"]["Enums"]["app_role"]
          author_user_id: string
          author_vendor_listing_id?: string | null
          best_answer_id?: string | null
          body: string
          category: string
          created_at?: string
          id?: string
          is_resolved?: boolean
          location_county?: string | null
          title: string
          updated_at?: string
          urgency?: string
        }
        Update: {
          author_role?: Database["public"]["Enums"]["app_role"]
          author_user_id?: string
          author_vendor_listing_id?: string | null
          best_answer_id?: string | null
          body?: string
          category?: string
          created_at?: string
          id?: string
          is_resolved?: boolean
          location_county?: string | null
          title?: string
          updated_at?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_exchange_questions_author_vendor_listing_id_fkey"
            columns: ["author_vendor_listing_id"]
            isOneToOne: false
            referencedRelation: "vendor_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_exchange_questions_best_answer_fk"
            columns: ["best_answer_id"]
            isOneToOne: false
            referencedRelation: "professional_exchange_answers"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_network_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          sender_role: Database["public"]["Enums"]["app_role"]
          sender_user_id: string
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sender_role: Database["public"]["Enums"]["app_role"]
          sender_user_id: string
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sender_role?: Database["public"]["Enums"]["app_role"]
          sender_user_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_network_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "professional_network_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_network_recommendation_requests: {
        Row: {
          created_at: string
          id: string
          recipient_user_id: string
          recipient_vendor_listing_id: string | null
          request_message: string | null
          requested_relationship_type: string
          requester_role: Database["public"]["Enums"]["app_role"]
          requester_user_id: string
          requester_vendor_listing_id: string | null
          responded_at: string | null
          response_note: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          recipient_user_id: string
          recipient_vendor_listing_id?: string | null
          request_message?: string | null
          requested_relationship_type: string
          requester_role: Database["public"]["Enums"]["app_role"]
          requester_user_id: string
          requester_vendor_listing_id?: string | null
          responded_at?: string | null
          response_note?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          recipient_user_id?: string
          recipient_vendor_listing_id?: string | null
          request_message?: string | null
          requested_relationship_type?: string
          requester_role?: Database["public"]["Enums"]["app_role"]
          requester_user_id?: string
          requester_vendor_listing_id?: string | null
          responded_at?: string | null
          response_note?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_network_recommend_recipient_vendor_listing_id_fkey"
            columns: ["recipient_vendor_listing_id"]
            isOneToOne: false
            referencedRelation: "vendor_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_network_recommend_requester_vendor_listing_id_fkey"
            columns: ["requester_vendor_listing_id"]
            isOneToOne: false
            referencedRelation: "vendor_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_network_relationships: {
        Row: {
          active: boolean
          created_at: string
          id: string
          is_public: boolean
          note: string | null
          relationship_type: string
          source_role: Database["public"]["Enums"]["app_role"]
          source_user_id: string
          target_acknowledged: boolean
          target_acknowledged_at: string | null
          target_user_id: string | null
          target_vendor_listing_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          is_public?: boolean
          note?: string | null
          relationship_type: string
          source_role: Database["public"]["Enums"]["app_role"]
          source_user_id: string
          target_acknowledged?: boolean
          target_acknowledged_at?: string | null
          target_user_id?: string | null
          target_vendor_listing_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          is_public?: boolean
          note?: string | null
          relationship_type?: string
          source_role?: Database["public"]["Enums"]["app_role"]
          source_user_id?: string
          target_acknowledged?: boolean
          target_acknowledged_at?: string | null
          target_user_id?: string | null
          target_vendor_listing_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_network_relationship_target_vendor_listing_id_fkey"
            columns: ["target_vendor_listing_id"]
            isOneToOne: false
            referencedRelation: "vendor_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_network_threads: {
        Row: {
          archived_by_planner: boolean
          archived_by_vendor: boolean
          context_type: string
          created_at: string
          created_by_role: Database["public"]["Enums"]["app_role"]
          created_by_user_id: string
          id: string
          last_message_at: string
          planner_user_id: string
          subject: string
          updated_at: string
          vendor_listing_id: string
          vendor_user_id: string
        }
        Insert: {
          archived_by_planner?: boolean
          archived_by_vendor?: boolean
          context_type?: string
          created_at?: string
          created_by_role: Database["public"]["Enums"]["app_role"]
          created_by_user_id: string
          id?: string
          last_message_at?: string
          planner_user_id: string
          subject: string
          updated_at?: string
          vendor_listing_id: string
          vendor_user_id: string
        }
        Update: {
          archived_by_planner?: boolean
          archived_by_vendor?: boolean
          context_type?: string
          created_at?: string
          created_by_role?: Database["public"]["Enums"]["app_role"]
          created_by_user_id?: string
          id?: string
          last_message_at?: string
          planner_user_id?: string
          subject?: string
          updated_at?: string
          vendor_listing_id?: string
          vendor_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_network_threads_vendor_listing_id_fkey"
            columns: ["vendor_listing_id"]
            isOneToOne: false
            referencedRelation: "vendor_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_review_invites: {
        Row: {
          couple_email: string
          couple_name: string
          created_at: string
          expires_at: string
          id: string
          planner_profile_id: string | null
          professional_name: string
          professional_type: string
          professional_user_id: string
          status: string
          token_hash: string
          updated_at: string
          used_at: string | null
          vendor_listing_id: string | null
        }
        Insert: {
          couple_email: string
          couple_name: string
          created_at?: string
          expires_at?: string
          id?: string
          planner_profile_id?: string | null
          professional_name: string
          professional_type: string
          professional_user_id: string
          status?: string
          token_hash: string
          updated_at?: string
          used_at?: string | null
          vendor_listing_id?: string | null
        }
        Update: {
          couple_email?: string
          couple_name?: string
          created_at?: string
          expires_at?: string
          id?: string
          planner_profile_id?: string | null
          professional_name?: string
          professional_type?: string
          professional_user_id?: string
          status?: string
          token_hash?: string
          updated_at?: string
          used_at?: string | null
          vendor_listing_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professional_review_invites_planner_profile_id_fkey"
            columns: ["planner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_review_invites_planner_profile_id_fkey"
            columns: ["planner_profile_id"]
            isOneToOne: false
            referencedRelation: "public_planner_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_review_invites_vendor_listing_id_fkey"
            columns: ["vendor_listing_id"]
            isOneToOne: false
            referencedRelation: "vendor_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_reviews: {
        Row: {
          created_at: string
          id: string
          invite_id: string
          planner_profile_id: string | null
          professional_reply: string | null
          professional_type: string
          professional_user_id: string
          published_at: string | null
          rating: number
          replied_at: string | null
          review_text: string | null
          reviewer_name: string
          status: string
          updated_at: string
          vendor_listing_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invite_id: string
          planner_profile_id?: string | null
          professional_reply?: string | null
          professional_type: string
          professional_user_id: string
          published_at?: string | null
          rating: number
          replied_at?: string | null
          review_text?: string | null
          reviewer_name: string
          status?: string
          updated_at?: string
          vendor_listing_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invite_id?: string
          planner_profile_id?: string | null
          professional_reply?: string | null
          professional_type?: string
          professional_user_id?: string
          published_at?: string | null
          rating?: number
          replied_at?: string | null
          review_text?: string | null
          reviewer_name?: string
          status?: string
          updated_at?: string
          vendor_listing_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professional_reviews_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: true
            referencedRelation: "professional_review_invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_reviews_planner_profile_id_fkey"
            columns: ["planner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_reviews_planner_profile_id_fkey"
            columns: ["planner_profile_id"]
            isOneToOne: false
            referencedRelation: "public_planner_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_reviews_vendor_listing_id_fkey"
            columns: ["vendor_listing_id"]
            isOneToOne: false
            referencedRelation: "vendor_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_purpose: string | null
          avatar_url: string | null
          beta_trial_expires_at: string | null
          beta_trial_started_at: string | null
          beta_trial_status: string
          bio: string | null
          collaboration_code: string | null
          committee_name: string | null
          company_email: string | null
          company_name: string | null
          company_phone: string | null
          company_website: string | null
          created_at: string
          directory_opt_out: boolean
          directory_opt_out_at: string | null
          expected_guest_count: number | null
          founding_planner_contributor: boolean
          free_wedding_replacement_used: boolean
          full_name: string | null
          id: string
          last_risk_calculated_at: string | null
          marketing_opt_out: boolean
          marketing_opt_out_at: string | null
          maximum_budget_kes: number | null
          minimum_budget_kes: number | null
          partner_name: string | null
          planner_subscription_expires_at: string | null
          planner_subscription_started_at: string | null
          planner_subscription_status: string
          planner_type: string | null
          planner_verification_requested: boolean
          planner_verification_requested_at: string | null
          planner_verified: boolean
          planning_pass_expires_at: string | null
          planning_pass_started_at: string | null
          planning_pass_status: string
          primary_county: string | null
          primary_town: string | null
          privacy_data_deleted_at: string | null
          professional_use_risk_level: string
          professional_use_risk_score: number
          role: Database["public"]["Enums"]["app_role"]
          service_areas: string[]
          specialties: string[] | null
          support_review_notes: string | null
          support_review_status: string
          travel_scope: string
          updated_at: string
          user_id: string
          verified_couple: boolean
          wedding_budget_goal: number | null
          wedding_county: string | null
          wedding_date: string | null
          wedding_location: string | null
          wedding_town: string | null
        }
        Insert: {
          account_purpose?: string | null
          avatar_url?: string | null
          beta_trial_expires_at?: string | null
          beta_trial_started_at?: string | null
          beta_trial_status?: string
          bio?: string | null
          collaboration_code?: string | null
          committee_name?: string | null
          company_email?: string | null
          company_name?: string | null
          company_phone?: string | null
          company_website?: string | null
          created_at?: string
          directory_opt_out?: boolean
          directory_opt_out_at?: string | null
          expected_guest_count?: number | null
          founding_planner_contributor?: boolean
          free_wedding_replacement_used?: boolean
          full_name?: string | null
          id?: string
          last_risk_calculated_at?: string | null
          marketing_opt_out?: boolean
          marketing_opt_out_at?: string | null
          maximum_budget_kes?: number | null
          minimum_budget_kes?: number | null
          partner_name?: string | null
          planner_subscription_expires_at?: string | null
          planner_subscription_started_at?: string | null
          planner_subscription_status?: string
          planner_type?: string | null
          planner_verification_requested?: boolean
          planner_verification_requested_at?: string | null
          planner_verified?: boolean
          planning_pass_expires_at?: string | null
          planning_pass_started_at?: string | null
          planning_pass_status?: string
          primary_county?: string | null
          primary_town?: string | null
          privacy_data_deleted_at?: string | null
          professional_use_risk_level?: string
          professional_use_risk_score?: number
          role?: Database["public"]["Enums"]["app_role"]
          service_areas?: string[]
          specialties?: string[] | null
          support_review_notes?: string | null
          support_review_status?: string
          travel_scope?: string
          updated_at?: string
          user_id: string
          verified_couple?: boolean
          wedding_budget_goal?: number | null
          wedding_county?: string | null
          wedding_date?: string | null
          wedding_location?: string | null
          wedding_town?: string | null
        }
        Update: {
          account_purpose?: string | null
          avatar_url?: string | null
          beta_trial_expires_at?: string | null
          beta_trial_started_at?: string | null
          beta_trial_status?: string
          bio?: string | null
          collaboration_code?: string | null
          committee_name?: string | null
          company_email?: string | null
          company_name?: string | null
          company_phone?: string | null
          company_website?: string | null
          created_at?: string
          directory_opt_out?: boolean
          directory_opt_out_at?: string | null
          expected_guest_count?: number | null
          founding_planner_contributor?: boolean
          free_wedding_replacement_used?: boolean
          full_name?: string | null
          id?: string
          last_risk_calculated_at?: string | null
          marketing_opt_out?: boolean
          marketing_opt_out_at?: string | null
          maximum_budget_kes?: number | null
          minimum_budget_kes?: number | null
          partner_name?: string | null
          planner_subscription_expires_at?: string | null
          planner_subscription_started_at?: string | null
          planner_subscription_status?: string
          planner_type?: string | null
          planner_verification_requested?: boolean
          planner_verification_requested_at?: string | null
          planner_verified?: boolean
          planning_pass_expires_at?: string | null
          planning_pass_started_at?: string | null
          planning_pass_status?: string
          primary_county?: string | null
          primary_town?: string | null
          privacy_data_deleted_at?: string | null
          professional_use_risk_level?: string
          professional_use_risk_score?: number
          role?: Database["public"]["Enums"]["app_role"]
          service_areas?: string[]
          specialties?: string[] | null
          support_review_notes?: string | null
          support_review_status?: string
          travel_scope?: string
          updated_at?: string
          user_id?: string
          verified_couple?: boolean
          wedding_budget_goal?: number | null
          wedding_county?: string | null
          wedding_date?: string | null
          wedding_location?: string | null
          wedding_town?: string | null
        }
        Relationships: []
      }
      public_token_access_logs: {
        Row: {
          created_at: string
          details: Json
          event_type: string
          id: string
          status: string
          token_kind: string
          token_value: string
        }
        Insert: {
          created_at?: string
          details?: Json
          event_type: string
          id?: string
          status: string
          token_kind: string
          token_value: string
        }
        Update: {
          created_at?: string
          details?: Json
          event_type?: string
          id?: string
          status?: string
          token_kind?: string
          token_value?: string
        }
        Relationships: []
      }
      support_requests: {
        Row: {
          browser_context: Json
          category: string
          created_at: string
          email_delivery_status: string
          error_reference: string | null
          id: string
          message: string
          page_path: string
          page_url: string | null
          planner_client_id: string | null
          reference: string
          resend_email_id: string | null
          resolved_at: string | null
          screenshot_name: string | null
          screenshot_size_bytes: number | null
          screenshot_type: string | null
          status: string
          updated_at: string
          user_email: string
          user_id: string
          user_name: string | null
          user_role: string
          wedding_id: string | null
          workspace_label: string | null
        }
        Insert: {
          browser_context?: Json
          category: string
          created_at?: string
          email_delivery_status?: string
          error_reference?: string | null
          id?: string
          message: string
          page_path: string
          page_url?: string | null
          planner_client_id?: string | null
          reference?: string
          resend_email_id?: string | null
          resolved_at?: string | null
          screenshot_name?: string | null
          screenshot_size_bytes?: number | null
          screenshot_type?: string | null
          status?: string
          updated_at?: string
          user_email: string
          user_id: string
          user_name?: string | null
          user_role: string
          wedding_id?: string | null
          workspace_label?: string | null
        }
        Update: {
          browser_context?: Json
          category?: string
          created_at?: string
          email_delivery_status?: string
          error_reference?: string | null
          id?: string
          message?: string
          page_path?: string
          page_url?: string | null
          planner_client_id?: string | null
          reference?: string
          resend_email_id?: string | null
          resolved_at?: string | null
          screenshot_name?: string | null
          screenshot_size_bytes?: number | null
          screenshot_type?: string | null
          status?: string
          updated_at?: string
          user_email?: string
          user_id?: string
          user_name?: string | null
          user_role?: string
          wedding_id?: string | null
          workspace_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_requests_planner_client_id_fkey"
            columns: ["planner_client_id"]
            isOneToOne: false
            referencedRelation: "planner_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_requests_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_membership_id: string | null
          assigned_to: string | null
          category: string | null
          client_id: string | null
          completed: boolean
          created_at: string
          delegatable: boolean
          description: string | null
          due_date: string | null
          due_date_source: string
          event_id: string | null
          id: string
          last_auto_scheduled_at: string | null
          manually_scheduled_at: string | null
          phase: string | null
          priority_level: number | null
          recommended_role: string | null
          schedule_anchor_date: string | null
          source_vendor_id: string | null
          template_key: string | null
          template_source: string | null
          timeline_offset_days: number | null
          title: string
          user_id: string
          visibility: string
          wedding_id: string | null
        }
        Insert: {
          assigned_membership_id?: string | null
          assigned_to?: string | null
          category?: string | null
          client_id?: string | null
          completed?: boolean
          created_at?: string
          delegatable?: boolean
          description?: string | null
          due_date?: string | null
          due_date_source?: string
          event_id?: string | null
          id?: string
          last_auto_scheduled_at?: string | null
          manually_scheduled_at?: string | null
          phase?: string | null
          priority_level?: number | null
          recommended_role?: string | null
          schedule_anchor_date?: string | null
          source_vendor_id?: string | null
          template_key?: string | null
          template_source?: string | null
          timeline_offset_days?: number | null
          title: string
          user_id: string
          visibility?: string
          wedding_id?: string | null
        }
        Update: {
          assigned_membership_id?: string | null
          assigned_to?: string | null
          category?: string | null
          client_id?: string | null
          completed?: boolean
          created_at?: string
          delegatable?: boolean
          description?: string | null
          due_date?: string | null
          due_date_source?: string
          event_id?: string | null
          id?: string
          last_auto_scheduled_at?: string | null
          manually_scheduled_at?: string | null
          phase?: string | null
          priority_level?: number | null
          recommended_role?: string | null
          schedule_anchor_date?: string | null
          source_vendor_id?: string | null
          template_key?: string | null
          template_source?: string | null
          timeline_offset_days?: number | null
          title?: string
          user_id?: string
          visibility?: string
          wedding_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_membership_id_fkey"
            columns: ["assigned_membership_id"]
            isOneToOne: false
            referencedRelation: "wedding_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "planner_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "wedding_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_source_vendor_id_fkey"
            columns: ["source_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
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
      timeline_operation_events: {
        Row: {
          created_at: string
          id: string
          idempotency_key: string
          operation_type: string
          payload: Json
          performed_by_user_id: string | null
          timeline_event_id: string | null
          timeline_id: string
          wedding_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          idempotency_key: string
          operation_type: string
          payload?: Json
          performed_by_user_id?: string | null
          timeline_event_id?: string | null
          timeline_id: string
          wedding_id: string
        }
        Update: {
          created_at?: string
          id?: string
          idempotency_key?: string
          operation_type?: string
          payload?: Json
          performed_by_user_id?: string | null
          timeline_event_id?: string | null
          timeline_id?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeline_operation_events_timeline_event_id_fkey"
            columns: ["timeline_event_id"]
            isOneToOne: false
            referencedRelation: "timeline_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_operation_events_timeline_id_fkey"
            columns: ["timeline_id"]
            isOneToOne: false
            referencedRelation: "timelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_operation_events_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_share_links: {
        Row: {
          access_count: number
          assignee_name: string
          created_at: string
          email: string | null
          expires_at: string
          id: string
          last_accessed_at: string | null
          revoked_at: string | null
          share_token: string
          timeline_id: string
          vendor_role: string | null
        }
        Insert: {
          access_count?: number
          assignee_name: string
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          last_accessed_at?: string | null
          revoked_at?: string | null
          share_token?: string
          timeline_id: string
          vendor_role?: string | null
        }
        Update: {
          access_count?: number
          assignee_name?: string
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          last_accessed_at?: string | null
          revoked_at?: string | null
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
          event_id: string | null
          id: string
          is_template: boolean
          share_access_count: number
          share_expires_at: string | null
          share_last_accessed_at: string | null
          share_revoked_at: string | null
          share_token: string
          timeline_date: string | null
          title: string
          updated_at: string
          user_id: string
          wedding_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          is_template?: boolean
          share_access_count?: number
          share_expires_at?: string | null
          share_last_accessed_at?: string | null
          share_revoked_at?: string | null
          share_token?: string
          timeline_date?: string | null
          title: string
          updated_at?: string
          user_id: string
          wedding_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          is_template?: boolean
          share_access_count?: number
          share_expires_at?: string | null
          share_last_accessed_at?: string | null
          share_revoked_at?: string | null
          share_token?: string
          timeline_date?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          wedding_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timelines_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "planner_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timelines_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "wedding_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timelines_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
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
      vendor_follow_up_reminders: {
        Row: {
          created_at: string
          created_by_user_id: string
          due_date: string | null
          id: string
          notes: string | null
          status: string
          title: string
          updated_at: string
          vendor_id: string
          vendor_listing_id: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          due_date?: string | null
          id?: string
          notes?: string | null
          status?: string
          title: string
          updated_at?: string
          vendor_id: string
          vendor_listing_id: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          status?: string
          title?: string
          updated_at?: string
          vendor_id?: string
          vendor_listing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_follow_up_reminders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_follow_up_reminders_vendor_listing_id_fkey"
            columns: ["vendor_listing_id"]
            isOneToOne: false
            referencedRelation: "vendor_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_listing_spaces: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_featured: boolean
          length_meters: number
          location_notes: string | null
          max_seated_capacity: number | null
          max_standing_capacity: number | null
          recommended_guest_count: number | null
          setup_notes: string | null
          sort_order: number
          space_name: string
          space_type: string
          updated_at: string
          vendor_listing_id: string
          width_meters: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_featured?: boolean
          length_meters: number
          location_notes?: string | null
          max_seated_capacity?: number | null
          max_standing_capacity?: number | null
          recommended_guest_count?: number | null
          setup_notes?: string | null
          sort_order?: number
          space_name: string
          space_type?: string
          updated_at?: string
          vendor_listing_id: string
          width_meters: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_featured?: boolean
          length_meters?: number
          location_notes?: string | null
          max_seated_capacity?: number | null
          max_standing_capacity?: number | null
          recommended_guest_count?: number | null
          setup_notes?: string | null
          sort_order?: number
          space_name?: string
          space_type?: string
          updated_at?: string
          vendor_listing_id?: string
          width_meters?: number
        }
        Relationships: [
          {
            foreignKeyName: "vendor_listing_spaces_vendor_listing_id_fkey"
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
          claim_claimed_at: string | null
          claim_contact_email: string | null
          claim_expires_at: string | null
          claim_invited_at: string | null
          claim_token: string | null
          claimed_at: string | null
          created_at: string
          description: string | null
          directory_opt_out: boolean
          directory_opt_out_at: string | null
          email: string | null
          featured_rank: number
          id: string
          is_approved: boolean
          is_verified: boolean
          location: string | null
          location_county: string | null
          location_town: string | null
          logo_url: string | null
          maximum_budget_kes: number | null
          minimum_budget_kes: number | null
          phone: string | null
          profile_kind: string
          public_listing_note: string | null
          service_areas: string[]
          services: string[] | null
          social_facebook: string | null
          social_instagram: string | null
          social_tiktok: string | null
          social_twitter: string | null
          subscription_expires_at: string | null
          subscription_started_at: string | null
          subscription_status: string
          travel_scope: string
          updated_at: string
          user_id: string | null
          verification_requested: boolean
          verification_requested_at: string | null
          website: string | null
        }
        Insert: {
          business_name: string
          category: string
          claim_claimed_at?: string | null
          claim_contact_email?: string | null
          claim_expires_at?: string | null
          claim_invited_at?: string | null
          claim_token?: string | null
          claimed_at?: string | null
          created_at?: string
          description?: string | null
          directory_opt_out?: boolean
          directory_opt_out_at?: string | null
          email?: string | null
          featured_rank?: number
          id?: string
          is_approved?: boolean
          is_verified?: boolean
          location?: string | null
          location_county?: string | null
          location_town?: string | null
          logo_url?: string | null
          maximum_budget_kes?: number | null
          minimum_budget_kes?: number | null
          phone?: string | null
          profile_kind?: string
          public_listing_note?: string | null
          service_areas?: string[]
          services?: string[] | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_tiktok?: string | null
          social_twitter?: string | null
          subscription_expires_at?: string | null
          subscription_started_at?: string | null
          subscription_status?: string
          travel_scope?: string
          updated_at?: string
          user_id?: string | null
          verification_requested?: boolean
          verification_requested_at?: string | null
          website?: string | null
        }
        Update: {
          business_name?: string
          category?: string
          claim_claimed_at?: string | null
          claim_contact_email?: string | null
          claim_expires_at?: string | null
          claim_invited_at?: string | null
          claim_token?: string | null
          claimed_at?: string | null
          created_at?: string
          description?: string | null
          directory_opt_out?: boolean
          directory_opt_out_at?: string | null
          email?: string | null
          featured_rank?: number
          id?: string
          is_approved?: boolean
          is_verified?: boolean
          location?: string | null
          location_county?: string | null
          location_town?: string | null
          logo_url?: string | null
          maximum_budget_kes?: number | null
          minimum_budget_kes?: number | null
          phone?: string | null
          profile_kind?: string
          public_listing_note?: string | null
          service_areas?: string[]
          services?: string[] | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_tiktok?: string | null
          social_twitter?: string | null
          subscription_expires_at?: string | null
          subscription_started_at?: string | null
          subscription_status?: string
          travel_scope?: string
          updated_at?: string
          user_id?: string | null
          verification_requested?: boolean
          verification_requested_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      vendor_planner_recommendations: {
        Row: {
          active: boolean
          created_at: string
          id: string
          planner_company_name: string | null
          planner_is_founding: boolean
          planner_public_name: string
          planner_user_id: string
          recommendation_note: string | null
          updated_at: string
          vendor_listing_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          planner_company_name?: string | null
          planner_is_founding?: boolean
          planner_public_name: string
          planner_user_id: string
          recommendation_note?: string | null
          updated_at?: string
          vendor_listing_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          planner_company_name?: string | null
          planner_is_founding?: boolean
          planner_public_name?: string
          planner_user_id?: string
          recommendation_note?: string | null
          updated_at?: string
          vendor_listing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_planner_recommendations_vendor_listing_id_fkey"
            columns: ["vendor_listing_id"]
            isOneToOne: false
            referencedRelation: "vendor_listings"
            referencedColumns: ["id"]
          },
        ]
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
            isOneToOne: true
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
      vendor_suggestions: {
        Row: {
          category: string
          created_at: string
          id: string
          instagram_or_website: string | null
          location: string | null
          recommendation_reason: string
          status: string
          suggested_by_user_id: string | null
          suggester_role: string | null
          updated_at: string
          vendor_name: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          instagram_or_website?: string | null
          location?: string | null
          recommendation_reason: string
          status?: string
          suggested_by_user_id?: string | null
          suggester_role?: string | null
          updated_at?: string
          vendor_name: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          instagram_or_website?: string | null
          location?: string | null
          recommendation_reason?: string
          status?: string
          suggested_by_user_id?: string | null
          suggester_role?: string | null
          updated_at?: string
          vendor_name?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          amount_paid: number
          category: string
          client_id: string | null
          committee_role_in_charge: string | null
          contract_status: string
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
          vendor_calendar_synced_at: string | null
          vendor_internal_notes: string | null
          vendor_listing_id: string | null
          wedding_id: string | null
        }
        Insert: {
          amount_paid?: number
          category: string
          client_id?: string | null
          committee_role_in_charge?: string | null
          contract_status?: string
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
          vendor_calendar_synced_at?: string | null
          vendor_internal_notes?: string | null
          vendor_listing_id?: string | null
          wedding_id?: string | null
        }
        Update: {
          amount_paid?: number
          category?: string
          client_id?: string | null
          committee_role_in_charge?: string | null
          contract_status?: string
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
          vendor_calendar_synced_at?: string | null
          vendor_internal_notes?: string | null
          vendor_listing_id?: string | null
          wedding_id?: string | null
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
          {
            foreignKeyName: "vendors_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_assignment_roles: {
        Row: {
          assignment_role: string
          created_at: string
          email: string | null
          id: string
          metadata: Json
          source_task_id: string | null
          status: string
          updated_at: string
          user_id: string | null
          wedding_id: string
        }
        Insert: {
          assignment_role: string
          created_at?: string
          email?: string | null
          id?: string
          metadata?: Json
          source_task_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          wedding_id: string
        }
        Update: {
          assignment_role?: string
          created_at?: string
          email?: string | null
          id?: string
          metadata?: Json
          source_task_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_assignment_roles_source_task_id_fkey"
            columns: ["source_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wedding_assignment_roles_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_committee_members: {
        Row: {
          chair_user_id: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          membership_id: string | null
          permission_level: string
          phone: string
          responsibility: string
          status: string
          updated_at: string
          wedding_id: string | null
        }
        Insert: {
          chair_user_id: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          membership_id?: string | null
          permission_level?: string
          phone: string
          responsibility: string
          status?: string
          updated_at?: string
          wedding_id?: string | null
        }
        Update: {
          chair_user_id?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          membership_id?: string | null
          permission_level?: string
          phone?: string
          responsibility?: string
          status?: string
          updated_at?: string
          wedding_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wedding_committee_members_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "wedding_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wedding_committee_members_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_contributions: {
        Row: {
          client_id: string | null
          contribution_type: string
          contributor_group: string | null
          contributor_name: string
          contributor_phone: string | null
          created_at: string
          id: string
          in_kind_item: string | null
          in_kind_value: number
          notes: string | null
          paid_amount: number
          paid_on: string | null
          payment_method: string
          pledged_amount: number
          purpose: string | null
          round_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          contribution_type?: string
          contributor_group?: string | null
          contributor_name: string
          contributor_phone?: string | null
          created_at?: string
          id?: string
          in_kind_item?: string | null
          in_kind_value?: number
          notes?: string | null
          paid_amount?: number
          paid_on?: string | null
          payment_method?: string
          pledged_amount?: number
          purpose?: string | null
          round_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          contribution_type?: string
          contributor_group?: string | null
          contributor_name?: string
          contributor_phone?: string | null
          created_at?: string
          id?: string
          in_kind_item?: string | null
          in_kind_value?: number
          notes?: string | null
          paid_amount?: number
          paid_on?: string | null
          payment_method?: string
          pledged_amount?: number
          purpose?: string | null
          round_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_contributions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "planner_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wedding_contributions_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "contribution_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_entitlements: {
        Row: {
          created_at: string
          effective_from: string
          effective_to: string | null
          feature_key: string
          id: string
          metadata: Json
          source_bundle_id: string | null
          status: string
          updated_at: string
          wedding_id: string
        }
        Insert: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          feature_key: string
          id?: string
          metadata?: Json
          source_bundle_id?: string | null
          status?: string
          updated_at?: string
          wedding_id: string
        }
        Update: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          feature_key?: string
          id?: string
          metadata?: Json
          source_bundle_id?: string | null
          status?: string
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_entitlements_source_bundle_id_fkey"
            columns: ["source_bundle_id"]
            isOneToOne: false
            referencedRelation: "wedding_subscription_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wedding_entitlements_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_events: {
        Row: {
          archived_at: string | null
          created_at: string
          end_time: string | null
          event_date: string
          id: string
          is_primary: boolean
          location: string | null
          name: string
          notes: string | null
          sort_order: number
          start_time: string | null
          updated_at: string
          venue_name: string | null
          wedding_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          end_time?: string | null
          event_date: string
          id?: string
          is_primary?: boolean
          location?: string | null
          name: string
          notes?: string | null
          sort_order?: number
          start_time?: string | null
          updated_at?: string
          venue_name?: string | null
          wedding_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          end_time?: string | null
          event_date?: string
          id?: string
          is_primary?: boolean
          location?: string | null
          name?: string
          notes?: string | null
          sort_order?: number
          start_time?: string | null
          updated_at?: string
          venue_name?: string | null
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_events_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          created_by_user_id: string | null
          email: string
          expires_at: string | null
          id: string
          invite_token: string
          invite_type: string
          membership_id: string | null
          proposed_role: string
          sent_at: string | null
          status: string
          updated_at: string
          wedding_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          email: string
          expires_at?: string | null
          id?: string
          invite_token?: string
          invite_type: string
          membership_id?: string | null
          proposed_role: string
          sent_at?: string | null
          status?: string
          updated_at?: string
          wedding_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          invite_token?: string
          invite_type?: string
          membership_id?: string | null
          proposed_role?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_invites_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "wedding_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wedding_invites_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_lifecycle_history: {
        Row: {
          became_meaningful_at: string | null
          collaborator_invite_count: number
          created_at: string
          created_wedding_name: string | null
          deleted_at: string | null
          deletion_reason: string | null
          export_count: number
          guest_count_at_deletion: number
          id: string
          is_meaningful: boolean
          last_activity_at: string | null
          metadata: Json
          updated_at: string
          user_id: string
          vendor_count_at_deletion: number
          wedding_date: string | null
          wedding_id: string
          workspace_lifetime_days: number | null
        }
        Insert: {
          became_meaningful_at?: string | null
          collaborator_invite_count?: number
          created_at: string
          created_wedding_name?: string | null
          deleted_at?: string | null
          deletion_reason?: string | null
          export_count?: number
          guest_count_at_deletion?: number
          id?: string
          is_meaningful?: boolean
          last_activity_at?: string | null
          metadata?: Json
          updated_at?: string
          user_id: string
          vendor_count_at_deletion?: number
          wedding_date?: string | null
          wedding_id: string
          workspace_lifetime_days?: number | null
        }
        Update: {
          became_meaningful_at?: string | null
          collaborator_invite_count?: number
          created_at?: string
          created_wedding_name?: string | null
          deleted_at?: string | null
          deletion_reason?: string | null
          export_count?: number
          guest_count_at_deletion?: number
          id?: string
          is_meaningful?: boolean
          last_activity_at?: string | null
          metadata?: Json
          updated_at?: string
          user_id?: string
          vendor_count_at_deletion?: number
          wedding_date?: string | null
          wedding_id?: string
          workspace_lifetime_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wedding_lifecycle_history_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_memberships: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          invited_by_user_id: string | null
          is_owner: boolean
          membership_status: string
          metadata: Json
          revoked_at: string | null
          role: string
          updated_at: string
          user_id: string | null
          wedding_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by_user_id?: string | null
          is_owner?: boolean
          membership_status?: string
          metadata?: Json
          revoked_at?: string | null
          role: string
          updated_at?: string
          user_id?: string | null
          wedding_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by_user_id?: string | null
          is_owner?: boolean
          membership_status?: string
          metadata?: Json
          revoked_at?: string | null
          role?: string
          updated_at?: string
          user_id?: string | null
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_memberships_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_planning_profiles: {
        Row: {
          booked_categories: string[]
          created_at: string
          estimated_budget: number
          estimated_guest_count: number
          primary_next_action: Json
          secondary_actions: Json
          top_priorities: string[]
          updated_at: string
          wedding_id: string
          wedding_type: string
        }
        Insert: {
          booked_categories?: string[]
          created_at?: string
          estimated_budget: number
          estimated_guest_count: number
          primary_next_action?: Json
          secondary_actions?: Json
          top_priorities?: string[]
          updated_at?: string
          wedding_id: string
          wedding_type: string
        }
        Update: {
          booked_categories?: string[]
          created_at?: string
          estimated_budget?: number
          estimated_guest_count?: number
          primary_next_action?: Json
          secondary_actions?: Json
          top_priorities?: string[]
          updated_at?: string
          wedding_id?: string
          wedding_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_planning_profiles_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: true
            referencedRelation: "weddings"
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
      wedding_registry_items: {
        Row: {
          category: string | null
          created_at: string
          created_by_user_id: string | null
          description: string | null
          estimated_price_kes: number | null
          id: string
          is_purchased: boolean
          purchase_url: string | null
          purchased_at: string | null
          title: string
          updated_at: string
          wedding_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          estimated_price_kes?: number | null
          id?: string
          is_purchased?: boolean
          purchase_url?: string | null
          purchased_at?: string | null
          title: string
          updated_at?: string
          wedding_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          estimated_price_kes?: number | null
          id?: string
          is_purchased?: boolean
          purchase_url?: string | null
          purchased_at?: string | null
          title?: string
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_registry_items_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_space_plan_guest_assignments: {
        Row: {
          created_at: string
          guest_id: string
          id: string
          notes: string | null
          seat_label: string | null
          space_plan_table_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          guest_id: string
          id?: string
          notes?: string | null
          seat_label?: string | null
          space_plan_table_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          guest_id?: string
          id?: string
          notes?: string | null
          seat_label?: string | null
          space_plan_table_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_space_plan_guest_assignments_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wedding_space_plan_guest_assignments_space_plan_table_id_fkey"
            columns: ["space_plan_table_id"]
            isOneToOne: false
            referencedRelation: "wedding_space_plan_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_space_plan_objects: {
        Row: {
          created_at: string
          height: number
          id: string
          label: string | null
          metadata: Json
          notes: string | null
          object_type: string
          rotation: number
          space_plan_id: string
          updated_at: string
          width: number
          x: number
          y: number
          z_index: number
        }
        Insert: {
          created_at?: string
          height?: number
          id?: string
          label?: string | null
          metadata?: Json
          notes?: string | null
          object_type: string
          rotation?: number
          space_plan_id: string
          updated_at?: string
          width?: number
          x?: number
          y?: number
          z_index?: number
        }
        Update: {
          created_at?: string
          height?: number
          id?: string
          label?: string | null
          metadata?: Json
          notes?: string | null
          object_type?: string
          rotation?: number
          space_plan_id?: string
          updated_at?: string
          width?: number
          x?: number
          y?: number
          z_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "wedding_space_plan_objects_space_plan_id_fkey"
            columns: ["space_plan_id"]
            isOneToOne: false
            referencedRelation: "wedding_space_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_space_plan_tables: {
        Row: {
          capacity: number
          created_at: string
          decor_notes: string | null
          dietary_notes: string | null
          id: string
          service_notes: string | null
          shape: string
          space_plan_object_id: string
          table_name: string
          updated_at: string
          vip: boolean
        }
        Insert: {
          capacity: number
          created_at?: string
          decor_notes?: string | null
          dietary_notes?: string | null
          id?: string
          service_notes?: string | null
          shape: string
          space_plan_object_id: string
          table_name: string
          updated_at?: string
          vip?: boolean
        }
        Update: {
          capacity?: number
          created_at?: string
          decor_notes?: string | null
          dietary_notes?: string | null
          id?: string
          service_notes?: string | null
          shape?: string
          space_plan_object_id?: string
          table_name?: string
          updated_at?: string
          vip?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "wedding_space_plan_tables_space_plan_object_id_fkey"
            columns: ["space_plan_object_id"]
            isOneToOne: false
            referencedRelation: "wedding_space_plan_objects"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_space_plans: {
        Row: {
          canvas_height: number
          canvas_width: number
          created_at: string
          created_by_user_id: string
          event_label: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          space_type: string
          status: string
          updated_at: string
          venue_listing_id: string | null
          venue_space_id: string | null
          wedding_id: string
        }
        Insert: {
          canvas_height?: number
          canvas_width?: number
          created_at?: string
          created_by_user_id: string
          event_label?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          space_type: string
          status?: string
          updated_at?: string
          venue_listing_id?: string | null
          venue_space_id?: string | null
          wedding_id: string
        }
        Update: {
          canvas_height?: number
          canvas_width?: number
          created_at?: string
          created_by_user_id?: string
          event_label?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          space_type?: string
          status?: string
          updated_at?: string
          venue_listing_id?: string | null
          venue_space_id?: string | null
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_space_plans_venue_listing_id_fkey"
            columns: ["venue_listing_id"]
            isOneToOne: false
            referencedRelation: "vendor_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wedding_space_plans_venue_space_id_fkey"
            columns: ["venue_space_id"]
            isOneToOne: false
            referencedRelation: "vendor_listing_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wedding_space_plans_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_subscription_bundles: {
        Row: {
          activated_at: string | null
          billing_cycle: string
          billing_provider: string | null
          billing_reference: string | null
          bundle_code: string
          bundle_type: string
          created_at: string
          expires_at: string | null
          grace_ends_at: string | null
          id: string
          metadata: Json
          seat_limit: number | null
          seats_used: number
          status: string
          updated_at: string
          wedding_id: string
        }
        Insert: {
          activated_at?: string | null
          billing_cycle?: string
          billing_provider?: string | null
          billing_reference?: string | null
          bundle_code: string
          bundle_type: string
          created_at?: string
          expires_at?: string | null
          grace_ends_at?: string | null
          id?: string
          metadata?: Json
          seat_limit?: number | null
          seats_used?: number
          status?: string
          updated_at?: string
          wedding_id: string
        }
        Update: {
          activated_at?: string | null
          billing_cycle?: string
          billing_provider?: string | null
          billing_reference?: string | null
          bundle_code?: string
          bundle_type?: string
          created_at?: string
          expires_at?: string | null
          grace_ends_at?: string | null
          id?: string
          metadata?: Json
          seat_limit?: number | null
          seats_used?: number
          status?: string
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_subscription_bundles_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      weddings: {
        Row: {
          became_meaningful_at: string | null
          created_at: string
          created_by_user_id: string
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_reason: string | null
          id: string
          is_meaningful: boolean
          location_county: string | null
          location_town: string | null
          metadata: Json
          name: string
          owner_timezone: string | null
          planning_country: string | null
          planning_mode: string
          reference_currency: string | null
          slug: string | null
          status: string
          updated_at: string
          wedding_code: string
          wedding_date: string | null
        }
        Insert: {
          became_meaningful_at?: string | null
          created_at?: string
          created_by_user_id: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          is_meaningful?: boolean
          location_county?: string | null
          location_town?: string | null
          metadata?: Json
          name: string
          owner_timezone?: string | null
          planning_country?: string | null
          planning_mode?: string
          reference_currency?: string | null
          slug?: string | null
          status?: string
          updated_at?: string
          wedding_code: string
          wedding_date?: string | null
        }
        Update: {
          became_meaningful_at?: string | null
          created_at?: string
          created_by_user_id?: string
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          id?: string
          is_meaningful?: boolean
          location_county?: string | null
          location_town?: string | null
          metadata?: Json
          name?: string
          owner_timezone?: string | null
          planning_country?: string | null
          planning_mode?: string
          reference_currency?: string | null
          slug?: string | null
          status?: string
          updated_at?: string
          wedding_code?: string
          wedding_date?: string | null
        }
        Relationships: []
      }
      workspace_events: {
        Row: {
          actor_user_id: string | null
          dedupe_key: string
          event_type: string
          id: string
          metadata: Json
          occurred_at: string
          subject_id: string | null
          subject_type: string
          summary: string | null
          title: string
          wedding_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          dedupe_key: string
          event_type: string
          id?: string
          metadata?: Json
          occurred_at?: string
          subject_id?: string | null
          subject_type: string
          summary?: string | null
          title: string
          wedding_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          dedupe_key?: string
          event_type?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          subject_id?: string | null
          subject_type?: string
          summary?: string | null
          title?: string
          wedding_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workspace_events_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_vendor_invites: {
        Row: {
          accepted_at: string | null
          claimed_vendor_listing_id: string | null
          created_at: string
          declined_at: string | null
          id: string
          invite_contact_email: string | null
          invite_contact_phone: string | null
          invite_expires_at: string | null
          invite_message: string | null
          invite_opened_at: string | null
          invite_sent_at: string | null
          invite_status: string
          invite_token: string
          invited_by_user_id: string | null
          invited_vendor_user_id: string | null
          metadata: Json
          public_profile_opt_in: boolean
          revoked_at: string | null
          updated_at: string
          vendor_id: string
          wedding_id: string
        }
        Insert: {
          accepted_at?: string | null
          claimed_vendor_listing_id?: string | null
          created_at?: string
          declined_at?: string | null
          id?: string
          invite_contact_email?: string | null
          invite_contact_phone?: string | null
          invite_expires_at?: string | null
          invite_message?: string | null
          invite_opened_at?: string | null
          invite_sent_at?: string | null
          invite_status?: string
          invite_token?: string
          invited_by_user_id?: string | null
          invited_vendor_user_id?: string | null
          metadata?: Json
          public_profile_opt_in?: boolean
          revoked_at?: string | null
          updated_at?: string
          vendor_id: string
          wedding_id: string
        }
        Update: {
          accepted_at?: string | null
          claimed_vendor_listing_id?: string | null
          created_at?: string
          declined_at?: string | null
          id?: string
          invite_contact_email?: string | null
          invite_contact_phone?: string | null
          invite_expires_at?: string | null
          invite_message?: string | null
          invite_opened_at?: string | null
          invite_sent_at?: string | null
          invite_status?: string
          invite_token?: string
          invited_by_user_id?: string | null
          invited_vendor_user_id?: string | null
          metadata?: Json
          public_profile_opt_in?: boolean
          revoked_at?: string | null
          updated_at?: string
          vendor_id?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_vendor_invites_claimed_vendor_listing_id_fkey"
            columns: ["claimed_vendor_listing_id"]
            isOneToOne: false
            referencedRelation: "vendor_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_vendor_invites_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_vendor_invites_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_vendor_task_suggestions: {
        Row: {
          accepted_task_id: string | null
          created_at: string
          created_by_user_id: string
          description: string | null
          id: string
          resolved_at: string | null
          resolved_by_user_id: string | null
          status: string
          suggested_due_date: string | null
          title: string
          updated_at: string
          vendor_id: string
          wedding_id: string
        }
        Insert: {
          accepted_task_id?: string | null
          created_at?: string
          created_by_user_id: string
          description?: string | null
          id?: string
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          status?: string
          suggested_due_date?: string | null
          title: string
          updated_at?: string
          vendor_id: string
          wedding_id: string
        }
        Update: {
          accepted_task_id?: string | null
          created_at?: string
          created_by_user_id?: string
          description?: string | null
          id?: string
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          status?: string
          suggested_due_date?: string | null
          title?: string
          updated_at?: string
          vendor_id?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_vendor_task_suggestions_accepted_task_id_fkey"
            columns: ["accepted_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_vendor_task_suggestions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_vendor_task_suggestions_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_vendor_updates: {
        Row: {
          archived_at: string | null
          archived_by_user_id: string | null
          created_at: string
          created_by_user_id: string
          id: string
          is_archived: boolean
          note_message: string | null
          update_type: string
          updated_at: string
          vendor_id: string
          wedding_id: string
        }
        Insert: {
          archived_at?: string | null
          archived_by_user_id?: string | null
          created_at?: string
          created_by_user_id: string
          id?: string
          is_archived?: boolean
          note_message?: string | null
          update_type: string
          updated_at?: string
          vendor_id: string
          wedding_id: string
        }
        Update: {
          archived_at?: string | null
          archived_by_user_id?: string | null
          created_at?: string
          created_by_user_id?: string
          id?: string
          is_archived?: boolean
          note_message?: string | null
          update_type?: string
          updated_at?: string
          vendor_id?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_vendor_updates_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_vendor_updates_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      zania_feature_flags: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
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
          founding_planner_contributor: boolean | null
          full_name: string | null
          id: string | null
          maximum_budget_kes: number | null
          minimum_budget_kes: number | null
          primary_county: string | null
          primary_town: string | null
          service_areas: string[] | null
          specialties: string[] | null
          travel_scope: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          company_email?: string | null
          company_name?: string | null
          company_phone?: string | null
          company_website?: string | null
          founding_planner_contributor?: boolean | null
          full_name?: string | null
          id?: string | null
          maximum_budget_kes?: number | null
          minimum_budget_kes?: number | null
          primary_county?: string | null
          primary_town?: string | null
          service_areas?: string[] | null
          specialties?: string[] | null
          travel_scope?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          company_email?: string | null
          company_name?: string | null
          company_phone?: string | null
          company_website?: string | null
          founding_planner_contributor?: boolean | null
          full_name?: string | null
          id?: string | null
          maximum_budget_kes?: number | null
          minimum_budget_kes?: number | null
          primary_county?: string | null
          primary_town?: string | null
          service_areas?: string[] | null
          specialties?: string[] | null
          travel_scope?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_vendor_workspace_task_suggestion: {
        Args: { target_suggestion_id: string }
        Returns: {
          accepted_task_id: string | null
          created_at: string
          created_by_user_id: string
          description: string | null
          id: string
          resolved_at: string | null
          resolved_by_user_id: string | null
          status: string
          suggested_due_date: string | null
          title: string
          updated_at: string
          vendor_id: string
          wedding_id: string
        }
        SetofOptions: {
          from: "*"
          to: "workspace_vendor_task_suggestions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      accept_wedding_invite: {
        Args: { invite_token_input: string }
        Returns: {
          membership_id: string
          resolved_role: string
          wedding_id: string
        }[]
      }
      adaptive_task_due_date: {
        Args: {
          maximum_timeline_days_input?: number
          planning_start_date_input: string
          timeline_offset_days_input: number
          wedding_date_input: string
        }
        Returns: string
      }
      admin_ai_usage_metrics: {
        Args: never
        Returns: {
          active_users: number
          committee_messages: number
          couple_messages: number
          planner_messages: number
          total_messages: number
          vendor_messages: number
        }[]
      }
      admin_beta_readiness_snapshot: {
        Args: never
        Returns: {
          active_beta_trials: number
          active_couple_passes: number
          active_planner_subscriptions: number
          active_professional_entitlements: number
          active_vendor_subscriptions: number
          active_wedding_entitlements: number
          recent_ai_failures: number
          recent_failed_syncs: number
        }[]
      }
      admin_convert_vendor_suggestion: {
        Args: { suggestion_id: string }
        Returns: string
      }
      admin_dashboard_metrics: {
        Args: never
        Returns: {
          open_link_requests: number
          pending_vendor_approvals: number
          total_admins: number
          total_budget_items: number
          total_clients: number
          total_couples: number
          total_guests: number
          total_planners: number
          total_tasks: number
          total_users: number
          total_vendor_listings: number
          total_vendors: number
        }[]
      }
      admin_free_tier_risk_summary: {
        Args: never
        Returns: {
          deleted_weddings: number
          flagged_accounts: number
          high_risk_accounts: number
          medium_risk_accounts: number
          pending_reviews: number
          restricted_reviews: number
        }[]
      }
      admin_get_active_pricing_catalog: {
        Args: never
        Returns: {
          catalog_key: string
          config: Json
          display_name: string
          is_active: boolean
          updated_at: string
        }[]
      }
      admin_issue_device_verification_challenge: {
        Args: {
          target_auth_session_id: string
          target_device_id: string
          target_email: string
          target_user_id: string
        }
        Returns: {
          challenge_id: string
          email_hint: string
          expires_at: string
          otp_code: string
          retry_after_seconds: number
        }[]
      }
      admin_list_ai_plan_configs: {
        Args: never
        Returns: {
          add_on_annual_lookup_key: string
          add_on_lookup_key: string
          add_on_separate: boolean
          ai_enabled: boolean
          audience: string
          monthly_message_cap: number
          updated_at: string
        }[]
      }
      admin_list_ai_usage: {
        Args: {
          audience_filter?: string
          limit_rows?: number
          offset_rows?: number
          search_query?: string
        }
        Returns: {
          ai_enabled: boolean
          audience: string
          email: string
          full_name: string
          messages_used: number
          month_start: string
          monthly_message_cap: number
          remaining_messages: number
          role: string
          user_id: string
        }[]
      }
      admin_list_couple_planning_passes: {
        Args: {
          limit_rows?: number
          offset_rows?: number
          search_query?: string
          status_filter?: string
        }
        Returns: {
          email: string
          full_name: string
          planning_pass_expires_at: string
          planning_pass_status: string
          profile_id: string
          updated_at: string
          user_id: string
          wedding_date: string
          wedding_location: string
        }[]
      }
      admin_list_free_tier_risk_accounts: {
        Args: {
          limit_rows?: number
          offset_rows?: number
          review_status_filter?: string
          risk_level_filter?: string
          search_query?: string
        }
        Returns: {
          account_purpose: string
          active_wedding_count: number
          archived_wedding_count: number
          collaborator_invite_attempts: number
          current_trusted_device_count: number
          deleted_wedding_count: number
          device_count: number
          device_switches_last_90_days: number
          email: string
          export_count: number
          full_name: string
          last_deleted_wedding_at: string
          last_risk_calculated_at: string
          last_wedding_created_at: string
          lifetime_wedding_count: number
          otp_failures_last_30_days: number
          otp_requests_last_30_days: number
          professional_use_risk_level: string
          professional_use_risk_score: number
          role: string
          support_review_notes: string
          support_review_status: string
          user_id: string
          verified_couple: boolean
        }[]
      }
      admin_list_planner_profiles: {
        Args: {
          limit_rows?: number
          offset_rows?: number
          search_query?: string
          verification_filter?: string
        }
        Returns: {
          committee_name: string
          company_email: string
          company_name: string
          founding_planner_contributor: boolean
          full_name: string
          planner_subscription_expires_at: string
          planner_subscription_status: string
          planner_type: string
          planner_verification_requested: boolean
          planner_verification_requested_at: string
          planner_verified: boolean
          profile_id: string
          updated_at: string
          user_id: string
        }[]
      }
      admin_list_pricing_catalog_revisions: {
        Args: { limit_rows?: number }
        Returns: {
          catalog_key: string
          change_source: string
          config: Json
          created_at: string
          created_by_user_id: string
          display_name: string
          id: string
        }[]
      }
      admin_list_user_account_audit_events: {
        Args: { limit_rows?: number; target_user_id: string }
        Returns: {
          created_at: string
          device_session_id: string
          event_type: string
          id: string
          metadata: Json
          wedding_id: string
        }[]
      }
      admin_list_user_wedding_lifecycle: {
        Args: { target_user_id: string }
        Returns: {
          archived_at: string
          became_meaningful_at: string
          collaborator_invite_count: number
          created_at: string
          created_wedding_name: string
          deleted_at: string
          deletion_reason: string
          export_count: number
          guest_count_at_deletion: number
          is_meaningful: boolean
          restored_at: string
          status: string
          vendor_count_at_deletion: number
          wedding_date: string
          wedding_id: string
          workspace_lifetime_days: number
        }[]
      }
      admin_list_users: {
        Args: {
          limit_rows?: number
          offset_rows?: number
          role_filter?: Database["public"]["Enums"]["app_role"]
          search_query?: string
        }
        Returns: {
          company_name: string
          created_at: string
          email: string
          full_name: string
          last_sign_in_at: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          wedding_date: string
        }[]
      }
      admin_list_vendor_listings: {
        Args: {
          limit_rows?: number
          offset_rows?: number
          search_query?: string
          status_filter?: string
        }
        Returns: {
          business_name: string
          category: string
          claim_contact_email: string
          claim_expires_at: string
          claim_invited_at: string
          featured_rank: number
          is_approved: boolean
          is_verified: boolean
          listing_id: string
          location: string
          owner_email: string
          owner_name: string
          profile_kind: string
          public_listing_note: string
          subscription_expires_at: string
          subscription_status: string
          updated_at: string
          user_id: string
          verification_requested: boolean
          verification_requested_at: string
        }[]
      }
      admin_list_vendor_reputation_reviews: {
        Args: {
          issue_filter?: string
          limit_rows?: number
          offset_rows?: number
          search_query?: string
          visibility_filter?: string
        }
        Returns: {
          client_name: string
          created_at: string
          delivered_on_time: boolean
          issue_flags: string[]
          overall_rating: number
          private_notes: string
          review_id: string
          review_source: string
          review_source_role: string
          reviewer_email: string
          reviewer_name: string
          reviewer_user_id: string
          vendor_category: string
          vendor_listing_id: string
          vendor_name: string
          visibility: string
          would_hire_again: boolean
        }[]
      }
      admin_list_vendor_suggestions: {
        Args: {
          limit_rows?: number
          offset_rows?: number
          search_query?: string
          status_filter?: string
        }
        Returns: {
          category: string
          created_at: string
          instagram_or_website: string
          location: string
          recommendation_reason: string
          status: string
          suggester_email: string
          suggester_name: string
          suggester_role: string
          suggestion_id: string
          vendor_name: string
        }[]
      }
      admin_prepare_vendor_listing_claim: {
        Args: { claim_email: string; listing_id: string }
        Returns: {
          claim_token: string
          claim_url: string
        }[]
      }
      admin_recent_function_events: {
        Args: { limit_rows?: number; status_filter?: string }
        Returns: {
          audience: string
          created_at: string
          details: Json
          entity_id: string
          event_type: string
          function_name: string
          message: string
          request_id: string
          severity: string
          status: string
          user_id: string
        }[]
      }
      admin_reputation_review_metrics: {
        Args: never
        Returns: {
          admin_only_reviews: number
          flagged_reviews: number
          planner_network_reviews: number
          private_reviews: number
          total_reviews: number
        }[]
      }
      admin_reset_free_tier_device_sessions: {
        Args: { target_user_id: string }
        Returns: number
      }
      admin_restore_deleted_wedding: {
        Args: { target_wedding_id: string }
        Returns: undefined
      }
      admin_restore_pricing_catalog_revision: {
        Args: { revision_id: string }
        Returns: {
          catalog_key: string
          config: Json
          created_at: string
          display_name: string
          is_active: boolean
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "pricing_catalog"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_review_vendor_listing: {
        Args: { approve: boolean; listing_id: string; verify?: boolean }
        Returns: undefined
      }
      admin_set_active_pricing_catalog: {
        Args: { next_config: Json; next_display_name?: string }
        Returns: {
          catalog_key: string
          config: Json
          created_at: string
          display_name: string
          is_active: boolean
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "pricing_catalog"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_ai_plan_config: {
        Args: {
          add_on_annual_lookup_key_input?: string
          add_on_lookup_key_input?: string
          add_on_separate_input?: boolean
          ai_enabled_input: boolean
          audience_input: string
          monthly_message_cap_input: number
        }
        Returns: {
          add_on_annual_lookup_key: string | null
          add_on_lookup_key: string | null
          add_on_separate: boolean
          ai_enabled: boolean
          audience: string
          created_at: string
          monthly_cost_cap_usd: number
          monthly_message_cap: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ai_plan_configs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_couple_planning_pass: {
        Args: {
          new_planning_pass_expires_at?: string
          new_planning_pass_status: string
          target_user_id: string
        }
        Returns: undefined
      }
      admin_set_free_tier_review_state: {
        Args: {
          new_review_notes?: string
          new_review_status: string
          new_verified_couple?: boolean
          target_user_id: string
        }
        Returns: undefined
      }
      admin_set_planner_access: {
        Args: {
          new_subscription_expires_at?: string
          new_subscription_status: string
          new_verified: boolean
          target_user_id: string
        }
        Returns: undefined
      }
      admin_set_planner_founding_contributor: {
        Args: {
          new_founding_planner_contributor: boolean
          target_user_id: string
        }
        Returns: undefined
      }
      admin_set_user_role: {
        Args: {
          new_role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
        }
        Returns: undefined
      }
      admin_set_vendor_listing_profile: {
        Args: {
          listing_id: string
          new_featured_rank?: number
          new_profile_kind: string
          new_public_listing_note?: string
        }
        Returns: undefined
      }
      admin_set_vendor_reputation_visibility: {
        Args: { new_visibility: string; review_id: string }
        Returns: undefined
      }
      admin_set_vendor_subscription: {
        Args: {
          listing_id: string
          new_subscription_expires_at?: string
          new_subscription_status: string
        }
        Returns: undefined
      }
      admin_set_vendor_suggestion_status: {
        Args: { new_status: string; suggestion_id: string }
        Returns: undefined
      }
      append_professional_contract_event: {
        Args: {
          _actor_email?: string
          _actor_name?: string
          _actor_source?: string
          _contract_id: string
          _event_type: string
          _payload?: Json
        }
        Returns: undefined
      }
      apply_current_user_signup_target: {
        Args: {
          target_committee_name?: string
          target_full_name?: string
          target_planner_type_text?: string
          target_role_text: string
        }
        Returns: {
          committee_name: string
          planner_type: string
          role: string
        }[]
      }
      approve_planner_code_link_request: {
        Args: { request_id_input: string }
        Returns: string
      }
      archive_planner_client_guarded: {
        Args: { target_client_id: string }
        Returns: Json
      }
      archive_vendor_workspace_update: {
        Args: { archived_input?: boolean; target_update_id: string }
        Returns: {
          archived_at: string | null
          archived_by_user_id: string | null
          created_at: string
          created_by_user_id: string
          id: string
          is_archived: boolean
          note_message: string | null
          update_type: string
          updated_at: string
          vendor_id: string
          wedding_id: string
        }
        SetofOptions: {
          from: "*"
          to: "workspace_vendor_updates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      archive_wedding_workspace: {
        Args: { target_wedding_id: string }
        Returns: undefined
      }
      assert_current_auth_session_active: { Args: never; Returns: undefined }
      assert_wedding_feature_enabled: {
        Args: {
          audit_event_type?: string
          required_feature: string
          target_wedding_id: string
        }
        Returns: undefined
      }
      available_committee_seats: {
        Args: { target_wedding_id: string }
        Returns: number
      }
      can_access_contribution_record: {
        Args: { _client_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_own_commercial_document: {
        Args: { _document_id: string }
        Returns: boolean
      }
      can_access_vendor_price_observation: {
        Args: { _client_id: string; _user_id: string }
        Returns: boolean
      }
      can_connect_professional_document: {
        Args: {
          _client_id?: string
          _role: string
          _user_id: string
          _vendor_id?: string
        }
        Returns: boolean
      }
      can_create_replacement_free_wedding: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      can_edit_wedding_space_plan: {
        Args: { target_wedding_id: string }
        Returns: boolean
      }
      can_manage_committee_members: {
        Args: { target_chair_user_id: string }
        Returns: boolean
      }
      can_manage_own_commercial_document: {
        Args: { _role: string; _user_id: string }
        Returns: boolean
      }
      can_manage_vendor_reputation_review: {
        Args: {
          _client_id: string
          _owner_user_id: string
          _reviewer_user_id: string
          _source_vendor_id: string
        }
        Returns: boolean
      }
      can_manage_wedding: {
        Args: { target_wedding_id: string }
        Returns: boolean
      }
      can_manage_wedding_memberships: {
        Args: { target_wedding_id: string }
        Returns: boolean
      }
      cancel_document_request: {
        Args: { request_id_input: string }
        Returns: {
          budget_amount: number | null
          client_id: string | null
          created_at: string
          due_at: string | null
          event_date: string | null
          id: string
          message: string | null
          metadata: Json
          recipient_name: string
          recipient_role: string
          recipient_user_id: string
          request_type: string
          requester_email: string | null
          requester_name: string
          requester_phone: string | null
          requester_role: string
          requester_user_id: string
          responded_at: string | null
          response_contract_id: string | null
          response_document_id: string | null
          service_category: string | null
          status: string
          title: string
          updated_at: string
          vendor_id: string | null
          vendor_listing_id: string | null
          viewed_at: string | null
          wedding_id: string | null
          wedding_name: string | null
        }
        SetofOptions: {
          from: "*"
          to: "document_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      canonical_budget_category: {
        Args: { category_name: string }
        Returns: string
      }
      canonical_vendor_category: {
        Args: { category_input: string }
        Returns: string
      }
      claim_lead_match_notification_deliveries: {
        Args: { batch_limit?: number }
        Returns: {
          action_path: string
          attempt_number: number
          category_key: string
          delivery_id: string
          recipient_email: string
          recipient_name: string
          recipient_role: string
          recipient_user_id: string
          wedding_name: string
        }[]
      }
      claim_vendor_listing: { Args: { claim_token: string }; Returns: string }
      claim_workspace_vendor_invite: {
        Args: { invite_token: string }
        Returns: string
      }
      commercial_document_status_allowed: {
        Args: { _document_type: string; _status: string }
        Returns: boolean
      }
      complete_lead_match_notification_delivery: {
        Args: {
          delivered: boolean
          delivery_id_input: string
          error_message_input?: string
          resend_email_id_input?: string
        }
        Returns: undefined
      }
      consume_professional_review_invite: {
        Args: {
          rating_input: number
          review_text_input?: string
          reviewer_name_input: string
          token_hash_input: string
        }
        Returns: string
      }
      convert_quote_to_invoice: {
        Args: { _due_date?: string; _issue_date?: string; _quote_id: string }
        Returns: {
          amount_paid: number
          balance_due: number
          client_id: string | null
          created_at: string
          currency: string
          discount_amount: number
          document_number: string
          document_type: string
          due_date: string | null
          id: string
          issue_date: string
          metadata: Json
          notes: string | null
          paid_date: string | null
          quote_source_id: string | null
          recipient_email: string | null
          recipient_name: string
          recipient_phone: string | null
          role: string
          status: string
          subtotal: number
          tax_amount: number
          terms: string | null
          title: string
          total_amount: number
          updated_at: string
          user_id: string
          vendor_id: string | null
          vendor_listing_id: string | null
          wedding_name: string | null
        }
        SetofOptions: {
          from: "*"
          to: "commercial_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_collaboration_attention: {
        Args: {
          action_label_input: string
          action_path_input: string
          attention_kind_input: string
          dedupe_key_prefix_input: string
          event_id_input: string
          metadata_input?: Json
          priority_input: string
          source_id_input: string
          source_type_input: string
          summary_input: string
          title_input: string
          wedding_id_input: string
        }
        Returns: number
      }
      create_commercial_document: {
        Args: {
          _client_id?: string
          _currency?: string
          _document_number?: string
          _document_type: string
          _due_date?: string
          _issue_date?: string
          _metadata?: Json
          _notes?: string
          _recipient_email?: string
          _recipient_name: string
          _recipient_phone?: string
          _role: string
          _status?: string
          _terms?: string
          _title: string
          _vendor_id?: string
          _vendor_listing_id?: string
          _wedding_name?: string
        }
        Returns: {
          amount_paid: number
          balance_due: number
          client_id: string | null
          created_at: string
          currency: string
          discount_amount: number
          document_number: string
          document_type: string
          due_date: string | null
          id: string
          issue_date: string
          metadata: Json
          notes: string | null
          paid_date: string | null
          quote_source_id: string | null
          recipient_email: string | null
          recipient_name: string
          recipient_phone: string | null
          role: string
          status: string
          subtotal: number
          tax_amount: number
          terms: string | null
          title: string
          total_amount: number
          updated_at: string
          user_id: string
          vendor_id: string | null
          vendor_listing_id: string | null
          wedding_name: string | null
        }
        SetofOptions: {
          from: "*"
          to: "commercial_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_planner_client_guarded: {
        Args: {
          client_name_input: string
          email_input?: string
          partner_name_input?: string
          phone_input?: string
          wedding_date_input?: string
          wedding_location_input?: string
        }
        Returns: {
          archived_at: string | null
          archived_by_user_id: string | null
          client_name: string
          created_at: string
          email: string | null
          expected_guest_count: number | null
          id: string
          is_archived: boolean
          linked_user_id: string | null
          notes: string | null
          partner_name: string | null
          phone: string | null
          planner_user_id: string
          updated_at: string
          wedding_budget_goal: number | null
          wedding_date: string | null
          wedding_id: string | null
          wedding_location: string | null
          workspace_status: string
        }
        SetofOptions: {
          from: "*"
          to: "planner_clients"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_vendor_follow_up_reminder: {
        Args: {
          due_date_input?: string
          notes_input?: string
          target_vendor_id: string
          title_input: string
        }
        Returns: string
      }
      create_vendor_workspace_task_suggestion: {
        Args: {
          description_input?: string
          suggested_due_date_input?: string
          target_vendor_id: string
          title_input: string
        }
        Returns: {
          accepted_task_id: string | null
          created_at: string
          created_by_user_id: string
          description: string | null
          id: string
          resolved_at: string | null
          resolved_by_user_id: string | null
          status: string
          suggested_due_date: string | null
          title: string
          updated_at: string
          vendor_id: string
          wedding_id: string
        }
        SetofOptions: {
          from: "*"
          to: "workspace_vendor_task_suggestions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_vendor_workspace_update: {
        Args: {
          note_message_input?: string
          target_vendor_id: string
          update_type_input: string
        }
        Returns: {
          archived_at: string | null
          archived_by_user_id: string | null
          created_at: string
          created_by_user_id: string
          id: string
          is_archived: boolean
          note_message: string | null
          update_type: string
          updated_at: string
          vendor_id: string
          wedding_id: string
        }
        SetofOptions: {
          from: "*"
          to: "workspace_vendor_updates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_wedding_workspace: {
        Args: {
          creator_role: string
          location_county_input?: string
          location_town_input?: string
          partner_email_input?: string
          wedding_date_input?: string
          wedding_name: string
        }
        Returns: {
          owner_membership_id: string
          partner_invite_id: string
          wedding_code: string
          wedding_id: string
        }[]
      }
      current_auth_session_uuid: { Args: never; Returns: string }
      current_user_email: { Args: never; Returns: string }
      current_user_primary_owned_wedding_id: { Args: never; Returns: string }
      delete_my_zania_profile_data: { Args: never; Returns: undefined }
      dismiss_vendor_workspace_task_suggestion: {
        Args: { target_suggestion_id: string }
        Returns: {
          accepted_task_id: string | null
          created_at: string
          created_by_user_id: string
          description: string | null
          id: string
          resolved_at: string | null
          resolved_by_user_id: string | null
          status: string
          suggested_due_date: string | null
          title: string
          updated_at: string
          vendor_id: string
          wedding_id: string
        }
        SetofOptions: {
          from: "*"
          to: "workspace_vendor_task_suggestions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ensure_commercial_document_share_token: {
        Args: { _document_id: string }
        Returns: string
      }
      ensure_contribution_share_token: {
        Args: { _client_id?: string }
        Returns: string
      }
      ensure_my_collaboration_code: { Args: never; Returns: string }
      ensure_professional_contract_share_token: {
        Args: { _contract_id: string }
        Returns: string
      }
      free_device_enforcement_required: {
        Args: { target_user_id?: string }
        Returns: boolean
      }
      generate_collaboration_code: { Args: never; Returns: string }
      generate_next_commercial_document_number: {
        Args: { _document_type: string; _issue_date?: string; _user_id: string }
        Returns: string
      }
      generate_wedding_code: { Args: never; Returns: string }
      get_ai_usage_status: {
        Args: never
        Returns: {
          add_on_annual_lookup_key: string
          add_on_lookup_key: string
          add_on_separate: boolean
          ai_enabled: boolean
          audience: string
          estimated_cost_used_usd: number
          messages_used: number
          month_start: string
          monthly_cost_cap_usd: number
          monthly_message_cap: number
          remaining_cost_usd: number
          remaining_messages: number
        }[]
      }
      get_assignee_timeline: { Args: { _share_token: string }; Returns: Json }
      get_couple_vendor_contract: {
        Args: { _vendor_id: string }
        Returns: {
          contract_id: string
          sent_at: string
          share_expires_at: string
          share_token: string
          signed_at: string
          status: string
          title: string
          updated_at: string
        }[]
      }
      get_current_ai_audience: { Args: never; Returns: string }
      get_my_wedding_ownership: {
        Args: never
        Returns: {
          location_county: string
          location_town: string
          owner_role: string
          partner_email: string
          partner_invite_expires_at: string
          partner_role: string
          partner_status: string
          wedding_code: string
          wedding_date: string
          wedding_id: string
          wedding_name: string
        }[]
      }
      get_planner_business_identity_key: {
        Args: { target_planner_user_id: string }
        Returns: string
      }
      get_planner_client_relationship_key: {
        Args: { target_client_id: string }
        Returns: string
      }
      get_planner_free_wedding_status: {
        Args: never
        Returns: {
          active_client_count: number
          archived_client_count: number
          business_identity_key: string
          can_add_wedding: boolean
          free_tier_consumed: boolean
          free_tier_locked_client_id: string
          free_tier_replacement_available: boolean
          gating_reason: string
          locked_client_is_meaningful: boolean
          meaningful_client_count: number
          planner_user_id: string
        }[]
      }
      get_public_budget_estimate: {
        Args: {
          county_input?: string
          guest_count_input?: number
          min_sample_size?: number
          venue_tier_input?: string
          wedding_style_input?: string
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
      get_public_platform_stats: {
        Args: never
        Returns: {
          rounded_wedding_plans_started: number
          wedding_plans_started_display: string
        }[]
      }
      get_shared_commercial_document: {
        Args: { _share_token: string }
        Returns: Json
      }
      get_shared_contributions_summary: {
        Args: { _share_token: string }
        Returns: Json
      }
      get_shared_professional_contract: {
        Args: { _share_token: string }
        Returns: Json
      }
      get_shared_timeline: { Args: { _share_token: string }; Returns: Json }
      get_vendor_learning_profile: {
        Args: { listing_id_input: string }
        Returns: {
          booked_average_amount: number
          booked_observation_count: number
          confidence_score: number
          declared_max_price: number
          declared_midpoint_price: number
          declared_min_price: number
          declared_range_count: number
          final_paid_average_amount: number
          final_paid_observation_count: number
          last_observed_at: string
          predicted_price: number
          quote_average_amount: number
          quote_observation_count: number
          quote_to_paid_delta_percent: number
          total_observation_count: number
          vendor_listing_id: string
        }[]
      }
      get_vendor_listing_claim: {
        Args: { claim_token: string }
        Returns: {
          business_name: string
          category: string
          claim_contact_email: string
          claim_expires_at: string
          claim_status: string
          listing_id: string
          location: string
        }[]
      }
      get_vendor_price_benchmark: {
        Args: {
          category_filter?: string
          county_filter?: string
          min_sample_size?: number
          vendor_listing_filter?: string
          venue_filter?: string
        }
        Returns: {
          average_amount: number
          benchmark_visible: boolean
          last_observation_at: string
          maximum_amount: number
          median_amount: number
          minimum_amount: number
          percentile_25_amount: number
          percentile_75_amount: number
          sample_size: number
          vendor_count: number
        }[]
      }
      get_vendor_reputation_benchmark: {
        Args: {
          category_filter?: string
          min_sample_size?: number
          vendor_listing_filter?: string
        }
        Returns: {
          average_communication_rating: number
          average_overall_rating: number
          average_punctuality_rating: number
          average_quality_rating: number
          average_reliability_rating: number
          average_value_rating: number
          benchmark_visible: boolean
          flagged_review_count: number
          hire_again_rate: number
          last_review_at: string
          on_time_rate: number
          sample_size: number
          vendor_count: number
        }[]
      }
      get_vendor_reputation_overview: {
        Args: { listing_id_input: string; min_sample_size?: number }
        Returns: {
          average_communication_rating: number
          average_overall_rating: number
          average_punctuality_rating: number
          average_quality_rating: number
          average_reliability_rating: number
          average_value_rating: number
          benchmark_visible: boolean
          flagged_review_count: number
          hire_again_rate: number
          last_review_at: string
          on_time_rate: number
          sample_size: number
        }[]
      }
      get_wedding_collaboration_metrics: {
        Args: { target_wedding_id: string }
        Returns: {
          budget_item_count: number
          collaborator_invite_count: number
          export_count: number
          guest_count: number
          last_activity_at: string
          task_count: number
          timeline_event_count: number
          vendor_count: number
        }[]
      }
      get_workspace_vendor_invite_claim: {
        Args: { invite_token: string }
        Returns: {
          invite_contact_email: string
          invite_contact_phone: string
          invite_expires_at: string
          invite_id: string
          invite_status: string
          vendor_category: string
          vendor_id: string
          vendor_name: string
          wedding_date: string
          wedding_id: string
          wedding_name: string
        }[]
      }
      get_zania_flag_bool: {
        Args: { fallback_value: boolean; flag_key: string }
        Returns: boolean
      }
      get_zania_flag_int: {
        Args: { fallback_value: number; flag_key: string }
        Returns: number
      }
      get_zania_flag_text: {
        Args: { fallback_value: string; flag_key: string }
        Returns: string
      }
      has_active_professional_entitlement: {
        Args: { _audience: string; _feature_key: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      infer_owner_membership_role: {
        Args: { target_user_id: string }
        Returns: string
      }
      is_active_auth_session: {
        Args: { target_session_id: string; target_user_id: string }
        Returns: boolean
      }
      is_current_trusted_auth_session: {
        Args: { target_session_id: string; target_user_id: string }
        Returns: boolean
      }
      is_linked_couple_of: { Args: { _client_id: string }; Returns: boolean }
      is_linked_planner_of: {
        Args: { _data_user_id: string }
        Returns: boolean
      }
      is_meaningful_wedding: {
        Args: { target_wedding_id: string }
        Returns: boolean
      }
      is_public_token_active: {
        Args: { _expires_at: string; _revoked_at: string }
        Returns: boolean
      }
      is_wedding_member: {
        Args: { target_wedding_id: string }
        Returns: boolean
      }
      is_wedding_owner: {
        Args: { target_wedding_id: string }
        Returns: boolean
      }
      issue_receipt_from_payment: {
        Args: { _document_id: string; _payment_id: string }
        Returns: {
          amount_paid: number
          balance_due: number
          client_id: string | null
          created_at: string
          currency: string
          discount_amount: number
          document_number: string
          document_type: string
          due_date: string | null
          id: string
          issue_date: string
          metadata: Json
          notes: string | null
          paid_date: string | null
          quote_source_id: string | null
          recipient_email: string | null
          recipient_name: string
          recipient_phone: string | null
          role: string
          status: string
          subtotal: number
          tax_amount: number
          terms: string | null
          title: string
          total_amount: number
          updated_at: string
          user_id: string
          vendor_id: string | null
          vendor_listing_id: string | null
          wedding_name: string | null
        }
        SetofOptions: {
          from: "*"
          to: "commercial_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      join_wedding_by_code: {
        Args: { wedding_code_input: string }
        Returns: {
          membership_id: string
          resolved_role: string
          wedding_id: string
        }[]
      }
      legacy_backfill_wedding_name: {
        Args: {
          fallback_name?: string
          partner_name: string
          primary_name: string
        }
        Returns: string
      }
      list_my_pending_wedding_invites: {
        Args: never
        Returns: {
          expires_at: string
          invite_id: string
          invite_type: string
          invited_by_name: string
          proposed_role: string
          wedding_code: string
          wedding_id: string
          wedding_name: string
        }[]
      }
      list_my_recent_workspace_events: {
        Args: { limit_input?: number }
        Returns: {
          action_label: string
          action_path: string
          event_type: string
          id: string
          metadata: Json
          occurred_at: string
          subject_id: string
          subject_type: string
          summary: string
          title: string
        }[]
      }
      lock_planner_free_wedding_slot: {
        Args: { target_client_id: string }
        Returns: undefined
      }
      log_account_audit_event: {
        Args: {
          event_metadata?: Json
          target_event_type: string
          target_user_id: string
          target_wedding_id: string
        }
        Returns: string
      }
      log_ai_assistant_message: {
        Args: {
          cached_input_tokens_input?: number
          estimated_cost_usd_input?: number
          feature_input?: string
          input_tokens_input?: number
          model_input?: string
          output_tokens_input?: number
          provider_request_count_input?: number
        }
        Returns: {
          add_on_annual_lookup_key: string
          add_on_lookup_key: string
          add_on_separate: boolean
          ai_enabled: boolean
          audience: string
          estimated_cost_used_usd: number
          messages_used: number
          month_start: string
          monthly_cost_cap_usd: number
          monthly_message_cap: number
          remaining_cost_usd: number
          remaining_messages: number
        }[]
      }
      log_public_token_access: {
        Args: {
          _details?: Json
          _event_type: string
          _status: string
          _token_kind: string
          _token_value: string
        }
        Returns: undefined
      }
      mark_document_request_viewed: {
        Args: { request_id_input: string }
        Returns: {
          budget_amount: number | null
          client_id: string | null
          created_at: string
          due_at: string | null
          event_date: string | null
          id: string
          message: string | null
          metadata: Json
          recipient_name: string
          recipient_role: string
          recipient_user_id: string
          request_type: string
          requester_email: string | null
          requester_name: string
          requester_phone: string | null
          requester_role: string
          requester_user_id: string
          responded_at: string | null
          response_contract_id: string | null
          response_document_id: string | null
          service_category: string | null
          status: string
          title: string
          updated_at: string
          vendor_id: string | null
          vendor_listing_id: string | null
          viewed_at: string | null
          wedding_id: string | null
          wedding_name: string | null
        }
        SetofOptions: {
          from: "*"
          to: "document_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_professional_contract_sent: {
        Args: { _contract_id: string }
        Returns: string
      }
      mark_vendor_booking_calendar_synced: {
        Args: { target_vendor_id: string }
        Returns: string
      }
      mask_email_address: { Args: { input_email: string }; Returns: string }
      owns_timeline: { Args: { _timeline_id: string }; Returns: boolean }
      planner_client_is_meaningful: {
        Args: { target_client_id: string }
        Returns: boolean
      }
      planner_has_active_subscription: {
        Args: { target_planner_user_id: string }
        Returns: boolean
      }
      planner_profile_has_full_access: {
        Args: { target_planner_user_id: string }
        Returns: boolean
      }
      planner_profile_is_collaboration_ready: {
        Args: { target_planner_user_id: string }
        Returns: boolean
      }
      preview_join_wedding_by_code: {
        Args: { wedding_code_input: string }
        Returns: {
          expires_at: string
          invite_id: string
          invite_type: string
          invited_by_name: string
          location_county: string
          location_town: string
          membership_status: string
          proposed_role: string
          wedding_code: string
          wedding_date: string
          wedding_id: string
          wedding_name: string
        }[]
      }
      primary_owned_wedding_id: {
        Args: { target_user_id: string }
        Returns: string
      }
      process_proactive_provider_matches: {
        Args: { batch_limit?: number }
        Returns: {
          deliveries_queued: number
          matches_created: number
          requests_matched: number
        }[]
      }
      public_rsvp_lookup: { Args: { _token: string }; Returns: Json }
      public_rsvp_respond: {
        Args: { _status: string; _token: string }
        Returns: Json
      }
      recalculate_commercial_document_totals: {
        Args: { _document_id: string }
        Returns: {
          amount_paid: number
          balance_due: number
          client_id: string | null
          created_at: string
          currency: string
          discount_amount: number
          document_number: string
          document_type: string
          due_date: string | null
          id: string
          issue_date: string
          metadata: Json
          notes: string | null
          paid_date: string | null
          quote_source_id: string | null
          recipient_email: string | null
          recipient_name: string
          recipient_phone: string | null
          role: string
          status: string
          subtotal: number
          tax_amount: number
          terms: string | null
          title: string
          total_amount: number
          updated_at: string
          user_id: string
          vendor_id: string | null
          vendor_listing_id: string | null
          wedding_name: string | null
        }
        SetofOptions: {
          from: "*"
          to: "commercial_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      recalculate_professional_risk: {
        Args: { target_user_id: string }
        Returns: {
          risk_level: string
          risk_score: number
        }[]
      }
      recalibrate_wedding_task_schedule: {
        Args: { target_wedding_id: string; wedding_date_input: string }
        Returns: number
      }
      record_commercial_document_payment: {
        Args: {
          _amount: number
          _budget_payment_id?: string
          _document_id: string
          _notes?: string
          _payment_date?: string
          _payment_method?: string
          _reference?: string
        }
        Returns: {
          amount: number
          budget_payment_id: string | null
          created_at: string
          document_id: string
          id: string
          notes: string | null
          payment_date: string
          payment_method: string
          recorded_by: string
          reference: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "commercial_document_payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_vendor_price_observation: {
        Args: {
          client?: string
          county_input?: string
          event_date_input?: string
          guest_count_input?: number
          is_anonymized_input?: boolean
          notes_input?: string
          observation_amount: number
          observation_category: string
          price_type_input?: string
          source_input?: string
          vendor_listing?: string
          vendor_name: string
          venue_input?: string
          wedding_style_input?: string
        }
        Returns: string
      }
      record_vendor_reputation_review: {
        Args: {
          client_input?: string
          communication_input: number
          delivered_on_time_input?: boolean
          event_date_input?: string
          is_anonymized_input?: boolean
          issue_flags_input?: string[]
          overall_rating_input: number
          private_notes_input?: string
          punctuality_input: number
          quality_input: number
          reliability_input: number
          source_vendor_input?: string
          value_input: number
          vendor_category_input?: string
          vendor_listing_input?: string
          vendor_name_input?: string
          visibility_input?: string
          would_hire_again_input?: boolean
        }
        Returns: string
      }
      record_workspace_event: {
        Args: {
          dedupe_key_input: string
          event_type_input: string
          metadata_input?: Json
          subject_id_input: string
          subject_type_input: string
          summary_input: string
          title_input: string
          wedding_id_input: string
        }
        Returns: string
      }
      refresh_professional_contract_share_token: {
        Args: { _contract_id: string }
        Returns: string
      }
      register_current_device_session: {
        Args: {
          target_app_installation_id?: string
          target_browser?: string
          target_device_id: string
          target_device_name?: string
          target_email?: string
          target_platform?: string
        }
        Returns: Json
      }
      reject_planner_code_link_request: {
        Args: { request_id_input: string }
        Returns: undefined
      }
      request_planner_link_by_code: {
        Args: { collaboration_code_input: string; note?: string }
        Returns: Json
      }
      request_planner_quote: {
        Args: {
          request_budget_amount?: number
          request_message?: string
          target_planner_user_id: string
        }
        Returns: {
          budget_amount: number | null
          client_id: string | null
          created_at: string
          due_at: string | null
          event_date: string | null
          id: string
          message: string | null
          metadata: Json
          recipient_name: string
          recipient_role: string
          recipient_user_id: string
          request_type: string
          requester_email: string | null
          requester_name: string
          requester_phone: string | null
          requester_role: string
          requester_user_id: string
          responded_at: string | null
          response_contract_id: string | null
          response_document_id: string | null
          service_category: string | null
          status: string
          title: string
          updated_at: string
          vendor_id: string | null
          vendor_listing_id: string | null
          viewed_at: string | null
          wedding_id: string | null
          wedding_name: string | null
        }
        SetofOptions: {
          from: "*"
          to: "document_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_planner_verification: { Args: never; Returns: undefined }
      request_vendor_quote: {
        Args: {
          request_budget_amount?: number
          request_message?: string
          target_vendor_id: string
        }
        Returns: {
          budget_amount: number | null
          client_id: string | null
          created_at: string
          due_at: string | null
          event_date: string | null
          id: string
          message: string | null
          metadata: Json
          recipient_name: string
          recipient_role: string
          recipient_user_id: string
          request_type: string
          requester_email: string | null
          requester_name: string
          requester_phone: string | null
          requester_role: string
          requester_user_id: string
          responded_at: string | null
          response_contract_id: string | null
          response_document_id: string | null
          service_category: string | null
          status: string
          title: string
          updated_at: string
          vendor_id: string | null
          vendor_listing_id: string | null
          viewed_at: string | null
          wedding_id: string | null
          wedding_name: string | null
        }
        SetofOptions: {
          from: "*"
          to: "document_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_vendor_verification: { Args: never; Returns: undefined }
      require_admin: { Args: never; Returns: undefined }
      require_planner_or_admin: { Args: never; Returns: undefined }
      resolve_vendor_workspace_wedding_id: {
        Args: { target_vendor_id: string }
        Returns: string
      }
      respond_to_document_request: {
        Args: {
          request_id_input: string
          response_contract_id_input?: string
          response_document_id_input?: string
        }
        Returns: {
          budget_amount: number | null
          client_id: string | null
          created_at: string
          due_at: string | null
          event_date: string | null
          id: string
          message: string | null
          metadata: Json
          recipient_name: string
          recipient_role: string
          recipient_user_id: string
          request_type: string
          requester_email: string | null
          requester_name: string
          requester_phone: string | null
          requester_role: string
          requester_user_id: string
          responded_at: string | null
          response_contract_id: string | null
          response_document_id: string | null
          service_category: string | null
          status: string
          title: string
          updated_at: string
          vendor_id: string | null
          vendor_listing_id: string | null
          viewed_at: string | null
          wedding_id: string | null
          wedding_name: string | null
        }
        SetofOptions: {
          from: "*"
          to: "document_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      restore_deleted_wedding_workspace: {
        Args: { target_wedding_id: string }
        Returns: undefined
      }
      revoke_professional_contract_share_token: {
        Args: { _contract_id: string }
        Returns: undefined
      }
      save_commercial_document_items: {
        Args: { _document_id: string; _items: Json }
        Returns: {
          amount_paid: number
          balance_due: number
          client_id: string | null
          created_at: string
          currency: string
          discount_amount: number
          document_number: string
          document_type: string
          due_date: string | null
          id: string
          issue_date: string
          metadata: Json
          notes: string | null
          paid_date: string | null
          quote_source_id: string | null
          recipient_email: string | null
          recipient_name: string
          recipient_phone: string | null
          role: string
          status: string
          subtotal: number
          tax_amount: number
          terms: string | null
          title: string
          total_amount: number
          updated_at: string
          user_id: string
          vendor_id: string | null
          vendor_listing_id: string | null
          wedding_name: string | null
        }
        SetofOptions: {
          from: "*"
          to: "commercial_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_planning_experiment: {
        Args: {
          booked_categories_input: string[]
          budget_rows_input: Json
          estimated_budget_input: number
          estimated_guest_count_input: number
          primary_next_action_input: Json
          secondary_actions_input: Json
          tasks_input: Json
          top_priorities_input: string[]
          wedding_date_input: string
          wedding_id_input: string
          wedding_type_input: string
        }
        Returns: Json
      }
      seed_professional_contract_created_events: {
        Args: never
        Returns: undefined
      }
      set_attention_item_state: {
        Args: { attention_id_input: string; next_status_input: string }
        Returns: {
          action_label: string | null
          action_path: string | null
          attention_kind: string
          completed_at: string | null
          created_at: string
          dedupe_key: string
          dismissed_at: string | null
          due_at: string | null
          event_id: string | null
          id: string
          metadata: Json
          priority: string
          read_at: string | null
          recipient_role: string
          recipient_user_id: string
          source_id: string | null
          source_type: string
          status: string
          summary: string | null
          title: string
          updated_at: string
          wedding_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "attention_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_planner_vendor_management_permission: {
        Args: {
          allowed: boolean
          target_planner_user_id: string
          target_wedding_id: string
        }
        Returns: boolean
      }
      set_primary_wedding_event: {
        Args: { target_event_id: string; target_wedding_id: string }
        Returns: {
          archived_at: string | null
          created_at: string
          end_time: string | null
          event_date: string
          id: string
          is_primary: boolean
          location: string | null
          name: string
          notes: string | null
          sort_order: number
          start_time: string | null
          updated_at: string
          venue_name: string | null
          wedding_id: string
        }
        SetofOptions: {
          from: "*"
          to: "wedding_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_self_directory_opt_out: {
        Args: { new_opt_out: boolean }
        Returns: undefined
      }
      set_self_marketing_opt_out: {
        Args: { new_opt_out: boolean }
        Returns: undefined
      }
      set_vendor_selection_status: {
        Args: { selection_status_input: string; vendor_id_input: string }
        Returns: string
      }
      sign_out_other_device_sessions: { Args: never; Returns: number }
      sign_owned_professional_contract: {
        Args: { _contract_id: string; _signed_name?: string }
        Returns: Json
      }
      sign_shared_professional_contract: {
        Args: {
          _agreed_to_terms?: boolean
          _share_token: string
          _signed_name: string
          _signer_email?: string
          _signer_locale?: string
          _signer_timezone?: string
          _signer_user_agent?: string
        }
        Returns: Json
      }
      soft_delete_wedding_workspace: {
        Args: { deletion_reason_input?: string; target_wedding_id: string }
        Returns: undefined
      }
      sync_current_user_signup_role: {
        Args: never
        Returns: {
          committee_name: string
          planner_type: string
          role: string
        }[]
      }
      sync_professional_contract_completion_event: {
        Args: { _contract_id: string }
        Returns: undefined
      }
      sync_vendor_document_payment_to_budget: {
        Args: {
          _amount: number
          _document_id: string
          _notes?: string
          _payment_date?: string
          _reference?: string
        }
        Returns: string
      }
      sync_wedding_meaningful_state: {
        Args: { target_wedding_id: string }
        Returns: boolean
      }
      trust_current_device_session: {
        Args: {
          target_app_installation_id?: string
          target_browser?: string
          target_device_id: string
          target_device_name?: string
          target_platform?: string
        }
        Returns: Json
      }
      update_vendor_booking_internal_notes: {
        Args: { internal_notes_input?: string; target_vendor_id: string }
        Returns: string
      }
      update_vendor_booking_status: {
        Args: { status_input: string; target_vendor_id: string }
        Returns: string
      }
      update_vendor_follow_up_reminder_status: {
        Args: { status_input: string; target_reminder_id: string }
        Returns: string
      }
      update_vendor_payment_state: {
        Args: {
          amount_paid_input?: number
          contract_amount_input?: number
          deposit_amount_input?: number
          payment_due_date_input?: string
          payment_status_input?: string
          vendor_id_input: string
        }
        Returns: {
          amount_paid: number
          category: string
          client_id: string | null
          committee_role_in_charge: string | null
          contract_status: string
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
          vendor_calendar_synced_at: string | null
          vendor_internal_notes: string | null
          vendor_listing_id: string | null
          wedding_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "vendors"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_vendor_workspace_record: {
        Args: {
          amount_paid_input?: number
          contract_amount_input?: number
          internal_notes_input?: string
          payment_due_date_input?: string
          payment_status_input?: string
          status_input?: string
          target_vendor_id: string
        }
        Returns: {
          amount_paid: number
          category: string
          client_id: string | null
          committee_role_in_charge: string | null
          contract_status: string
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
          vendor_calendar_synced_at: string | null
          vendor_internal_notes: string | null
          vendor_listing_id: string | null
          wedding_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "vendors"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_vendor_workspace_task: {
        Args: { completed_input?: boolean; target_task_id: string }
        Returns: {
          assigned_membership_id: string | null
          assigned_to: string | null
          category: string | null
          client_id: string | null
          completed: boolean
          created_at: string
          delegatable: boolean
          description: string | null
          due_date: string | null
          due_date_source: string
          event_id: string | null
          id: string
          last_auto_scheduled_at: string | null
          manually_scheduled_at: string | null
          phase: string | null
          priority_level: number | null
          recommended_role: string | null
          schedule_anchor_date: string | null
          source_vendor_id: string | null
          template_key: string | null
          template_source: string | null
          timeline_offset_days: number | null
          title: string
          user_id: string
          visibility: string
          wedding_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "tasks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_committee_invite: {
        Args: {
          committee_email_input: string
          committee_role_input?: string
          target_wedding_id: string
        }
        Returns: {
          expires_at: string
          invite_id: string
          membership_id: string
          proposed_role: string
          seats_remaining: number
          wedding_id: string
        }[]
      }
      upsert_partner_invite: {
        Args: { partner_email_input: string; target_wedding_id: string }
        Returns: {
          expires_at: string
          invite_id: string
          membership_id: string
          proposed_role: string
          wedding_id: string
        }[]
      }
      upsert_wedding_lifecycle_history: {
        Args: { target_wedding_id: string }
        Returns: undefined
      }
      vendor_listing_has_full_access: {
        Args: { target_listing_id: string }
        Returns: boolean
      }
      vendor_listing_is_collaboration_ready: {
        Args: { target_listing_id: string }
        Returns: boolean
      }
      verify_device_verification_otp: {
        Args: {
          submitted_code: string
          target_app_installation_id?: string
          target_browser?: string
          target_challenge_id: string
          target_device_id: string
          target_device_name?: string
          target_platform?: string
        }
        Returns: Json
      }
      wedding_has_feature: {
        Args: { target_feature_key: string; target_wedding_id: string }
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
