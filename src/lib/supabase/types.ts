export type UserRole = "church" | "musician";
export type RequestStatus = "open" | "in_progress" | "filled" | "cancelled";
export type MessageKind = "text" | "proposal";
export type ProposalStatus = "pending" | "accepted" | "declined" | "countered";
export type UnavailabilitySource = "manual" | "ical" | "google" | "pco";
export type CalendarKind = "ical" | "google" | "pco";
export type ReviewerRole = "musician" | "church";

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
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"], "created_at">;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
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
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["bookings"]["Insert"]>;
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
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      request_status: RequestStatus;
      message_kind: MessageKind;
      proposal_status: ProposalStatus;
      unavailability_source: UnavailabilitySource;
      calendar_kind: CalendarKind;
      reviewer_role: ReviewerRole;
    };
  };
};
