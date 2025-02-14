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
          status: 'scheduled' | 'completed' | 'cancelled'
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
          status?: 'scheduled' | 'completed' | 'cancelled'
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
          status?: 'scheduled' | 'completed' | 'cancelled'
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