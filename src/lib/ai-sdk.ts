/**
 * Dual-mode AI SDK for "Sit With Me"
 * 
 * LOCAL (z.ai sandbox): Uses z-ai-web-dev-sdk (internal API)
 * PRODUCTION (HF Spaces etc): Uses Google Generative AI SDK directly
 * 
 * The SDK auto-detects which mode to use based on whether
 * a valid Gemini API key is available.
 * 
 * Key priority: GEMINI_KEY > GEMINI_API_KEY
 * (GEMINI_KEY is the valid key on HF Spaces; GEMINI_API_KEY may be invalid)
 * 
 * RESILIENCE FEATURES:
 * - Model fallback chain: tries multiple models if one hits rate limits
 * - Exponential backoff retry for 429 errors
 * - Automatic model rotation to avoid quota exhaustion
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// ── Model Constants ──────────────────────────────────────────────
export const MODELS = {
  /** Fast/cheap model for simple JSON-output tasks */
  FAST: 'gemini-2.0-flash-lite',
  /** Smart model for conversation & complex reasoning */
  SMART: 'gemini-2.0-flash',
} as const;

// ── Model Fallback Chains ────────────────────────────────────────
// If the primary model hits 429, we try the next one in the chain
// Each model has separate quota limits on the free tier
const MODEL_FALLBACK_CHAINS: Record<string, string[]> = {
  'gemini-2.0-flash-lite': ['gemini-2.0-flash-lite', 'gemini-1.5-flash-8b', 'gemini-1.5-flash', 'gemini-2.0-flash'],
  'gemini-2.0-flash': ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash-8b'],
};

// ── Key Detection ────────────────────────────────────────────────
// GEMINI_KEY (39 chars) is the valid key on HF Spaces
// GEMINI_API_KEY (24 chars) is often invalid — only use as fallback
const GEMINI_KEY = process.env.GEMINI_KEY || process.env.GEMINI_API_KEY;
const isProductionMode = !!GEMINI_KEY;

console.log('[ai-sdk] Mode:', isProductionMode ? 'PRODUCTION (Gemini)' : 'LOCAL (z-ai-web-dev-sdk)');
console.log('[ai-sdk] Key source:', process.env.GEMINI_KEY ? 'GEMINI_KEY' : process.env.GEMINI_API_KEY ? 'GEMINI_API_KEY' : 'NONE');

// ── Retry Utility ────────────────────────────────────────────────
/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if an error is a rate limit error (429)
 */
function isRateLimitError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('quota');
}

/**
 * Extract retry delay from 429 error, or return default
 */
function getRetryDelay(error: unknown): number {
  const msg = error instanceof Error ? error.message : String(error);
  // Try to extract "retryDelay" from the error message
  const retryMatch = msg.match(/retryDelay["':\s]+(\d+)s/i);
  if (retryMatch) {
    return parseInt(retryMatch[1]) * 1000;
  }
  // Try to extract "Please retry in Xs"
  const retryInMatch = msg.match(/retry in ([\d.]+)s/i);
  if (retryInMatch) {
    return Math.ceil(parseFloat(retryInMatch[1]) * 1000);
  }
  // Default: exponential backoff base
  return 2000;
}

/**
 * Send a chat completion request using the best available SDK
 * With model fallback chain and retry logic for 429 errors
 */
export async function chatCompletion(options: {
  model?: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const {
    model = MODELS.SMART,
    messages,
    temperature = 0.9,
    maxTokens = 2048,
  } = options;

  if (isProductionMode) {
    return geminiCompletionWithFallback(model, messages, temperature, maxTokens);
  } else {
    return zaiCompletion(model, messages, temperature);
  }
}

/**
 * Production mode: Try Gemini with model fallback chain and retry logic
 */
async function geminiCompletionWithFallback(
  primaryModel: string,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  temperature: number,
  maxTokens: number,
): Promise<string> {
  const chain = MODEL_FALLBACK_CHAINS[primaryModel] || [primaryModel];
  const errors: string[] = [];

  for (const model of chain) {
    try {
      // Try with retry (max 2 attempts per model)
      const result = await geminiCompletionWithRetry(model, messages, temperature, maxTokens, 2);
      if (result) {
        if (model !== primaryModel) {
          console.log(`[ai-sdk] Successfully used fallback model: ${model} (primary: ${primaryModel})`);
        }
        return result;
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      errors.push(`${model}: ${errMsg.slice(0, 200)}`);
      
      if (isRateLimitError(error)) {
        console.warn(`[ai-sdk] Rate limited on model ${model}, trying next in chain...`);
        continue; // Try next model in chain
      } else {
        // Non-rate-limit error — still try next model as a safety net
        console.error(`[ai-sdk] Error on model ${model}:`, errMsg.slice(0, 200));
        continue;
      }
    }
  }

  // All models in the chain failed
  console.error('[ai-sdk] All models in fallback chain failed:', errors);
  throw new Error(`AI service unavailable — all models rate limited. Please try again in a few minutes.`);
}

/**
 * Gemini completion with retry + exponential backoff for 429 errors
 */
async function geminiCompletionWithRetry(
  model: string,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  temperature: number,
  maxTokens: number,
  maxRetries: number,
): Promise<string> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await geminiCompletion(model, messages, temperature, maxTokens);
    } catch (error) {
      lastError = error;

      if (isRateLimitError(error) && attempt < maxRetries - 1) {
        const delay = getRetryDelay(error) * (attempt + 1); // Exponential backoff
        console.warn(`[ai-sdk] Rate limited on ${model} (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`);
        await sleep(Math.min(delay, 10000)); // Cap at 10 seconds
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

/**
 * Core Gemini completion — single model, single attempt
 */
async function geminiCompletion(
  model: string,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  temperature: number,
  maxTokens: number,
): Promise<string> {
  const genAI = new GoogleGenerativeAI(GEMINI_KEY!);

  // Convert messages to Gemini format
  // Gemini uses "system instruction" + "history" format
  const systemMessages = messages.filter(m => m.role === 'system');
  const chatMessages = messages.filter(m => m.role !== 'system');

  const systemInstruction = systemMessages.map(m => m.content).join('\n');

  const genModel = genAI.getGenerativeModel({
    model,
    systemInstruction: systemInstruction || undefined,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  });

  // Build chat history
  const history: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
  let lastUserMessage = '';

  for (let i = 0; i < chatMessages.length; i++) {
    const msg = chatMessages[i];
    if (msg.role === 'user') {
      if (i === chatMessages.length - 1) {
        lastUserMessage = msg.content;
      } else {
        history.push({ role: 'user', parts: [{ text: msg.content }] });
      }
    } else if (msg.role === 'assistant') {
      history.push({ role: 'model', parts: [{ text: msg.content }] });
    }
  }

  // If no last user message, use the last one from history
  if (!lastUserMessage && history.length > 0) {
    const lastEntry = history.pop();
    if (lastEntry?.role === 'user') {
      lastUserMessage = lastEntry.parts[0]?.text || 'Hello';
    }
  }

  const chat = genModel.startChat({ history });
  const result = await chat.sendMessage(lastUserMessage || 'Hello');
  const response = result.response;
  return response.text();
}

/**
 * Local mode: Use z-ai-web-dev-sdk (sandbox internal API)
 */
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
    console.error('[ai-sdk] ZAI SDK error, falling back to Gemini:', error);
    // Only fall back to Gemini if the VALID key (GEMINI_KEY) exists
    // Don't fall back to GEMINI_API_KEY — it may be invalid
    if (process.env.GEMINI_KEY) {
      return geminiCompletionWithFallback(model, messages, temperature, 2048);
    }
    throw error;
  }
}
