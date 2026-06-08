/**
 * Dual-mode AI SDK for "Sit With Me"
 * 
 * LOCAL (z.ai sandbox): Uses z-ai-web-dev-sdk (internal API)
 * PRODUCTION (HF Spaces etc): Uses @google/genai SDK (Gemini 3 family)
 * 
 * Key priority: GEMINI_KEY > GEMINI_API_KEY
 * 
 * GEMINI 3 FAMILY (from official Google docs):
 * - gemini-3.1-flash-lite: Fast/cheap, 1M/64k context — for simple JSON tasks
 * - gemini-3-flash-preview: Mid-tier, 1M/64k context — for conversation & reasoning
 * - gemini-3.1-pro-preview: Smart/reasoning, 1M/64k context — for complex tasks
 * 
 * RESILIENCE:
 * - Model fallback chain if one model hits rate limits
 * - Retry with exponential backoff for 429 errors
 * - thinking_level support for Gemini 3 reasoning models
 */

import { GoogleGenAI } from '@google/genai';

// ── Model Constants ──────────────────────────────────────────────
export const MODELS = {
  /** Fast/cheap model for simple JSON-output tasks */
  FAST: 'gemini-3.1-flash-lite',
  /** Smart model for conversation & reasoning */
  SMART: 'gemini-3-flash-preview',
} as const;

// ── Thinking Levels ──────────────────────────────────────────────
// Gemini 3 supports thinking_level: 'minimal' | 'low' | 'medium' | 'high'
// Default for flash-lite: minimal, for flash: medium, for pro: high
type ThinkingLevel = 'minimal' | 'low' | 'medium' | 'high';

// ── Model Fallback Chains ────────────────────────────────────────
// If primary model fails (rate limit, etc.), try the next one
const MODEL_FALLBACK_CHAINS: Record<string, string[]> = {
  'gemini-3.1-flash-lite': ['gemini-3.1-flash-lite', 'gemini-3-flash-preview'],
  'gemini-3-flash-preview': ['gemini-3-flash-preview', 'gemini-3.1-flash-lite'],
};

// ── Key Detection ────────────────────────────────────────────────
const GEMINI_KEY = process.env.GEMINI_KEY || process.env.GEMINI_API_KEY;
const isProductionMode = !!GEMINI_KEY;

console.log('[ai-sdk] Mode:', isProductionMode ? 'PRODUCTION (Gemini 3)' : 'LOCAL (z-ai-web-dev-sdk)');
console.log('[ai-sdk] Key source:', process.env.GEMINI_KEY ? 'GEMINI_KEY' : process.env.GEMINI_API_KEY ? 'GEMINI_API_KEY' : 'NONE');
console.log('[ai-sdk] Models: FAST=gemini-3.1-flash-lite, SMART=gemini-3-flash-preview');

// ── Lazy-initialized GoogleGenAI client ──────────────────────────
let genAIClient: GoogleGenAI | null = null;

function getGenAIClient(): GoogleGenAI {
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({ apiKey: GEMINI_KEY! });
  }
  return genAIClient;
}

// ── Retry Utility ────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRateLimitError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('quota');
}

function getRetryDelay(error: unknown): number {
  const msg = error instanceof Error ? error.message : String(error);
  const retryMatch = msg.match(/retryDelay["':\s]+(\d+)s/i);
  if (retryMatch) return parseInt(retryMatch[1]) * 1000;
  const retryInMatch = msg.match(/retry in ([\d.]+)s/i);
  if (retryInMatch) return Math.ceil(parseFloat(retryInMatch[1]) * 1000);
  return 2000;
}

// ── Public API ───────────────────────────────────────────────────
export async function chatCompletion(options: {
  model?: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
  thinkingLevel?: ThinkingLevel;
}): Promise<string> {
  const {
    model = MODELS.SMART,
    messages,
    temperature = 0.9,
    maxTokens = 2048,
    thinkingLevel,
  } = options;

  if (isProductionMode) {
    return geminiCompletionWithFallback(model, messages, temperature, maxTokens, thinkingLevel);
  } else {
    return zaiCompletion(model, messages, temperature);
  }
}

// ── Gemini 3 Completion with Fallback Chain ──────────────────────
async function geminiCompletionWithFallback(
  primaryModel: string,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  temperature: number,
  maxTokens: number,
  thinkingLevel?: ThinkingLevel,
): Promise<string> {
  const chain = MODEL_FALLBACK_CHAINS[primaryModel] || [primaryModel];
  const errors: string[] = [];

  for (const model of chain) {
    try {
      const result = await geminiCompletionWithRetry(model, messages, temperature, maxTokens, thinkingLevel, 2);
      if (model !== primaryModel) {
        console.log(`[ai-sdk] Fallback to ${model} succeeded (primary: ${primaryModel})`);
      }
      return result;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      errors.push(`${model}: ${errMsg.slice(0, 200)}`);
      console.warn(`[ai-sdk] Model ${model} failed: ${errMsg.slice(0, 150)}`);
      continue;
    }
  }

  console.error('[ai-sdk] All models failed:', errors);
  throw new Error('AI service unavailable — please try again in a minute.');
}

// ── Gemini Completion with Retry ─────────────────────────────────
async function geminiCompletionWithRetry(
  model: string,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  temperature: number,
  maxTokens: number,
  thinkingLevel: ThinkingLevel | undefined,
  maxRetries: number,
): Promise<string> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await geminiCompletion(model, messages, temperature, maxTokens, thinkingLevel);
    } catch (error) {
      lastError = error;
      if (isRateLimitError(error) && attempt < maxRetries - 1) {
        const delay = Math.min(getRetryDelay(error) * (attempt + 1), 10000);
        console.warn(`[ai-sdk] Rate limited on ${model} (attempt ${attempt + 1}/${maxRetries}), retry in ${delay}ms`);
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}

// ── Core Gemini 3 Completion (single model, single attempt) ──────
async function geminiCompletion(
  model: string,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  temperature: number,
  maxTokens: number,
  thinkingLevel?: ThinkingLevel,
): Promise<string> {
  const ai = getGenAIClient();

  // Convert messages to Gemini format
  const systemMessages = messages.filter(m => m.role === 'system');
  const chatMessages = messages.filter(m => m.role !== 'system');
  const systemInstruction = systemMessages.map(m => m.content).join('\n');

  // Build contents array (Gemini 3 format)
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  for (const msg of chatMessages) {
    if (msg.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: msg.content }] });
    } else if (msg.role === 'assistant') {
      contents.push({ role: 'model', parts: [{ text: msg.content }] });
    }
  }

  // Build config with thinking_level for Gemini 3
  const config: Record<string, unknown> = {
    temperature,
    maxOutputTokens: maxTokens,
  };

  if (systemInstruction) {
    config.systemInstruction = systemInstruction;
  }

  // Add thinking config for Gemini 3 models
  // Gemini 3 defaults to 'high' thinking — for simple tasks, use 'low' or 'minimal'
  if (thinkingLevel) {
    config.thinkingConfig = { thinkingLevel };
  }

  const response = await ai.models.generateContent({
    model,
    contents,
    config,
  });

  const text = response.text;
  if (!text) {
    throw new Error('Empty response from Gemini 3');
  }
  return text;
}

// ── Local mode: z-ai-web-dev-sdk ────────────────────────────────
async function zaiCompletion(
  model: string,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  temperature: number,
): Promise<string> {
  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();
    const result = await zai.chat.completions.create({
      model,
      messages,
      temperature,
    });

    const reply = result?.choices?.[0]?.message?.content || result?.content;
    if (reply) return reply;
    throw new Error('Empty response from ZAI SDK');
  } catch (error) {
    console.error('[ai-sdk] ZAI SDK error, falling back to Gemini 3:', error);
    if (process.env.GEMINI_KEY) {
      return geminiCompletionWithFallback(model, messages, temperature, 2048);
    }
    throw error;
  }
}
