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