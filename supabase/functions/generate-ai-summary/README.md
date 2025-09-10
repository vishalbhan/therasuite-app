# Generate AI Summary Function

This Supabase Edge Function generates AI-powered summaries of therapy session notes using OpenAI's API via Cloudflare AI Gateway.

## Environment Variables Required

Add these environment variables to your Supabase project:

```bash
# OpenAI API Key
OPENAI_API_KEY=your_openai_api_key

# Cloudflare AI Gateway Configuration
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
CLOUDFLARE_AI_GATEWAY_ID=your_ai_gateway_id
```

## Setting up Cloudflare AI Gateway

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to AI → AI Gateway
3. Create a new AI Gateway
4. Note down your Account ID and Gateway ID
5. Configure the gateway to proxy OpenAI requests

## Setting Environment Variables in Supabase

```bash
# Using Supabase CLI
supabase secrets set OPENAI_API_KEY=your_key_here
supabase secrets set CLOUDFLARE_ACCOUNT_ID=your_account_id
supabase secrets set CLOUDFLARE_AI_GATEWAY_ID=your_gateway_id
```

## Function Usage

The function expects a POST request with the following body:

```json
{
  "notes": [
    {
      "id": "note_id",
      "session_date": "2024-01-01T10:00:00Z",
      "notes": "Session notes content...",
      "session_type": "video",
      "session_length": 60
    }
  ]
}
```

## Response

```json
{
  "success": true,
  "summary": "Generated AI summary of the therapy notes...",
  "sessionCount": 3
}
```

## Benefits of Using Cloudflare AI Gateway

- **Caching**: Reduces API costs by caching similar requests
- **Analytics**: Track usage and performance
- **Rate Limiting**: Protect against abuse
- **Fallback**: Configure fallback providers
- **Cost Control**: Monitor and control AI API spending
