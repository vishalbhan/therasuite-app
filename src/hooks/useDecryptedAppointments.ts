import { useState, useEffect } from 'react';
import { decryptSingleValue } from '@/lib/encryption';

interface BaseAppointment {
  id: string;
  client_name: string;
  client_email: string;
  [key: string]: any;
}

interface DecryptedAppointment extends BaseAppointment {
  decrypted_client_name: string;
  decrypted_client_email: string;
}

export function useDecryptedAppointments<T extends BaseAppointment>(
  appointments: T[]
): (T & { decrypted_client_name: string; decrypted_client_email: string })[] {
  const [decryptedAppointments, setDecryptedAppointments] = useState<
    (T & { decrypted_client_name: string; decrypted_client_email: string })[]
  >([]);

  useEffect(() => {
    const decryptAppointments = async () => {
      const decrypted = await Promise.all(
        appointments.map(async (appointment) => ({
          ...appointment,
          decrypted_client_name: await decryptSingleValue(appointment.client_name),
          decrypted_client_email: await decryptSingleValue(appointment.client_email)
        }))
      );
      setDecryptedAppointments(decrypted);
    };

    if (appointments.length > 0) {
      decryptAppointments();
    } else {
      setDecryptedAppointments([]);
    }
  }, [appointments]);

  return decryptedAppointments;
}