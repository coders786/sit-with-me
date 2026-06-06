import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

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

    // Build context-aware prompt
    const profileContext: string[] = [];
    if (user.topic) profileContext.push(`Learning topic: ${user.topic}`);
    if (user.vision) profileContext.push(`Vision: ${user.vision}`);
    if (user.domain) profileContext.push(`Domain: ${user.domain}`);
    if (user.level) profileContext.push(`Current level: ${user.level}`);
    if (user.minutesPerDay) profileContext.push(`Available minutes per day: ${user.minutesPerDay}`);
    if (user.learningStyle) profileContext.push(`Preferred learning style: ${user.learningStyle}`);
    if (user.whyNow) profileContext.push(`Motivation: ${user.whyNow}`);
    if (user.obstacle) profileContext.push(`Main obstacle: ${user.obstacle}`);

    const systemPrompt = `You are a learning path architect for "Sit With Me" — an AI learning companion. Based on the user's topic, level, and learning style, generate a 4-phase learning path.

Each phase represents a major stage of their learning journey. Return your response as JSON with this EXACT structure (no markdown, no code blocks):
{
  "phases": [
    {
      "phase": 1,
      "title": "Short phase title",
      "description": "2-3 sentence description of what this phase covers and why it matters",
      "estimatedWeeks": 2,
      "milestones": [
        {"text": "Complete this milestone", "completed": false},
        {"text": "Achieve this goal", "completed": false},
        {"text": "Master this concept", "completed": false}
      ],
      "resources": [
        {"title": "Resource Name", "url": "https://example.com"}
      ]
    }
  ]
}

Rules:
- Phase 1 should always be fundamentals/foundations for the topic
- Phase 2 should build on Phase 1 with more depth
- Phase 3 should cover advanced/specialized topics
- Phase 4 should be mastery/application/project-based
- Each phase should have 3-4 milestones
- Each phase should have 1-2 learning resources with real URLs where possible
- Adjust estimatedWeeks based on the user's level (beginner = longer phases, advanced = shorter)
- Account for the user's daily time commitment
- Consider their learning style when suggesting resources

User's learning profile:
${profileContext.join('\n')}`;

    const zai = await ZAI.create();
    const result = await zai.chat.completions.create({
      model: 'gemini-2.0-flash',
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: 'Generate my personalized 4-phase learning path.' },
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
      // Fallback path
      const topic = user.topic || 'your topic';
      pathData = {
        phases: [
          { phase: 1, title: 'Foundations', description: `Build a solid understanding of ${topic} fundamentals.`, estimatedWeeks: 2, milestones: [{ text: 'Understand core concepts', completed: false }, { text: 'Complete introductory tutorial', completed: false }, { text: 'Build first simple project', completed: false }], resources: [{ title: `${topic} Official Docs`, url: '#' }] },
          { phase: 2, title: 'Growth', description: `Deepen your ${topic} skills with more complex topics.`, estimatedWeeks: 3, milestones: [{ text: 'Master intermediate patterns', completed: false }, { text: 'Build a portfolio project', completed: false }, { text: 'Solve practice problems', completed: false }], resources: [{ title: `${topic} Advanced Guide`, url: '#' }] },
          { phase: 3, title: 'Mastery', description: `Tackle advanced ${topic} concepts and real-world applications.`, estimatedWeeks: 3, milestones: [{ text: 'Understand advanced patterns', completed: false }, { text: 'Contribute to a project', completed: false }, { text: 'Teach concepts to others', completed: false }], resources: [{ title: `${topic} Community`, url: '#' }] },
          { phase: 4, title: 'Application', description: `Apply your ${topic} expertise to build something meaningful.`, estimatedWeeks: 2, milestones: [{ text: 'Design and build a capstone project', completed: false }, { text: 'Get feedback from peers', completed: false }, { text: 'Document your journey', completed: false }], resources: [{ title: 'Project Ideas', url: '#' }] },
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
