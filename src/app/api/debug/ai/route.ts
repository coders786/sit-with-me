import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const TEST_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
];

export async function GET() {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const geminiKey = process.env.GEMINI_KEY;
  const effectiveKey = geminiKey || geminiApiKey;
  const effectiveKeySource = geminiKey ? 'GEMINI_KEY' : geminiApiKey ? 'GEMINI_API_KEY' : 'NONE';

  const result: Record<string, unknown> = {
    sdk: '@google/genai',
    GEMINI_KEY: geminiKey ? `SET (length: ${geminiKey.length})` : 'MISSING',
    GEMINI_API_KEY: geminiApiKey ? `SET (length: ${geminiApiKey.length})` : 'MISSING',
    effectiveKeySource,
    modelTests: {} as Record<string, unknown>,
  };

  if (!effectiveKey) {
    result.error = 'No valid API key found';
    return NextResponse.json(result);
  }

  const ai = new GoogleGenAI({ apiKey: effectiveKey });

  for (const model of TEST_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: 'Say "hello" in one word',
        config: { maxOutputTokens: 10 },
      });
      (result.modelTests as Record<string, unknown>)[model] = {
        status: 'SUCCESS',
        response: response.text?.slice(0, 100),
      };
    } catch (err: unknown) {
      const errMsg = (err as Error).message?.slice(0, 300) || String(err);
      const is429 = errMsg.includes('429') || errMsg.includes('Too Many Requests') || errMsg.includes('quota');
      (result.modelTests as Record<string, unknown>)[model] = {
        status: is429 ? 'RATE_LIMITED' : 'FAILED',
        error: errMsg,
      };
    }
  }

  return NextResponse.json(result);
}
