import { supabase } from '@/integrations/supabase/client';

export interface ClientData {
  name: string;
  email: string;
}

export interface EncryptedClientData {
  name: string;
  email: string;
}

/**
 * Encrypts client name and email data
 */
export async function encryptClientData(data: ClientData): Promise<EncryptedClientData> {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      throw new Error('No active session');
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/encrypt-client-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.session.access_token}`
      },
      body: JSON.stringify({
        action: 'encrypt',
        data: {
          name: data.name,
          email: data.email
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Encryption failed: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.details || 'Encryption failed');
    }

    return result.data;
  } catch (error) {
    console.error('Error encrypting client data:', error);
    throw new Error('Failed to encrypt client data');
  }
}

/**
 * Decrypts client name and email data
 */
export async function decryptClientData(data: EncryptedClientData): Promise<ClientData> {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      throw new Error('No active session');
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/encrypt-client-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.session.access_token}`
      },
      body: JSON.stringify({
        action: 'decrypt',
        data: {
          name: data.name,
          email: data.email
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Decryption failed: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.details || 'Decryption failed');
    }

    return result.data;
  } catch (error) {
    console.error('Error decrypting client data:', error);
    // Return original data as fallback
    return data;
  }
}

/**
 * Decrypts a single value (name or email)
 */
export async function decryptSingleValue(value: string): Promise<string> {
  // If value doesn't start with 'enc:', it's not encrypted
  if (!value.startsWith('enc:')) {
    return value;
  }

  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      return value; // Fallback to original value
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/encrypt-client-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.session.access_token}`
      },
      body: JSON.stringify({
        action: 'decrypt_single',
        data: {
          value: value
        }
      })
    });

    if (!response.ok) {
      return value; // Fallback to original value
    }

    const result = await response.json();
    if (!result.success) {
      return value; // Fallback to original value
    }

    return result.data.value;
  } catch (error) {
    console.error('Error decrypting single value:', error);
    // Return original value as fallback
    return value;
  }
}

/**
 * Checks if a value is encrypted
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith('enc:');
}

/**
 * Encrypts a single value (like notes)
 */
export async function encryptSingleValue(value: string): Promise<string> {
  // If value is empty or already encrypted, return as-is
  if (!value || isEncrypted(value)) {
    return value;
  }

  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      throw new Error('No active session');
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/encrypt-client-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.session.access_token}`
      },
      body: JSON.stringify({
        action: 'encrypt_single',
        data: {
          value: value
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Encryption failed: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.details || 'Encryption failed');
    }

    return result.data.value;
  } catch (error) {
    console.error('Error encrypting single value:', error);
    throw new Error('Failed to encrypt value');
  }
}