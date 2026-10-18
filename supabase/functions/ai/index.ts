const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const receiptSchema = {
  type: 'OBJECT',
  properties: {
    vendor: { type: 'STRING' },
    amount: { type: 'STRING' },
    date: { type: 'STRING' },
    tags: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['vendor', 'amount', 'date', 'tags'],
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function generateReceipt(prompt: string, file: File) {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  const bytes = new Uint8Array(await file.arrayBuffer());
  const base64 = bytes.reduce(
    (binary, value) => binary + String.fromCharCode(value),
    ''
  );
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType: file.type || 'application/octet-stream', data: btoa(base64) } },
          ],
        }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: receiptSchema,
        },
      }),
    }
  );

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message ?? 'Gemini request failed');
  }

  const encoded = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!encoded) throw new Error('Gemini returned no receipt data');
  return JSON.parse(encoded);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const isVoice = new URL(request.url).pathname.endsWith('/voice');
  const fieldName = isVoice ? 'audio' : 'image';
  const formData = await request.formData();
  const uploaded = formData.get(fieldName);

  if (!(uploaded instanceof File)) {
    return jsonResponse({ error: `${isVoice ? 'Voice recording' : 'Receipt image'} is required` }, 400);
  }

  try {
    const receipt = await generateReceipt(
      isVoice
        ? 'Parse this spoken transaction into vendor, amount, date, and category tags. Use today as the date when no date is spoken. Return amount as a numeric string without currency symbols.'
        : 'Extract receipt data. Return empty strings when a field is unreadable. Use YYYY-MM-DD for date and a numeric string for amount without currency symbols. Return vendor, amount, date, and useful category tags.',
      uploaded
    );
    return jsonResponse({ receipt });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'AI processing failed' }, 500);
  }
});
