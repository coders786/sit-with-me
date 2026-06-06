import { db } from './db';

export async function getValidGoogleToken(
  userId: string
): Promise<string | null> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user?.googleToken) return null;

  // Check if token is expired
  if (user.googleTokenExpiry && new Date() >= user.googleTokenExpiry) {
    // Try to refresh
    if (!user.googleRefreshToken) {
      console.warn(
        '[google-auth] Token expired and no refresh token available'
      );
      return null;
    }

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          refresh_token: user.googleRefreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        console.error('[google-auth] Token refresh failed');
        return null;
      }

      const data = await response.json();
      const newExpiry = new Date(Date.now() + (data.expires_in || 3600) * 1000);

      await db.user.update({
        where: { id: userId },
        data: {
          googleToken: data.access_token,
          googleTokenExpiry: newExpiry,
        },
      });

      return data.access_token;
    } catch (err) {
      console.error('[google-auth] Token refresh error:', err);
      return null;
    }
  }

  return user.googleToken;
}
