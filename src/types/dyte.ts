export interface DyteMeeting {
  id: string;
  title: string;
  preferred_region: string;
  record_on_start: boolean;
  created_at: string;
  updated_at: string;
}

export interface DyteParticipant {
  id: string;
  name: string;
  custom_participant_id: string;
  preset_name: string;
  token: string;
}

export interface DyteAPIResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: number;
    message: string;
  };
}

export interface VideoMeeting {
  id: string;
  appointment_id: string;
  meeting_id: string;
  therapist_id: string;
  client_email: string;
  therapist_token: string;
  client_token: string;
  created_at: string;
} 