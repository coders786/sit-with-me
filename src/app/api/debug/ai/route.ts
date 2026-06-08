import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function GET() {
  const geminiKey = process.env.GEMINI_API_KEY;
  const geminiKeyOld = process.env.GEMINI_KEY;

  const result: Record<string, unknown> = {
    GEMINI_API_KEY: geminiKey ? `SET (length: ${geminiKey.length})` : 'MISSING',
    GEMINI_KEY: geminiKeyOld ? `SET (length: ${geminiKeyOld.length})` : 'MISSING',
  };

  // Quick test: try a Gemini call
  if (geminiKey) {
    try {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const chat = model.startChat({});
      const res = await chat.sendMessage('Say "hello" in one word');
      const text = res.response.text();
      result.geminiTest = 'SUCCESS';
      result.geminiResponse = text.slice(0, 50);
    } catch (err: unknown) {
      result.geminiTest = 'FAILED';
      result.geminiError = (err as Error).message || String(err);
    }
  }

  return NextResponse.json(result);
}
