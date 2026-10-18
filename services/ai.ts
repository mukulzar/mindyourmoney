import type { ParsedReceipt } from '../types';
import { File } from 'expo-file-system';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

type ParsedReceiptResponse = Pick<ParsedReceipt, 'vendor' | 'amount' | 'date' | 'tags'>;

async function readResponse(response: Response): Promise<ParsedReceiptResponse> {
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? 'AI service request failed');
  }
  return payload.receipt as ParsedReceiptResponse;
}

function getApiUrl() {
  if (!API_URL) {
    throw new Error('Set EXPO_PUBLIC_API_URL to the deployed Supabase function URL.');
  }
  return API_URL;
}

export async function parseReceiptImage(imageUri: string): Promise<ParsedReceiptResponse> {
  const formData = new FormData();
  formData.append('image', new File(imageUri), 'receipt.jpg');

  return readResponse(
    await fetch(`${getApiUrl()}/receipt`, {
      method: 'POST',
      body: formData,
    })
  );
}

export async function parseVoiceRecording(audioUri: string): Promise<ParsedReceiptResponse> {
  const formData = new FormData();
  formData.append('audio', new File(audioUri), 'voice.m4a');

  return readResponse(
    await fetch(`${getApiUrl()}/voice`, {
      method: 'POST',
      body: formData,
    })
  );
}
