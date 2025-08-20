# Encrypt Existing Client Data

This guide will help you encrypt all existing client data in your database while preserving the functionality of your application.

## ⚠️ Important Prerequisites

1. **Backup your database** before running this migration
2. **Ensure the encryption service is deployed** and working:
   ```bash
   npx supabase functions deploy encrypt-client-data
   ```
3. **Verify encryption key is set** in Supabase environment variables:
   - Go to Supabase Dashboard > Settings > Edge Functions
   - Ensure `ENCRYPTION_KEY` is set with a 32-character key

## 🚀 Running the Migration

### Step 1: Install Dependencies (if needed)
```bash
npm install dotenv
```

### Step 2: Set Up Environment Variables

Create a `.env` file in your project root (if not already present) with:
```env
VITE_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Note**: You need the service role key (not the anon key) to run this migration.

### Step 3: Run the Encryption Migration
```bash
npm run encrypt-existing-data
```

## 📊 What the Script Does

The migration script will:

1. **Fetch all clients** from the database
2. **Check each client** to see if data is already encrypted
3. **Skip already encrypted data** (data starting with `enc:`)
4. **Encrypt unencrypted names and emails** using your Supabase encryption function
5. **Update the database** with encrypted values
6. **Repeat the process for appointments** client data
7. **Provide detailed progress reports**

## 🔍 Expected Output

```
🔒 TheraSuite Data Encryption Tool
==================================

🚀 Starting encryption of existing client data...
📊 Found 150 clients to process

🔄 Processing client abc123...
🔐 Encrypting data for client abc123...
✅ Successfully encrypted client abc123

🔄 Processing client def456...
⏭️  Client def456 already encrypted, skipping

🎉 Encryption process completed!
📈 Results:
   - Encrypted: 120 clients
   - Skipped (already encrypted): 25 clients
   - Failed: 5 clients

🚀 Starting encryption of existing appointment data...
📊 Found 800 appointments to process
...
✨ All encryption processes completed!
```

## 🛠️ Troubleshooting

### "Missing required environment variables"
- Ensure your `.env` file contains the correct Supabase URL and Service Role Key
- The Service Role Key should start with `eyJ...` and be much longer than the anon key

### "Encryption error"
- Verify the `encrypt-client-data` Supabase function is deployed and working
- Check that the `ENCRYPTION_KEY` environment variable is set in Supabase Edge Functions
- Test the function manually in the Supabase dashboard

### "Failed to encrypt data for client"
- Some clients may have invalid or malformed data
- Check the console output for specific error details
- These clients will need manual review

### "Network error during encryption"
- Check your internet connection
- Verify Supabase service is accessible
- Try running the script again (it will skip already encrypted data)

## ✅ Verification Steps

After running the migration:

1. **Check your database** - Client names and emails should start with `enc:`
2. **Test the application** - Log in and verify:
   - Client names display correctly in the app
   - Appointments show proper client names
   - Email functionality still works
   - Invoices display correct client information

3. **Sample queries to verify**:
   ```sql
   -- Check encrypted clients
   SELECT id, name, email FROM clients LIMIT 5;
   -- Names and emails should start with 'enc:'
   
   -- Check encrypted appointments
   SELECT id, client_name, client_email FROM appointments LIMIT 5;
   -- Client names and emails should start with 'enc:'
   ```

## 🔄 Re-running the Script

The script is **safe to run multiple times**:
- Already encrypted data is automatically skipped
- Only new unencrypted data will be processed
- No duplicate encryption will occur

## 📞 Support

If you encounter any issues:

1. **Check the console output** for specific error messages
2. **Verify your environment setup** (keys, function deployment)
3. **Test with a small subset** by temporarily limiting the database query
4. **Contact support** with the specific error messages and steps you've taken

---

**⚠️ Remember**: Always test thoroughly in a development environment before running in production!