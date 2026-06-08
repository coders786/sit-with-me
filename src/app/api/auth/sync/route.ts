import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * POST /api/auth/sync
 * 
 * Syncs user progress between client and server.
 * 
 * Body:
 *   sessionToken: string (required)
 *   action: 'save' | 'load' | 'full' (default: 'full')
 *   
 *   For 'save' and 'full':
 *     currentView, currentTab, onboardingDone,
 *     topic, vision, domain, level, minutesPerDay, learningStyle, whyNow, obstacle,
 *     sessionCount, wins, successStreak, bestStreak, mastery, xp,
 *     autoTasks, autoSchedule, voiceEnabled
 *   
 * Returns:
 *   For 'load' and 'full': the full user state from DB
 *   For 'save': just { ok: true }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionToken, action = 'full' } = body;

    if (!sessionToken) {
      return NextResponse.json({ error: 'sessionToken is required' }, { status: 400 });
    }

    const user = await db.user.findFirst({ where: { sessionToken }, include: { profile: true } });
    if (!user) {
      return NextResponse.json({ error: 'Invalid session token' }, { status: 401 });
    }

    // ── LOAD: Return current state from DB ──────────────────────
    if (action === 'load') {
      return NextResponse.json({
        ok: true,
        user: serializeUser(user),
        profile: user.profile,
      });
    }

    // ── SAVE: Update DB with client state ───────────────────────
    if (action === 'save' || action === 'full') {
      const updateData: Record<string, unknown> = {};

      // UI state
      if (body.currentView !== undefined) updateData.currentView = body.currentView;
      if (body.currentTab !== undefined) updateData.currentTab = body.currentTab;
      if (body.onboardingDone !== undefined) updateData.onboardingDone = body.onboardingDone;

      // Learning profile
      if (body.topic !== undefined) updateData.topic = body.topic;
      if (body.vision !== undefined) updateData.vision = body.vision;
      if (body.domain !== undefined) updateData.domain = body.domain;
      if (body.level !== undefined) updateData.level = body.level;
      if (body.minutesPerDay !== undefined) updateData.minutesPerDay = String(body.minutesPerDay);
      if (body.learningStyle !== undefined) updateData.learningStyle = body.learningStyle;
      if (body.whyNow !== undefined) updateData.whyNow = body.whyNow;
      if (body.obstacle !== undefined) updateData.obstacle = body.obstacle;

      // Progress (only save if values are higher — never overwrite progress with lower values)
      if (body.sessionCount !== undefined && body.sessionCount > user.sessionCount) {
        updateData.sessionCount = body.sessionCount;
      }
      if (body.wins !== undefined && body.wins > user.wins) {
        updateData.wins = body.wins;
      }
      if (body.successStreak !== undefined && body.successStreak > user.successStreak) {
        updateData.successStreak = body.successStreak;
      }
      if (body.bestStreak !== undefined && body.bestStreak > user.bestStreak) {
        updateData.bestStreak = body.bestStreak;
      }
      if (body.xp !== undefined && body.xp > user.xp) {
        updateData.xp = body.xp;
      }
      if (body.mastery !== undefined && body.mastery > user.mastery) {
        updateData.mastery = body.mastery;
      }

      // Settings
      if (body.autoTasks !== undefined) updateData.autoTasks = body.autoTasks;
      if (body.autoSchedule !== undefined) updateData.autoSchedule = body.autoSchedule;
      if (body.voiceEnabled !== undefined) updateData.voiceEnabled = body.voiceEnabled;

      if (Object.keys(updateData).length > 0) {
        updateData.lastSeenAt = new Date();
        await db.user.update({
          where: { id: user.id },
          data: updateData,
        });
      }
    }

    // ── FULL: Return updated state after save ────────────────────
    if (action === 'full') {
      const updatedUser = await db.user.findUnique({ where: { id: user.id }, include: { profile: true } });
      return NextResponse.json({
        ok: true,
        user: serializeUser(updatedUser!),
        profile: updatedUser!.profile,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[auth/sync] Error:', error);
    return NextResponse.json({ error: 'Failed to sync' }, { status: 500 });
  }
}

function serializeUser(user: {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  provider: string;
  sessionToken: string | null;
  topic: string | null;
  vision: string | null;
  domain: string | null;
  level: string | null;
  minutesPerDay: string | null;
  learningStyle: string | null;
  whyNow: string | null;
  obstacle: string | null;
  sessionCount: number;
  wins: number;
  successStreak: number;
  bestStreak: number;
  mastery: number;
  xp: number;
  autoTasks: boolean;
  autoSchedule: boolean;
  voiceEnabled: boolean;
  currentView: string | null;
  currentTab: string | null;
  onboardingDone: boolean;
  calendarConnected: boolean;
  tasksConnected: boolean;
  gmailConnected: boolean;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    picture: user.picture,
    provider: user.provider,
    sessionToken: user.sessionToken,
    topic: user.topic,
    vision: user.vision,
    domain: user.domain,
    level: user.level,
    minutesPerDay: user.minutesPerDay,
    learningStyle: user.learningStyle,
    whyNow: user.whyNow,
    obstacle: user.obstacle,
    sessionCount: user.sessionCount,
    wins: user.wins,
    successStreak: user.successStreak,
    bestStreak: user.bestStreak,
    mastery: user.mastery,
    xp: user.xp,
    autoTasks: user.autoTasks,
    autoSchedule: user.autoSchedule,
    voiceEnabled: user.voiceEnabled,
    currentView: user.currentView,
    currentTab: user.currentTab,
    onboardingDone: user.onboardingDone,
    calendarConnected: user.calendarConnected,
    tasksConnected: user.tasksConnected,
    gmailConnected: user.gmailConnected,
  };
}
