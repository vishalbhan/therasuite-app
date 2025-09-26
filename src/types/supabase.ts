export interface Database {
  public: {
    Tables: {
      appointments: {
        Row: {
          id: string;
          created_at?: string;
          therapist_id: string;
          client_id: string;
          client_name: string;
          client_email: string;
          session_date: string;
          session_length: number;
          session_type: 'video' | 'in_person';
          status: 'scheduled' | 'completed' | 'cancelled';
          price: number;
          notes?: string;
          video_provider?: string | null;
          custom_meeting_link?: string | null;
        };
        Insert: Omit<Database['public']['Tables']['appointments']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['appointments']['Row']>;
      };
      clients: {
        Row: {
          id: string;
          created_at?: string;
          therapist_id: string;
          name: string;
          email: string;
          phone_number?: string;
          diagnosis?: string;
          timezone: string;
          avatar_color: string;
          initials: string;
        };
        Insert: Omit<Database['public']['Tables']['clients']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['clients']['Row']>;
      };
      profiles: {
        Row: {
          id: string;
          created_at?: string;
          email?: string;
          full_name?: string;
          photo_url?: string;
          location?: {
            address: string;
            city: string;
            state: string;
            country: string;
            postal_code: string;
          };
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at: string;
          updated_at: string;
          is_active: boolean;
        };
        Insert: Omit<Database['public']['Tables']['push_subscriptions']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['push_subscriptions']['Row']>;
      };
      notification_preferences: {
        Row: {
          id: string;
          user_id: string;
          appointment_reminder_enabled: boolean;
          reminder_minutes_before: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['notification_preferences']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['notification_preferences']['Row']>;
      };
      notification_queue: {
        Row: {
          id: string;
          user_id: string;
          appointment_id: string;
          notification_type: string;
          scheduled_for: string;
          sent_at?: string;
          status: 'pending' | 'sent' | 'failed' | 'cancelled';
          retry_count: number;
          error_message?: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['notification_queue']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['notification_queue']['Row']>;
      };
    };
  };
}

export interface Client {
  id: string;
  therapist_id: string;
  name: string;
  email: string;
  phone_number?: string;
  diagnosis?: string;
  timezone: string;
  avatar_color: string;
  initials: string;
  created_at: string;
}

export type Appointment = {
  id: string;
  therapist_id: string;
  client_id: string;
  client_name: string;
  client_email: string;
  session_date: string;
  session_length: number;
  session_type: 'video' | 'in_person';
  price: number;
  notes?: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'expired';
  video_provider?: 'therasuite' | 'google_meet' | 'zoom' | null;
  custom_meeting_link?: string | null;
}; 