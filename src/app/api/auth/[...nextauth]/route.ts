import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { db } from '@/lib/db';

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/tasks https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly',
          prompt: 'consent',
          access_type: 'offline',
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google' && account.access_token) {
        // Find or create user by email
        let dbUser = await db.user.findFirst({ where: { email: user.email! } });
        if (!dbUser) {
          // Create new user
          const sessionToken = crypto.randomUUID();
          dbUser = await db.user.create({
            data: {
              email: user.email!,
              name: user.name || null,
              picture: user.image || null,
              provider: 'google',
              providerId: account.providerAccountId,
              googleToken: account.access_token,
              googleRefreshToken: account.refresh_token || null,
              googleEmail: user.email!,
              googleTokenExpiry: account.expires_at
                ? new Date(account.expires_at * 1000)
                : null,
              sessionToken,
              calendarConnected: true,
              tasksConnected: true,
              gmailConnected: true,
            },
          });
          // Create profile
          await db.profile.create({
            data: {
              userId: dbUser.id,
              displayName: user.name || 'Learner',
              avatar: '🧠',
            },
          });
        } else {
          // Update existing user with Google tokens
          await db.user.update({
            where: { id: dbUser.id },
            data: {
              provider: 'google',
              providerId: account.providerAccountId,
              googleToken: account.access_token,
              googleRefreshToken:
                account.refresh_token || dbUser.googleRefreshToken,
              googleEmail: user.email!,
              googleTokenExpiry: account.expires_at
                ? new Date(account.expires_at * 1000)
                : null,
              calendarConnected: true,
              tasksConnected: true,
              gmailConnected: true,
              picture: user.image || dbUser.picture,
            },
          });
        }
      }
      return true;
    },
    async session({ session }) {
      // Attach sessionToken to session for client use
      if (session.user?.email) {
        const dbUser = await db.user.findFirst({
          where: { email: session.user.email },
        });
        if (dbUser) {
          (session as Record<string, unknown>).sessionToken =
            dbUser.sessionToken;
          (session as Record<string, unknown>).googleConnected =
            !!dbUser.googleToken;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/', // Use the app's landing page
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
