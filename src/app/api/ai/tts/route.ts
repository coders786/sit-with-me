import { NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, voice } = body;

    if (!text) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }

    // Limit text length for TTS
    const truncatedText = text.slice(0, 1000);

    const zai = await ZAI.create();
    const result = await zai.tts.create({
      text: truncatedText,
      voice: voice || 'alloy',
    });

    // Return audio as base64
    if (result?.audio) {
      const audioBuffer = Buffer.from(result.audio, 'base64');
      return new NextResponse(audioBuffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': audioBuffer.length.toString(),
        },
      });
    }

    // Fallback: return the raw result if audio format differs
    return NextResponse.json(result);
  } catch (error) {
    console.error('[ai/tts] Error:', error);
    return NextResponse.json({ error: 'Failed to generate speech' }, { status: 500 });
  }
}
