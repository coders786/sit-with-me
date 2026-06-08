import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';

  // Check if Client ID looks like a valid Google OAuth Client ID
  const clientIdValid = clientId.includes('.apps.googleusercontent.com');
  const clientIdLength = clientId.length;
  const clientIdEndsWith = clientId.endsWith('.apps.googleusercontent.com');

  // Check for whitespace issues
  const clientIdHasWhitespace = clientId !== clientId.trim();
  const clientSecretHasWhitespace = clientSecret !== clientSecret.trim();

  return NextResponse.json({
    clientId: {
      length: clientIdLength,
      startsWith: clientId.slice(0, 10),
      endsWith: clientId.slice(-30),
      endsWithGoogleusercontent: clientIdEndsWith,
      looksValid: clientIdValid,
      hasWhitespace: clientIdHasWhitespace,
    },
    clientSecret: {
      length: clientSecret.length,
      startsWith: clientSecret.slice(0, 4),
      startsWithGOC: clientSecret.startsWith('GOC'),
      hasWhitespace: clientSecretHasWhitespace,
    },
    nextauthSecret: process.env.NEXTAUTH_SECRET ? `SET (length: ${process.env.NEXTAUTH_SECRET.length})` : 'MISSING',
    nextauthUrl: process.env.NEXTAUTH_URL || 'NOT SET',
  });
}
