# AI setup

The mobile app sends receipt images and voice recordings to the Supabase Edge Function in `supabase/functions/ai/index.ts`. The Gemini API key stays in Supabase secrets and is never bundled into Expo.

1. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey).
2. Add it in Supabase under **Project Settings > Edge Functions > Secrets** with the name `GEMINI_API_KEY`.
3. Deploy the `ai` function with `supabase functions deploy ai --project-ref owrlroemyxssmgipytte`.
4. Set `EXPO_PUBLIC_API_URL` to `https://owrlroemyxssmgipytte.supabase.co/functions/v1/ai`.
5. Start Expo with `npx expo start`.

The API provides:

- `POST /api/receipt`: vision OCR with structured JSON output.
- `POST /api/voice`: Gemini audio understanding followed by structured transaction parsing.

Never commit `.env` or expose `GEMINI_API_KEY` through an `EXPO_PUBLIC_` variable.
