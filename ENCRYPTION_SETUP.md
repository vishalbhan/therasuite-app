# Client Data Encryption Setup

This guide explains how to set up client data encryption for the TheraSuite application.

## Environment Setup

### 1. Generate Encryption Key

Generate a secure 32-byte encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Example output: `75ad5a327ece28dab82cf1e93fbbfa851394e0b8cf1558cba9eb06b4231afd64`

### 2. Set Environment Variable

Add the encryption key to your Supabase environment variables:

**Via Supabase Dashboard:**
1. Go to your Supabase project dashboard
2. Navigate to Settings > Functions
3. Add a new environment variable:
   - Name: `ENCRYPTION_KEY`
   - Value: Your generated 32-byte hex key

**Via Supabase CLI:**
```bash
supabase secrets set ENCRYPTION_KEY=your_generated_key_here
```

## How It Works

### Encryption Strategy
- **New clients only**: Only newly created clients will have encrypted data
- **Mixed data approach**: Existing clients remain unencrypted for backward compatibility
- **Transparent handling**: The application automatically detects encrypted vs. plain text data

### Encrypted Fields
- Client name (`clients.name`)
- Client email (`clients.email`)

### Encryption Details
- **Algorithm**: AES-256-GCM
- **Key size**: 256 bits (32 bytes)
- **IV**: Random 12-byte initialization vector per encryption
- **Format**: `enc:` prefix + base64 encoded (IV + ciphertext)

## Files Modified

### New Files
- `supabase/functions/encrypt-client-data/index.ts` - Encryption service
- `supabase/functions/encrypt-client-data/deno.json` - Deno config
- `supabase/functions/encrypt-client-data/import_map.json` - Import map
- `src/lib/encryption.ts` - Client-side encryption utilities

### Updated Files
- `src/components/clients/CreateClientModal.tsx` - Encrypt new client data
- `src/components/appointments/CreateAppointmentModal.tsx` - Encrypt during appointment creation
- `src/pages/Clients.tsx` - Handle encrypted/plain text display
- `src/pages/ClientDetails.tsx` - Decrypt for editing and display
- `src/pages/Invoices.tsx` - Handle encrypted client names in filters

## Testing

1. **Deploy the encryption function**:
   ```bash
   supabase functions deploy encrypt-client-data
   ```

2. **Create a new client** through the UI and verify:
   - Client appears normally in the interface
   - Database shows encrypted data with `enc:` prefix
   - Editing and displaying works correctly

3. **Verify mixed data handling**:
   - Existing clients should display normally
   - New clients should display normally
   - No errors should occur during transitions

## Security Considerations

- **Key Management**: Store encryption keys securely in environment variables
- **Backup Strategy**: Ensure encryption keys are backed up securely
- **Access Control**: Limit access to encryption keys to authorized personnel
- **Logging**: Avoid logging decrypted client data in production

## Rollback Strategy

If needed, the encryption can be rolled back by:
1. Removing encryption calls from client creation flows
2. Keeping decryption logic for existing encrypted data
3. Eventually migrating encrypted data back to plain text if required

The mixed data approach ensures the system continues working during any transition period.