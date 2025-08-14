export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          photo_url: string | null;
          professional_type: 'psychologist' | 'therapist' | 'coach' | null;
          session_length: number | null;
          session_type: 'video' | 'in_person' | 'hybrid' | null;
          collect_payments: boolean;
          price_per_session: number | null;
          payment_details: string | null;
          location: string | null;
          created_at: string;
          is_onboarding_complete: boolean;
        };
        Insert: {
          id: string;
          email?: string;
          full_name?: string | null;
          photo_url?: string | null;
          professional_type?: 'psychologist' | 'therapist' | 'coach' | null;
          session_length?: number | null;
          session_type?: 'video' | 'in_person' | 'hybrid' | null;
          collect_payments?: boolean;
          price_per_session?: number | null;
          payment_details?: string | null;
          location?: string | null;
          created_at?: string;
          is_onboarding_complete?: boolean;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          photo_url?: string | null;
          professional_type?: 'psychologist' | 'therapist' | 'coach' | null;
          session_length?: number | null;
          session_type?: 'video' | 'in_person' | 'hybrid' | null;
          collect_payments?: boolean;
          price_per_session?: number | null;
          payment_details?: string | null;
          location?: string | null;
          created_at?: string;
          is_onboarding_complete?: boolean;
        };
      };
      appointments: {
        Row: {
          id: string;
          therapist_id: string;
          client_id: string;
          client_name: string;
          client_email: string;
          session_date: string;
          session_length: number;
          session_type: 'video' | 'in_person';
          status: 'scheduled' | 'completed' | 'cancelled';
          notes: string | null;
          price: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          therapist_id: string;
          client_id: string;
          client_name: string;
          client_email: string;
          session_date: string;
          session_length: number;
          session_type: 'video' | 'in_person';
          status?: 'scheduled' | 'completed' | 'cancelled';
          notes?: string | null;
          price: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          therapist_id?: string;
          client_id?: string;
          client_name?: string;
          client_email?: string;
          session_date?: string;
          session_length?: number;
          session_type?: 'video' | 'in_person';
          status?: 'scheduled' | 'completed' | 'cancelled';
          notes?: string | null;
          price?: number;
          created_at?: string;
        };
      };
      clients: {
        Row: {
          id: string;
          therapist_id: string;
          name: string;
          email: string;
          avatar_color: string;
          initials: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          therapist_id: string;
          name: string;
          email: string;
          avatar_color: string;
          initials: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          therapist_id?: string;
          name?: string;
          email?: string;
          avatar_color?: string;
          initials?: string;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
} 