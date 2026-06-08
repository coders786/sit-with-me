import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Models to test — these are the same ones in the fallback chain
const TEST_MODELS = [
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash-8b',
  'gemini-1.5-flash',
  'gemini-2.0-flash',
];

export async function GET() {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const geminiKey = process.env.GEMINI_KEY;

  // Match ai-sdk.ts priority: GEMINI_KEY > GEMINI_API_KEY
  const effectiveKey = geminiKey || geminiApiKey;
  const effectiveKeySource = geminiKey ? 'GEMINI_KEY' : geminiApiKey ? 'GEMINI_API_KEY' : 'NONE';

  const result: Record<string, unknown> = {
    GEMINI_KEY: geminiKey ? `SET (length: ${geminiKey.length})` : 'MISSING',
    GEMINI_API_KEY: geminiApiKey ? `SET (length: ${geminiApiKey.length})` : 'MISSING',
    effectiveKeySource,
    modelTests: {},
  };

  if (!effectiveKey) {
    result.error = 'No valid API key found';
    return NextResponse.json(result);
  }

  // Test each model in the fallback chain
  const genAI = new GoogleGenerativeAI(effectiveKey);
  
  for (const model of TEST_MODELS) {
    try {
      const genModel = genAI.getGenerativeModel({ model });
      const chat = genModel.startChat({});
      const res = await chat.sendMessage('Say "hello" in one word');
      const text = res.response.text();
      (result.modelTests as Record<string, unknown>)[model] = {
        status: 'SUCCESS',
        response: text.slice(0, 100),
      };
      // Stop at first successful model — no need to waste quota testing all
      break;
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
