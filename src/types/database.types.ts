export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          created_at: string | null
          email: string
          full_name: string
          photo_url: string | null
          professional_type: 'psychologist' | 'therapist' | 'coach' | null
          working_hours: Record<string, Array<{
            start: string;
            end: string;
            enabled: boolean;
          }>> | null
          session_length: number | null
          session_type: 'video' | 'in_person' | 'hybrid' | null
          collect_payments: boolean | null
          price_per_session: number | null
          payment_details: string | null
          location: {
            address: string
            city: string
            state: string
            country: string
            postal_code: string
          } | null
        }
        Insert: {
          id: string
          email: string
          full_name: string
          created_at?: string | null
          photo_url?: string | null
          professional_type?: 'psychologist' | 'therapist' | 'coach' | null
          working_hours?: Record<string, Array<{
            start: string;
            end: string;
            enabled: boolean;
          }>> | null
          session_length?: number | null
          session_type?: 'video' | 'in_person' | 'hybrid' | null
          collect_payments?: boolean | null
          price_per_session?: number | null
          payment_details?: string | null
          location?: {
            address: string
            city: string
            state: string
            country: string
            postal_code: string
          } | null
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          created_at?: string | null
          photo_url?: string | null
          professional_type?: 'psychologist' | 'therapist' | 'coach' | null
          working_hours?: Record<string, Array<{
            start: string;
            end: string;
            enabled: boolean;
          }>> | null
          session_length?: number | null
          session_type?: 'video' | 'in_person' | 'hybrid' | null
          collect_payments?: boolean | null
          price_per_session?: number | null
          payment_details?: string | null
          location?: {
            address: string
            city: string
            state: string
            country: string
            postal_code: string
          } | null
        }
      }
      appointments: {
        Row: {
          id: string
          therapist_id: string
          client_name: string
          client_email: string
          session_date: string
          session_length: number
          session_type: 'video' | 'in_person'
          price: number
          payment_status: 'pending' | 'invoice_sent' | 'received'
          payment_date: string | null
          created_at: string | null
        }
        Insert: {
          id: string
          therapist_id: string
          client_name: string
          client_email: string
          session_date: string
          session_length: number
          session_type: 'video' | 'in_person'
          price: number
          payment_status?: 'pending' | 'invoice_sent' | 'received'
          payment_date?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          therapist_id?: string
          client_name?: string
          client_email?: string
          session_date?: string
          session_length?: number
          session_type?: 'video' | 'in_person'
          price?: number
          payment_status?: 'pending' | 'invoice_sent' | 'received'
          payment_date?: string | null
          created_at?: string | null
        }
      }
    }
  }
} 