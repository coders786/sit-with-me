import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function GET() {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const geminiKey = process.env.GEMINI_KEY;
  const effectiveKey = geminiApiKey || geminiKey;

  const result: Record<string, unknown> = {
    GEMINI_API_KEY: geminiApiKey ? `SET (length: ${geminiApiKey.length})` : 'MISSING',
    GEMINI_KEY: geminiKey ? `SET (length: ${geminiKey.length})` : 'MISSING',
    effectiveKeySource: geminiApiKey ? 'GEMINI_API_KEY' : geminiKey ? 'GEMINI_KEY' : 'NONE',
  };

  // Test with GEMINI_KEY (the correct one)
  if (geminiKey) {
    try {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const chat = model.startChat({});
      const res = await chat.sendMessage('Say "hello" in one word');
      const text = res.response.text();
      result.geminiKeyTest = 'SUCCESS';
      result.geminiKeyResponse = text.slice(0, 100);
    } catch (err: unknown) {
      result.geminiKeyTest = 'FAILED';
      result.geminiKeyError = (err as Error).message?.slice(0, 200) || String(err);
    }
  }

  // Test with GEMINI_API_KEY (might be invalid)
  if (geminiApiKey && geminiApiKey !== geminiKey) {
    try {
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const chat = model.startChat({});
      const res = await chat.sendMessage('Say "hello" in one word');
      const text = res.response.text();
      result.geminiApiKeyTest = 'SUCCESS';
      result.geminiApiKeyResponse = text.slice(0, 100);
    } catch (err: unknown) {
      result.geminiApiKeyTest = 'FAILED';
      result.geminiApiKeyError = (err as Error).message?.slice(0, 200) || String(err);
    }
  }

  return NextResponse.json(result);
}
