/**
 * Dual-mode AI SDK for "Sit With Me"
 * 
 * LOCAL (z.ai sandbox): Uses z-ai-web-dev-sdk (internal API)
 * PRODUCTION (HF Spaces etc): Uses Google Generative AI SDK directly
 * 
 * The SDK auto-detects which mode to use based on whether
 * the GEMINI_API_KEY environment variable is set.
 */

import ZAI from 'z-ai-web-dev-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Detect mode
const isProductionMode = !!process.env.GEMINI_API_KEY;

/**
 * Send a chat completion request using the best available SDK
 */
export async function chatCompletion(options: {
  model?: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const {
    model = 'gemini-2.0-flash',
    messages,
    temperature = 0.9,
    maxTokens = 2048,
  } = options;

  if (isProductionMode) {
    return geminiCompletion(model, messages, temperature, maxTokens);
  } else {
    return zaiCompletion(model, messages, temperature);
  }
}

/**
 * Production mode: Use Google Generative AI SDK directly
 */
async function geminiCompletion(
  model: string,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  temperature: number,
  maxTokens: number,
): Promise<string> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

  // Convert messages to Gemini format
  // Gemini uses "system instruction" + "history" format
  const systemMessages = messages.filter(m => m.role === 'system');
  const chatMessages = messages.filter(m => m.role !== 'system');

  const systemInstruction = systemMessages.map(m => m.content).join('\n');

  const genModel = genAI.getGenerativeModel({
    model: model.replace('gemini-2.0-flash', 'gemini-2.0-flash'), // keep model name
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
    // If ZAI fails and we have a Gemini key, try that instead
    if (process.env.GEMINI_API_KEY) {
      return geminiCompletion(model, messages, temperature, 2048);
    }
    throw error;
  }
}
