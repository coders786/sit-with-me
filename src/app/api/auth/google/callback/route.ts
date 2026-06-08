import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const NEXTAUTH_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';
const REDIRECT_URI = `${NEXTAUTH_URL}/api/auth/google/callback`;

// Helper to build public URLs (not internal Docker 0.0.0.0 ones)
function publicUrl(path: string) {
  return `${NEXTAUTH_URL}${path}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    console.error('[Google OAuth] Error:', error || 'No code received');
    return NextResponse.redirect(publicUrl('/?googleError=true'));
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('[Google OAuth] Token exchange failed:', errText);
      return NextResponse.redirect(publicUrl('/?googleError=true'));
    }

    const tokens = await tokenRes.json();

    // Get user info from Google
    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userRes.ok) {
      console.error('[Google OAuth] Failed to fetch user info');
      return NextResponse.redirect(publicUrl('/?googleError=true'));
    }

    const googleUser = await userRes.json();

    // Find or create user in our DB
    let dbUser = await db.user.findFirst({ where: { email: googleUser.email } });
    if (!dbUser) {
      const sessionToken = crypto.randomUUID();
      dbUser = await db.user.create({
        data: {
          email: googleUser.email,
          name: googleUser.name || null,
          picture: googleUser.picture || null,
          provider: 'google',
          providerId: googleUser.sub,
          googleToken: tokens.access_token,
          googleRefreshToken: tokens.refresh_token || null,
          googleEmail: googleUser.email,
          googleTokenExpiry: tokens.expires_in
            ? new Date(Date.now() + tokens.expires_in * 1000)
            : null,
          sessionToken,
          calendarConnected: true,
          tasksConnected: true,
          gmailConnected: true,
        },
      });
      await db.profile.create({
        data: {
          userId: dbUser.id,
          displayName: googleUser.name || 'Learner',
          avatar: '🧠',
        },
      });
    } else {
      await db.user.update({
        where: { id: dbUser.id },
        data: {
          provider: 'google',
          providerId: googleUser.sub,
          googleToken: tokens.access_token,
          googleRefreshToken: tokens.refresh_token || dbUser.googleRefreshToken,
          googleEmail: googleUser.email,
          googleTokenExpiry: tokens.expires_in
            ? new Date(Date.now() + tokens.expires_in * 1000)
            : null,
          calendarConnected: true,
          tasksConnected: true,
          gmailConnected: true,
          picture: googleUser.picture || dbUser.picture,
        },
      });
    }

    // Redirect to app with session token using PUBLIC URL
    const redirectUrl = publicUrl(`/?googleConnected=true&sessionToken=${dbUser.sessionToken}`);
    console.log('[Google OAuth] Success! Redirecting to:', redirectUrl);
    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    console.error('[Google OAuth] Callback error:', err);
    return NextResponse.redirect(publicUrl('/?googleError=true'));
  }
}
