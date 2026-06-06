import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      sessionToken,
      name,
      topic,
      vision,
      domain,
      level,
      minutesPerDay,
      learningStyle,
      whyNow,
      obstacle,
      displayName,
      bio,
      avatar,
      goal,
    } = body;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Session token is required' }, { status: 400 });
    }

    const user = await db.user.findFirst({ where: { sessionToken } });
    if (!user) {
      return NextResponse.json({ error: 'Invalid session token' }, { status: 401 });
    }

    // Build user update data (only include fields that are provided)
    const userData: Record<string, unknown> = {};
    if (name !== undefined) userData.name = name;
    if (topic !== undefined) userData.topic = topic;
    if (vision !== undefined) userData.vision = vision;
    if (domain !== undefined) userData.domain = domain;
    if (level !== undefined) userData.level = level;
    if (minutesPerDay !== undefined) userData.minutesPerDay = minutesPerDay;
    if (learningStyle !== undefined) userData.learningStyle = learningStyle;
    if (whyNow !== undefined) userData.whyNow = whyNow;
    if (obstacle !== undefined) userData.obstacle = obstacle;

    // Build profile update data
    const profileData: Record<string, unknown> = {};
    if (displayName !== undefined) profileData.displayName = displayName;
    if (bio !== undefined) profileData.bio = bio;
    if (avatar !== undefined) profileData.avatar = avatar;
    if (goal !== undefined) profileData.goal = goal;

    // Update user if there are fields to update
    if (Object.keys(userData).length > 0) {
      await db.user.update({
        where: { id: user.id },
        data: userData,
      });
    }

    // Update profile if there are fields to update
    if (Object.keys(profileData).length > 0) {
      const existingProfile = await db.profile.findUnique({ where: { userId: user.id } });
      if (existingProfile) {
        await db.profile.update({
          where: { userId: user.id },
          data: profileData,
        });
      } else {
        await db.profile.create({
          data: {
            userId: user.id,
            displayName: name || 'Learner',
            avatar: '🧠',
            ...profileData,
          },
        });
      }
    }

    // Fetch updated data
    const updatedUser = await db.user.findUnique({ where: { id: user.id } });
    const updatedProfile = await db.profile.findUnique({ where: { userId: user.id } });

    return NextResponse.json({ user: updatedUser, profile: updatedProfile });
  } catch (error) {
    console.error('[profile] Error:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
