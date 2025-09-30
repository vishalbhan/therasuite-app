import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/types/database.types';

type AppointmentRequest = Database['public']['Tables']['appointment_requests']['Row'];
type AppointmentRequestInsert = Database['public']['Tables']['appointment_requests']['Insert'];

export interface CreateAppointmentRequestData {
  therapistId: string;
  clientName: string;
  clientEmail: string;
  clientMessage?: string;
  preferredDates: string[];
  sessionLength?: number;
}

export async function createAppointmentRequest(data: CreateAppointmentRequestData) {
  const requestData: AppointmentRequestInsert = {
    therapist_id: data.therapistId,
    client_name: data.clientName,
    client_email: data.clientEmail,
    client_message: data.clientMessage || null,
    preferred_dates: data.preferredDates,
    session_length: data.sessionLength || 60,
    status: 'pending',
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
  };

  const { data: request, error } = await supabase
    .from('appointment_requests')
    .insert(requestData)
    .select()
    .single();

  if (error) throw error;
  return request;
}

export async function getAppointmentRequestsForTherapist(therapistId: string) {
  const { data, error } = await supabase
    .from('appointment_requests')
    .select('*')
    .eq('therapist_id', therapistId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as AppointmentRequest[];
}

export async function updateAppointmentRequestStatus(
  requestId: string,
  status: 'approved' | 'declined',
  therapistResponse?: string,
  appointmentId?: string
) {
  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (therapistResponse) {
    updateData.therapist_response = therapistResponse;
  }

  if (appointmentId && status === 'approved') {
    updateData.appointment_id = appointmentId;
  }

  const { data, error } = await supabase
    .from('appointment_requests')
    .update(updateData)
    .eq('id', requestId)
    .select()
    .single();

  if (error) throw error;
  return data as AppointmentRequest;
}

export async function getTherapistByUsername(username: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username.toLowerCase())
    .eq('is_onboarding_complete', true)
    .single();

  if (error) throw error;
  return data as Database['public']['Tables']['profiles']['Row'];
}

export async function getPendingRequestsCount(therapistId: string) {
  const { count, error } = await supabase
    .from('appointment_requests')
    .select('*', { count: 'exact', head: true })
    .eq('therapist_id', therapistId)
    .eq('status', 'pending');

  if (error) throw error;
  return count || 0;
}

export function formatPreferredDates(dates: any): string[] {
  if (!dates) return [];
  if (Array.isArray(dates)) return dates;
  if (typeof dates === 'string') {
    try {
      return JSON.parse(dates);
    } catch {
      return [dates];
    }
  }
  return [];
}
