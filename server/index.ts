import 'dotenv/config';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import cors from 'cors';
import express from 'express';
import multer from 'multer';
import { z } from 'zod';

const app = express();
const upload = multer({ limits: { fileSize: 12 * 1024 * 1024 } });
if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is required to start the AI service');
}
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = gemini.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: {
    temperature: 0,
    responseMimeType: 'application/json',
    responseSchema: {
      type: SchemaType.OBJECT,
      properties: {
        vendor: { type: SchemaType.STRING },
        amount: { type: SchemaType.STRING },
        date: { type: SchemaType.STRING },
        tags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      },
      required: ['vendor', 'amount', 'date', 'tags'],
    },
  },
});
const port = Number(process.env.PORT ?? 3000);

const receiptSchema = z.object({
  vendor: z.string().default(''),
  amount: z.string().default(''),
  date: z.string().default(''),
  tags: z.array(z.string()).default([]),
});

app.use(cors());
app.use(express.json());

app.post('/api/receipt', upload.single('image'), async (request, response) => {
  if (!request.file) {
    response.status(400).json({ error: 'Receipt image is required' });
    return;
  }

  try {
    const result = await model.generateContent([
      'Extract receipt data. Return empty strings when a field is unreadable. Use YYYY-MM-DD for date and a numeric string for amount without currency symbols. Read this receipt and return vendor, amount, date, and useful category tags.',
      {
        inlineData: {
          mimeType: request.file.mimetype,
          data: request.file.buffer.toString('base64'),
        },
      },
    ]);
    const receipt = receiptSchema.parse(JSON.parse(result.response.text()));
    response.json({ receipt });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Receipt processing failed' });
  }
});

app.post('/api/voice', upload.single('audio'), async (request, response) => {
  if (!request.file) {
    response.status(400).json({ error: 'Voice recording is required' });
    return;
  }

  try {
    const result = await model.generateContent([
      'Parse this spoken transaction into vendor, amount, date, and category tags. Use today as the date when no date is spoken. Return amount as a numeric string without currency symbols.',
      {
        inlineData: {
          mimeType: request.file.mimetype,
          data: request.file.buffer.toString('base64'),
        },
      },
    ]);
    const receipt = receiptSchema.parse(JSON.parse(result.response.text()));
    response.json({ receipt });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Voice processing failed' });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`WealthAI AI service listening on http://0.0.0.0:${port}`);
});
