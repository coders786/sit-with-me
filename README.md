---
title: Sit With Me
emoji: 🧠
colorFrom: purple
colorTo: pink
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# 🧠 Sit With Me — AI Learning Companion

**Sit With Me** is an AI-powered learning companion that creates personalized study paths, provides interactive mentoring, and tracks your learning progress with gamification.

## Features

- 🤖 **AI Mentor Chat** — Personalized conversations with Gemini AI
- 📚 **Learning Paths** — Auto-generated study plans tailored to your goals
- ✅ **Task Management** — Smart task extraction from conversations
- 📊 **Progress Tracking** — XP, levels, streaks, achievements
- 🃏 **Spaced Repetition** — Flashcards with SM-2 algorithm
- 🍅 **Pomodoro Timer** — Focus sessions with sound alerts
- 🎯 **Daily Challenges** — Quick learning challenges for XP
- 🌙 **Dark/Light Theme** — Beautiful adaptive UI
- 🔊 **Text-to-Speech** — AI responses read aloud
- 🎨 **Rich Markdown** — Code blocks, formatting, reactions
- ⌨️ **Keyboard Shortcuts** — Navigate with ⌘K, 1-9, ? shortcuts

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **AI**: Google Gemini via z-ai-web-dev-sdk
- **State**: Zustand with persistence
- **UI**: Tailwind CSS + shadcn/ui + Radix Primitives
- **Database**: Prisma ORM with SQLite
- **Charts**: Recharts
- **Animations**: Framer Motion

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up your Gemini API key in the app
4. Run: `npm run dev`

## License

MIT
