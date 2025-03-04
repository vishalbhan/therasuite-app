export type Database = {
  public: {
    Tables: {
      appointments: {
        Row: {
          id: string
          client_name: string
          client_email: string
          session_date: string
          session_length: number
          session_type: 'video' | 'in_person'
          status: 'scheduled' | 'completed' | 'cancelled' | 'expired';
          price: number
          created_at?: string
        }
        Insert: {
          id?: string
          client_name: string
          client_email: string
          session_date: string
          session_length: number
          session_type: 'video' | 'in_person'
          status?: 'scheduled' | 'completed' | 'cancelled' | 'expired';
          price: number
          created_at?: string
        }
        Update: {
          id?: string
          client_name?: string
          client_email?: string
          session_date?: string
          session_length?: number
          session_type?: 'video' | 'in_person'
          status?: 'scheduled' | 'completed' | 'cancelled' | 'expired';
          price?: number
          created_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          email: string
          created_at: string
        }
        Insert: {
          id: string
          email?: string
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          created_at?: string
        }
      }
    }
  }
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