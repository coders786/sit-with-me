import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const nextauthSecret = process.env.NEXTAUTH_SECRET;
  const nextauthUrl = process.env.NEXTAUTH_URL;

  return NextResponse.json({
    GOOGLE_CLIENT_ID: clientId ? `SET (length: ${clientId.length}, starts: ${clientId.slice(0, 6)}...)` : 'MISSING',
    GOOGLE_CLIENT_SECRET: clientSecret ? `SET (length: ${clientSecret.length}, starts: ${clientSecret.slice(0, 3)}...)` : 'MISSING',
    NEXTAUTH_SECRET: nextauthSecret ? `SET (length: ${nextauthSecret.length})` : 'MISSING',
    NEXTAUTH_URL: nextauthUrl || 'NOT SET',
    NODE_ENV: process.env.NODE_ENV,
  });
}
