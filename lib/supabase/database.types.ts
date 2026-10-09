export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      accounts: {
        Row: {
          created_at: string
          id: string
          industry: string | null
          legal_name: string
          notes: string | null
          status: Database["public"]["Enums"]["account_status"]
          tax_id: string | null
          trade_name: string
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          industry?: string | null
          legal_name: string
          notes?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          tax_id?: string | null
          trade_name: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          industry?: string | null
          legal_name?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          tax_id?: string | null
          trade_name?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      activities: {
        Row: {
          account_id: string | null
          body: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          direction: string
          external_message_id: string | null
          id: string
          occurred_at: string
          opportunity_id: string | null
          subject: string | null
          type: string
        }
        Insert: {
          account_id?: string | null
          body?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          direction: string
          external_message_id?: string | null
          id?: string
          occurred_at?: string
          opportunity_id?: string | null
          subject?: string | null
          type: string
        }
        Update: {
          account_id?: string | null
          body?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          direction?: string
          external_message_id?: string | null
          id?: string
          occurred_at?: string
          opportunity_id?: string | null
          subject?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_events: {
        Row: {
          cache_creation_input_tokens: number
          cache_read_input_tokens: number
          conversation_id: string | null
          cost_usd: number
          created_at: string
          id: string
          input_tokens: number
          model: string
          model_calls: number
          output_tokens: number
          purpose: string
        }
        Insert: {
          cache_creation_input_tokens?: number
          cache_read_input_tokens?: number
          conversation_id?: string | null
          cost_usd?: number
          created_at?: string
          id?: string
          input_tokens?: number
          model: string
          model_calls?: number
          output_tokens?: number
          purpose: string
        }
        Update: {
          cache_creation_input_tokens?: number
          cache_read_input_tokens?: number
          conversation_id?: string | null
          cost_usd?: number
          created_at?: string
          id?: string
          input_tokens?: number
          model?: string
          model_calls?: number
          output_tokens?: number
          purpose?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          account_id: string | null
          action: string
          actor_user_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: number
          ip: unknown
          user_agent: string | null
        }
        Insert: {
          account_id?: string | null
          action: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: never
          ip?: unknown
          user_agent?: string | null
        }
        Update: {
          account_id?: string | null
          action?: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: never
          ip?: unknown
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_periods: {
        Row: {
          amount_due: number
          amount_paid: number
          created_at: string
          due_date: string
          id: string
          period_end: string
          period_start: string
          pricing_snapshot: Json
          status: Database["public"]["Enums"]["billing_status"]
          subscription_id: string
          updated_at: string
        }
        Insert: {
          amount_due: number
          amount_paid?: number
          created_at?: string
          due_date: string
          id?: string
          period_end: string
          period_start: string
          pricing_snapshot: Json
          status?: Database["public"]["Enums"]["billing_status"]
          subscription_id: string
          updated_at?: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          created_at?: string
          due_date?: string
          id?: string
          period_end?: string
          period_start?: string
          pricing_snapshot?: Json
          status?: Database["public"]["Enums"]["billing_status"]
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_periods_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          created_at: string
          external_identifier: string | null
          id: string
          provider: string
          status: string
          type: string
        }
        Insert: {
          created_at?: string
          external_identifier?: string | null
          id?: string
          provider: string
          status: string
          type: string
        }
        Update: {
          created_at?: string
          external_identifier?: string | null
          id?: string
          provider?: string
          status?: string
          type?: string
        }
        Relationships: []
      }
      client_solutions: {
        Row: {
          account_id: string
          actual_days: number | null
          catalog_solution_id: string | null
          complexity_factor: number
          created_at: string
          day_rate_snapshot: number
          estimated_days: number
          expansion_discount_percent: number
          go_live_date: string | null
          gross_implementation_price: number
          gross_maintenance_increment: number
          id: string
          maintenance_discount_percent: number
          name: string
          net_implementation_price: number
          net_maintenance_increment: number
          owner_user_id: string | null
          pricing_snapshot: Json
          problem_statement: string | null
          quote_id: string | null
          scope: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["solution_status"]
          updated_at: string
        }
        Insert: {
          account_id: string
          actual_days?: number | null
          catalog_solution_id?: string | null
          complexity_factor: number
          created_at?: string
          day_rate_snapshot: number
          estimated_days: number
          expansion_discount_percent?: number
          go_live_date?: string | null
          gross_implementation_price: number
          gross_maintenance_increment: number
          id?: string
          maintenance_discount_percent?: number
          name: string
          net_implementation_price: number
          net_maintenance_increment: number
          owner_user_id?: string | null
          pricing_snapshot: Json
          problem_statement?: string | null
          quote_id?: string | null
          scope?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["solution_status"]
          updated_at?: string
        }
        Update: {
          account_id?: string
          actual_days?: number | null
          catalog_solution_id?: string | null
          complexity_factor?: number
          created_at?: string
          day_rate_snapshot?: number
          estimated_days?: number
          expansion_discount_percent?: number
          go_live_date?: string | null
          gross_implementation_price?: number
          gross_maintenance_increment?: number
          id?: string
          maintenance_discount_percent?: number
          name?: string
          net_implementation_price?: number
          net_maintenance_increment?: number
          owner_user_id?: string | null
          pricing_snapshot?: Json
          problem_statement?: string | null
          quote_id?: string | null
          scope?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["solution_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_solutions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_solutions_catalog_solution_id_fkey"
            columns: ["catalog_solution_id"]
            isOneToOne: false
            referencedRelation: "solution_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_solutions_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_solutions_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: true
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_roles: {
        Row: {
          contact_id: string
          role: string
        }
        Insert: {
          contact_id: string
          role: string
        }
        Update: {
          contact_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_roles_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          account_id: string
          created_at: string
          email: string
          first_name: string
          id: string
          is_active: boolean
          is_primary_billing: boolean
          job_title: string | null
          last_name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          email: string
          first_name: string
          id?: string
          is_active?: boolean
          is_primary_billing?: boolean
          job_title?: string | null
          last_name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          is_active?: boolean
          is_primary_billing?: boolean
          job_title?: string | null
          last_name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          account_id: string | null
          assigned_to: string | null
          bot_context: Json
          channel_id: string
          contact_id: string | null
          created_at: string
          external_participant_id: string | null
          human_handoff_requested: boolean
          id: string
          last_message_at: string | null
          lead_id: string | null
          profile_name: string | null
          qualification_state: string
          status: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          assigned_to?: string | null
          bot_context?: Json
          channel_id: string
          contact_id?: string | null
          created_at?: string
          external_participant_id?: string | null
          human_handoff_requested?: boolean
          id?: string
          last_message_at?: string | null
          lead_id?: string | null
          profile_name?: string | null
          qualification_state?: string
          status: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          assigned_to?: string | null
          bot_context?: Json
          channel_id?: string
          contact_id?: string | null
          created_at?: string
          external_participant_id?: string | null
          human_handoff_requested?: boolean
          id?: string
          last_message_at?: string | null
          lead_id?: string | null
          profile_name?: string | null
          qualification_state?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      credential_metadata: {
        Row: {
          auth_type: string
          created_at: string
          expires_at: string | null
          id: string
          integration_id: string
          last_accessed_at: string | null
          rotated_at: string | null
          scopes: string[] | null
          secret_reference: string
        }
        Insert: {
          auth_type: string
          created_at?: string
          expires_at?: string | null
          id?: string
          integration_id: string
          last_accessed_at?: string | null
          rotated_at?: string | null
          scopes?: string[] | null
          secret_reference: string
        }
        Update: {
          auth_type?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          integration_id?: string
          last_accessed_at?: string | null
          rotated_at?: string | null
          scopes?: string[] | null
          secret_reference?: string
        }
        Relationships: [
          {
            foreignKeyName: "credential_metadata_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      implementation_tasks: {
        Row: {
          actual_hours: number | null
          assignee: string | null
          client_solution_id: string
          created_at: string
          due_date: string | null
          estimate_hours: number | null
          id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          actual_hours?: number | null
          assignee?: string | null
          client_solution_id: string
          created_at?: string
          due_date?: string | null
          estimate_hours?: number | null
          id?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          actual_hours?: number | null
          assignee?: string | null
          client_solution_id?: string
          created_at?: string
          due_date?: string | null
          estimate_hours?: number | null
          id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "implementation_tasks_assignee_fkey"
            columns: ["assignee"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implementation_tasks_client_solution_id_fkey"
            columns: ["client_solution_id"]
            isOneToOne: false
            referencedRelation: "client_solutions"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          account_id: string | null
          created_at: string
          credential_reference: string | null
          display_name: string
          external_account_identifier: string | null
          id: string
          last_error: string | null
          last_health_check_at: string | null
          provider: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          credential_reference?: string | null
          display_name: string
          external_account_identifier?: string | null
          id?: string
          last_error?: string | null
          last_health_check_at?: string | null
          provider: string
          status: string
          type: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          credential_reference?: string | null
          display_name?: string
          external_account_identifier?: string | null
          id?: string
          last_error?: string | null
          last_health_check_at?: string | null
          provider?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          billing_period_id: string
          created_at: string
          document_url: string | null
          external_id: string | null
          id: string
          issue_date: string | null
          number: string | null
          provider: string | null
          status: string
        }
        Insert: {
          billing_period_id: string
          created_at?: string
          document_url?: string | null
          external_id?: string | null
          id?: string
          issue_date?: string | null
          number?: string | null
          provider?: string | null
          status: string
        }
        Update: {
          billing_period_id?: string
          created_at?: string
          document_url?: string | null
          external_id?: string | null
          id?: string
          issue_date?: string | null
          number?: string | null
          provider?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_billing_period_id_fkey"
            columns: ["billing_period_id"]
            isOneToOne: false
            referencedRelation: "billing_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          api_knowledge: string
          attribution: Json | null
          company: string
          consent_given: boolean
          converted_account_id: string | null
          created_at: string
          email: string
          hours_per_month: number | null
          id: string
          monthly_volume: number | null
          name: string
          owner_user_id: string | null
          people_involved: number | null
          phone: string | null
          primary_goal: string
          raw_need_description: string
          score: number
          source: string
          status: string
          systems: string[]
          updated_at: string
        }
        Insert: {
          api_knowledge?: string
          attribution?: Json | null
          company: string
          consent_given: boolean
          converted_account_id?: string | null
          created_at?: string
          email: string
          hours_per_month?: number | null
          id?: string
          monthly_volume?: number | null
          name: string
          owner_user_id?: string | null
          people_involved?: number | null
          phone?: string | null
          primary_goal: string
          raw_need_description: string
          score?: number
          source: string
          status?: string
          systems?: string[]
          updated_at?: string
        }
        Update: {
          api_knowledge?: string
          attribution?: Json | null
          company?: string
          consent_given?: boolean
          converted_account_id?: string | null
          created_at?: string
          email?: string
          hours_per_month?: number | null
          id?: string
          monthly_volume?: number | null
          name?: string
          owner_user_id?: string | null
          people_involved?: number | null
          phone?: string | null
          primary_goal?: string
          raw_need_description?: string
          score?: number
          source?: string
          status?: string
          systems?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_converted_account_id_fkey"
            columns: ["converted_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_expenses: {
        Row: {
          amount: number
          campaign: string | null
          clicks: number | null
          category: string
          channel: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string
          impressions: number | null
          ends_on: string | null
          id: string
          recurrence: string
          source: string
          external_ref: string | null
          spent_on: string
        }
        Insert: {
          amount: number
          campaign?: string | null
          clicks?: number | null
          category: string
          channel?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description: string
          impressions?: number | null
          ends_on?: string | null
          id?: string
          recurrence?: string
          source?: string
          external_ref?: string | null
          spent_on: string
        }
        Update: {
          amount?: number
          clicks?: number | null
          campaign?: string | null
          category?: string
          channel?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          impressions?: number | null
          description?: string
          ends_on?: string | null
          id?: string
          recurrence?: string
          source?: string
          external_ref?: string | null
          spent_on?: string
        }
        Relationships: []
      }
      marketing_spend: {
        Row: {
          amount: number
          channel: string
          created_at: string
          id: string
          notes: string | null
          period: string
        }
        Insert: {
          amount: number
          channel: string
          created_at?: string
          id?: string
          notes?: string | null
          period: string
        }
        Update: {
          amount?: number
          channel?: string
          created_at?: string
          id?: string
          notes?: string | null
          period?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string | null
          conversation_id: string
          created_at: string
          delivery_status: string | null
          direction: string
          external_id: string | null
          id: string
          message_type: string
          metadata: Json
          sender_ref: string | null
          sent_at: string
        }
        Insert: {
          body?: string | null
          conversation_id: string
          created_at?: string
          delivery_status?: string | null
          direction: string
          external_id?: string | null
          id?: string
          message_type: string
          metadata?: Json
          sender_ref?: string | null
          sent_at: string
        }
        Update: {
          body?: string | null
          conversation_id?: string
          created_at?: string
          delivery_status?: string | null
          direction?: string
          external_id?: string | null
          id?: string
          message_type?: string
          metadata?: Json
          sender_ref?: string | null
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          account_id: string
          contact_id: string | null
          created_at: string
          expected_close_date: string | null
          expected_value: number | null
          id: string
          lost_reason: string | null
          next_action: string | null
          next_action_at: string | null
          owner_user_id: string | null
          probability: number | null
          problem_summary: string | null
          stage: string
          title: string
          updated_at: string
        }
        Insert: {
          account_id: string
          contact_id?: string | null
          created_at?: string
          expected_close_date?: string | null
          expected_value?: number | null
          id?: string
          lost_reason?: string | null
          next_action?: string | null
          next_action_at?: string | null
          owner_user_id?: string | null
          probability?: number | null
          problem_summary?: string | null
          stage?: string
          title: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          contact_id?: string | null
          created_at?: string
          expected_close_date?: string | null
          expected_value?: number | null
          id?: string
          lost_reason?: string | null
          next_action?: string | null
          next_action_at?: string | null
          owner_user_id?: string | null
          probability?: number | null
          problem_summary?: string | null
          stage?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          external_event_id: string
          id: string
          normalized_payload: Json
          payment_id: string | null
          provider: string
          received_at: string
        }
        Insert: {
          external_event_id: string
          id?: string
          normalized_payload: Json
          payment_id?: string | null
          provider: string
          received_at?: string
        }
        Update: {
          external_event_id?: string
          id?: string
          normalized_payload?: Json
          payment_id?: string | null
          provider?: string
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_reminders: {
        Row: {
          billing_period_id: string
          cancelled_at: string | null
          channel: string
          contact_id: string | null
          created_at: string
          id: string
          scheduled_at: string
          sent_at: string | null
          status: string
          template_key: string
          template_version: string
        }
        Insert: {
          billing_period_id: string
          cancelled_at?: string | null
          channel: string
          contact_id?: string | null
          created_at?: string
          id?: string
          scheduled_at: string
          sent_at?: string | null
          status?: string
          template_key: string
          template_version?: string
        }
        Update: {
          billing_period_id?: string
          cancelled_at?: string | null
          channel?: string
          contact_id?: string | null
          created_at?: string
          id?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          template_key?: string
          template_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_reminders_billing_period_id_fkey"
            columns: ["billing_period_id"]
            isOneToOne: false
            referencedRelation: "billing_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          billing_period_id: string
          created_at: string
          currency: string
          external_payment_id: string
          id: string
          paid_at: string | null
          provider: string
          raw_provider_payload: Json
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          billing_period_id: string
          created_at?: string
          currency: string
          external_payment_id: string
          id?: string
          paid_at?: string | null
          provider: string
          raw_provider_payload?: Json
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_period_id?: string
          created_at?: string
          currency?: string
          external_payment_id?: string
          id?: string
          paid_at?: string | null
          provider?: string
          raw_provider_payload?: Json
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_billing_period_id_fkey"
            columns: ["billing_period_id"]
            isOneToOne: false
            referencedRelation: "billing_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          complexity_tiers: Json
          created_at: string
          created_by: string | null
          day_rate: number
          effective_from: string
          expansion_discount_tiers: Json
          id: string
          maintenance_brackets: Json
          min_implementation: number
          min_maintenance: number
          published_at: string | null
          rounding_multiple: number
          version: string
        }
        Insert: {
          complexity_tiers: Json
          created_at?: string
          created_by?: string | null
          day_rate: number
          effective_from: string
          expansion_discount_tiers: Json
          id?: string
          maintenance_brackets: Json
          min_implementation: number
          min_maintenance: number
          published_at?: string | null
          rounding_multiple?: number
          version: string
        }
        Update: {
          complexity_tiers?: Json
          created_at?: string
          created_by?: string | null
          day_rate?: number
          effective_from?: string
          expansion_discount_tiers?: Json
          id?: string
          maintenance_brackets?: Json
          min_implementation?: number
          min_maintenance?: number
          published_at?: string | null
          rounding_multiple?: number
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_id: string | null
          created_at: string
          display_name: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          two_factor_required: boolean
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          display_name: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          two_factor_required?: boolean
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          display_name?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          two_factor_required?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          account_id: string
          active_solutions_after_addition: number
          approved_at: string | null
          complexity: string
          complexity_factor: number
          created_at: string
          created_by: string | null
          day_rate_snapshot: number
          estimated_days: number
          estimation_notes: string | null
          expansion_discount_percent: number
          gross_implementation_price: number
          gross_maintenance_increment: number
          id: string
          maintenance_discount_percent: number
          name: string
          net_implementation_price: number
          net_maintenance_increment: number
          pricing_rule_version: string
          pricing_snapshot: Json
          status: string
          third_party_costs: Json
          updated_at: string
        }
        Insert: {
          account_id: string
          active_solutions_after_addition: number
          approved_at?: string | null
          complexity: string
          complexity_factor: number
          created_at?: string
          created_by?: string | null
          day_rate_snapshot: number
          estimated_days: number
          estimation_notes?: string | null
          expansion_discount_percent: number
          gross_implementation_price: number
          gross_maintenance_increment: number
          id?: string
          maintenance_discount_percent: number
          name: string
          net_implementation_price: number
          net_maintenance_increment: number
          pricing_rule_version: string
          pricing_snapshot: Json
          status?: string
          third_party_costs?: Json
          updated_at?: string
        }
        Update: {
          account_id?: string
          active_solutions_after_addition?: number
          approved_at?: string | null
          complexity?: string
          complexity_factor?: number
          created_at?: string
          created_by?: string | null
          day_rate_snapshot?: number
          estimated_days?: number
          estimation_notes?: string | null
          expansion_discount_percent?: number
          gross_implementation_price?: number
          gross_maintenance_increment?: number
          id?: string
          maintenance_discount_percent?: number
          name?: string
          net_implementation_price?: number
          net_maintenance_increment?: number
          pricing_rule_version?: string
          pricing_snapshot?: Json
          status?: string
          third_party_costs?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          id: string
          created_at: string
          rating: number
          body: string
          author_name: string
          product_label: string | null
          contact: string | null
          status: string
          source: string
          moderated_at: string | null
          moderated_by: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          rating: number
          body: string
          author_name: string
          product_label?: string | null
          contact?: string | null
          status?: string
          source?: string
          moderated_at?: string | null
          moderated_by?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          rating?: number
          body?: string
          author_name?: string
          product_label?: string | null
          contact?: string | null
          status?: string
          source?: string
          moderated_at?: string | null
          moderated_by?: string | null
        }
        Relationships: []
      }
      product_variants: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          variant_key: string
          product_key: string
          product_name: string
          format_label: string
          sku: string | null
          price: number | null
          active: boolean
          track_stock: boolean
          stock: number
          low_stock_threshold: number
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          variant_key: string
          product_key: string
          product_name: string
          format_label?: string
          sku?: string | null
          price?: number | null
          active?: boolean
          track_stock?: boolean
          stock?: number
          low_stock_threshold?: number
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          variant_key?: string
          product_key?: string
          product_name?: string
          format_label?: string
          sku?: string | null
          price?: number | null
          active?: boolean
          track_stock?: boolean
          stock?: number
          low_stock_threshold?: number
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          id: string
          created_at: string
          variant_id: string
          quantity: number
          reason: string
          note: string | null
          stock_after: number
          created_by: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          variant_id: string
          quantity: number
          reason: string
          note?: string | null
          stock_after: number
          created_by?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          variant_id?: string
          quantity?: number
          reason?: string
          note?: string | null
          stock_after?: number
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      site_visits: {
        Row: {
          fbclid: boolean
          id: string
          landing_path: string | null
          referrer: string | null
          session_id: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          visited_at: string
        }
        Insert: {
          fbclid?: boolean
          id?: string
          landing_path?: string | null
          referrer?: string | null
          session_id: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          visited_at?: string
        }
        Update: {
          fbclid?: boolean
          id?: string
          landing_path?: string | null
          referrer?: string | null
          session_id?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          visited_at?: string
        }
        Relationships: []
      }
      solution_catalog: {
        Row: {
          active: boolean
          category: string
          created_at: string
          default_complexity: string
          default_days: number
          description: string | null
          id: string
          name: string
          reusable_template_key: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          default_complexity: string
          default_days: number
          description?: string | null
          id?: string
          name: string
          reusable_template_key?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          default_complexity?: string
          default_days?: number
          description?: string | null
          id?: string
          name?: string
          reusable_template_key?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      store_sale_counters: {
        Row: {
          prefix: string
          year: number
          last_value: number
        }
        Insert: {
          prefix: string
          year: number
          last_value?: number
        }
        Update: {
          prefix?: string
          year?: number
          last_value?: number
        }
        Relationships: []
      }
      store_sales: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          number: string
          order_number: string | null
          status: string
          lead_id: string | null
          conversation_id: string | null
          customer: Json
          destination: string
          delivery_mode: string
          carrier: string | null
          payment_method: string | null
          document: string | null
          billing: Json | null
          tracking: string | null
          notes: string | null
          current_version: number
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          number: string
          order_number?: string | null
          status: string
          lead_id?: string | null
          conversation_id?: string | null
          customer: Json
          destination?: string
          delivery_mode?: string
          carrier?: string | null
          payment_method?: string | null
          document?: string | null
          billing?: Json | null
          tracking?: string | null
          notes?: string | null
          current_version?: number
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          number?: string
          order_number?: string | null
          status?: string
          lead_id?: string | null
          conversation_id?: string | null
          customer?: Json
          destination?: string
          delivery_mode?: string
          carrier?: string | null
          payment_method?: string | null
          document?: string | null
          billing?: Json | null
          tracking?: string | null
          notes?: string | null
          current_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_sales_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      store_quote_versions: {
        Row: {
          id: string
          created_at: string
          sale_id: string
          version: number
          lines: Json
          products_total: number
          net: number
          vat: number
          shipping: number | null
          total: number
          valid_until: string
          notes: string | null
          changes: string | null
          created_via: string
          created_by: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          sale_id: string
          version: number
          lines: Json
          products_total: number
          net: number
          vat: number
          shipping?: number | null
          total: number
          valid_until: string
          notes?: string | null
          changes?: string | null
          created_via: string
          created_by?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          sale_id?: string
          version?: number
          lines?: Json
          products_total?: number
          net?: number
          vat?: number
          shipping?: number | null
          total?: number
          valid_until?: string
          notes?: string | null
          changes?: string | null
          created_via?: string
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_quote_versions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "store_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      store_payments: {
        Row: {
          id: string
          created_at: string
          sale_id: string
          quote_version: number
          method: string
          amount: number
          expected_amount: number
          status: string
          payer: string | null
          paid_on: string | null
          receipt_ref: string | null
          note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          review_note: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          sale_id: string
          quote_version: number
          method: string
          amount: number
          expected_amount: number
          status?: string
          payer?: string | null
          paid_on?: string | null
          receipt_ref?: string | null
          note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          review_note?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          sale_id?: string
          quote_version?: number
          method?: string
          amount?: number
          expected_amount?: number
          status?: string
          payer?: string | null
          paid_on?: string | null
          receipt_ref?: string | null
          note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          review_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "store_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      store_sale_events: {
        Row: {
          id: string
          created_at: string
          sale_id: string
          from_status: string | null
          to_status: string
          via: string
          note: string | null
          actor: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          sale_id: string
          from_status?: string | null
          to_status: string
          via: string
          note?: string | null
          actor?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          sale_id?: string
          from_status?: string | null
          to_status?: string
          via?: string
          note?: string | null
          actor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_sale_events_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "store_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_items: {
        Row: {
          client_solution_id: string | null
          created_at: string
          discount_percent: number
          ends_at: string | null
          id: string
          metadata: Json
          name: string
          net_amount: number
          quantity: number
          starts_at: string
          subscription_id: string
          third_party: boolean
          type: string
          unit_amount: number
        }
        Insert: {
          client_solution_id?: string | null
          created_at?: string
          discount_percent?: number
          ends_at?: string | null
          id?: string
          metadata?: Json
          name: string
          net_amount: number
          quantity?: number
          starts_at: string
          subscription_id: string
          third_party?: boolean
          type: string
          unit_amount: number
        }
        Update: {
          client_solution_id?: string | null
          created_at?: string
          discount_percent?: number
          ends_at?: string | null
          id?: string
          metadata?: Json
          name?: string
          net_amount?: number
          quantity?: number
          starts_at?: string
          subscription_id?: string
          third_party?: boolean
          type?: string
          unit_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "subscription_items_client_solution_id_fkey"
            columns: ["client_solution_id"]
            isOneToOne: false
            referencedRelation: "client_solutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_items_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          account_id: string
          billing_day: number
          cancelled_at: string | null
          created_at: string
          currency: string
          id: string
          payment_method_type: string | null
          payment_provider_customer_id: string | null
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          account_id: string
          billing_day: number
          cancelled_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          payment_method_type?: string | null
          payment_provider_customer_id?: string | null
          started_at: string
          status: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          billing_day?: number
          cancelled_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          payment_method_type?: string | null
          payment_provider_customer_id?: string | null
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      third_party_cost_items: {
        Row: {
          client_solution_id: string
          cost: number
          created_at: string
          currency: string
          description: string
          documentation_url: string | null
          ends_at: string | null
          id: string
          markup_percent: number
          paid_by: string
          periodicity: string
          provider: string
          starts_at: string
        }
        Insert: {
          client_solution_id: string
          cost: number
          created_at?: string
          currency: string
          description: string
          documentation_url?: string | null
          ends_at?: string | null
          id?: string
          markup_percent?: number
          paid_by: string
          periodicity: string
          provider: string
          starts_at: string
        }
        Update: {
          client_solution_id?: string
          cost?: number
          created_at?: string
          currency?: string
          description?: string
          documentation_url?: string | null
          ends_at?: string | null
          id?: string
          markup_percent?: number
          paid_by?: string
          periodicity?: string
          provider?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "third_party_cost_items_client_solution_id_fkey"
            columns: ["client_solution_id"]
            isOneToOne: false
            referencedRelation: "client_solutions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_quote_transaction: { Args: { p_quote_id: string }; Returns: Json }
      convert_lead_to_account: {
        Args: { p_industry: string; p_lead_id: string }
        Returns: Json
      }
      current_account_id: { Args: never; Returns: string }
      next_store_sale_number: { Args: { p_prefix: string; p_year: number }; Returns: string }
      current_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      is_admin: { Args: never; Returns: boolean }
      is_internal: { Args: never; Returns: boolean }
      record_inventory_movement: {
        Args: { p_variant_id: string; p_quantity: number; p_reason: string; p_note?: string | null }
        Returns: number
      }
      get_dashboard_metrics: {
        Args: never
        Returns: {
          current_mrr: number
          active_clients: number
          account_total: number
          expansion_mrr_this_month: number
          active_implementations: number
          receivable_amount: number
          overdue_amount: number
          overdue_periods: number
          blocked_tasks: number
          overdue_tasks: number
          new_leads: number
          lead_total: number
          sold_solutions_this_month: number
          billing_by_month: Json
          pipeline_counts: Json
        }[]
      }
      list_account_summaries_page: {
        Args: { p_limit: number; p_offset: number; p_search: string | null }
        Returns: {
          id: string
          legal_name: string
          trade_name: string
          status: Database["public"]["Enums"]["account_status"]
          industry: string
          contact_count: number
          active_solutions: number
          mrr: number
          total_count: number
        }[]
      }
      list_billing_period_summaries_page: {
        Args: { p_limit: number; p_offset: number }
        Returns: {
          id: string
          account_id: string
          account_name: string
          period_start: string
          period_end: string
          due_date: string
          amount_due: number
          amount_paid: number
          status: Database["public"]["Enums"]["billing_status"]
          total_count: number
        }[]
      }
      list_conversation_summaries_page: {
        Args: { p_limit: number; p_offset: number }
        Returns: {
          id: string
          profile_name: string | null
          external_participant_id: string | null
          status: string
          last_message_at: string | null
          human_handoff_requested: boolean
          last_message: string | null
          total_count: number
        }[]
      }
      list_portal_solutions: {
        Args: never
        Returns: {
          account_id: string
          estimated_days: number
          id: string
          name: string
          status: Database["public"]["Enums"]["solution_status"]
        }[]
      }
      list_solution_summaries_page: {
        Args: { p_limit: number; p_offset: number }
        Returns: {
          id: string
          account_id: string
          account_name: string
          name: string
          status: Database["public"]["Enums"]["solution_status"]
          estimated_days: number
          net_implementation_price: number
          net_maintenance_increment: number
          pricing_version: string
          created_at: string
          total_count: number
        }[]
      }
      process_payment_event_transaction: {
        Args: {
          p_amount: number
          p_currency: string
          p_external_event_id: string
          p_external_payment_id: string
          p_normalized_payload?: Json
          p_provider: string
          p_status: Database["public"]["Enums"]["payment_status"]
        }
        Returns: Json
      }
    }
    Enums: {
      account_status: "lead" | "prospect" | "active" | "paused" | "churned"
      app_role:
        | "owner_admin"
        | "sales"
        | "technical"
        | "finance"
        | "support"
        | "client_admin"
        | "client_billing"
        | "client_technical"
        | "client_viewer"
      billing_status: "upcoming" | "pending" | "paid" | "overdue" | "void"
      payment_status:
        | "pending"
        | "approved"
        | "rejected"
        | "refunded"
        | "cancelled"
      solution_status:
        | "proposed"
        | "approved"
        | "development"
        | "testing"
        | "production"
        | "paused"
        | "cancelled"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_status: ["lead", "prospect", "active", "paused", "churned"],
      app_role: [
        "owner_admin",
        "sales",
        "technical",
        "finance",
        "support",
        "client_admin",
        "client_billing",
        "client_technical",
        "client_viewer",
      ],
      billing_status: ["upcoming", "pending", "paid", "overdue", "void"],
      payment_status: [
        "pending",
        "approved",
        "rejected",
        "refunded",
        "cancelled",
      ],
      solution_status: [
        "proposed",
        "approved",
        "development",
        "testing",
        "production",
        "paused",
        "cancelled",
      ],
    },
  },
} as const
