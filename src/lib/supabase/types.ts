export type UserRole = "church" | "musician";
export type RequestStatus = "open" | "in_progress" | "filled" | "cancelled";
export type MessageKind = "text" | "proposal";
export type ProposalStatus = "pending" | "accepted" | "declined" | "countered";
export type UnavailabilitySource = "manual" | "ical" | "google" | "pco";
export type CalendarKind = "ical" | "google" | "pco";
export type ReviewerRole = "musician" | "church";
export type PaymentStatus = "scheduled" | "capturing" | "captured" | "failed" | "cancelled";

type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          display_name: string;
          email: string;
          avatar_url: string | null;
          deleted_at: string | null;
          is_admin: boolean;
          verified: boolean;
          suspended_at: string | null;
          suspend_reason: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"],
          "created_at" | "deleted_at" | "is_admin" | "verified" | "suspended_at" | "suspend_reason"
        > & {
          deleted_at?: string | null;
          is_admin?: boolean;
          verified?: boolean;
          suspended_at?: string | null;
          suspend_reason?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      admin_actions: {
        Row: {
          id: string;
          actor_id: string;
          actor_email: string;
          action: string;
          target_type: string | null;
          target_id: string | null;
          target_label: string | null;
          level: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id: string;
          actor_email: string;
          action: string;
          target_type?: string | null;
          target_id?: string | null;
          target_label?: string | null;
          level?: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["admin_actions"]["Insert"]>;
        Relationships: [];
      };
      notification_preferences: {
        Row: {
          profile_id: string;
          payment_emails: boolean;
          activity_emails: boolean;
          system_emails: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          profile_id: string;
          payment_emails?: boolean;
          activity_emails?: boolean;
          system_emails?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notification_preferences"]["Insert"]>;
        Relationships: [];
      };
      musician_profiles: {
        Row: {
          id: string;
          profile_id: string;
          city: string;
          state: string;
          lat: number | null;
          lng: number | null;
          instruments: string[];
          instruments_detail: Json;
          primary_instrument: string;
          years_experience: number;
          is_volunteer: boolean;
          fee_min: number;
          fee_max: number;
          bio: string;
          denomination_tags: string[];
          rating: number;
          review_count: number;
          available: boolean;
          address: string | null;
          zip: string | null;
          travel_radius_miles: number;
          youtube_links: string[];
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["musician_profiles"]["Row"], "created_at" | "rating" | "review_count">;
        Update: Partial<Database["public"]["Tables"]["musician_profiles"]["Insert"]>;
        Relationships: [];
      };
      church_profiles: {
        Row: {
          id: string;
          profile_id: string;
          church_name: string;
          city: string;
          state: string;
          lat: number | null;
          lng: number | null;
          capacity: number | null;
          service_count: number | null;
          musical_style: string | null;
          production_level: string | null;
          address: string | null;
          zip: string | null;
          contact_name: string | null;
          denomination: string | null;
          musical_approach: string | null;
          music_value: string | null;
          worship_theology: string | null;
          additional_worship_values: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["church_profiles"]["Row"], "created_at">;
        Update: Partial<Database["public"]["Tables"]["church_profiles"]["Insert"]>;
        Relationships: [];
      };
      service_requests: {
        Row: {
          id: string;
          church_profile_id: string;
          title: string;
          service_type: string;
          service_date: string;
          service_time: string | null;
          location: string | null;
          instruments_needed: string[];
          rehearsals: string;
          tech_setup: string[];
          offered_fee: number | null;
          fee_type: string;
          setlist_url: string | null;
          notes: string | null;
          status: RequestStatus;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["service_requests"]["Row"], "created_at" | "id" | "status"> & { status?: RequestStatus };
        Update: Partial<Database["public"]["Tables"]["service_requests"]["Insert"]>;
        Relationships: [];
      };
      applications: {
        Row: {
          id: string;
          request_id: string;
          musician_profile_id: string;
          message: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["applications"]["Row"], "created_at" | "id">;
        Update: Partial<Database["public"]["Tables"]["applications"]["Insert"]>;
        Relationships: [];
      };
      threads: {
        Row: {
          id: string;
          request_id: string;
          church_profile_id: string;
          musician_profile_id: string;
          last_read_at_church: string | null;
          last_read_at_musician: string | null;
          archived_at: string | null;
          archive_reason: string | null;
          last_message_at: string | null;
          last_message_preview: string | null;
          last_message_kind: MessageKind | null;
          last_message_sender_id: string | null;
          unread_count_church: number;
          unread_count_musician: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          church_profile_id: string;
          musician_profile_id: string;
          last_read_at_church?: string | null;
          last_read_at_musician?: string | null;
          archived_at?: string | null;
          archive_reason?: string | null;
          last_message_at?: string | null;
          last_message_preview?: string | null;
          last_message_kind?: MessageKind | null;
          last_message_sender_id?: string | null;
          unread_count_church?: number;
          unread_count_musician?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["threads"]["Insert"]>;
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          thread_id: string;
          sender_profile_id: string;
          kind: MessageKind;
          body: string | null;
          proposal: Json | null;
          proposal_status: ProposalStatus | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["messages"]["Row"], "created_at" | "id" | "proposal" | "proposal_status"> & {
          proposal?: Json | null;
          proposal_status?: ProposalStatus | null;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Insert"]>;
        Relationships: [];
      };
      reviews: {
        Row: {
          id: string;
          period_id: string;
          reviewer_role: ReviewerRole;
          rating: number;
          body: string;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          period_id: string;
          reviewer_role: ReviewerRole;
          rating: number;
          body: string;
          submitted_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reviews"]["Insert"]>;
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          request_id: string;
          thread_id: string;
          church_profile_id: string;
          musician_profile_id: string;
          service_date: string;
          fee: number | null;
          fee_type: string | null;
          accepted_at: string;
          cancelled_at: string | null;
          cancelled_by: string | null;
          cancel_reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          thread_id: string;
          church_profile_id: string;
          musician_profile_id: string;
          service_date: string;
          fee?: number | null;
          fee_type?: string | null;
          accepted_at?: string;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          cancel_reason?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["bookings"]["Insert"]>;
        Relationships: [];
      };
      stripe_accounts: {
        Row: {
          id: string;
          musician_profile_id: string;
          stripe_account_id: string;
          charges_enabled: boolean;
          payouts_enabled: boolean;
          details_submitted: boolean;
          requirements_due: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          musician_profile_id: string;
          stripe_account_id: string;
          charges_enabled?: boolean;
          payouts_enabled?: boolean;
          details_submitted?: boolean;
          requirements_due?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["stripe_accounts"]["Insert"]>;
        Relationships: [];
      };
      stripe_customers: {
        Row: {
          id: string;
          church_profile_id: string;
          stripe_customer_id: string;
          default_payment_method: string | null;
          card_brand: string | null;
          card_last4: string | null;
          card_exp_month: number | null;
          card_exp_year: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          church_profile_id: string;
          stripe_customer_id: string;
          default_payment_method?: string | null;
          card_brand?: string | null;
          card_last4?: string | null;
          card_exp_month?: number | null;
          card_exp_year?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["stripe_customers"]["Insert"]>;
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          booking_id: string;
          church_profile_id: string;
          musician_profile_id: string;
          status: PaymentStatus;
          musician_amount: number;
          platform_fee: number;
          stripe_fee_estimate: number;
          application_fee_amount: number;
          charge_total: number;
          stripe_payment_intent_id: string | null;
          stripe_charge_id: string | null;
          stripe_customer_id: string;
          stripe_destination_id: string;
          stripe_payment_method_id: string;
          scheduled_for: string;
          attempted_at: string | null;
          captured_at: string | null;
          failed_at: string | null;
          failure_message: string | null;
          cancelled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          church_profile_id: string;
          musician_profile_id: string;
          status?: PaymentStatus;
          musician_amount: number;
          platform_fee: number;
          stripe_fee_estimate: number;
          application_fee_amount: number;
          charge_total: number;
          stripe_payment_intent_id?: string | null;
          stripe_charge_id?: string | null;
          stripe_customer_id: string;
          stripe_destination_id: string;
          stripe_payment_method_id: string;
          scheduled_for: string;
          attempted_at?: string | null;
          captured_at?: string | null;
          failed_at?: string | null;
          failure_message?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
        Relationships: [];
      };
      review_periods: {
        Row: {
          id: string;
          booking_id: string;
          reveal_at: string;
          released_at: string | null;
          prompt_musician_at: string | null;
          prompt_church_at: string | null;
          reminder_musician_at: string | null;
          reminder_church_at: string | null;
          released_email_musician_at: string | null;
          released_email_church_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          reveal_at: string;
          released_at?: string | null;
          prompt_musician_at?: string | null;
          prompt_church_at?: string | null;
          reminder_musician_at?: string | null;
          reminder_church_at?: string | null;
          released_email_musician_at?: string | null;
          released_email_church_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["review_periods"]["Insert"]>;
        Relationships: [];
      };
      unavailability_blocks: {
        Row: {
          id: string;
          musician_profile_id: string;
          start_date: string;
          end_date: string;
          source: UnavailabilitySource;
          external_id: string | null;
          note: string | null;
          connection_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          musician_profile_id: string;
          start_date: string;
          end_date: string;
          source?: UnavailabilitySource;
          external_id?: string | null;
          note?: string | null;
          connection_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["unavailability_blocks"]["Insert"]>;
        Relationships: [];
      };
      calendar_connections: {
        Row: {
          id: string;
          musician_profile_id: string;
          kind: CalendarKind;
          label: string;
          ical_url: string | null;
          meta: Json;
          last_synced_at: string | null;
          last_error: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          musician_profile_id: string;
          kind: CalendarKind;
          label: string;
          ical_url?: string | null;
          meta?: Json;
          last_synced_at?: string | null;
          last_error?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["calendar_connections"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      admin_user_rollups: {
        Row: {
          id: string;
          role: UserRole;
          name: string;
          email: string;
          is_admin: boolean;
          verified: boolean;
          suspended_at: string | null;
          suspend_reason: string | null;
          created_at: string;
          side_profile_id: string | null;
          city: string;
          state: string;
          bookings: number;
          amount_cents: number;
          search_text: string;
        };
        Relationships: [];
      };
      admin_daily_payment_rollups: {
        Row: {
          day: string;
          captured_count: number;
          gross_cents: number;
          platform_cents: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      admin_set_user_verified: {
        Args: {
          p_actor_id: string;
          p_actor_email: string;
          p_target_id: string;
          p_verified: boolean;
        };
        Returns: undefined;
      };
      admin_set_user_suspension: {
        Args: {
          p_actor_id: string;
          p_actor_email: string;
          p_target_id: string;
          p_suspended: boolean;
          p_reason?: string | null;
        };
        Returns: undefined;
      };
    };
    Enums: {
      user_role: UserRole;
      request_status: RequestStatus;
      message_kind: MessageKind;
      proposal_status: ProposalStatus;
      unavailability_source: UnavailabilitySource;
      calendar_kind: CalendarKind;
      reviewer_role: ReviewerRole;
      payment_status: PaymentStatus;
    };
  };
};
