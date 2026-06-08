import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function GET() {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const geminiKey = process.env.GEMINI_KEY;

  // Match ai-sdk.ts priority: GEMINI_KEY > GEMINI_API_KEY
  const effectiveKeySource = geminiKey ? 'GEMINI_KEY' : geminiApiKey ? 'GEMINI_API_KEY' : 'NONE';

  const result: Record<string, unknown> = {
    GEMINI_KEY: geminiKey ? `SET (length: ${geminiKey.length})` : 'MISSING',
    GEMINI_API_KEY: geminiApiKey ? `SET (length: ${geminiApiKey.length})` : 'MISSING',
    effectiveKeySource,
  };

  // Test with GEMINI_KEY (the valid one on HF Spaces)
  if (geminiKey) {
    try {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
      const chat = model.startChat({});
      const res = await chat.sendMessage('Say "hello" in one word');
      const text = res.response.text();
      result.geminiKeyTest = 'SUCCESS';
      result.geminiKeyResponse = text.slice(0, 100);
    } catch (err: unknown) {
      result.geminiKeyTest = 'FAILED';
      result.geminiKeyError = (err as Error).message?.slice(0, 300) || String(err);
    }
  }

  return NextResponse.json(result);
}
