import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Comprehensive list of possible Gemini model names to test
const TEST_MODELS = [
  // Current models
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
  // 1.5 variants
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
  'gemini-1.5-pro-latest',
  // 2.5 variants
  'gemini-2.5-flash-preview-05-20',
  'gemini-2.5-pro-preview-05-06',
  // Experimental
  'gemini-2.0-flash-exp',
  'gemini-exp-1206',
  // Legacy
  'gemini-pro',
  'gemini-1.0-pro',
  'gemini-1.0-pro-latest',
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
    workingModels: [] as string[],
  };

  if (!effectiveKey) {
    result.error = 'No valid API key found';
    return NextResponse.json(result);
  }

  // Test ALL models to discover which ones work
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
      (result.workingModels as string[]).push(model);
    } catch (err: unknown) {
      const errMsg = (err as Error).message?.slice(0, 300) || String(err);
      const is429 = errMsg.includes('429') || errMsg.includes('Too Many Requests') || errMsg.includes('quota');
      const is404 = errMsg.includes('404') || errMsg.includes('not found');
      (result.modelTests as Record<string, unknown>)[model] = {
        status: is429 ? 'RATE_LIMITED' : is404 ? 'NOT_FOUND' : 'FAILED',
        error: errMsg,
      };
    }
  }

  return NextResponse.json(result);
}
