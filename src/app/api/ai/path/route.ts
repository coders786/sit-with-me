import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';
import { buildSystemPrompt, buildUserProfileContext } from '@/lib/ai-personality';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionToken } = body;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Session token is required' }, { status: 400 });
    }

    const user = await db.user.findFirst({ where: { sessionToken } });
    if (!user) {
      return NextResponse.json({ error: 'Invalid session token' }, { status: 401 });
    }

    const profileContext = buildUserProfileContext(user);

    const systemPrompt = buildSystemPrompt({
      tone: 'path',
      context: profileContext || undefined,
      additionalRules: [
        `Generate a 4-phase learning path. Return it as JSON with this EXACT structure (no markdown, no code blocks):`,
        `{`,
        `  "phases": [`,
        `    {`,
        `      "phase": 1,`,
        `      "title": "A name that means something (not 'Phase 1: Fundamentals')",`,
        `      "description": "2-3 sentences about what this phase covers — write it like you're telling them what's coming up and why it matters",`,
        `      "estimatedWeeks": 2,`,
        `      "milestones": [`,
        `        {"text": "A real milestone they'd actually celebrate reaching", "completed": false},`,
        `        {"text": "Another achievable win", "completed": false},`,
        `        {"text": "The 'aha moment' milestone", "completed": false}`,
        `      ],`,
        `      "resources": [`,
        `        {"title": "A resource you'd genuinely recommend", "url": "https://example.com"}`,
        `      ]`,
        `    }`,
        `  ]`,
        `}`,
        ``,
        `Rules:`,
        `- Phase 1: Getting started / foundations — make it feel exciting, not intimidating`,
        `- Phase 2: Building on what they know — going deeper`,
        `- Phase 3: Advanced stuff — where it gets really interesting`,
        `- Phase 4: Mastery / real projects — putting it all together`,
        `- Each phase needs 3-4 milestones that feel like real achievements, not checkboxes`,
        `- 1-2 resources per phase that you'd actually tell a friend about`,
        `- Adjust estimatedWeeks based on their level — beginners need more time, advanced folks can move faster`,
        `- Factor in how much time they have each day`,
        `- Think about how they learn best when picking resources`,
      ],
    });

    const zai = await ZAI.create();
    const result = await zai.chat.completions.create({
      model: 'gemini-2.0-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Map out my learning journey.' },
      ],
      temperature: 0.8,
    });

    const content = result?.choices?.[0]?.message?.content || result?.content || '';

    // Parse the JSON from the response
    let pathData: { phases: Array<{ phase: number; title: string; description: string; estimatedWeeks: number; milestones: Array<{ text: string; completed: boolean }>; resources: Array<{ title: string; url: string }> }> };
    try {
      const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        pathData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('[ai/path] JSON parse error:', parseError, 'Content:', content.slice(0, 200));
      const topic = user.topic || 'your topic';
      pathData = {
        phases: [
          { phase: 1, title: 'Getting Your Feet Wet', description: `Starting with the basics of ${topic} — the stuff that'll make everything else click.`, estimatedWeeks: 2, milestones: [{ text: 'Understand the core ideas', completed: false }, { text: 'Finish your first intro tutorial', completed: false }, { text: 'Build something tiny but real', completed: false }], resources: [{ title: `${topic} Official Docs`, url: '#' }] },
          { phase: 2, title: 'Finding Your Rhythm', description: `Getting deeper into ${topic} and starting to connect the dots.`, estimatedWeeks: 3, milestones: [{ text: 'Handle intermediate-level stuff confidently', completed: false }, { text: 'Build a project worth showing', completed: false }, { text: 'Solve problems without following a guide', completed: false }], resources: [{ title: `${topic} Advanced Guide`, url: '#' }] },
          { phase: 3, title: 'Going Deeper', description: `Tackling the advanced ${topic} territory — this is where it gets fun.`, estimatedWeeks: 3, milestones: [{ text: 'Understand the patterns pros use', completed: false }, { text: 'Contribute to something bigger', completed: false }, { text: 'Teach it to someone else', completed: false }], resources: [{ title: `${topic} Community`, url: '#' }] },
          { phase: 4, title: 'Making It Yours', description: `Putting your ${topic} skills to work on something that matters to you.`, estimatedWeeks: 2, milestones: [{ text: 'Ship a capstone project', completed: false }, { text: 'Get real feedback', completed: false }, { text: 'Look back and see how far you\'ve come', completed: false }], resources: [{ title: 'Project Ideas', url: '#' }] },
        ],
      };
    }

    return NextResponse.json({
      phases: pathData.phases || [],
    });
  } catch (error) {
    console.error('[ai/path] Error:', error);
    return NextResponse.json({ error: 'Failed to generate learning path' }, { status: 500 });
  }
}
