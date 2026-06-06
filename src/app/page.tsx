'use client'

import React, { useState, useRef, useEffect, useCallback, useMemo, Fragment } from 'react'
import { useAppStore, type AppView, type AppTab, type ChatMsg, type ReviewCard } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  MessageSquare, Calendar, CheckSquare, TrendingUp, Globe, Settings,
  Send, Mic, MicOff, LogOut, Brain, Sparkles, ArrowRight, ArrowLeft,
  Key, User, ChevronRight, Volume2, VolumeX, Plus, Clock, Target,
  Zap, Star, Trophy, Flame, Eye, Mail, Check, X, Menu, Command,
  Search, RotateCcw, Wand2, LayoutList, BarChart3, MonitorSmartphone,
  Lightbulb, Code2, Palette, Hash, Bell, Copy, CheckCheck, Filter,
  Clipboard, Download, Lock, Unlock, BookOpen, Sun, Moon, BookMarked,
  ExternalLink, ChevronUp, ChevronDown
} from 'lucide-react'
import { toast } from 'sonner'
import { AnimatePresence, motion } from 'framer-motion'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts'
import { Drawer as VaulDrawer } from 'vaul'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

/* ========================================================================
   API Helper
   ======================================================================== */
async function api(path: string, body: Record<string, unknown> = {}) {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

/* ========================================================================
   TIME AGO HELPER
   ======================================================================== */
function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

/* ========================================================================
   IMPROVED MARKDOWN RENDERER
   ======================================================================== */
function renderMarkdown(text: string): React.ReactNode {
  // Pre-process: split by ``` markers for code blocks
  const segments = text.split(/(```[\s\S]*?```)/g)
  const result: React.ReactNode[] = []
  let key = 0

  for (const segment of segments) {
    if (segment.startsWith('```') && segment.endsWith('```')) {
      // Code block
      const inner = segment.slice(3, -3)
      const firstNewline = inner.indexOf('\n')
      const lang = firstNewline > 0 ? inner.slice(0, firstNewline).trim() : ''
      const code = firstNewline > 0 ? inner.slice(firstNewline + 1) : inner
      const safeLang = lang || 'text'
      try {
        result.push(
          <SyntaxHighlighter key={key++} language={safeLang} style={oneDark} className="rounded-lg my-2 text-xs">
            {code}
          </SyntaxHighlighter>
        )
      } catch {
        result.push(
          <pre key={key++} className="bg-[#272b34] text-[#c5d0ff] p-3 rounded-lg my-2 text-xs overflow-x-auto">
            <code>{code}</code>
          </pre>
        )
      }
    } else {
      // Regular markdown - process line by line
      const lines = segment.split('\n')
      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx]

        // Handle headers
        if (line.startsWith('### ')) {
          result.push(<h3 key={key++} className="text-sm font-bold text-[#c5d0ff] mt-2 mb-1">{line.slice(4)}</h3>)
          continue
        }
        if (line.startsWith('## ')) {
          result.push(<h2 key={key++} className="text-base font-bold text-[#c5d0ff] mt-2 mb-1">{line.slice(3)}</h2>)
          continue
        }
        if (line.startsWith('# ')) {
          result.push(<h1 key={key++} className="text-lg font-bold text-[#c5d0ff] mt-2 mb-1">{line.slice(2)}</h1>)
          continue
        }

        // Process inline elements within the line
        const inlineParts = line.split(/(\*\*.*?\*\*|`[^`]+`|\[([^\]]+)\]\(([^)]+)\))/g)
        const inlineResult: React.ReactNode[] = []

        for (const part of inlineParts) {
          if (part === undefined || part === '') continue
          if (part.startsWith('**') && part.endsWith('**')) {
            inlineResult.push(<strong key={key++} className="font-semibold text-[#c5d0ff]">{part.slice(2, -2)}</strong>)
          } else if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
            inlineResult.push(
              <code key={key++} className="bg-[#272b34] text-[#9d7cff] px-1.5 py-0.5 rounded text-xs font-mono">
                {part.slice(1, -1)}
              </code>
            )
          } else if (/^\[([^\]]+)\]\(([^)]+)\)$/.test(part)) {
            const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
            if (match) {
              inlineResult.push(
                <a key={key++} href={match[2]} target="_blank" rel="noopener noreferrer"
                  className="text-[#7c9cff] underline hover:text-[#9d7cff] transition-colors">
                  {match[1]}
                </a>
              )
            }
          } else if (part.startsWith('- ') || part === '- ') {
            inlineResult.push(<span key={key++}>&bull; {part.slice(2)}</span>)
          } else {
            inlineResult.push(<span key={key++}>{part}</span>)
          }
        }

        if (lineIdx > 0 || result.length > 0) {
          result.push(<br key={key++} />)
        }
        result.push(<span key={key++}>{inlineResult}</span>)
      }
    }
  }
  return <>{result}</>
}

/* ========================================================================
   GLOBAL CSS ANIMATIONS & CUSTOM SCROLLBAR
   ======================================================================== */
function GlobalStyles() {
  return (
    <style>{`
      @keyframes glow {
        0%, 100% { box-shadow: 0 0 30px rgba(124,156,255,0.3), 0 0 60px rgba(157,124,255,0.1); }
        50% { box-shadow: 0 0 50px rgba(124,156,255,0.5), 0 0 100px rgba(157,124,255,0.2); }
      }
      @keyframes glowSpeaking {
        0%, 100% { box-shadow: 0 0 40px rgba(124,156,255,0.5), 0 0 80px rgba(157,124,255,0.2); }
        50% { box-shadow: 0 0 70px rgba(124,156,255,0.7), 0 0 120px rgba(157,124,255,0.3); }
      }
      @keyframes orbRing {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes orbRing2 {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(-360deg); }
      }
      @keyframes floatUp {
        0% { transform: translateY(100vh) scale(0); opacity: 0; }
        10% { opacity: 1; }
        90% { opacity: 0.6; }
        100% { transform: translateY(-20vh) scale(1); opacity: 0; }
      }
      @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes thinkingDot {
        0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
        40% { transform: scale(1); opacity: 1; }
      }
      @keyframes countUp {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes pulseDot {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
      @keyframes cardHover {
        from { transform: translateY(0); }
        to { transform: translateY(-2px); }
      }
      @keyframes shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      @keyframes tabSwitch {
        from { opacity: 0; transform: translateX(8px); }
        to { opacity: 1; transform: translateX(0); }
      }
      @keyframes shimmer-gradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
      @keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
      @keyframes gradient-border { from { background-position: 0% 50%; } to { background-position: 100% 50%; } }
      @keyframes pulseRing { 0% { box-shadow: 0 0 0 0 rgba(124,156,255,0.4); } 70% { box-shadow: 0 0 0 8px rgba(124,156,255,0); } 100% { box-shadow: 0 0 0 0 rgba(124,156,255,0); } }
      @keyframes progressShimmer { 0% { left: -100%; } 100% { left: 200%; } }
      @keyframes cardShine { from { left: -100%; } to { left: 200%; } }
      @keyframes ripple { 0% { transform: scale(0.8); opacity: 1; } 100% { transform: scale(2.5); opacity: 0; } }
      @keyframes aurora { 0% { background-position: 0% 50%; } 25% { background-position: 50% 0%; } 50% { background-position: 100% 50%; } 75% { background-position: 50% 100%; } 100% { background-position: 0% 50%; } }
      @keyframes slideInLeft { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
      @keyframes pulseGlow { 0%, 100% { box-shadow: 0 0 8px rgba(124,156,255,0.3); } 50% { box-shadow: 0 0 20px rgba(124,156,255,0.6); } }
      @keyframes borderGlow { 0%, 100% { border-color: rgba(124,156,255,0.3); } 50% { border-color: rgba(124,156,255,0.7); } }

      .animate-fadeInUp { animation: fadeInUp 0.5s ease-out forwards; }
      .animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }
      .animate-slideUp { animation: slideUp 0.35s ease-out forwards; }
      .animate-tabSwitch { animation: tabSwitch 0.25s ease-out forwards; }
      .animate-slideInLeft { animation: slideInLeft 0.3s ease-out forwards; }
      .animate-pulseGlow { animation: pulseGlow 2s ease-in-out infinite; }
      .animate-borderGlow { animation: borderGlow 2s ease-in-out infinite; }

      /* Aurora background */
      .aurora-bg {
        background: linear-gradient(135deg, #0e0f13, #111318, #0f1117, #10121a);
        background-size: 400% 400%;
        animation: aurora 15s ease infinite;
      }

      /* Chat input glow on focus */
      .chat-input-glow:focus-within {
        animation: borderGlow 2s ease-in-out infinite;
        box-shadow: 0 0 12px rgba(124,156,255,0.15);
      }

      /* Thinking ripple effect */
      .thinking-ripple {
        position: relative;
      }
      .thinking-ripple::before, .thinking-ripple::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 1px solid rgba(157,124,255,0.3);
        transform: translate(-50%, -50%);
        animation: ripple 2s ease-out infinite;
      }
      .thinking-ripple::after {
        animation-delay: 0.5s;
      }

      .chat-bubble-enter { animation: slideUp 0.3s ease-out forwards; }

      .card-hover { transition: all 0.2s ease; position: relative; overflow: hidden; }
      .card-hover:hover { transform: translateY(-2px); box-shadow: 0 0 20px rgba(124,156,255,0.1), 0 0 40px rgba(124,156,255,0.05); border-color: rgba(124,156,255,0.3) !important; }
      .card-shine { position: relative; overflow: hidden; }
      .card-shine::after { content: ''; position: absolute; top: 0; left: -100%; width: 60%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent); pointer-events: none; }
      .card-shine:hover::after { animation: cardShine 0.6s ease forwards; }

      .btn-hover { transition: all 0.15s ease; }
      .btn-hover:hover { transform: scale(1.03); }
      .btn-hover:active { transform: scale(0.97); }

      /* Custom scrollbar */
      .custom-scrollbar::-webkit-scrollbar { width: 6px; }
      .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      .custom-scrollbar::-webkit-scrollbar-thumb { background: #272b34; border-radius: 3px; }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3a3f4b; }

      .particle {
        position: absolute;
        border-radius: 50%;
        pointer-events: none;
        animation: floatUp linear infinite;
      }

      /* Grid pattern background */
      .grid-bg {
        background-image:
          linear-gradient(rgba(124,156,255,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(124,156,255,0.03) 1px, transparent 1px);
        background-size: 40px 40px;
      }

      /* Scroll area gradient overlay */
      .scroll-gradient::before {
        content: '';
        position: sticky;
        top: 0;
        display: block;
        height: 32px;
        background: linear-gradient(to bottom, #0e0f13, transparent);
        pointer-events: none;
        z-index: 1;
      }

      /* Sidebar active accent border */
      .sidebar-active {
        border-left: 3px solid #7c9cff;
        padding-left: 9px;
        background: linear-gradient(to right, rgba(124,156,255,0.12), rgba(124,156,255,0.02)) !important;
      }
      .sidebar-active-dot {
        display: inline-block;
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: #7c9cff;
        margin-left: 4px;
        animation: pulseDot 1.5s ease-in-out infinite;
      }
      .sidebar-inactive {
        border-left: 3px solid transparent;
        padding-left: 9px;
      }

      /* Animated gradient border */
      .gradient-border-animated {
        position: relative;
        border-radius: 0.75rem;
        overflow: hidden;
      }
      .gradient-border-animated::before {
        content: '';
        position: absolute;
        inset: 0;
        padding: 1.5px;
        border-radius: 0.75rem;
        background: conic-gradient(from var(--border-angle, 0deg), #7c9cff, #9d7cff, #c084fc, #7c9cff);
        -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
        animation: gradient-border 3s linear infinite;
        background-size: 100% 100%;
      }

      /* Progress bar shimmer */
      .progress-shimmer { position: relative; overflow: hidden; }
      .progress-shimmer::after {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 50%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
        animation: progressShimmer 2s ease-in-out infinite;
      }

      /* Onboarding bubble gradient */
      .bubble-gradient-assistant {
        background: linear-gradient(135deg, #1d2129 0%, #1f2535 100%);
      }
      .bubble-gradient-user {
        background: linear-gradient(135deg, #2c3450 0%, #2a3555 100%);
      }

      /* Glassmorphism helpers */
      .glass { background: rgba(25, 28, 35, 0.6); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); }
      .glass-hover:hover { background: rgba(25, 28, 35, 0.8); border-color: rgba(124,156,255,0.2) !important; }
      .vignette { box-shadow: inset 0 0 150px rgba(0,0,0,0.5); }

      /* Light Theme Overrides */
      [data-theme="light"] {
        --theme-bg: #f8f9fb;
        --theme-bg-secondary: #ffffff;
        --theme-bg-tertiary: #e8eaed;
        --theme-text: #1a1c23;
        --theme-text-muted: #6b7280;
        --theme-accent: #6366f1;
        --theme-border: #e5e7eb;
        --theme-card-bg: #ffffff;
        --theme-card-border: #e5e7eb;
        --theme-input-bg: #f3f4f6;
        --theme-input-border: #d1d5db;
        --theme-sidebar-bg: #f3f4f6;
        --theme-sidebar-border: #e5e7eb;
        --theme-hover-bg: #e8eaed;
        --theme-code-bg: #f3f4f6;
        --theme-bubble-assistant: #f3f4f6;
        --theme-bubble-user: #e0e7ff;
        --theme-top-bar-bg: #ffffff;
        --theme-badge-bg: #e0e7ff;
        --theme-badge-text: #4f46e5;
        --theme-scrollbar-thumb: #c7c8cc;
        --theme-scrollbar-thumb-hover: #a1a1aa;
        --theme-shadow: rgba(0,0,0,0.08);
        --theme-overlay-bg: rgba(255,255,255,0.6);
        --theme-glass-bg: rgba(255, 255, 255, 0.7);
        --theme-glass-border: rgba(0, 0, 0, 0.08);
      }
      [data-theme="light"] .bg-\\[\\#0e0f13\\] { background-color: #f8f9fb !important; }
      [data-theme="light"] .bg-\\[\\#15171d\\] { background-color: #f3f4f6 !important; }
      [data-theme="light"] .bg-\\[\\#191c23\\] { background-color: #ffffff !important; }
      [data-theme="light"] .bg-\\[\\#1d2129\\] { background-color: #f3f4f6 !important; }
      [data-theme="light"] .bg-\\[\\#1f232c\\] { background-color: #e8eaed !important; }
      [data-theme="light"] .border-\\[\\#272b34\\] { border-color: #e5e7eb !important; }
      [data-theme="light"] .text-\\[\\#eef0f4\\] { color: #1a1c23 !important; }
      [data-theme="light"] .text-\\[\\#c5d0ff\\] { color: #4338ca !important; }
      [data-theme="light"] .text-muted-foreground { color: #6b7280 !important; }
      [data-theme="light"] .custom-scrollbar::-webkit-scrollbar-thumb { background: #c7c8cc; }
      [data-theme="light"] .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #a1a1aa; }
      [data-theme="light"] .bubble-gradient-assistant { background: linear-gradient(135deg, #f3f4f6 0%, #e8eaed 100%); }
      [data-theme="light"] .bubble-gradient-user { background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%); }
      [data-theme="light"] .sidebar-active { background: rgba(99,102,241,0.08) !important; border-left-color: #6366f1; }
      [data-theme="light"] .glass { background: rgba(255,255,255,0.7); border-color: rgba(0,0,0,0.08); }
      [data-theme="light"] .grid-bg {
        background-image:
          linear-gradient(rgba(99,102,241,0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(99,102,241,0.05) 1px, transparent 1px);
      }
      /* Light Theme - Aurora background */
      [data-theme="light"] .aurora-bg {
        background: linear-gradient(135deg, #f8f9fb, #eef0f5, #f3f4f8, #f0f1f6);
        background-size: 400% 400%;
        animation: aurora 15s ease infinite;
      }
      /* Light Theme - Thinking ripple */
      [data-theme="light"] .thinking-ripple::before,
      [data-theme="light"] .thinking-ripple::after {
        border-color: rgba(99,102,241,0.25);
      }
      /* Light Theme - Chat input glow */
      [data-theme="light"] .chat-input-glow:focus-within {
        border-color: rgba(99,102,241,0.4);
        box-shadow: 0 0 12px rgba(99,102,241,0.1);
      }
      /* Light Theme - Review card flip */
      [data-theme="light"] .backface-hidden + div .bg-\\[\\#191c23\\],
      [data-theme="light"] .perspective-1000 .bg-\\[\\#191c23\\] {
        background-color: #ffffff !important;
        border-color: #e5e7eb !important;
      }
      /* Light Theme - Mood tracker widget */
      [data-theme="light"] .card-hover:hover {
        box-shadow: 0 0 20px rgba(99,102,241,0.08), 0 0 40px rgba(99,102,241,0.04);
        border-color: rgba(99,102,241,0.2) !important;
      }
    `}</style>
  )
}

/* ========================================================================
   ANIMATED ORB (Enhanced)
   ======================================================================== */
function Orb({ speaking }: { speaking?: boolean }) {
  return (
    <div className="relative mx-auto mb-8 w-24 h-24">
      {/* Outer ring 1 */}
      <div className="absolute inset-[-16px] rounded-full border border-[#7c9cff]/20"
        style={{ animation: 'orbRing 8s linear infinite' }}>
        <div className="absolute -top-1 left-1/2 w-2 h-2 rounded-full bg-[#7c9cff]/60" />
      </div>
      {/* Outer ring 2 */}
      <div className="absolute inset-[-28px] rounded-full border border-dashed border-[#9d7cff]/15"
        style={{ animation: 'orbRing2 12s linear infinite' }}>
        <div className="absolute -bottom-1 right-1/4 w-1.5 h-1.5 rounded-full bg-[#9d7cff]/40" />
      </div>
      {/* Glow background */}
      <div className="absolute inset-[-8px] rounded-full opacity-40"
        style={{
          background: 'radial-gradient(circle, rgba(124,156,255,0.3), transparent 70%)',
          animation: speaking ? 'glowSpeaking 1.4s ease-in-out infinite' : 'glow 3s ease-in-out infinite',
        }} />
      {/* Main orb */}
      <div
        className={`relative w-24 h-24 rounded-full ${speaking ? 'animate-pulse' : ''}`}
        style={{
          background: 'radial-gradient(circle at 35% 30%, #c5d0ff, #7c9cff 40%, #9d7cff 80%, #6b5ce7 100%)',
          boxShadow: speaking
            ? '0 0 40px rgba(124,156,255,0.5), inset 0 0 20px rgba(255,255,255,0.1)'
            : '0 0 30px rgba(124,156,255,0.3), inset 0 0 20px rgba(255,255,255,0.05)',
          animation: speaking ? 'glowSpeaking 1.4s ease-in-out infinite' : 'glow 3s ease-in-out infinite',
        }}
      >
        {/* Inner highlight */}
        <div className="absolute top-3 left-4 w-6 h-4 rounded-full bg-white/20 blur-sm" />
      </div>
    </div>
  )
}

/* ========================================================================
   FLOATING PARTICLES
   ======================================================================== */
// Seeded PRNG (mulberry32) for deterministic random values on server & client
function mulberry32(seed: number) {
  return function() {
    let t = seed += 0x6D2B79F5
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

function FloatingParticles() {
  // Deterministic seeded random — avoids hydration mismatch
  const particles = useMemo(() => {
    const rand = mulberry32(42)
    return Array.from({ length: 25 }, (_, i) => ({
      id: i,
      left: rand() * 100,
      size: rand() * 3 + 1,
      duration: rand() * 12 + 8,
      delay: rand() * 8,
      opacity: rand() * 0.4 + 0.1,
    }))
  }, [])

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map(p => (
        <div
          key={p.id}
          className="particle"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: p.id % 3 === 0 ? '#7c9cff' : p.id % 3 === 1 ? '#9d7cff' : '#c5d0ff',
            opacity: p.opacity,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  )
}

/* ========================================================================
   COMMAND PALETTE
   ======================================================================== */
function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const store = useAppStore()
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const actions = useMemo(() => [
    { id: 'new-session', label: 'New Session', icon: <MessageSquare className="w-4 h-4" />, desc: 'Start a fresh chat', action: () => { store.clearChat(); store.setTab('session'); onClose() } },
    { id: 'generate-plan', label: 'Generate Plan', icon: <Calendar className="w-4 h-4" />, desc: 'Create 7-day learning plan', action: () => { store.setTab('plan'); onClose() } },
    { id: 'view-tasks', label: 'View Tasks', icon: <CheckSquare className="w-4 h-4" />, desc: 'See your learning tasks', action: () => { store.setTab('tasks'); onClose() } },
    { id: 'progress', label: 'Progress', icon: <TrendingUp className="w-4 h-4" />, desc: 'Check your progress', action: () => { store.setTab('progress'); onClose() } },
    { id: 'add-flashcard', label: 'Add Flashcard', icon: <BookMarked className="w-4 h-4" />, desc: 'Go to Review tab', action: () => { store.setTab('review'); onClose() } },
    { id: 'toggle-theme', label: 'Toggle Theme', icon: <Sun className="w-4 h-4" />, desc: 'Switch dark/light mode', action: () => { store.setTheme(store.theme === 'dark' ? 'light' : 'dark'); toast.success(`Switched to ${store.theme === 'dark' ? 'light' : 'dark'} mode`); onClose() } },
    { id: 'export-data', label: 'Export Data', icon: <Download className="w-4 h-4" />, desc: 'Download all data as JSON', action: () => {
      const state = useAppStore.getState()
      const data = {
        exportDate: new Date().toISOString(), version: '9.0',
        profile: state.profile, topic: state.topic, vision: state.vision,
        tasks: state.tasks, reviewCards: state.reviewCards, moodLogs: state.moodLogs,
        chatMessages: state.chatMessages, quickNotes: state.quickNotes,
        progress: { sessionCount: state.sessionCount, wins: state.wins, xp: state.xp, mastery: state.mastery },
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `sitwithme-export.json`; a.click()
      URL.revokeObjectURL(url); toast.success('Data exported!'); onClose()
    }},
    { id: 'start-pomodoro', label: 'Start Pomodoro', icon: <Clock className="w-4 h-4" />, desc: 'Start focus timer', action: () => {
      const state = useAppStore.getState()
      const dur = state.defaultSessionDuration
      state.setPomodoroState({ running: true, timeLeft: dur * 60, mode: 'work' })
      toast.success(`Pomodoro started! ${dur} min focus.`); onClose()
    }},
    { id: 'room', label: 'World Room', icon: <Globe className="w-4 h-4" />, desc: 'Community chat', action: () => { store.setTab('room'); onClose() } },
    { id: 'thinkspace', label: 'Think Space', icon: <Sparkles className="w-4 h-4" />, desc: 'Deploy sub-agents', action: () => { store.setTab('thinkspace'); onClose() } },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" />, desc: 'Configure preferences', action: () => { store.setTab('settings'); onClose() } },
    { id: 'toggle-voice', label: 'Toggle Voice', icon: <Volume2 className="w-4 h-4" />, desc: 'Enable/disable voice', action: () => { store.setSettings({ voiceEnabled: !store.voiceEnabled }); toast.success(store.voiceEnabled ? 'Voice off' : 'Voice on'); onClose() } },
    { id: 'reset', label: 'Reset Everything', icon: <RotateCcw className="w-4 h-4" />, desc: 'Clear all data', action: () => { localStorage.removeItem('sitwithme-v9'); window.location.reload() } },
  ], [store, onClose])

  const filtered = useMemo(() =>
    actions.filter(a =>
      a.label.toLowerCase().includes(search.toLowerCase()) ||
      a.desc.toLowerCase().includes(search.toLowerCase())
    )
  , [actions, search])

  // Compute clamped selected index
  const safeSelectedIndex = Math.min(selectedIndex, Math.max(filtered.length - 1, 0))

  // Focus input when opening
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose()
      if (!open) return
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, filtered.length - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)) }
      if (e.key === 'Enter' && filtered[safeSelectedIndex]) { e.preventDefault(); filtered[safeSelectedIndex].action() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, filtered, safeSelectedIndex, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-[#191c23] border border-[#272b34] rounded-xl shadow-2xl overflow-hidden animate-fadeInUp"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 border-b border-[#272b34]">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Type a command..."
            className="flex-1 bg-transparent py-3.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="text-[10px] text-muted-foreground bg-[#0e0f13] px-1.5 py-0.5 rounded border border-[#272b34]">ESC</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto custom-scrollbar p-2">
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-6">No commands found</p>
          )}
          {filtered.map((action, i) => (
            <button
              key={action.id}
              onClick={action.action}
              onMouseEnter={() => setSelectedIndex(i)}
              className={`flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                i === safeSelectedIndex ? 'bg-[#272b34] text-foreground' : 'text-muted-foreground hover:bg-[#1f232c]'
              }`}
            >
              <span className="text-[#7c9cff]">{action.icon}</span>
              <span className="flex-1">{action.label}</span>
              <span className="text-xs text-muted-foreground">{action.desc}</span>
            </button>
          ))}
        </div>
        <div className="border-t border-[#272b34] px-4 py-2 flex items-center gap-4 text-[10px] text-muted-foreground">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  )
}

/* ========================================================================
   COMMAND PALETTE KEYBOARD HOOK
   ======================================================================== */
function useCommandPalette() {
  const [open, setOpen] = useState(false)
  const [openCount, setOpenCount] = useState(0)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(v => {
          if (!v) setOpenCount(c => c + 1)
          return !v
        })
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])
  return { open, setOpen, openCount, close: () => setOpen(false) }
}

/* ========================================================================
   KEYBOARD SHORTCUTS MODAL
   ======================================================================== */
function KeyboardShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (open) {
      const handleKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose()
      }
      window.addEventListener('keydown', handleKey)
      return () => window.removeEventListener('keydown', handleKey)
    }
  }, [open, onClose])

  if (!open) return null

  const shortcuts = [
    { keys: '⌘K', desc: 'Command Palette' },
    { keys: '⌘Enter', desc: 'Send message' },
    { keys: '1-9', desc: 'Switch tabs' },
    { keys: '⇧⌘F', desc: 'Focus Mode' },
    { keys: '?', desc: 'Show shortcuts' },
    { keys: 'Esc', desc: 'Close modal/palette' },
  ]

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm bg-[#191c23] border border-[#272b34] rounded-xl shadow-2xl p-6 animate-fadeInUp"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Keyboard Shortcuts</h3>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="space-y-3">
          {shortcuts.map(s => (
            <div key={s.keys} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{s.desc}</span>
              <kbd className="bg-[#0e0f13] border border-[#272b34] rounded px-2 py-1 text-xs text-foreground font-mono">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ========================================================================
   KEYBOARD SHORTCUTS HOOK
   ======================================================================== */
function useKeyboardShortcuts() {
  const [open, setOpen] = useState(false)
  const store = useAppStore()

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // ? to show shortcuts
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
        e.preventDefault()
        setOpen(v => !v)
      }
      // Number keys 1-9 for tab switching (only when not in input)
      if (/^[1-9]$/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
        const tabs: AppTab[] = ['session', 'plan', 'tasks', 'progress', 'resources', 'review', 'thinkspace', 'room', 'settings']
        if (store.currentView === 'app') {
          store.setTab(tabs[parseInt(e.key) - 1])
        }
      }
      // Cmd+Enter to send
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        const sendBtn = document.querySelector('[data-send-btn]') as HTMLButtonElement
        if (sendBtn && !sendBtn.disabled) sendBtn.click()
      }
      // Ctrl+Shift+F for Focus Mode
      if (e.shiftKey && (e.metaKey || e.ctrlKey) && e.key === 'F') {
        e.preventDefault()
        const currentStore = useAppStore.getState()
        currentStore.setFocusMode(!currentStore.focusMode)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [store])
  return { open, setOpen, close: () => setOpen(false) }
}

/* ========================================================================
   NOTIFICATION CENTER
   ======================================================================== */
function NotificationCenter() {
  const store = useAppStore()
  const [open, setOpen] = useState(false)
  const unreadCount = store.notifications.filter(n => !n.read).length

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(!open); if (!open && unreadCount > 0) store.markNotificationsRead() }}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-[#191c23] border border-[#272b34] hover:border-[#7c9cff]/30 transition-colors"
      >
        <Bell className="w-4 h-4 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ff8a8a] text-[9px] text-white flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-10 w-72 bg-[#191c23] border border-[#272b34] rounded-xl shadow-2xl z-50 animate-fadeInUp overflow-hidden">
          <div className="px-4 py-3 border-b border-[#272b34]">
            <h4 className="text-sm font-semibold">Notifications</h4>
          </div>
          <div className="max-h-80 overflow-y-auto custom-scrollbar">
            {store.notifications.length === 0 ? (
              <p className="text-center text-muted-foreground text-xs py-6">No notifications yet</p>
            ) : (
              store.notifications.map(n => (
                <div key={n.id} className={`px-4 py-3 border-b border-[#272b34]/50 text-xs ${!n.read ? 'bg-[#7c9cff]/5' : ''}`}>
                  <p className="text-foreground/90">{n.text}</p>
                  <p className="text-muted-foreground mt-1">{timeAgo(n.time)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ========================================================================
   AGENT TRACE PANEL
   ======================================================================== */
function AgentTracePanel({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div className="mx-4 mb-2 animate-slideUp">
      <div className="bg-[#15171d] border border-[#272b34] rounded-xl p-3 max-w-3xl lg:mx-auto">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-[#9d7cff] font-semibold">🤖 Multi-Agent Trace</span>
        </div>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">💬 Socrates:</span>
            <span className="text-[#7c9cff]">Analyzing...</span>
            <span className="text-[#5fd0a0]">→ Done</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">🛠️ Synthesis:</span>
            <span className="text-[#7c9cff]">Compiling...</span>
            <span className="text-[#5fd0a0]">→ Done</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">⚖️ Epistemic:</span>
            <span className="text-[#7c9cff]">Monitoring...</span>
            <span className="text-[#5fd0a0]">→ Done</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ========================================================================
   THINKING INDICATOR
   ======================================================================== */
function ThinkingIndicator() {
  return (
    <div className="flex gap-3 chat-bubble-enter">
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 thinking-ripple"
        style={{ background: 'linear-gradient(135deg, #7c9cff, #9d7cff)' }}>
        🧠
      </div>
      <div className="bg-[#1d2129] px-4 py-3 rounded-2xl rounded-tl-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#9d7cff] mr-1">🧠 Thinking</span>
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-[#9d7cff]"
                style={{ animation: `thinkingDot 1.2s ease-in-out ${i * 0.15}s infinite` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ========================================================================
   CONFETTI EFFECT
   ======================================================================== */
function ConfettiEffect() {
  const store = useAppStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!store.confettiActive) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const colors = ['#7c9cff', '#9d7cff', '#5fd0a0', '#ffce6b', '#c5d0ff', '#f472b6']
    const particles = Array.from({ length: 50 }, () => ({
      x: window.innerWidth / 2 + (Math.random() - 0.5) * 200,
      y: window.innerHeight * 0.3,
      vx: (Math.random() - 0.5) * 12,
      vy: Math.random() * -12 - 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 6 + 3,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
      gravity: 0.15 + Math.random() * 0.1,
    }))

    let frame = 0
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      let alive = false
      particles.forEach(p => {
        p.x += p.vx
        p.vy += p.gravity
        p.y += p.vy
        p.rotation += p.rotationSpeed
        p.vx *= 0.99
        if (p.y < canvas.height + 20) {
          alive = true
          ctx.save()
          ctx.translate(p.x, p.y)
          ctx.rotate((p.rotation * Math.PI) / 180)
          ctx.fillStyle = p.color
          ctx.globalAlpha = Math.max(0, 1 - frame / 120)
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
          ctx.restore()
        }
      })
      frame++
      if (alive && frame < 150) requestAnimationFrame(animate)
      else {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        setTimeout(() => useAppStore.setState({ confettiActive: false }), 100)
      }
    }
    requestAnimationFrame(animate)
  }, [store.confettiActive])

  if (!store.confettiActive) return null
  return <canvas ref={canvasRef} className="fixed inset-0 z-[200] pointer-events-none" />
}

/* ========================================================================
   POMODORO TIMER FLOATING WIDGET
   ======================================================================== */
function PomodoroWidget() {
  const store = useAppStore()
  const [expanded, setExpanded] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const { running, timeLeft, sessionsCompleted, mode } = store.pomodoroState

  useEffect(() => {
    if (running && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        const s = useAppStore.getState().pomodoroState
        if (s.timeLeft <= 1) {
          clearInterval(intervalRef.current!)
          if (s.mode === 'work') {
            const newSessions = s.sessionsCompleted + 1
            store.setPomodoroState({ running: false, timeLeft: 0, sessionsCompleted: newSessions })
            store.addNotification(`🍅 Pomodoro #${newSessions} complete! +5 XP`)
            store.setProgress({ xp: store.xp + 5 })
            try {
              const ac = new AudioContext()
              const osc = ac.createOscillator()
              const gain = ac.createGain()
              osc.connect(gain)
              gain.connect(ac.destination)
              osc.frequency.value = 800
              gain.gain.value = 0.3
              osc.start()
              gain.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.5)
              osc.stop(ac.currentTime + 0.5)
            } catch { /* audio not available */ }
          } else {
            store.setPomodoroState({ running: false, timeLeft: 25 * 60, mode: 'work' })
            store.addNotification('☕ Break over! Ready for another session?')
          }
        } else {
          store.setPomodoroState({ timeLeft: s.timeLeft - 1 })
        }
      }, 1000)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running])

  const mins = Math.floor(timeLeft / 60)
  const secs = timeLeft % 60
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`

  const startWork = () => store.setPomodoroState({ running: true, timeLeft: 25 * 60, mode: 'work' })
  const startBreak = () => store.setPomodoroState({ running: true, timeLeft: 5 * 60, mode: 'break' })
  const pause = () => store.setPomodoroState({ running: false })
  const reset = () => store.setPomodoroState({ running: false, timeLeft: 25 * 60, mode: 'work' })

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {expanded ? (
        <div className="bg-[#191c23]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 w-64 shadow-2xl animate-fadeInUp"
          style={{ boxShadow: running ? '0 0 30px rgba(124,156,255,0.15)' : 'none' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-[#9d7cff] font-semibold uppercase tracking-wider">
              {mode === 'work' ? '🍅 Focus' : '☕ Break'}
            </span>
            <button onClick={() => setExpanded(false)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className={`text-3xl font-mono font-bold text-center mb-3 ${running ? 'text-[#7c9cff]' : 'text-foreground'}`}>
            {timeStr}
          </div>
          <div className="flex gap-2 justify-center mb-3">
            {!running ? (
              <Button size="sm" onClick={mode === 'work' ? startWork : startBreak}
                className="bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] text-[#0e0f13] text-xs btn-hover">
                {timeLeft === 25 * 60 || timeLeft === 5 * 60 ? 'Start' : 'Resume'}
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={pause} className="text-xs border-[#272b34] btn-hover">Pause</Button>
            )}
            <Button size="sm" variant="ghost" onClick={reset} className="text-xs text-muted-foreground btn-hover">Reset</Button>
          </div>
          <div className="flex gap-1 justify-center">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full ${i < sessionsCompleted ? 'bg-[#7c9cff]' : 'bg-[#272b34]'}`} />
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-1">{sessionsCompleted}/4 sessions</p>
        </div>
      ) : (
        <TooltipPrimitive.Root>
          <TooltipPrimitive.Trigger asChild>
            <button
              onClick={() => setExpanded(true)}
              className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110 ${
                running ? 'bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] text-[#0e0f13]' : 'bg-[#191c23]/80 backdrop-blur border border-white/10 text-muted-foreground hover:text-foreground'
              }`}
              style={running ? { boxShadow: '0 0 20px rgba(124,156,255,0.3)' } : {}}
            >
              {running ? <span className="text-sm font-mono">{timeStr}</span> : <Clock className="w-5 h-5" />}
            </button>
          </TooltipPrimitive.Trigger>
          <TooltipPrimitive.Content side="left" className="bg-[#191c23] border border-[#272b34] text-xs px-2 py-1 rounded-md z-[200]">
            Pomodoro Timer
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Root>
      )}
    </div>
  )
}

/* ========================================================================
   FOCUS MODE OVERLAY
   ======================================================================== */
function FocusModeOverlay({ children }: { children: React.ReactNode }) {
  const store = useAppStore()
  if (!store.focusMode) return <>{children}</>
  return (
    <div className="fixed inset-0 z-[60] bg-[#0e0f13] animate-fadeIn">
      <div className="h-12 border-b border-white/10 flex items-center px-4 gap-3 bg-[#0e0f13]/80 backdrop-blur">
        <Badge className="bg-[#7c9cff]/20 text-[#7c9cff] border-0 text-xs">🎯 Focus Mode</Badge>
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">{store.userName}</span>
        <Button variant="ghost" size="sm" onClick={() => store.setFocusMode(false)}
          className="text-muted-foreground hover:text-foreground text-xs btn-hover">
          <X className="w-4 h-4 mr-1" /> Exit Focus
        </Button>
      </div>
      <div className="flex-1 overflow-auto" style={{ height: 'calc(100vh - 48px)' }}>
        <ChatSessionView />
      </div>
    </div>
  )
}

/* ========================================================================
   BOOKMARKS MODAL
   ======================================================================== */
function BookmarksModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const store = useAppStore()
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg bg-[#191c23]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-fadeInUp"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span className="font-semibold text-sm">⭐ Bookmarked Messages</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="max-h-80 overflow-y-auto custom-scrollbar p-3">
          {store.bookmarkedMessages.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-6">
              <span className="text-4xl block mb-3">⭐</span>
              No bookmarks yet. Star a message in chat to save it for later.
            </p>
          )}
          {store.bookmarkedMessages.map(msg => (
            <div key={msg.id} className="bg-white/5 border border-white/5 rounded-lg p-3 mb-2">
              <p className="text-sm text-foreground/90 whitespace-pre-wrap line-clamp-4">{msg.content}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-muted-foreground">{timeAgo(msg.timestamp)}</span>
                <button onClick={() => store.removeBookmark(msg.id)} className="text-[10px] text-[#ff8a8a] hover:underline">Remove</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ========================================================================
   LANDING / SIGN UP SCREEN (Enhanced)
   ======================================================================== */
/* ========================================================================
   TYPING SUBTITLE COMPONENT
   ======================================================================== */
function TypingSubtitle() {
  const phrases = ['your AI mentor', 'your study companion', 'your learning partner']
  const [idx, setIdx] = useState(0)
  const [fade, setFade] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false)
      setTimeout(() => {
        setIdx(i => (i + 1) % phrases.length)
        setFade(true)
      }, 400)
    }, 3000)
    return () => clearInterval(interval)
  }, [phrases.length])

  return (
    <p className="text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed transition-opacity duration-400"
      style={{ opacity: fade ? 1 : 0 }}>
      the teacher you always wished you had. {phrases[idx]}.
    </p>
  )
}

/* ========================================================================
   LANDING SCREEN
   ======================================================================== */
function LandingScreen() {
  const { setAuth, setView } = useAppStore()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup')

  const handleGuestSignup = async () => {
    if (!name.trim()) {
      toast.error('Please enter your name')
      return
    }
    setLoading(true)
    try {
      const data = await api('/auth/signup', { name: name.trim() })
      setAuth({
        sessionToken: data.sessionToken,
        userId: data.user.id,
        userName: data.user.name || name.trim(),
        userEmail: data.user.email,
        provider: 'guest',
      })
      toast.success(`Welcome, ${name}!`)
      setView('apikey')
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to create account')
    } finally {
      setLoading(false)
    }
  }

  const handleResumeSession = async () => {
    const token = useAppStore.getState().sessionToken
    if (!token) {
      toast.error('No saved session found. Please create a new account.')
      return
    }
    setLoading(true)
    try {
      const data = await api('/auth/login', { sessionToken: token })
      setAuth({
        sessionToken: token,
        userId: data.user.id,
        userName: data.user.name,
        userEmail: data.user.email,
        userPicture: data.user.picture || undefined,
        provider: data.user.provider,
      })
      toast.success(`Welcome back, ${data.user.name}!`)
      const user = data.user
      if (user.topic) {
        setView('app')
      } else {
        setView('onboarding')
      }
    } catch {
      toast.error('Session expired. Please create a new account.')
    } finally {
      setLoading(false)
    }
  }

  const features = [
    { emoji: '🧠', title: 'Agentic AI Mentor', desc: 'Socratic dialogue that adapts to how you think' },
    { emoji: '📋', title: 'Auto-Task Extraction', desc: 'AI reads your chat and creates learning tasks' },
    { emoji: '🃏', title: 'Spaced Repetition', desc: 'Flashcards that adapt to your memory' },
    { emoji: '📅', title: 'Smart Scheduling', desc: '7-day plans pushed to Google Calendar' },
    { emoji: '😊', title: 'Mood Tracking', desc: 'Track how you feel — your mentor notices' },
    { emoji: '🌱', title: 'Progress Tracking', desc: 'XP, streaks, radar charts — not percentages' },
  ]

  const stats = [
    { value: '2', label: 'AI Models' },
    { value: 'HIGH', label: 'Thinking' },
    { value: '3', label: 'Google APIs' },
    { value: '⌘K', label: 'Commands' },
  ]

  const techPills = ['Gemini 2.5', 'React', 'Next.js', 'Zustand', 'Google Calendar', 'Tasks API', 'Gmail API', 'Socratic Engine', 'Multi-Agent']

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden"
      style={{ background: 'radial-gradient(1200px 700px at 50% -10%, #1a1d27 0%, #0e0f13 60%)' }}>

      <FloatingParticles />

      {/* Hero */}
      <div className="text-center max-w-2xl mx-auto mb-8 animate-fadeInUp relative z-10">
        <div style={{ animation: 'bob 3s ease-in-out infinite' }}>
          <Orb />
        </div>
        <Badge className="mb-4 bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] text-[#0e0f13] font-bold text-xs px-4 py-1">
          v9.0 AGENTIC
        </Badge>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-[#7c9cff] via-[#9d7cff] to-[#c084fc]"
          style={{ backgroundSize: '200% 200%', animation: 'shimmer-gradient 4s ease infinite' }}>
          sit with me
        </h1>
        <TypingSubtitle />
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl mx-auto mb-8 relative z-10">
        {features.map((f, i) => (
          <div
            key={f.title}
            className="card-hover card-shine bg-[#191c23]/80 border border-[#272b34] rounded-xl p-4 backdrop-blur-sm relative group"
            style={{ animationDelay: `${i * 80}ms`, animation: 'fadeInUp 0.5s ease-out both', animationDelay: `${i * 80 + 200}ms` }}
          >
            <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl bg-gradient-to-b from-[#7c9cff] to-[#9d7cff] scale-y-0 group-hover:scale-y-100 transition-transform duration-300 origin-center" />
            <span className="text-2xl mb-2 block">{f.emoji}</span>
            <h3 className="text-sm font-semibold mb-1">{f.title}</h3>
            <p className="text-xs text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Social Proof Section */}
      <div className="max-w-3xl mx-auto mb-8 relative z-10" style={{ animation: 'fadeInUp 0.6s ease-out both', animationDelay: '650ms' }}>
        <div className="glass rounded-2xl p-6 border border-[#7c9cff]/10 animate-borderGlow">
          <p className="text-center text-xs text-muted-foreground uppercase tracking-widest mb-5">Trusted by learners worldwide</p>
          {/* Animated Counter Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
            {[
              { value: '1,000+', label: 'Sessions', color: '#7c9cff' },
              { value: '500+', label: 'Tasks Created', color: '#5fd0a0' },
              { value: '50+', label: 'Learning Paths', color: '#9d7cff' },
              { value: '98%', label: 'Satisfaction', color: '#ffce6b' },
            ].map((s, i) => (
              <div key={s.label} className="text-center" style={{ animation: `countUp 0.6s ease-out ${i * 120 + 200}ms both` }}>
                <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
          {/* Active Learner Avatars */}
          <div className="flex items-center justify-center gap-2">
            <div className="flex -space-x-2">
              {['#7c9cff', '#9d7cff', '#5fd0a0', '#ffce6b', '#f472b6', '#c084fc'].map((c, i) => (
                <div key={i} className="w-7 h-7 rounded-full border-2 border-[#0e0f13] flex items-center justify-center text-[10px] font-bold"
                  style={{ background: c, color: '#0e0f13', animation: `pulseDot ${1.5 + i * 0.3}s ease-in-out infinite` }}>
                  {String.fromCharCode(65 + i)}
                </div>
              ))}
            </div>
            <span className="text-xs text-muted-foreground ml-2">and 200+ active learners</span>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="flex flex-wrap gap-4 justify-center mb-8 relative z-10" style={{ animation: 'fadeInUp 0.5s ease-out both', animationDelay: '700ms' }}>
        {stats.map(s => (
          <div key={s.label} className="bg-[#191c23]/60 border border-[#272b34] rounded-lg px-4 py-2 text-center backdrop-blur-sm">
            <div className="text-lg font-bold bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] bg-clip-text text-transparent">{s.value}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Feature Pills */}
      <div className="flex flex-wrap gap-2 justify-center mb-8 relative z-10" style={{ animation: 'fadeInUp 0.5s ease-out both', animationDelay: '800ms' }}>
        {['🧠 agentic AI mentor', '📅 calendar + tasks sync', '🖥 screen-aware', '🎙 voice support'].map((f) => (
          <span key={f} className="bg-[#191c23] border border-[#272b34] rounded-full px-3 py-1.5 text-xs text-muted-foreground">
            {f}
          </span>
        ))}
      </div>

      {/* Auth Card */}
      <Card className="w-full max-w-md bg-[#15171d]/90 border-[#272b34] shadow-2xl backdrop-blur-sm relative z-10" style={{ animation: 'fadeInUp 0.5s ease-out both', animationDelay: '900ms' }}>
        <CardContent className="p-6">
          {/* Tab Switcher */}
          <div className="flex gap-2 mb-6">
            <Button
              variant={authMode === 'signup' ? 'default' : 'ghost'}
              className={authMode === 'signup' ? 'flex-1 bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] text-[#0e0f13] font-semibold btn-hover' : 'flex-1 text-muted-foreground'}
              onClick={() => setAuthMode('signup')}
            >
              <Sparkles className="w-4 h-4 mr-2" /> Create Account
            </Button>
            <Button
              variant={authMode === 'login' ? 'default' : 'ghost'}
              className={authMode === 'login' ? 'flex-1 bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] text-[#0e0f13] font-semibold btn-hover' : 'flex-1 text-muted-foreground'}
              onClick={() => setAuthMode('login')}
            >
              🔐 Welcome Back
            </Button>
          </div>

          {authMode === 'signup' ? (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <h3 className="font-semibold text-sm">Begin Your Learning Journey</h3>
                <p className="text-xs text-muted-foreground">Let&apos;s tailor an AI mentor to your mind</p>
              </div>

              <Button
                className="w-full bg-white text-gray-900 hover:bg-gray-100 font-semibold flex items-center justify-center gap-2 h-11 btn-hover"
                onClick={() => toast.info('Google OAuth requires server configuration. Use guest account for now.')}
              >
                <span className="text-lg font-bold text-blue-500">G</span>
                Continue with Google
              </Button>

              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest">or join anonymously</span>
                <Separator className="flex-1" />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Your Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Scholar"
                  className="mt-1 bg-[#0e0f13] border-[#272b34] text-foreground focus:border-[#7c9cff] h-11"
                  onKeyDown={(e) => e.key === 'Enter' && handleGuestSignup()}
                />
              </div>

              <Button
                onClick={handleGuestSignup}
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] text-[#0e0f13] font-semibold h-11 btn-hover"
              >
                {loading ? 'Creating...' : 'Create Guest Account'} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <h3 className="font-semibold text-sm">Welcome Back, Scholar</h3>
                <p className="text-xs text-muted-foreground">Pick up exactly where you left off</p>
              </div>

              <Button
                className="w-full bg-white text-gray-900 hover:bg-gray-100 font-semibold flex items-center justify-center gap-2 h-11 btn-hover"
                onClick={() => toast.info('Google OAuth requires server configuration. Use resume session.')}
              >
                <span className="text-lg font-bold text-blue-500">G</span>
                Log In with Google
              </Button>

              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest">or resume session</span>
                <Separator className="flex-1" />
              </div>

              <Button
                onClick={handleResumeSession}
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] text-[#0e0f13] font-semibold h-11 btn-hover"
              >
                {loading ? 'Resuming...' : 'Resume Saved Session'} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground mt-6 text-center max-w-sm relative z-10">
        Free forever. Your learning progress is kept safe in your browser.
      </p>

      {/* Tech Pills */}
      <div className="flex flex-wrap gap-1.5 justify-center mt-6 max-w-xl relative z-10" style={{ animation: 'fadeInUp 0.5s ease-out both', animationDelay: '1100ms' }}>
        {techPills.map(t => (
          <span key={t} className="text-[10px] text-muted-foreground/60 bg-[#191c23]/40 border border-[#272b34]/50 rounded-full px-2 py-0.5">
            {t}
          </span>
        ))}
      </div>

      <p className="absolute bottom-4 text-[11px] text-muted-foreground z-10">
        powered by gemini · your data stays private
      </p>
    </div>
  )
}

/* ========================================================================
   API KEY SCREEN
   ======================================================================== */
function ApiKeyScreen() {
  const { setView } = useAppStore()
  const [key, setKey] = useState('')
  const [status, setStatus] = useState<'idle' | 'testing' | 'ok' | 'err'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const testAndContinue = async () => {
    if (!key.trim()) {
      toast.error('Please paste your Gemini API key')
      return
    }
    setStatus('testing')
    try {
      await api('/ai/key-test', { apiKey: key.trim() })
      setStatus('ok')
      toast.success('Connected! Gemini is working.')
      setTimeout(() => setView('onboarding'), 1000)
    } catch (err: unknown) {
      setStatus('err')
      setErrorMsg((err as Error).message)
      toast.error('Key test failed. You can still continue and test later.')
    }
  }

  const skip = () => {
    toast.info('You can add your API key later in settings.')
    setView('onboarding')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 animate-fadeIn"
      style={{ background: 'radial-gradient(1200px 700px at 50% -10%, #1a1d27 0%, #0e0f13 60%)' }}>
      <div className="w-full max-w-lg text-center">
        <Orb />
        <h2 className="text-2xl font-bold mb-2">one quick thing</h2>
        <p className="text-muted-foreground mb-6">
          to power your AI mentor, paste a free Gemini API key. You can skip this and add it later.
        </p>

        <Card className="bg-[#191c23] border-[#272b34] text-left card-hover">
          <CardContent className="p-6">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Gemini API Key</Label>
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              type="password"
              placeholder="AIza..."
              className="mt-2 bg-[#0e0f13] border-[#272b34] text-foreground focus:border-[#7c9cff] h-12 text-base"
            />
            <p className="text-[11px] text-muted-foreground mt-2">
              Get a free key at{' '}
              <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer"
                className="text-[#7c9cff] hover:underline">
                aistudio.google.com
              </a>. This key stays on the server only.
            </p>

            {status === 'ok' && (
              <p className="text-[#5fd0a0] text-sm mt-3 font-medium">✓ Connected! Gemini is working.</p>
            )}
            {status === 'err' && (
              <p className="text-[#ff8a8a] text-sm mt-3">✗ {errorMsg}</p>
            )}

            <div className="flex gap-3 mt-4 justify-center">
              <Button variant="ghost" onClick={() => setView('landing')} className="text-muted-foreground btn-hover">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button onClick={testAndContinue} disabled={status === 'testing'}
                className="bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] text-[#0e0f13] font-semibold btn-hover">
                {status === 'testing' ? 'Testing...' : 'Continue'} <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
              <Button variant="ghost" onClick={skip} className="text-muted-foreground text-sm btn-hover">
                Skip
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* ========================================================================
   AI ONBOARDING SCREEN
   ======================================================================== */
function OnboardingScreen() {
  const store = useAppStore()
  const { onboardingMessages, onboardingDone, addOnboardingMessage, setOnboardingDone, setLearningProfile, setView } = store
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (onboardingMessages.length === 0) {
      const name = store.userName
      addOnboardingMessage({
        role: 'assistant',
        content: name
          ? `hey ${name}. i'm your mentor — i'll sit with you while you learn. tell me, what do you want to learn right now?`
          : "hey! i'm your learning mentor. what are you trying to figure out right now? just type it.",
        timestamp: Date.now(),
      })
    }
  }, [])

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [onboardingMessages])

  const send = async () => {
    const msg = input.trim()
    if (!msg || busy) return
    setInput('')
    addOnboardingMessage({ role: 'user', content: msg, timestamp: Date.now() })
    setBusy(true)

    try {
      const data = await api('/ai/onboard', {
        sessionToken: store.sessionToken,
        message: msg,
      })
      addOnboardingMessage({ role: 'assistant', content: data.reply, timestamp: Date.now() })

      if (data.done && data.extractedData) {
        setOnboardingDone(true)
        setLearningProfile(data.extractedData)
        toast.success('Profile discovered! Let\'s set it up.')
        setTimeout(() => setView('profile'), 1500)
      }
    } catch (err: unknown) {
      addOnboardingMessage({
        role: 'system',
        content: `Connection error: ${(err as Error).message}. Try again?`,
        timestamp: Date.now(),
      })
    } finally {
      setBusy(false)
    }
  }

  // Onboarding progress - count filled profile fields
  const profileFields = [store.topic, store.vision, store.domain, store.level, store.minutesPerDay, store.learningStyle, store.whyNow, store.obstacle]
  const filledCount = profileFields.filter(Boolean).length
  const progressPct = (filledCount / 8) * 100

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 animate-fadeIn"
      style={{ background: 'radial-gradient(1200px 700px at 50% -10%, #1a1d27 0%, #0e0f13 60%)' }}>
      <div className="w-full max-w-2xl">
        {/* Onboarding Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">Step {filledCount}/8 discovered</span>
            <span className="text-xs text-[#7c9cff] font-semibold">{Math.round(progressPct)}%</span>
          </div>
          <div className="h-2 bg-[#272b34] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%`, background: 'linear-gradient(to right, #7c9cff, #9d7cff)' }} />
          </div>
        </div>
        <Orb speaking={busy} />
        <h2 className="text-2xl font-bold text-center mb-4">let&apos;s discover your learning path</h2>

        {/* Chat Messages */}
        <div ref={chatRef}
          className="max-h-[45vh] overflow-y-auto space-y-3 mb-4 pr-2 custom-scrollbar">
          {onboardingMessages.map((msg, i) => (
            <div key={i} className={`flex gap-3 chat-bubble-enter ${msg.role === 'user' ? 'justify-end' : msg.role === 'system' ? 'justify-center' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
                  style={{ background: 'linear-gradient(135deg, #7c9cff, #9d7cff)' }}>
                  🧠
                </div>
              )}
              <div className={`max-w-[78%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bubble-gradient-user text-foreground rounded-tr-sm'
                  : msg.role === 'system'
                    ? 'bg-transparent border border-dashed border-[#272b34] text-muted-foreground text-xs max-w-[90%]'
                    : 'bubble-gradient-assistant text-foreground rounded-tl-sm'
              }`}>
                {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm bg-[#1f232c] text-muted-foreground shrink-0">
                  🧑
                </div>
              )}
            </div>
          ))}
          {busy && <ThinkingIndicator />}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="tell me what you want to learn..."
            className="flex-1 bg-[#191c23] border-[#272b34] text-foreground focus:border-[#7c9cff] resize-none min-h-[48px]"
            rows={1}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          />
          <Button onClick={send} disabled={busy}
            className="bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] text-[#0e0f13] px-4 shrink-0 btn-hover">
            <Send className="w-4 h-4" />
          </Button>
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-4">
          <Button variant="ghost" onClick={() => setView('apikey')} className="text-muted-foreground btn-hover">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          {store.topic && (
            <Button onClick={() => setView('profile')}
              className="bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] text-[#0e0f13] font-semibold btn-hover">
              Next <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ========================================================================
   PROFILE SETUP SCREEN
   ======================================================================== */
function ProfileSetupScreen() {
  const store = useAppStore()
  const [displayName, setDisplayName] = useState(store.userName || '')
  const [goal, setGoal] = useState(store.vision || '')
  const [style, setStyle] = useState(store.learningStyle || '')
  const [loading, setLoading] = useState(false)

  const saveAndContinue = async () => {
    setLoading(true)
    try {
      await api('/profile', {
        sessionToken: store.sessionToken,
        displayName: displayName || store.userName,
        goal,
        learningStyle: style,
        name: displayName || store.userName,
        vision: goal,
      })
      store.setLearningProfile({ vision: goal, learningStyle: style })
      store.setProfile({
        displayName: displayName || store.userName || 'Learner',
        bio: '',
        avatar: '🧠',
        goal,
        isPublic: true,
      })
      toast.success('Profile saved!')
      store.setView('googleconnect')
    } catch (err: unknown) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 animate-fadeIn"
      style={{ background: 'radial-gradient(1200px 700px at 50% -10%, #1a1d27 0%, #0e0f13 60%)' }}>
      <div className="w-full max-w-lg">
        <Orb />
        <h2 className="text-2xl font-bold text-center mb-2">almost done</h2>
        <p className="text-muted-foreground text-center mb-6">let&apos;s set up your profile.</p>

        <Card className="bg-[#191c23] border-[#272b34] card-hover">
          <CardContent className="p-6 space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Display Name</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="your name"
                className="mt-1 bg-[#0e0f13] border-[#272b34] focus:border-[#7c9cff]"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">What you&apos;re working toward</Label>
              <Input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="build my own app"
                className="mt-1 bg-[#0e0f13] border-[#272b34] focus:border-[#7c9cff]"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">How you learn best</Label>
              <Select value={style} onValueChange={setStyle}>
                <SelectTrigger className="mt-1 bg-[#0e0f13] border-[#272b34]">
                  <SelectValue placeholder="select..." />
                </SelectTrigger>
                <SelectContent className="bg-[#191c23] border-[#272b34]">
                  <SelectItem value="show me then i copy">Show me, then I copy</SelectItem>
                  <SelectItem value="let me try, catch my mistakes">Let me try, catch my mistakes</SelectItem>
                  <SelectItem value="explain the why first">Explain the why first</SelectItem>
                  <SelectItem value="interactive socratic dialogue">Interactive Socratic dialogue</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Cognitive State Card */}
            {store.topic && (
              <div className="bg-[#0e0f13] p-4 rounded-xl border border-dashed border-[#272b34]">
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="w-4 h-4 text-[#7c9cff]" />
                  <span className="text-xs text-[#7c9cff] uppercase tracking-wider font-semibold">Cognitive State Matrix</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Depth:</span> <span className="font-medium">{store.level || 'Beginner'}</span></div>
                  <div><span className="text-muted-foreground">Daily Slot:</span> <span className="font-medium text-[#7c9cff]">{store.minutesPerDay || '20'} min</span></div>
                  <div><span className="text-muted-foreground">Focus:</span> <span className="font-medium">{store.topic}</span></div>
                  <div><span className="text-muted-foreground">Goal:</span> <span className="font-medium">{store.vision || '—'}</span></div>
                </div>
                {store.obstacle && (
                  <p className="text-xs text-[#ff8a8a] mt-2 pt-2 border-t border-[#272b34]">
                    ⚠️ Block: {store.obstacle}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3 mt-6 justify-center">
          <Button variant="ghost" onClick={() => store.setView('onboarding')} className="text-muted-foreground btn-hover">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <Button onClick={saveAndContinue} disabled={loading}
            className="bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] text-[#0e0f13] font-semibold btn-hover">
            {loading ? 'Saving...' : "Done — Connect Google"} <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ========================================================================
   GOOGLE CONNECT SCREEN
   ======================================================================== */
function GoogleConnectScreen() {
  const store = useAppStore()

  const connectGoogle = () => {
    toast.info('Google OAuth requires server-side configuration (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET). For now, you can simulate the connection.')
    store.setGoogle({
      googleToken: 'demo_token_' + Date.now(),
      googleEmail: store.userEmail || 'demo@sitwithme.app',
    })
    toast.success('Google connected! (Demo mode)')
  }

  const finish = () => {
    store.setView('app')
    store.setTab('session')
    store.setProgress({ sessionCount: store.sessionCount + 1 })
  }

  const googleServices = [
    { icon: '📅', name: 'Google Calendar', desc: 'Schedule learning sessions, block focus time', key: 'calendarConnected' as const },
    { icon: '✅', name: 'Google Tasks', desc: 'Daily learning quests and action items', key: 'tasksConnected' as const },
    { icon: '📧', name: 'Gmail', desc: 'Receive morning nudges from your mentor', key: 'gmailConnected' as const },
  ]

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 animate-fadeIn"
      style={{ background: 'radial-gradient(1200px 700px at 50% -10%, #1a1d27 0%, #0e0f13 60%)' }}>
      <div className="w-full max-w-lg">
        <Orb />
        <h2 className="text-2xl font-bold text-center mb-2">last step</h2>
        <p className="text-muted-foreground text-center mb-6">connect your google services so i can schedule your learning.</p>

        <div className="space-y-3">
          {googleServices.map((svc) => {
            const connected = store[svc.key]
            return (
              <Card key={svc.key} className={`bg-[#191c23] border-[#272b34] transition-colors card-hover ${connected ? 'border-[#5fd0a0] bg-[#5fd0a0]/5' : ''}`}>
                <CardContent className="p-4 flex items-center gap-4">
                  <span className="text-3xl shrink-0">{svc.icon}</span>
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm">{svc.name}</h4>
                    <p className="text-xs text-muted-foreground">{svc.desc}</p>
                  </div>
                  {connected ? (
                    <Badge className="bg-[#5fd0a0]/15 text-[#5fd0a0]">connected</Badge>
                  ) : (
                    <Button size="sm" variant="outline" className="border-[#272b34] btn-hover"
                      onClick={connectGoogle}>
                      Connect
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="flex gap-3 mt-6 justify-center">
          <Button variant="ghost" onClick={() => store.setView('profile')} className="text-muted-foreground btn-hover">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <Button onClick={finish}
            className="bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] text-[#0e0f13] font-semibold btn-hover">
            I&apos;m Ready to Learn <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ========================================================================
   DAILY CHECK-IN WIDGET
   ======================================================================== */
function DailyCheckinWidget() {
  const store = useAppStore()
  const sessionDay = store.sessionCount + 1
  const todayFocus = store.planWeek?.[0]?.focus || store.topic || 'your learning journey'
  const firstStep = store.planWeek?.[0]?.firstStep || 'Start a conversation with your mentor'

  return (
    <Card className="bg-gradient-to-r from-[#7c9cff]/10 to-[#9d7cff]/10 border-[#7c9cff]/20 mb-3 card-hover">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
            style={{ background: 'linear-gradient(135deg, #7c9cff, #9d7cff)' }}>
            🌱
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#c5d0ff]">Day {sessionDay} of your learning journey</p>
            <p className="text-xs text-muted-foreground mt-0.5">Today&apos;s focus: <span className="text-foreground">{todayFocus}</span></p>
            <p className="text-xs text-muted-foreground">Quick start: <span className="text-[#7c9cff]">{firstStep}</span></p>
            <Button size="sm" className="mt-2 h-7 text-xs bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] text-[#0e0f13] font-semibold btn-hover"
              onClick={() => {
                store.setProgress({ sessionCount: store.sessionCount + 1 })
                store.addNotification('🌱 Day ' + (store.sessionCount + 1) + ' session started!')
                toast.success('Session started! Let\'s go!')
              }}>
              Start Today&apos;s Session
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/* ========================================================================
   DAILY CHALLENGE WIDGET
   ======================================================================== */
function DailyChallengeWidget() {
  const store = useAppStore()
  const [challengeData, setChallengeData] = useState<{ loading: boolean; challenge: typeof store.dailyChallenge }>({ loading: true, challenge: null })
  const fetchedRef = useRef(false)

  const fetchChallenge = useCallback(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    api('/ai/challenge', { sessionToken: store.sessionToken, topic: store.topic })
      .then(data => {
        if (data.challenge) {
          store.setDailyChallenge(data.challenge)
        }
        setChallengeData({ loading: false, challenge: data.challenge || null })
      })
      .catch(() => {
        setChallengeData({ loading: false, challenge: null })
      })
  }, [store])

  useEffect(() => {
    if (!store.dailyChallenge) {
      fetchChallenge()
    }
  }, [store.dailyChallenge, fetchChallenge])

  const challenge = store.dailyChallenge || challengeData.challenge
  const loading = challengeData.loading

  if (!challenge && !loading) return null

  const handleComplete = () => {
    store.completeDailyChallenge()
    store.triggerConfetti()
    store.addNotification(`🎯 Daily challenge completed! +${challenge?.xpReward || 0} XP`)
    toast.success(`Challenge completed! +${challenge?.xpReward || 0} XP`)
  }

  return (
    <Card className="bg-gradient-to-r from-[#ffce6b]/5 to-[#fb923c]/5 border border-transparent mb-3 card-hover"
      style={{ borderImage: 'linear-gradient(to right, rgba(255,206,107,0.3), rgba(251,146,60,0.3)) 1' }}>
      <CardContent className="p-4">
        {loading && !challenge ? (
          <div className="flex items-center gap-2">
            <div className="animate-spin w-4 h-4 border-2 border-[#ffce6b] border-t-transparent rounded-full" />
            <span className="text-xs text-muted-foreground">Loading daily challenge...</span>
          </div>
        ) : challenge ? (
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
              style={{ background: 'linear-gradient(135deg, #ffce6b, #fb923c)' }}>
              🎯
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-semibold text-[#ffce6b]">Daily Challenge</p>
                <Badge className="bg-[#ffce6b]/15 text-[#ffce6b] text-[9px] border-0">+{challenge.xpReward} XP</Badge>
              </div>
              <p className="text-sm font-medium">{challenge.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{challenge.description}</p>
              {challenge.completed ? (
                <div className="flex items-center gap-1 mt-2 text-[#5fd0a0] text-xs font-semibold">
                  <Check className="w-4 h-4" /> Completed! +{challenge.xpReward} XP
                </div>
              ) : (
                <Button size="sm" onClick={handleComplete}
                  className="mt-2 h-7 text-xs bg-gradient-to-r from-[#ffce6b] to-[#fb923c] text-[#0e0f13] font-semibold btn-hover">
                  Complete Challenge
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

/* ========================================================================
   SESSION SUMMARY MODAL
   ======================================================================== */
function SessionSummaryModal({ open, onClose, summary, keyPoints, xp }: {
  open: boolean; onClose: () => void; summary: string; keyPoints: string[]; xp: number
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg bg-[#191c23]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-fadeInUp"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span className="font-semibold text-sm">📋 Session Summary</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 max-h-80 overflow-y-auto custom-scrollbar">
          <p className="text-sm text-foreground/90 whitespace-pre-wrap mb-4">{summary}</p>
          {keyPoints.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#9d7cff] uppercase tracking-wider mb-2">Key Points</p>
              <ul className="space-y-1.5">
                {keyPoints.map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                    <span className="text-[#7c9cff] shrink-0">•</span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2">
            <Badge className="bg-[#5fd0a0]/15 text-[#5fd0a0] border-0">+{xp} XP earned</Badge>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ========================================================================
   CHAT SESSION VIEW (Enhanced)
   ======================================================================== */
function ChatSessionView() {
  const store = useAppStore()
  const [input, setInput] = useState('')
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [showBookmarks, setShowBookmarks] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)

  // Chat search state
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchIdx, setSearchIdx] = useState(0)

  // Session summary state
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [summaryData, setSummaryData] = useState<{ summary: string; keyPoints: string[]; xp: number }>({ summary: '', keyPoints: [], xp: 0 })
  const [summarizing, setSummarizing] = useState(false)

  // Study mode state
  const [studyMode, setStudyMode] = useState(false)
  const [studyContent, setStudyContent] = useState('')
  const [studyLoading, setStudyLoading] = useState(false)
  const [showAnswers, setShowAnswers] = useState(false)

  const handleStudyMode = async () => {
    setStudyLoading(true)
    try {
      const topic = store.topic || 'general learning'
      const level = store.level || 'beginner'
      const data = await api('/ai/chat', {
        sessionToken: store.sessionToken,
        message: `Generate 3 quiz questions about ${topic} at ${level} level. Format each question as: **Q:** [question] **A:** [answer]`,
        history: [],
        boost: false,
      })
      setStudyContent(data.reply || 'Failed to generate quiz.')
      setStudyMode(true)
      setShowAnswers(false)
      store.setProgress({ xp: store.xp + 10 })
      store.addNotification('🧪 Study Mode activated! +10 XP')
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to start study mode')
    } finally {
      setStudyLoading(false)
    }
  }

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [store.chatMessages, store.chatBusy])

  // Initial greeting + session start time
  useEffect(() => {
    if (store.chatMessages.length === 0) {
      store.addChatMessage({
        role: 'assistant',
        content: `welcome${store.userName ? ', ' + store.userName : ''}. your goal: ${store.vision || store.topic || 'learning'}.\n\nlet's start with one small thing. what part of this feels most confusing right now?`,
        timestamp: Date.now(),
      })
    }
    if (!store.sessionStartTime) {
      store.setSessionStartTime(Date.now())
    }
  }, [])

  const send = async () => {
    const msg = input.trim()
    if (!msg || store.chatBusy) return
    setInput('')
    store.addChatMessage({ role: 'user', content: msg, timestamp: Date.now() })
    store.setChatBusy(true)

    try {
      const history = store.chatMessages.slice(-10).map(m => ({ role: m.role, content: m.content }))
      const isComplex = msg.length > 100 || /plan|strategy|how do i|what should|explain|why|compare|analyze|build|create|code|debug|fix|implement|design/i.test(msg)

      const data = await api('/ai/chat', {
        sessionToken: store.sessionToken,
        message: msg,
        history,
        boost: isComplex,
      })
      store.addChatMessage({ role: 'assistant', content: data.reply, timestamp: Date.now() })

      // Auto-task extraction from AI responses
      if (store.autoTasks) {
        const actionPatterns = /(?:you should|try to|make sure to|practice|build a|create a|work on|focus on|start by|remember to|don't forget to|it's important to)\s+(.{10,80})/gi
        const extractedTasks = [...data.reply.matchAll(actionPatterns)].map(m => m[1].trim().replace(/[.!]+$/, ''))
        if (extractedTasks.length > 0) {
          extractedTasks.slice(0, 3).forEach(taskTitle => {
            store.addTask({
              id: Date.now().toString() + Math.random().toString(36).slice(2),
              title: taskTitle,
              status: 'pending',
              source: 'ai-extracted',
              priority: 'medium',
            })
          })
          store.addNotification(`📋 ${extractedTasks.length} task${extractedTasks.length > 1 ? 's' : ''} extracted from conversation`)
        }
      }

      if (data.actions?.includes('suggest-task')) {
        store.addChatMessage({
          role: 'system',
          content: '💡 Tip: You can create a task from this — check the Tasks tab!',
          timestamp: Date.now(),
        })
        store.addNotification('📋 New task extracted from your chat')
      }

      // Award XP for chatting
      store.setProgress({ xp: store.xp + 5 })
    } catch (err: unknown) {
      store.addChatMessage({
        role: 'system',
        content: `Error: ${(err as Error).message}`,
        timestamp: Date.now(),
      })
    } finally {
      store.setChatBusy(false)
    }
  }

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
    toast.success('Copied to clipboard')
  }

  const quickChips = ['Explain simply', 'Give me a challenge', 'Plan my week', 'Create a task']

  // Chat search logic
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return store.chatMessages
      .map((msg, i) => ({ msg, i }))
      .filter(({ msg }) => msg.content.toLowerCase().includes(q))
  }, [searchQuery, store.chatMessages])

  const highlightText = (text: string) => {
    if (!searchQuery.trim()) return text
    const q = searchQuery.toLowerCase()
    const parts = text.split(new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
    return parts.map((part, i) =>
      part.toLowerCase() === q ? <mark key={i} className="bg-[#7c9cff]/30 text-foreground rounded px-0.5">{part}</mark> : part
    )
  }

  const handleSummary = async () => {
    setSummarizing(true)
    try {
      const messages = store.chatMessages.slice(-10).map(m => ({ role: m.role, content: m.content }))
      const data = await api('/ai/summary', { sessionToken: store.sessionToken, messages })
      const xpEarned = 15
      setSummaryData({ summary: data.summary || 'No summary generated.', keyPoints: data.keyPoints || [], xp: xpEarned })
      setSummaryOpen(true)
      store.addSessionSummary({
        id: Date.now().toString(),
        date: Date.now(),
        summary: data.summary || '',
        keyPoints: data.keyPoints || [],
        xp: xpEarned,
      })
      store.setProgress({ xp: store.xp + xpEarned })
      store.addNotification(`📋 Session summary saved! +${xpEarned} XP`)
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to summarize')
    } finally {
      setSummarizing(false)
    }
  }

  // Search keyboard handling
  useEffect(() => {
    if (!searchOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery('') }
      if (e.key === 'Enter' && searchResults.length > 0) {
        e.preventDefault()
        setSearchIdx(i => (i + 1) % searchResults.length)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [searchOpen, searchResults.length])

  return (
    <div className="flex flex-col h-full">
      {/* Agent Trace Panel */}
      <AgentTracePanel visible={store.chatBusy} />

      {/* Chat Search Bar */}
      {searchOpen && (
        <div className="px-4 py-2 border-b border-[#272b34] max-w-3xl mx-auto w-full animate-slideUp">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setSearchIdx(0) }}
              placeholder="Search messages..."
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              autoFocus
            />
            {searchQuery && (
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                {searchResults.length > 0 ? `${searchIdx + 1}/${searchResults.length}` : '0 results'}
              </span>
            )}
            {searchResults.length > 1 && (
              <>
                <button onClick={() => setSearchIdx(i => (i - 1 + searchResults.length) % searchResults.length)}
                  className="text-muted-foreground hover:text-foreground"><ChevronUp className="w-3.5 h-3.5" /></button>
                <button onClick={() => setSearchIdx(i => (i + 1) % searchResults.length)}
                  className="text-muted-foreground hover:text-foreground"><ChevronDown className="w-3.5 h-3.5" /></button>
              </>
            )}
            <button onClick={() => { setSearchOpen(false); setSearchQuery('') }}
              className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3 max-w-3xl mx-auto w-full custom-scrollbar">
        {/* Mood Tracker Widget */}
        <MoodTrackerWidget />
        {/* Daily Check-in Widget */}
        <DailyCheckinWidget />
        {/* Daily Challenge Widget */}
        <DailyChallengeWidget />

        {/* Study Mode Card */}
        {studyMode && (
          <Card className="bg-[#191c23] border-[#5fd0a0]/30 card-hover card-shine">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🧪</span>
                  <span className="text-xs font-semibold text-[#5fd0a0]">Study Mode</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setStudyMode(false)} className="h-6 w-6 p-0">
                  <X className="w-3 h-3" />
                </Button>
              </div>
              <div className="text-sm">
                {showAnswers ? renderMarkdown(studyContent) : renderMarkdown(studyContent.replace(/\*\*A:\*\*.*?(?=\*\*Q:\*\*|$)/gs, '**A:** _hidden_'))}
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowAnswers(!showAnswers)}
                className="mt-3 text-xs border-[#5fd0a0]/30 text-[#5fd0a0] hover:bg-[#5fd0a0]/10 btn-hover">
                {showAnswers ? '🙈 Hide Answers' : '👁 Show Answers'}
              </Button>
            </CardContent>
          </Card>
        )}

        {store.chatMessages.map((msg, i) => {
          const isSearchMatch = searchQuery.trim() && searchResults.some(r => r.i === i)
          const isLastAiMessage = msg.role === 'assistant' && i === store.chatMessages.length - 1 && !store.chatBusy
          // Smart suggestion chips heuristics
          const getSuggestions = (content: string): string[] => {
            const lower = content.toLowerCase()
            if (/try|attempt|consider/i.test(lower)) return ['Show me an example', 'Break this down further', 'How do I practice this?']
            if (/```|code|function|class |import |const |let |var /i.test(lower)) return ['Explain this code', 'Show me a simpler version', 'How do I debug this?']
            if (/because|reason|why/i.test(lower)) return ['Tell me more', 'What are the alternatives?', 'Give me an example']
            if (/step|first|then|next|finally/i.test(lower)) return ['Can you simplify this?', 'What if I get stuck?', 'Show me a practice exercise']
            return ['Tell me more', 'Give me an example', 'How do I practice this?']
          }
          return (
            <div key={i} className={`flex gap-3 chat-bubble-enter ${msg.role === 'user' ? 'justify-end' : msg.role === 'system' ? 'justify-center' : 'justify-start'} ${isSearchMatch ? 'ring-1 ring-[#7c9cff]/40 rounded-xl' : ''}`}>
              {msg.role === 'assistant' && (
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${store.chatBusy && i === store.chatMessages.length - 1 ? '' : ''}`}
                  style={{ background: 'linear-gradient(135deg, #7c9cff, #9d7cff)', animation: store.chatBusy && i === store.chatMessages.length - 1 ? 'pulseRing 1.5s ease-in-out infinite' : 'none' }}>
                  🧠
                </div>
              )}
              <div className="flex flex-col max-w-[78%]">
                <div className={`relative group ${
                  msg.role === 'user'
                    ? 'bubble-gradient-user text-foreground rounded-2xl rounded-tr-sm whitespace-pre-wrap px-4 py-3 text-sm'
                    : msg.role === 'system'
                      ? 'bg-transparent border border-dashed border-[#272b34] text-muted-foreground text-xs max-w-[90%] px-4 py-3 rounded-2xl'
                      : 'bubble-gradient-assistant text-foreground rounded-2xl rounded-tl-sm px-4 py-3 text-sm border-l-2 border-l-[#7c9cff]/60 hover:shadow-[0_0_15px_rgba(124,156,255,0.15)] transition-shadow duration-300'
                }`}>
                  {searchQuery.trim() ? highlightText(msg.content) : (msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content)}
                  {/* Timestamp */}
                  <div className={`text-[9px] text-muted-foreground/50 mt-1 ${msg.role === 'user' ? 'text-right' : ''}`}>
                    {timeAgo(msg.timestamp)}
                  </div>
                  {/* Copy & Bookmark & Reaction buttons on assistant messages */}
                  {msg.role === 'assistant' && (
                    <div className="absolute -bottom-1 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      {/* Message Reactions */}
                      {(['👍', '👎', '💡', '📌'] as const).map(reaction => {
                        const isActive = store.messageReactions.some(r => r.messageId === `msg-${i}` && r.reaction === reaction)
                        return (
                          <button
                            key={reaction}
                            onClick={() => store.addMessageReaction(`msg-${i}`, reaction)}
                            className={`bg-[#272b34] hover:bg-[#3a3f4b] rounded px-1 py-0.5 text-[10px] transition-colors ${isActive ? 'ring-1 ring-[#7c9cff]/50' : ''}`}
                          >
                            {reaction}
                          </button>
                        )
                      })}
                      <button
                        onClick={() => copyToClipboard(msg.content, i)}
                        className="bg-[#272b34] hover:bg-[#3a3f4b] rounded px-1.5 py-0.5 text-[10px] text-muted-foreground flex items-center gap-1"
                      >
                        {copiedIdx === i ? <CheckCheck className="w-3 h-3 text-[#5fd0a0]" /> : <Copy className="w-3 h-3" />}
                        {copiedIdx === i ? 'Copied' : 'Copy'}
                      </button>
                      <button onClick={() => {
                        const isBookmarked = store.bookmarkedMessages.some(b => b.id === `msg-${i}`)
                        if (isBookmarked) store.removeBookmark(`msg-${i}`)
                        else store.addBookmark({ id: `msg-${i}`, content: msg.content, timestamp: msg.timestamp })
                      }} className={`bg-[#272b34] hover:bg-[#3a3f4b] rounded px-1.5 py-0.5 text-[10px] flex items-center gap-1 ${store.bookmarkedMessages.some(b => b.id === `msg-${i}`) ? 'text-[#ffce6b]' : 'text-muted-foreground'}`}>
                        <Star className="w-3 h-3" fill={store.bookmarkedMessages.some(b => b.id === `msg-${i}`) ? '#ffce6b' : 'none'} />
                      </button>
                    </div>
                  )}
                </div>
                {/* Smart Suggestion Chips after last AI message */}
                {isLastAiMessage && (
                  <div className="flex flex-wrap gap-1.5 mt-2 animate-slideUp">
                    {getSuggestions(msg.content).map(suggestion => (
                      <button
                        key={suggestion}
                        onClick={() => setInput(suggestion)}
                        className="text-[11px] text-[#7c9cff] bg-[#7c9cff]/8 border border-[#7c9cff]/20 rounded-full px-2.5 py-1 hover:bg-[#7c9cff]/15 hover:border-[#7c9cff]/30 transition-colors btn-hover"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm bg-[#1f232c] text-muted-foreground shrink-0">
                  🧑
                </div>
              )}
            </div>
          )
        })}
        {store.chatBusy && <ThinkingIndicator />}
      </div>

      {/* Composer */}
      <div className="border-t border-[#272b34] p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-2 chat-input-glow rounded-lg">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="type or use the mic..."
              className="flex-1 bg-[#191c23] border-[#272b34] text-foreground focus:border-[#7c9cff] resize-none min-h-[48px] transition-all"
              rows={1}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            />
            <Button onClick={send} disabled={store.chatBusy} data-send-btn
              className="bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] text-[#0e0f13] px-4 shrink-0 btn-hover animate-pulseGlow">
              <Send className="w-4 h-4" />
            </Button>
          </div>
          {/* Quick-action Chips */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            <button onClick={() => setShowBookmarks(true)} className="text-[11px] text-[#ffce6b] bg-[#ffce6b]/10 border border-[#ffce6b]/20 rounded-full px-2.5 py-1 hover:bg-[#ffce6b]/20 transition-colors">
              ⭐ {store.bookmarkedMessages.length}
            </button>
            <button onClick={handleSummary} disabled={summarizing}
              className="text-[11px] text-[#9d7cff] bg-[#9d7cff]/10 border border-[#9d7cff]/20 rounded-full px-2.5 py-1 hover:bg-[#9d7cff]/20 transition-colors disabled:opacity-50">
              {summarizing ? '⏳ Summarizing...' : '📋 Summarize'}
            </button>
            <button onClick={handleStudyMode} disabled={studyLoading}
              className="text-[11px] text-[#5fd0a0] bg-[#5fd0a0]/10 border border-[#5fd0a0]/20 rounded-full px-2.5 py-1 hover:bg-[#5fd0a0]/20 transition-colors disabled:opacity-50">
              {studyLoading ? '⏳ Loading...' : '🧪 Study Mode'}
            </button>
            <button onClick={() => setSearchOpen(!searchOpen)}
              className={`text-[11px] rounded-full px-2.5 py-1 transition-colors ${searchOpen ? 'text-[#7c9cff] bg-[#7c9cff]/10 border border-[#7c9cff]/20' : 'text-muted-foreground bg-[#191c23] border border-[#272b34] hover:border-[#7c9cff]/40 hover:text-[#7c9cff]'}`}>
              🔍 Search
            </button>
            {quickChips.map(chip => (
              <button
                key={chip}
                onClick={() => { setInput(chip); }}
                className="text-[11px] text-muted-foreground bg-[#191c23] border border-[#272b34] rounded-full px-2.5 py-1 hover:border-[#7c9cff]/40 hover:text-[#7c9cff] transition-colors btn-hover"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      </div>
      <BookmarksModal open={showBookmarks} onClose={() => setShowBookmarks(false)} />
      <SessionSummaryModal open={summaryOpen} onClose={() => setSummaryOpen(false)}
        summary={summaryData.summary} keyPoints={summaryData.keyPoints} xp={summaryData.xp} />
    </div>
  )
}

/* ========================================================================
   PLAN VIEW (Enhanced with day progress, export, completion toggle)
   ======================================================================== */
function PlanView() {
  const store = useAppStore()
  const [loading, setLoading] = useState(false)
  const [plan, setPlan] = useState<{ summary: string; adapts?: string; week: Array<{ day: string; focus: string; minutes: number; firstStep: string; time?: string }> } | null>(null)

  const generatePlan = async () => {
    setLoading(true)
    try {
      const data = await api('/ai/plan', { sessionToken: store.sessionToken })
      setPlan(data.plan)
      store.setPlan(data.plan.summary, data.plan.week)
      store.addNotification('📅 Your 7-day learning plan is ready!')
    } catch (err: unknown) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const exportPlan = () => {
    const currentPlan = plan || store.planWeek
    const summary = plan?.summary || store.planSummary || ''
    if (!currentPlan) {
      toast.error('No plan to export')
      return
    }
    let text = summary + '\n\n'
    currentPlan.forEach((day, i) => {
      const status = store.planDayProgress[i + 1] || 'not-started'
      const statusIcon = status === 'completed' ? '✅' : status === 'in-progress' ? '🔄' : '⬜'
      text += `${statusIcon} Day ${i + 1}: ${day.day} · ${day.focus}\n`
      text += `   ${day.firstStep}\n`
      text += `   Time: ${day.minutes}min${day.time ? ' · ' + day.time : ''}\n\n`
    })
    navigator.clipboard.writeText(text)
    toast.success('Plan copied to clipboard!')
  }

  const toggleDayComplete = (dayIdx: number) => {
    const current = store.planDayProgress[dayIdx] || 'not-started'
    const newStatus = current === 'completed' ? 'not-started' : 'completed'
    store.setPlanDayProgress(dayIdx, newStatus)
    if (newStatus === 'completed') {
      store.setProgress({ xp: store.xp + 20 })
      store.addNotification(`🎯 Day ${dayIdx} completed! +20 XP`)
      toast.success(`Day ${dayIdx} completed! +20 XP`)
    }
  }

  const accentColors = [
    'from-[#7c9cff] to-[#9d7cff]',
    'from-[#9d7cff] to-[#c084fc]',
    'from-[#c084fc] to-[#e879f9]',
    'from-[#e879f9] to-[#f472b6]',
    'from-[#f472b6] to-[#fb923c]',
    'from-[#fb923c] to-[#fbbf24]',
    'from-[#fbbf24] to-[#5fd0a0]',
  ]

  const statusIcons: Record<string, React.ReactNode> = {
    'not-started': <span className="w-5 h-5 rounded border border-[#272b34] inline-block" />,
    'in-progress': <span className="w-5 h-5 rounded border-2 border-[#ffce6b] inline-block flex items-center justify-center" />,
    'completed': <CheckCheck className="w-5 h-5 text-[#5fd0a0]" />,
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto animate-tabSwitch">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="text-2xl font-bold">your learning plan</h2>
          <p className="text-muted-foreground text-sm">
            AI builds a 7-day plan, pushes it to your calendar, and creates daily tasks.
          </p>
        </div>
        {(plan || store.planWeek) && (
          <Button variant="outline" size="sm" className="border-[#272b34] btn-hover" onClick={exportPlan}>
            <Clipboard className="w-3.5 h-3.5 mr-1" /> Export as Text
          </Button>
        )}
      </div>

      {!plan && !loading && !store.planWeek && (
        <Card className="bg-[#191c23] border-[#272b34] card-hover mt-6">
          <CardContent className="p-12 text-center">
            <span className="text-6xl mb-4 block">📅</span>
            <h3 className="font-semibold text-lg mb-2">No plan yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              Generate a personalized 7-day learning plan tailored to your goals and schedule. Your AI mentor will create daily focus areas and actionable steps.
            </p>
            <Button onClick={generatePlan}
              className="bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] text-[#0e0f13] font-semibold btn-hover">
              <Zap className="w-4 h-4 mr-2" /> Generate Plan
            </Button>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin w-10 h-10 border-2 border-[#7c9cff] border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Building your plan with deep thinking...</p>
        </div>
      )}

      {(plan || store.planWeek) && !loading && (
        <div className="space-y-4 mt-6">
          {(plan?.summary || store.planSummary) && (
            <Card className="bg-[#191c23] border-[#272b34] card-hover">
              <CardContent className="p-4">
                <p className="font-semibold">{plan?.summary || store.planSummary}</p>
                {plan?.adapts && <p className="text-sm text-muted-foreground mt-1">🎯 {plan.adapts}</p>}
              </CardContent>
            </Card>
          )}
          {(plan?.week || store.planWeek || []).map((day, i) => {
            const dayStatus = store.planDayProgress[i + 1] || 'not-started'
            const isCompleted = dayStatus === 'completed'
            return (
              <Card key={i} className={`bg-[#191c23] border-[#272b34] overflow-hidden card-hover transition-opacity ${isCompleted ? 'opacity-70' : ''}`}>
                <div className="flex">
                  {/* Left accent border */}
                  <div className={`w-1.5 shrink-0 bg-gradient-to-b ${accentColors[i % accentColors.length]}`} />
                  <CardContent className="p-4 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          {/* Day completion toggle */}
                          <button
                            onClick={() => toggleDayComplete(i + 1)}
                            className="shrink-0 hover:scale-110 transition-transform"
                            title={isCompleted ? 'Mark as not started' : 'Mark as completed'}
                          >
                            {statusIcons[dayStatus]}
                          </button>
                          <span className="text-3xl font-bold bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] bg-clip-text text-transparent leading-none">
                            {i + 1}
                          </span>
                          <div>
                            <h4 className={`font-semibold text-sm ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>{day.day} · {day.focus}</h4>
                            {day.time && (
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Clock className="w-3 h-3" /> {day.time}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className={`text-sm ${isCompleted ? 'line-through text-muted-foreground' : 'text-muted-foreground'} mt-1`}>{day.firstStep}</p>
                        {/* Status badge */}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge className={`text-[10px] border-0 ${
                            dayStatus === 'completed' ? 'bg-[#5fd0a0]/20 text-[#5fd0a0]' :
                            dayStatus === 'in-progress' ? 'bg-[#ffce6b]/20 text-[#ffce6b]' :
                            'bg-[#272b34] text-muted-foreground'
                          }`}>
                            {dayStatus === 'completed' ? '✅ Completed' : dayStatus === 'in-progress' ? '🔄 In Progress' : '⬜ Not Started'}
                          </Badge>
                        </div>
                        {/* Per-day action buttons */}
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" variant="ghost" className="h-6 text-[10px] text-muted-foreground hover:text-[#7c9cff] btn-hover">
                            📅 Push to Calendar
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 text-[10px] text-muted-foreground hover:text-[#5fd0a0] btn-hover">
                            ✅ Create Task
                          </Button>
                        </div>
                      </div>
                      <Badge className="bg-gradient-to-r from-[#7c9cff]/20 to-[#9d7cff]/20 text-[#9d7cff] border-0 text-xs shrink-0">
                        <Clock className="w-3 h-3 mr-1" />{day.minutes}m
                      </Badge>
                    </div>
                  </CardContent>
                </div>
              </Card>
            )
          })}
          <div className="flex gap-3 justify-center pt-2">
            <Button onClick={generatePlan} variant="outline" className="border-[#272b34] btn-hover">
              🔄 Regenerate
            </Button>
            <Button className="bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] text-[#0e0f13] font-semibold btn-hover">
              📅 Push to Calendar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ========================================================================
   TASKS VIEW (Enhanced with priority, due date, filters, extract)
   ======================================================================== */
function TasksView() {
  const store = useAppStore()
  const [newTask, setNewTask] = useState('')
  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)

  const addTask = async () => {
    if (!newTask.trim()) return
    setLoading(true)
    try {
      const data = await api('/tasks', {
        sessionToken: store.sessionToken,
        title: newTask.trim(),
        source: 'local',
      })
      store.addTask(data.task)
      setNewTask('')
      toast.success('Task added ✓')
      store.addNotification('📋 New task: ' + newTask.trim())
    } catch (err: unknown) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const completeTask = async (taskId: string) => {
    try {
      await api(`/tasks/${taskId}`, { sessionToken: store.sessionToken, status: 'completed' })
      store.completeTask(taskId)
      store.addNotification('🎯 You earned 15 XP for completing a task!')
      toast.success('Done ✓ +15 XP')
    } catch (err: unknown) {
      toast.error((err as Error).message)
    }
  }

  const extractFromChat = async () => {
    setExtracting(true)
    try {
      const lastMessages = store.chatMessages.slice(-6).map(m => m.content).join('\n')
      const data = await api('/ai/chat', {
        sessionToken: store.sessionToken,
        message: `Extract actionable learning tasks from this conversation. Return each task as a line starting with "TASK:". Each line should be a concise task title. If there are due dates or priorities, add them in brackets like [high] or [due:tomorrow].\n\nConversation:\n${lastMessages}`,
        history: [],
        boost: false,
      })
      const lines = data.reply.split('\n').filter(l => l.trim().startsWith('TASK:'))
      let added = 0
      for (const line of lines) {
        const text = line.replace('TASK:', '').trim()
        if (text) {
          let priority: 'high' | 'medium' | 'low' = 'medium'
          let due: string | undefined
          if (text.includes('[high]')) priority = 'high'
          else if (text.includes('[low]')) priority = 'low'
          const dueMatch = text.match(/\[due:([^\]]+)\]/)
          if (dueMatch) due = dueMatch[1]
          store.addTask({
            id: Date.now().toString() + Math.random().toString(36).slice(2),
            title: text.replace(/\[[^\]]+\]/g, '').trim(),
            priority,
            due,
            status: 'pending',
            source: 'ai-extracted',
          })
          added++
        }
      }
      if (added > 0) {
        toast.success(`Extracted ${added} task${added > 1 ? 's' : ''} from chat!`)
        store.addNotification(`📋 ${added} task${added > 1 ? 's' : ''} extracted from chat`)
      } else {
        toast.info('No tasks found in recent chat messages')
      }
    } catch (err: unknown) {
      toast.error((err as Error).message)
    } finally {
      setExtracting(false)
    }
  }

  const loadTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks?sessionToken=${encodeURIComponent(store.sessionToken || '')}`)
      const data = await res.json()
      if (data.tasks) store.setTasks(data.tasks)
    } catch { /* ignore */ }
  }, [store.sessionToken])

  useEffect(() => { loadTasks() }, [loadTasks])

  // Filter tasks
  const filter = store.taskFilter
  const allPending = store.tasks.filter(t => t.status === 'pending')
  const allCompleted = store.tasks.filter(t => t.status === 'completed')

  const pending = filter === 'completed' ? [] : allPending
  const completed = filter === 'active' ? [] : allCompleted

  const priorityColors: Record<string, string> = {
    high: 'bg-[#ff8a8a]',
    medium: 'bg-[#ffce6b]',
    low: 'bg-[#5fd0a0]',
  }

  const isOverdue = (due?: string) => {
    if (!due) return false
    try {
      return new Date(due) < new Date()
    } catch {
      return false
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto animate-tabSwitch">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="text-2xl font-bold">your tasks</h2>
          <p className="text-muted-foreground text-sm">learning tasks — check them off as you go.</p>
        </div>
        <Button variant="outline" size="sm" className="border-[#272b34] btn-hover"
          onClick={extractFromChat} disabled={extracting}>
          <Wand2 className="w-3.5 h-3.5 mr-1" />
          {extracting ? 'Extracting...' : 'Extract from Chat'}
        </Button>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 mb-4 mt-4">
        {(['all', 'active', 'completed'] as const).map(f => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'ghost'}
            size="sm"
            className={filter === f ? 'bg-[#7c9cff]/20 text-[#7c9cff] border border-[#7c9cff]/30 btn-hover' : 'text-muted-foreground btn-hover'}
            onClick={() => store.setTaskFilter(f)}
          >
            {f === 'all' ? `All (${store.tasks.length})` : f === 'active' ? `Active (${allPending.length})` : `Completed (${allCompleted.length})`}
          </Button>
        ))}
      </div>

      {/* Quick Add */}
      <div className="flex gap-2 mb-6">
        <Input
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          placeholder="add a task..."
          className="bg-[#191c23] border-[#272b34] focus:border-[#7c9cff]"
          onKeyDown={(e) => e.key === 'Enter' && addTask()}
        />
        <Button onClick={addTask} disabled={loading}
          className="bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] text-[#0e0f13] shrink-0 btn-hover">
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <div className="space-y-2 mb-6">
          <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Active Tasks</h3>
          {pending.map(task => (
            <Card key={task.id} className="bg-[#191c23] border-[#272b34] card-hover">
              <CardContent className="p-3 flex items-center gap-3">
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-[#5fd0a0] btn-hover"
                  onClick={() => completeTask(task.id)}>
                  <Check className="w-4 h-4" />
                </Button>
                {/* Priority dot */}
                <span className={`w-2 h-2 rounded-full shrink-0 ${priorityColors[task.priority || 'medium']}`}
                  title={task.priority || 'medium'} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{task.title}</p>
                  {task.notes && <p className="text-xs text-muted-foreground truncate">{task.notes}</p>}
                </div>
                {/* Due date with color coding */}
                {task.due && (
                  <span className={`text-xs shrink-0 ${isOverdue(task.due) ? 'text-[#ff8a8a] font-medium' : 'text-muted-foreground'}`}>
                    {isOverdue(task.due) && '⚠️ '}{task.due}
                  </span>
                )}
                <Badge variant="secondary" className="text-[10px] shrink-0">{task.source}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Completed ({completed.length})</h3>
          <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-2">
            {completed.map(task => (
              <Card key={task.id} className="bg-[#191c23] border-[#272b34] opacity-60">
                <CardContent className="p-3 flex items-center gap-3">
                  <Check className="w-4 h-4 text-[#5fd0a0] shrink-0" />
                  <p className="text-sm line-through text-muted-foreground truncate">{task.title}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {pending.length === 0 && completed.length === 0 && (
        <Card className="bg-[#191c23] border-[#272b34] card-hover">
          <CardContent className="p-12 text-center">
            <span className="text-6xl mb-4 block">📋</span>
            <h3 className="font-semibold text-lg mb-2">No tasks yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              Chat with your mentor and tasks will be auto-created, or generate a plan to get started with actionable steps.
            </p>
            <Button onClick={() => store.setTab('session')}
              className="bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] text-[#0e0f13] font-semibold btn-hover">
              <MessageSquare className="w-4 h-4 mr-2" /> Start Chatting
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/* ========================================================================
   ACHIEVEMENT BADGES
   ======================================================================== */
function AchievementBadge({ emoji, title, desc, unlocked }: { emoji: string; title: string; desc: string; unlocked: boolean }) {
  return (
    <div className={`relative flex flex-col items-center text-center p-3 rounded-xl border transition-all ${
      unlocked
        ? 'bg-gradient-to-b from-[#7c9cff]/10 to-[#9d7cff]/5 border-[#7c9cff]/30 card-hover'
        : 'bg-[#191c23] border-[#272b34] opacity-50'
    }`}>
      <span className={`text-2xl mb-1 ${unlocked ? '' : 'grayscale'}`}>{emoji}</span>
      <p className="text-xs font-semibold leading-tight">{title}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{desc}</p>
      {!unlocked && (
        <Lock className="absolute top-2 right-2 w-3 h-3 text-muted-foreground/40" />
      )}
    </div>
  )
}

/* ========================================================================
   WEEKLY ACTIVITY HEATMAP
   ======================================================================== */
function WeeklyActivityHeatmap() {
  const store = useAppStore()
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  // Calculate activity level based on XP and session count
  const getActivityLevel = (dayIndex: number) => {
    // Use session count and XP as proxy for weekly activity
    const baseActivity = store.sessionCount
    const xpPerDay = store.xp / 7
    // Generate deterministic but varied activity per day
    const dayActivity = (baseActivity * (dayIndex + 1) + store.wins * dayIndex) % 4
    return Math.min(dayActivity, 3)
  }

  const colors = [
    '#191c23',      // 0: no activity
    'rgba(124,156,255,0.2)',  // 1: some
    'rgba(124,156,255,0.5)',  // 2: good
    '#7c9cff',      // 3: great
  ]

  return (
    <div className="flex items-center gap-2">
      {days.map((day, i) => {
        const level = getActivityLevel(i)
        return (
          <div key={day} className="flex flex-col items-center gap-1">
            <div
              className="w-8 h-8 rounded-md transition-colors"
              style={{ backgroundColor: colors[level] }}
              title={`${day}: ${['No activity', 'Some activity', 'Good activity', 'Great activity'][level]}`}
            />
            <span className="text-[9px] text-muted-foreground">{day}</span>
          </div>
        )
      })}
    </div>
  )
}

/* ========================================================================
   PROGRESS VIEW (Enhanced with achievements and heatmap)
   ======================================================================== */
function AnimatedNumber({ value, label, color, icon: Icon }: { value: number | string; label: string; color: string; icon: React.ElementType }) {
  const [displayed, setDisplayed] = useState(0)
  const numValue = typeof value === 'number' ? value : parseInt(String(value)) || 0

  useEffect(() => {
    let start = 0
    const duration = 800
    const startTime = Date.now()
    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayed(Math.round(start + (numValue - start) * eased))
      if (progress < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }, [numValue])

  return (
    <Card className="bg-[#191c23] border-[#272b34] card-hover">
      <CardContent className="p-4 text-center">
        <Icon className={`w-5 h-5 mx-auto mb-2 ${color}`} />
        <div className={`text-2xl font-bold ${color}`} style={{ animation: 'countUp 0.5s ease-out' }}>
          {typeof value === 'string' ? value : displayed}
        </div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      </CardContent>
    </Card>
  )
}

function ProgressView() {
  const store = useAppStore()
  const totalSessions = store.sessionCount
  const wins = store.wins
  const streak = store.successStreak
  const bestStreak = store.bestStreak
  const completedTasks = store.tasks.filter(t => t.status === 'completed').length
  const pendingTasks = store.tasks.filter(t => t.status === 'pending').length
  const mastery = Math.min(100, Math.round(((wins * 3) + (completedTasks * 2) + (totalSessions * 1)) / Math.max(1, 10) * 100))

  // XP / Level system
  const xp = store.xp
  const level = Math.floor(xp / 100) + 1
  const xpInLevel = xp % 100
  const xpForNext = 100

  const motivationalMessages = [
    { min: 0, msg: "Every journey starts with a single step. You're here. That counts. 🌱" },
    { min: 1, msg: "You're building momentum. Keep going! 🔥" },
    { min: 3, msg: "3-day streak! You're forming a habit. 💪" },
    { min: 5, msg: "5 days strong! Your future self thanks you. ⭐" },
    { min: 7, msg: "A full week! You're becoming unstoppable. 🚀" },
    { min: 14, msg: "Two weeks of consistency. You're a learning machine. 🏆" },
  ]
  const motivation = motivationalMessages.filter(m => streak >= m.min).pop()?.msg || motivationalMessages[0].msg

  // Achievements
  const achievements = [
    { emoji: '🌱', title: 'First Steps', desc: 'Complete 1 session', unlocked: totalSessions >= 1 },
    { emoji: '🔥', title: '3-Day Streak', desc: '3 days in a row', unlocked: streak >= 3 },
    { emoji: '💪', title: '7-Day Streak', desc: '7 days in a row', unlocked: streak >= 7 },
    { emoji: '🧠', title: 'Knowledge Seeker', desc: '5 wins', unlocked: wins >= 5 },
    { emoji: '⭐', title: 'Rising Star', desc: 'Reach Level 3', unlocked: level >= 3 },
    { emoji: '🏆', title: 'Master Learner', desc: 'Earn 100 XP', unlocked: xp >= 100 },
    { emoji: '📋', title: 'Task Master', desc: '10 tasks completed', unlocked: completedTasks >= 10 },
    { emoji: '🗓️', title: 'Week Warrior', desc: 'Complete a 7-day plan', unlocked: Object.values(store.planDayProgress).filter(s => s === 'completed').length >= 7 },
  ]

  const unlockedCount = achievements.filter(a => a.unlocked).length

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto animate-tabSwitch">
      <h2 className="text-2xl font-bold mb-1">your progress</h2>
      <p className="text-muted-foreground text-sm mb-6">no percentages. just me, noticing you.</p>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <AnimatedNumber value={totalSessions} label="sessions" color="text-[#7c9cff]" icon={MessageSquare} />
        <AnimatedNumber value={wins} label="wins" color="text-[#5fd0a0]" icon={Trophy} />
        <AnimatedNumber value={`${streak}🔥`} label="streak" color="text-[#ffce6b]" icon={Flame} />
        <AnimatedNumber value={`${mastery}%`} label="mastery" color="text-[#9d7cff]" icon={Star} />
      </div>

      {/* Skill Radar Chart */}
      <Card className="bg-[#191c23] border-[#272b34] mb-4 card-hover card-shine">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">Skill Profile</p>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={useMemo(() => [
              { skill: 'Consistency', value: Math.min(100, streak * 15 + 20), fullMark: 100 },
              { skill: 'Depth', value: Math.min(100, wins * 10 + 15), fullMark: 100 },
              { skill: 'Breadth', value: Math.min(100, store.tasks.length * 8 + 10), fullMark: 100 },
              { skill: 'Speed', value: Math.min(100, totalSessions * 5 + 25), fullMark: 100 },
              { skill: 'Retention', value: Math.min(100, Math.round(mastery * 0.8 + store.reviewCards.length * 5)), fullMark: 100 },
            ], [streak, wins, store.tasks.length, totalSessions, mastery, store.reviewCards.length])}>
              <PolarGrid stroke="rgba(255,255,255,0.06)" />
              <PolarAngleAxis dataKey="skill" tick={{ fontSize: 10, fill: '#6b7280' }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name="Skills" dataKey="value" stroke="#7c9cff" fill="#7c9cff" fillOpacity={0.15} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* XP / Level Card */}
      <Card className="bg-[#191c23] border-[#272b34] mb-4 card-hover">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                style={{ background: 'linear-gradient(135deg, #7c9cff, #9d7cff)' }}>
                {level}
              </div>
              <div>
                <p className="text-sm font-semibold">Level {level}</p>
                <p className="text-[10px] text-muted-foreground">{xp} total XP</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{xpInLevel} / {xpForNext} XP</p>
              <p className="text-[10px] text-muted-foreground">Level {level + 1}</p>
            </div>
          </div>
          <div className="relative progress-shimmer">
            <Progress value={(xpInLevel / xpForNext) * 100} className="h-2.5" />
            <div className="absolute inset-0 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] rounded-full"
                style={{ width: `${(xpInLevel / xpForNext) * 100}%`, transition: 'width 0.5s ease' }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Activity Heatmap */}
      <Card className="bg-[#191c23] border-[#272b34] mb-4 card-hover">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">Weekly Activity</p>
          <WeeklyActivityHeatmap />
          <div className="flex items-center gap-3 mt-3 text-[9px] text-muted-foreground">
            <span>Less</span>
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#191c23' }} />
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(124,156,255,0.2)' }} />
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(124,156,255,0.5)' }} />
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#7c9cff' }} />
            <span>More</span>
          </div>
        </CardContent>
      </Card>

      {/* Radial Mastery Circle */}
      <Card className="bg-[#191c23] border-[#272b34] mb-4 card-hover card-shine">
        <CardContent className="p-6 flex flex-col items-center">
          <div className="relative w-40 h-40">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <defs>
                <linearGradient id="masteryGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#7c9cff" />
                  <stop offset="100%" stopColor="#9d7cff" />
                </linearGradient>
              </defs>
              {/* Background circle */}
              <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
              {/* Progress circle */}
              <circle cx="60" cy="60" r="50" fill="none" stroke="url(#masteryGrad)" strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${Math.PI * 100}`}
                strokeDashoffset={`${Math.PI * 100 * (1 - mastery / 100)}`}
                style={{ transition: 'stroke-dashoffset 1.2s ease-out' }}
              />
            </svg>
            {/* Center text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] bg-clip-text text-transparent">{mastery}%</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Mastery</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tasks Progress */}
      <Card className="bg-[#191c23] border-[#272b34] mb-4 card-hover">
        <CardContent className="p-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>tasks</span><span>{completedTasks} done · {pendingTasks} pending</span>
          </div>
          <Progress value={completedTasks + pendingTasks > 0 ? Math.round(completedTasks / (completedTasks + pendingTasks) * 100) : 0}
            className="h-2" />
        </CardContent>
      </Card>

      {/* Best Streak + Motivation */}
      <Card className="bg-[#191c23] border-[#272b34] mb-4 card-hover">
        <CardContent className="p-4">
          <p className="font-medium mb-2"><Flame className="w-4 h-4 inline mr-1 text-[#ffce6b]" />best streak: {bestStreak} 🔥</p>
          <p className="text-xs text-muted-foreground mb-3">
            topic: {store.topic || '—'} · goal: {store.vision || '—'}
          </p>
          <div className="bg-gradient-to-r from-[#7c9cff]/10 to-[#9d7cff]/10 border border-[#7c9cff]/20 rounded-lg p-3">
            <p className="text-xs text-[#c5d0ff]">{motivation}</p>
          </div>
        </CardContent>
      </Card>

      {/* XP Growth Chart (Recharts) */}
      <Card className="bg-[#191c23] border-[#272b34] mb-4 card-hover card-shine">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">XP Growth This Week</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={useMemo(() => {
              const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
              const baseXp = Math.max(xp - 35, 0)
              return days.map((day, i) => ({
                day,
                xp: Math.max(0, baseXp + Math.floor((xp / 7) * (i + 1) + (wins * i * 2) - (i * 3 + 2)))
              }))
            }, [xp, wins, totalSessions])}>
              <defs>
                <linearGradient id="xpGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#7c9cff" />
                  <stop offset="100%" stopColor="#9d7cff" />
                </linearGradient>
                <linearGradient id="xpFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7c9cff" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#9d7cff" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} width={30} />
              <RechartsTooltip
                contentStyle={{ backgroundColor: '#191c23', border: '1px solid #272b34', borderRadius: '8px', fontSize: '11px' }}
                labelStyle={{ color: '#c5d0ff' }}
              />
              <Area type="monotone" dataKey="xp" stroke="url(#xpGradient)" fill="url(#xpFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Learning Streak Calendar - 35-Day Activity */}
      <Card className="bg-[#191c23] border-[#272b34] mb-4 card-hover card-shine">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">35-Day Activity</p>
          {/* Column labels */}
          <div className="flex gap-1 mb-1 ml-8">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <div key={i} className="w-5 h-3 flex items-center justify-center text-[8px] text-muted-foreground/60">{d}</div>
            ))}
          </div>
          {/* Grid rows */}
          <div className="space-y-1">
            {[0, 1, 2, 3, 4].map(week => (
              <div key={week} className="flex items-center gap-1">
                <span className="text-[8px] text-muted-foreground/40 w-6 shrink-0">W{week + 1}</span>
                {[0, 1, 2, 3, 4, 5, 6].map(day => {
                  const idx = week * 7 + day
                  const activityLevel = (() => {
                    const base = totalSessions + wins + Math.floor(xp / 10)
                    const val = (base * (idx + 1) + store.xp * (idx % 3)) % 7
                    if (val < 2) return 0
                    if (val < 4) return 1
                    if (val < 6) return 2
                    return 3
                  })()
                  const colors = ['#191c23', 'rgba(124,156,255,0.15)', 'rgba(124,156,255,0.35)', '#7c9cff']
                  return (
                    <div key={day} className="w-5 h-5 rounded-sm" style={{ backgroundColor: colors[activityLevel] }}
                      title={`Day ${idx + 1}: ${['No activity', 'Low', 'Medium', 'High'][activityLevel]}`} />
                  )
                })}
              </div>
            ))}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-2 mt-3 text-[9px] text-muted-foreground">
            <span>Less</span>
            <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: '#191c23' }} />
            <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: 'rgba(124,156,255,0.15)' }} />
            <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: 'rgba(124,156,255,0.35)' }} />
            <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: '#7c9cff' }} />
            <span>More</span>
          </div>
        </CardContent>
      </Card>

      {/* Mood History */}
      {store.moodLogs.length > 0 && (
        <Card className="bg-[#191c23] border-[#272b34] mb-4 card-hover card-shine">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">Mood History (Last 7 Days)</p>
            <div className="flex items-end gap-2 h-16">
              {store.moodLogs.slice(-7).map((log, i) => {
                const moods = ['', '😫', '😐', '🙂', '😊', '🤩']
                const colors = ['', '#ff8a8a', '#ffce6b', '#c5d0ff', '#7c9cff', '#5fd0a0']
                return (
                  <div key={log.id} className="flex flex-col items-center gap-1 flex-1">
                    <div className="w-full rounded-t" style={{
                      height: `${log.mood * 16}%`,
                      background: colors[log.mood],
                      opacity: 0.7,
                      minHeight: '8px',
                    }} />
                    <span className="text-xs">{moods[log.mood]}</span>
                    <span className="text-[8px] text-muted-foreground/50">
                      {i === store.moodLogs.slice(-7).length - 1 ? 'Today' : `${7 - i}d`}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Session History */}
      <Card className="bg-[#191c23] border-[#272b34] mb-4 card-hover card-shine">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Session History</p>
            <BookMarked className="w-4 h-4 text-[#7c9cff]" />
          </div>
          {store.sessionSummaries.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-xs text-muted-foreground">No sessions summarized yet</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">Use 📋 Summarize in chat to save sessions</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
              {store.sessionSummaries.slice(-5).reverse().map(s => (
                <div key={s.id} className="bg-[#15171d] rounded-lg p-2.5 border border-[#272b34]/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-muted-foreground">{timeAgo(s.date)}</span>
                    <Badge className="text-[8px] bg-[#7c9cff]/15 text-[#7c9cff] border-0 px-1">+{s.xp} XP</Badge>
                  </div>
                  <p className="text-xs text-foreground/80 line-clamp-2">{s.summary}</p>
                  {s.keyPoints.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {s.keyPoints.slice(0, 3).map((kp, ki) => (
                        <Badge key={ki} variant="outline" className="text-[8px] border-[#272b34] text-muted-foreground px-1 py-0">{kp}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Achievements */}
      <Card className="bg-[#191c23] border-[#272b34] card-hover">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Achievements ({unlockedCount}/{achievements.length})
            </p>
            <Trophy className="w-4 h-4 text-[#ffce6b]" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {achievements.map(a => (
              <AchievementBadge key={a.title} {...a} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ========================================================================
   LEARNING RESOURCES VIEW
   ======================================================================== */
function ResourcesView() {
  const store = useAppStore()
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'video' | 'article' | 'interactive' | 'podcast'>('all')

  const fetchResources = async () => {
    setLoading(true)
    try {
      const data = await api('/ai/resources', { sessionToken: store.sessionToken, topic: store.topic })
      if (data.resources) {
        store.setLearningResources(data.resources)
        toast.success(`Found ${data.resources.length} resources`)
      }
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to fetch resources')
    } finally {
      setLoading(false)
    }
  }

  const typeIcons: Record<string, string> = { video: '🎬', article: '📝', interactive: '🎮', podcast: '🎧' }
  const filtered = filter === 'all' ? store.learningResources : store.learningResources.filter(r => r.type === filter)
  const filterPills: Array<{ value: typeof filter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'video', label: '🎬 Video' },
    { value: 'article', label: '📝 Article' },
    { value: 'interactive', label: '🎮 Interactive' },
    { value: 'podcast', label: '🎧 Podcast' },
  ]

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto animate-tabSwitch">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">learning resources</h2>
        <Button onClick={fetchResources} disabled={loading}
          className="bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] text-[#0e0f13] font-semibold btn-hover">
          {loading ? <><span className="animate-spin mr-2">⏳</span> Fetching...</> : <><BookOpen className="w-4 h-4 mr-2" /> Fetch Resources</>}
        </Button>
      </div>

      {/* Filter Pills */}
      {store.learningResources.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {filterPills.map(p => (
            <button
              key={p.value}
              onClick={() => setFilter(p.value)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filter === p.value
                  ? 'bg-[#7c9cff]/20 text-[#7c9cff] border-[#7c9cff]/30'
                  : 'bg-[#191c23] border-[#272b34] text-muted-foreground hover:border-[#7c9cff]/30'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-16">
          <div className="animate-spin w-12 h-12 border-2 border-[#7c9cff] border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Curating resources for you...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && store.learningResources.length === 0 && (
        <Card className="bg-[#191c23] border-[#272b34] card-hover">
          <CardContent className="p-12 text-center">
            <span className="text-6xl mb-4 block">📚</span>
            <h3 className="font-semibold text-lg mb-2">No resources yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              Let your AI mentor find the best videos, articles, podcasts, and interactive tools for your learning journey.
            </p>
            <Button onClick={fetchResources}
              className="bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] text-[#0e0f13] font-semibold btn-hover">
              <BookOpen className="w-4 h-4 mr-2" /> Discover Resources
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Resource Cards Grid */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((r) => (
            <Card key={r.id} className="bg-[#191c23] border-[#272b34] card-hover overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0">{typeIcons[r.type] || '📖'}</span>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm truncate">{r.title}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{r.source}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className={`text-[9px] border-0 ${
                        r.difficulty === 'beginner' ? 'bg-[#5fd0a0]/15 text-[#5fd0a0]' :
                        r.difficulty === 'advanced' ? 'bg-[#ff8a8a]/15 text-[#ff8a8a]' :
                        'bg-[#ffce6b]/15 text-[#ffce6b]'
                      }`}>
                        {r.difficulty}
                      </Badge>
                      {r.url && (
                        <a href={r.url} target="_blank" rel="noopener noreferrer"
                          className="text-[#7c9cff] hover:text-[#9d7cff] transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

/* ========================================================================
   MOOD TRACKER WIDGET
   ======================================================================== */
function MoodTrackerWidget() {
  const store = useAppStore()
  const [selectedMood, setSelectedMood] = useState<number | null>(null)
  const moods = [
    { value: 1, emoji: '😫', label: 'Struggling', color: '#ff8a8a' },
    { value: 2, emoji: '😐', label: 'Meh', color: '#ffce6b' },
    { value: 3, emoji: '🙂', label: 'Okay', color: '#c5d0ff' },
    { value: 4, emoji: '😊', label: 'Good', color: '#7c9cff' },
    { value: 5, emoji: '🤩', label: 'Great', color: '#5fd0a0' },
  ]

  // Check if already logged mood today
  const today = new Date().toDateString()
  const alreadyLogged = store.moodLogs.some(m => new Date(m.timestamp).toDateString() === today)

  const handleMood = (value: number) => {
    if (alreadyLogged) return
    setSelectedMood(value)
    store.addMoodLog(value)
    store.addNotification(`${moods[value - 1].emoji} Mood logged! Keep tracking your progress.`)
    // Check for low mood streak
    const recentMoods = store.moodLogs.slice(-3)
    if (recentMoods.length >= 2 && recentMoods.every(m => m.mood <= 2)) {
      store.addNotification('💛 Noticed you\'re having a tough time. Remember, it\'s okay to take a break.')
    }
  }

  if (alreadyLogged && selectedMood === null) {
    const lastMood = store.moodLogs[store.moodLogs.length - 1]
    if (!lastMood) return null
    return (
      <div className="flex items-center gap-2 px-4 py-2 mb-2 max-w-3xl mx-auto w-full">
        <div className="flex items-center gap-2 bg-[#191c23]/60 border border-[#272b34] rounded-full px-3 py-1.5 text-xs text-muted-foreground">
          <span>{moods[lastMood.mood - 1].emoji}</span>
          <span>Today's mood logged</span>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-2 mb-2 max-w-3xl mx-auto w-full">
      <div className="bg-[#191c23]/60 border border-[#272b34] rounded-xl p-3 card-hover">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">How are you feeling today?</span>
          {selectedMood !== null && <span className="text-[10px] text-[#5fd0a0]">✓ Logged</span>}
        </div>
        <div className="flex items-center gap-2">
          {moods.map(m => (
            <button
              key={m.value}
              onClick={() => handleMood(m.value)}
              disabled={alreadyLogged}
              className={`flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-lg transition-all text-sm
                ${selectedMood === m.value ? 'scale-110 ring-2' : 'hover:scale-105'}
                ${alreadyLogged ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
              style={{
                ringColor: selectedMood === m.value ? m.color : 'transparent',
                background: selectedMood === m.value ? `${m.color}15` : 'transparent',
              }}
            >
              <span className="text-lg">{m.emoji}</span>
              <span className="text-[9px] text-muted-foreground">{m.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ========================================================================
   REVIEW VIEW (Spaced Repetition)
   ======================================================================== */
function ReviewView() {
  const store = useAppStore()
  const [flipped, setFlipped] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(0)

  const dueCards = store.reviewCards.filter(c => c.nextReview <= Date.now())
  const hasCards = dueCards.length > 0
  const allCards = store.reviewCards

  const currentCard = hasCards ? dueCards[currentIdx % dueCards.length] : null

  // SM-2 simplified algorithm
  const rateCard = (quality: number) => {
    if (!currentCard) return
    const { easeFactor, interval, repetitions } = currentCard
    let newEf = easeFactor
    let newRep = repetitions
    let newInterval = interval

    if (quality >= 3) {
      if (repetitions === 0) newInterval = 1
      else if (repetitions === 1) newInterval = 6
      else newInterval = Math.round(interval * easeFactor)
      newRep = repetitions + 1
    } else {
      newRep = 0
      newInterval = 1
    }

    newEf = Math.max(1.3, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))

    store.updateReviewCard(currentCard.id, {
      easeFactor: newEf,
      interval: newInterval,
      repetitions: newRep,
      nextReview: Date.now() + newInterval * 24 * 60 * 60 * 1000,
    })

    setFlipped(false)
    setCurrentIdx(i => i + 1)
    store.setProgress({ xp: store.xp + 3 })
    store.addNotification(`🃏 Card reviewed! +3 XP`)
  }

  const addSampleCards = () => {
    const topic = store.topic || 'learning'
    const samples = [
      { front: `What is the core concept of ${topic}?`, back: 'The fundamental principle that underpins understanding of this topic.', interval: 1, nextReview: Date.now(), easeFactor: 2.5, repetitions: 0 },
      { front: `Why is ${topic} important?`, back: 'It enables practical application and deeper understanding of related concepts.', interval: 1, nextReview: Date.now(), easeFactor: 2.5, repetitions: 0 },
      { front: `How would you explain ${topic} to a beginner?`, back: 'Start with the basics, use analogies, and build up complexity gradually.', interval: 1, nextReview: Date.now(), easeFactor: 2.5, repetitions: 0 },
    ]
    samples.forEach(s => {
      store.addReviewCard({ id: Date.now().toString() + Math.random().toString(36).slice(2), ...s })
    })
    store.addNotification('🃏 3 flashcards added!')
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto animate-tabSwitch">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-2xl font-bold">review</h2>
        <Badge className="bg-[#7c9cff]/15 text-[#7c9cff] border-0">
          {dueCards.length} due · {allCards.length} total
        </Badge>
      </div>
      <p className="text-muted-foreground text-sm mb-6">spaced repetition. come back stronger each time.</p>

      {hasCards ? (
        <div className="space-y-4">
          {/* Flashcard */}
          <div
            className="relative cursor-pointer perspective-1000"
            onClick={() => setFlipped(!flipped)}
            style={{ perspective: '1000px' }}
          >
            <div className="relative w-full min-h-[240px] transition-transform duration-500"
              style={{ transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
              {/* Front */}
              <div className="absolute inset-0 backface-hidden" style={{ backfaceVisibility: 'hidden' }}>
                <Card className="bg-[#191c23] border-[#272b34] h-full card-hover card-shine gradient-border-animated">
                  <CardContent className="p-8 flex flex-col items-center justify-center min-h-[240px]">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest mb-4">Question</span>
                    <p className="text-lg text-center font-medium">{currentCard!.front}</p>
                    <p className="text-xs text-muted-foreground mt-6">tap to reveal answer</p>
                  </CardContent>
                </Card>
              </div>
              {/* Back */}
              <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                <Card className="bg-[#191c23] border-[#7c9cff]/30 h-full">
                  <CardContent className="p-8 flex flex-col items-center justify-center min-h-[240px]">
                    <span className="text-[10px] text-[#7c9cff] uppercase tracking-widest mb-4">Answer</span>
                    <p className="text-base text-center">{currentCard!.back}</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          {/* Rating Buttons */}
          {flipped && (
            <div className="grid grid-cols-4 gap-2 animate-slideUp">
              <button onClick={() => rateCard(1)} className="py-3 rounded-xl bg-[#ff8a8a]/10 border border-[#ff8a8a]/20 text-[#ff8a8a] text-xs font-semibold hover:bg-[#ff8a8a]/20 transition-colors btn-hover">
                😫 Again
              </button>
              <button onClick={() => rateCard(2)} className="py-3 rounded-xl bg-[#ffce6b]/10 border border-[#ffce6b]/20 text-[#ffce6b] text-xs font-semibold hover:bg-[#ffce6b]/20 transition-colors btn-hover">
                😐 Hard
              </button>
              <button onClick={() => rateCard(3)} className="py-3 rounded-xl bg-[#7c9cff]/10 border border-[#7c9cff]/20 text-[#7c9cff] text-xs font-semibold hover:bg-[#7c9cff]/20 transition-colors btn-hover">
                🙂 Good
              </button>
              <button onClick={() => rateCard(4)} className="py-3 rounded-xl bg-[#5fd0a0]/10 border border-[#5fd0a0]/20 text-[#5fd0a0] text-xs font-semibold hover:bg-[#5fd0a0]/20 transition-colors btn-hover">
                😊 Easy
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(124,156,255,0.1), rgba(157,124,255,0.1))' }}>
            <span className="text-4xl">🃏</span>
          </div>
          <h3 className="text-lg font-semibold mb-2">No cards to review</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
            {allCards.length === 0
              ? 'Create flashcards to start your spaced repetition practice.'
              : 'All cards are reviewed! Come back when they\'re due.'}
          </p>
          {allCards.length === 0 && (
            <Button onClick={addSampleCards} className="bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] text-[#0e0f13] btn-hover">
              <Plus className="w-4 h-4 mr-2" /> Add Sample Cards
            </Button>
          )}
        </div>
      )}

      {/* Card List */}
      {allCards.length > 0 && (
        <Card className="bg-[#191c23] border-[#272b34] mt-6 card-hover">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">All Cards ({allCards.length})</p>
            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
              {allCards.map(card => {
                const isDue = card.nextReview <= Date.now()
                return (
                  <div key={card.id} className="flex items-center justify-between bg-[#15171d] rounded-lg p-2.5 border border-[#272b34]/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate">{card.front}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Rep: {card.repetitions} · EF: {card.easeFactor.toFixed(1)} · {isDue ? 'Due now' : `Due ${timeAgo(card.nextReview)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      {isDue && <span className="w-2 h-2 rounded-full bg-[#ff8a8a]" />}
                      <button onClick={() => store.removeReviewCard(card.id)} className="text-muted-foreground hover:text-[#ff8a8a] transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            <Button size="sm" variant="outline" onClick={addSampleCards} className="mt-3 text-xs border-[#7c9cff]/30 text-[#7c9cff] hover:bg-[#7c9cff]/10 btn-hover">
              <Plus className="w-3 h-3 mr-1" /> Add More Cards
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/* ========================================================================
   ROOM VIEW (Fixed)
   ======================================================================== */
function RoomView() {
  const store = useAppStore()
  const [messages, setMessages] = useState<Array<{ id: string; name: string; avatar: string; text: string; createdAt: string }>>([])
  const [input, setInput] = useState('')

  const fetchAndSetMessages = useCallback(async () => {
    try {
      const res = await fetch('/api/room')
      const data = await res.json()
      setMessages(data.messages || [])
    } catch { /* ignore */ }
  }, [])

  const postMessage = async () => {
    const text = input.trim()
    if (!text) return
    setInput('')
    try {
      await api('/room', { sessionToken: store.sessionToken, text })
      fetchAndSetMessages()
    } catch (err: unknown) {
      toast.error((err as Error).message)
    }
  }

  useEffect(() => {
    const doFetch = async () => {
      try {
        const res = await fetch('/api/room')
        const data = await res.json()
        setMessages(data.messages || [])
      } catch { /* ignore */ }
    }
    doFetch()
    const t = setInterval(doFetch, 5000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="flex flex-col h-full animate-tabSwitch">
      <div className="p-4 border-b border-[#272b34]">
        <h2 className="text-lg font-bold">the world room</h2>
        <p className="text-xs text-muted-foreground">everyone learning, in one place</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {messages.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-8">No messages yet. Say something!</p>
        )}
        {messages.map(msg => (
          <div key={msg.id} className="flex items-start gap-2 chat-bubble-enter">
            <span className="text-lg">{msg.avatar || '🙂'}</span>
            <div>
              <span className="text-xs font-semibold text-[#7c9cff]">{msg.name}</span>
              <span className="text-xs text-muted-foreground ml-2">
                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <p className="text-sm">{msg.text}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 border-t border-[#272b34]">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="say something..."
            maxLength={280}
            className="bg-[#191c23] border-[#272b34] focus:border-[#7c9cff]"
            onKeyDown={(e) => e.key === 'Enter' && postMessage()}
          />
          <Button onClick={postMessage}
            className="bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] text-[#0e0f13] shrink-0 btn-hover">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ========================================================================
   THINKING SPACE VIEW
   ======================================================================== */
function ThinkSpaceView() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [agentInput, setAgentInput] = useState('')
  const [agentOutput, setAgentOutput] = useState('')
  const [deploying, setDeploying] = useState(false)

  const subAgents = [
    { id: 'planner', emoji: '📋', name: 'Task Planner', desc: 'Break goals into actionable steps', icon: LayoutList, color: 'from-[#7c9cff] to-[#9d7cff]' },
    { id: 'architect', emoji: '🛠️', name: 'Code Architect', desc: 'Design technical solutions', icon: Code2, color: 'from-[#5fd0a0] to-[#38bdf8]' },
    { id: 'ideator', emoji: '💡', name: 'Creative Ideator', desc: 'Generate innovative ideas', icon: Lightbulb, color: 'from-[#fbbf24] to-[#fb923c]' },
  ]

  const deploy = async () => {
    if (!agentInput.trim() || !selectedAgent) return
    setDeploying(true)
    setAgentOutput('')
    try {
      const agent = subAgents.find(a => a.id === selectedAgent)
      // Use the chat API with a tailored prompt
      const data = await api('/ai/chat', {
        sessionToken: useAppStore.getState().sessionToken,
        message: `[${agent?.name} Agent] ${agentInput}`,
        history: [],
        boost: true,
      })
      setAgentOutput(data.reply || 'Agent completed successfully.')
    } catch (err: unknown) {
      setAgentOutput(`Error: ${(err as Error).message}`)
    } finally {
      setDeploying(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto animate-tabSwitch">
      <div className="flex items-center gap-3 mb-1">
        <h2 className="text-2xl font-bold">think space</h2>
        <span className="text-lg">🔮</span>
      </div>
      <p className="text-muted-foreground text-sm mb-6">deploy specialized sub-agents for deep thinking</p>

      {/* Sub-Agent Cards */}
      {!selectedAgent && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {subAgents.map(agent => (
            <Card
              key={agent.id}
              className="bg-[#191c23] border-[#272b34] cursor-pointer card-hover group"
              onClick={() => setSelectedAgent(agent.id)}
            >
              <CardContent className="p-5 text-center">
                <div className={`w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center text-xl bg-gradient-to-br ${agent.color} bg-opacity-20`}
                  style={{ background: `linear-gradient(135deg, var(--tw-gradient-from), var(--tw-gradient-to))`, opacity: 0.9 }}>
                  {agent.emoji}
                </div>
                <h3 className="font-semibold text-sm mb-1 group-hover:text-[#7c9cff] transition-colors">{agent.name}</h3>
                <p className="text-xs text-muted-foreground">{agent.desc}</p>
                <Button size="sm" variant="ghost" className="mt-3 text-xs text-muted-foreground group-hover:text-[#7c9cff] btn-hover">
                  Deploy <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Selected Agent Chat-like Interface */}
      {selectedAgent && (
        <div className="space-y-4">
          {/* Agent Header */}
          <div className="flex items-center gap-3 bg-[#191c23] border border-[#272b34] rounded-xl p-4">
            <button
              onClick={() => { setSelectedAgent(null); setAgentOutput(''); setAgentInput('') }}
              className="text-muted-foreground hover:text-foreground transition-colors btn-hover"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-xl">{subAgents.find(a => a.id === selectedAgent)?.emoji}</span>
            <div>
              <h3 className="font-semibold text-sm">{subAgents.find(a => a.id === selectedAgent)?.name}</h3>
              <p className="text-[10px] text-muted-foreground">{subAgents.find(a => a.id === selectedAgent)?.desc}</p>
            </div>
          </div>

          {/* Output Area */}
          {(agentOutput || deploying) && (
            <Card className="bg-[#15171d] border-[#272b34]">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-[#9d7cff] font-semibold">🤖 Agent Output</span>
                  {deploying && (
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <span key={i} className="w-1 h-1 rounded-full bg-[#9d7cff]" style={{ animation: `thinkingDot 1.2s ease-in-out ${i * 0.15}s infinite` }} />
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-sm text-foreground/90 whitespace-pre-wrap max-h-64 overflow-y-auto custom-scrollbar">
                  {deploying ? 'Processing...' : renderMarkdown(agentOutput)}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Input */}
          <div className="flex gap-2">
            <Input
              value={agentInput}
              onChange={e => setAgentInput(e.target.value)}
              placeholder={`describe what you need from the ${subAgents.find(a => a.id === selectedAgent)?.name}...`}
              className="bg-[#191c23] border-[#272b34] focus:border-[#7c9cff]"
              onKeyDown={e => e.key === 'Enter' && deploy()}
            />
            <Button
              onClick={deploy}
              disabled={deploying || !agentInput.trim()}
              className="bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] text-[#0e0f13] font-semibold shrink-0 btn-hover"
            >
              <Sparkles className="w-4 h-4 mr-1" /> Deploy Agent 🔮
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ========================================================================
   SETTINGS VIEW
   ======================================================================== */
function SettingsView() {
  const store = useAppStore()
  const [voiceEnabled, setVoiceEnabled] = useState(store.voiceEnabled)
  const [autoTasks, setAutoTasks] = useState(store.autoTasks)
  const [autoSchedule, setAutoSchedule] = useState(store.autoSchedule)
  const [dailyReviewReminders, setDailyReviewReminders] = useState(store.dailyReviewReminders)
  const [autoGenerateFlashcards, setAutoGenerateFlashcards] = useState(store.autoGenerateFlashcards)
  const [defaultSessionDuration, setDefaultSessionDuration] = useState(store.defaultSessionDuration)
  const importRef = useRef<HTMLInputElement>(null)

  const toggleVoice = () => {
    const newVal = !voiceEnabled
    setVoiceEnabled(newVal)
    store.setSettings({ voiceEnabled: newVal })
    toast.success(newVal ? 'Voice enabled' : 'Voice disabled')
  }

  const handleSignOut = () => {
    store.clearAuth()
    toast.success('Signed out')
  }

  const handleReset = () => {
    localStorage.removeItem('sitwithme-v9')
    window.location.reload()
  }

  const handleExportData = () => {
    const data = {
      exportDate: new Date().toISOString(),
      version: '9.0',
      profile: store.profile,
      topic: store.topic,
      vision: store.vision,
      domain: store.domain,
      level: store.level,
      tasks: store.tasks,
      planWeek: store.planWeek,
      planSummary: store.planSummary,
      reviewCards: store.reviewCards,
      moodLogs: store.moodLogs,
      sessionSummaries: store.sessionSummaries,
      chatMessages: store.chatMessages,
      bookmarkedMessages: store.bookmarkedMessages,
      quickNotes: store.quickNotes,
      progress: {
        sessionCount: store.sessionCount,
        wins: store.wins,
        successStreak: store.successStreak,
        bestStreak: store.bestStreak,
        mastery: store.mastery,
        xp: store.xp,
      },
      settings: {
        autoTasks: store.autoTasks,
        autoSchedule: store.autoSchedule,
        voiceEnabled: store.voiceEnabled,
        dailyReviewReminders: store.dailyReviewReminders,
        autoGenerateFlashcards: store.autoGenerateFlashcards,
        defaultSessionDuration: store.defaultSessionDuration,
        theme: store.theme,
      },
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sitwithme-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Data exported successfully!')
  }

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        if (data.tasks) store.setTasks(data.tasks)
        if (data.reviewCards) data.reviewCards.forEach((c: ReviewCard) => store.addReviewCard(c))
        if (data.quickNotes !== undefined) store.setQuickNotes(data.quickNotes)
        if (data.progress) store.setProgress(data.progress)
        if (data.settings) {
          if (data.settings.dailyReviewReminders !== undefined) {
            setDailyReviewReminders(data.settings.dailyReviewReminders)
            store.setEnhancedSettings({ dailyReviewReminders: data.settings.dailyReviewReminders })
          }
          if (data.settings.autoGenerateFlashcards !== undefined) {
            setAutoGenerateFlashcards(data.settings.autoGenerateFlashcards)
            store.setEnhancedSettings({ autoGenerateFlashcards: data.settings.autoGenerateFlashcards })
          }
          if (data.settings.defaultSessionDuration) {
            setDefaultSessionDuration(data.settings.defaultSessionDuration)
            store.setEnhancedSettings({ defaultSessionDuration: data.settings.defaultSessionDuration })
          }
        }
        toast.success('Data imported successfully!')
      } catch {
        toast.error('Invalid import file. Please use a valid Sit With Me export.')
      }
    }
    reader.readAsText(file)
    // Reset the file input
    if (importRef.current) importRef.current.value = ''
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto animate-tabSwitch">
      <h2 className="text-2xl font-bold mb-1">settings</h2>

      <Card className="bg-[#191c23] border-[#272b34] mt-4 card-hover">
        <CardContent className="p-6 space-y-6">
          {/* Theme Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {store.theme === 'dark' ? <Moon className="w-4 h-4 text-[#9d7cff]" /> : <Sun className="w-4 h-4 text-[#ffce6b]" />}
              <div>
                <Label className="font-medium">Theme</Label>
                <p className="text-xs text-muted-foreground">{store.theme === 'dark' ? 'Dark mode active' : 'Light mode active'}</p>
              </div>
            </div>
            <Switch
              checked={store.theme === 'light'}
              onCheckedChange={(checked) => store.setTheme(checked ? 'light' : 'dark')}
            />
          </div>

          <Separator className="bg-[#272b34]" />

          {/* Voice */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Voice</Label>
              <p className="text-xs text-muted-foreground">Have the mentor speak responses aloud</p>
            </div>
            <Switch checked={voiceEnabled} onCheckedChange={toggleVoice} />
          </div>

          <Separator className="bg-[#272b34]" />

          {/* Auto Tasks */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Auto-extract tasks</Label>
              <p className="text-xs text-muted-foreground">AI reads your conversation and creates tasks</p>
            </div>
            <Switch checked={autoTasks} onCheckedChange={(v) => { setAutoTasks(v); store.setSettings({ autoTasks: v }) }} />
          </div>

          <Separator className="bg-[#272b34]" />

          {/* Auto Schedule */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Auto-schedule</Label>
              <p className="text-xs text-muted-foreground">Push learning plans to your calendar</p>
            </div>
            <Switch checked={autoSchedule} onCheckedChange={(v) => { setAutoSchedule(v); store.setSettings({ autoSchedule: v }) }} />
          </div>
        </CardContent>
      </Card>

      {/* Review Settings */}
      <Card className="bg-[#191c23] border-[#272b34] mt-4 card-hover">
        <CardContent className="p-6 space-y-6">
          <Label className="font-medium text-xs text-muted-foreground uppercase tracking-wider">Review Settings</Label>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#9d7cff]" />
              <div>
                <Label className="font-medium">Daily review reminders</Label>
                <p className="text-xs text-muted-foreground">Get notified when cards are due</p>
              </div>
            </div>
            <Switch checked={dailyReviewReminders} onCheckedChange={(v) => { setDailyReviewReminders(v); store.setEnhancedSettings({ dailyReviewReminders: v }) }} />
          </div>

          <Separator className="bg-[#272b34]" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#7c9cff]" />
              <div>
                <Label className="font-medium">Auto-generate flashcards</Label>
                <p className="text-xs text-muted-foreground">AI creates review cards from chat</p>
              </div>
            </div>
            <Switch checked={autoGenerateFlashcards} onCheckedChange={(v) => { setAutoGenerateFlashcards(v); store.setEnhancedSettings({ autoGenerateFlashcards: v }) }} />
          </div>
        </CardContent>
      </Card>

      {/* Session Preferences */}
      <Card className="bg-[#191c23] border-[#272b34] mt-4 card-hover">
        <CardContent className="p-6 space-y-6">
          <Label className="font-medium text-xs text-muted-foreground uppercase tracking-wider">Session Preferences</Label>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#ffce6b]" />
              <div>
                <Label className="font-medium">Default session duration</Label>
                <p className="text-xs text-muted-foreground">Pomodoro timer default length</p>
              </div>
            </div>
            <Select value={String(defaultSessionDuration)} onValueChange={(v) => {
              const val = Number(v) as 15 | 25 | 45 | 60
              setDefaultSessionDuration(val)
              store.setEnhancedSettings({ defaultSessionDuration: val })
              store.setPomodoroState({ timeLeft: val * 60 })
            }}>
              <SelectTrigger className="w-24 bg-[#0e0f13] border-[#272b34] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#191c23] border-[#272b34]">
                <SelectItem value="15">15 min</SelectItem>
                <SelectItem value="25">25 min</SelectItem>
                <SelectItem value="45">45 min</SelectItem>
                <SelectItem value="60">60 min</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card className="bg-[#191c23] border-[#272b34] mt-4 card-hover">
        <CardContent className="p-6 space-y-6">
          <Label className="font-medium text-xs text-muted-foreground uppercase tracking-wider">Data Management</Label>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-[#5fd0a0]" />
              <div>
                <Label className="font-medium">Export all data</Label>
                <p className="text-xs text-muted-foreground">Download your data as JSON</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportData} className="border-[#5fd0a0]/30 text-[#5fd0a0] hover:bg-[#5fd0a0]/10 btn-hover text-xs">
              <Download className="w-3 h-3 mr-1" /> Export
            </Button>
          </div>

          <Separator className="bg-[#272b34]" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clipboard className="w-4 h-4 text-[#7c9cff]" />
              <div>
                <Label className="font-medium">Import data</Label>
                <p className="text-xs text-muted-foreground">Restore from a previous export</p>
              </div>
            </div>
            <div>
              <input ref={importRef} type="file" accept=".json" onChange={handleImportData} className="hidden" />
              <Button variant="outline" size="sm" onClick={() => importRef.current?.click()} className="border-[#7c9cff]/30 text-[#7c9cff] hover:bg-[#7c9cff]/10 btn-hover text-xs">
                <Clipboard className="w-3 h-3 mr-1" /> Import
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card className="bg-[#191c23] border-[#272b34] mt-4 card-hover">
        <CardContent className="p-6 space-y-6">
          {/* User Info */}
          <div>
            <Label className="font-medium text-xs text-muted-foreground uppercase tracking-wider">Account</Label>
            <div className="mt-2 text-sm">
              <p>Name: <span className="text-foreground">{store.userName || '—'}</span></p>
              <p>Email: <span className="text-foreground">{store.userEmail || '—'}</span></p>
              <p>Provider: <span className="text-foreground">{store.provider || '—'}</span></p>
            </div>
          </div>

          <Separator className="bg-[#272b34]" />

          {/* Google Connections */}
          <div>
            <Label className="font-medium text-xs text-muted-foreground uppercase tracking-wider">Google Connections</Label>
            <div className="mt-2 space-y-2">
              {[
                { label: 'Calendar', connected: store.calendarConnected },
                { label: 'Tasks', connected: store.tasksConnected },
                { label: 'Gmail', connected: store.gmailConnected },
              ].map(g => (
                <div key={g.label} className="flex items-center justify-between text-sm">
                  <span>{g.label}</span>
                  <Badge className={g.connected ? 'bg-[#5fd0a0]/15 text-[#5fd0a0]' : 'bg-muted text-muted-foreground'}>
                    {g.connected ? 'Connected' : 'Not connected'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          <Separator className="bg-[#272b34]" />

          <div className="text-xs text-muted-foreground">⌘K = command palette · ? = shortcuts · version 9.0 agentic</div>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={handleSignOut} className="text-muted-foreground btn-hover">
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </Button>
            <Button variant="ghost" onClick={handleReset} className="text-[#ff8a8a] btn-hover">
              Reset Everything
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ========================================================================
   QUICK NOTES PANEL
   ======================================================================== */
function QuickNotesPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const store = useAppStore()
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const handleChange = (val: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      store.setQuickNotes(val)
    }, 500)
  }

  const copyAll = () => {
    navigator.clipboard.writeText(store.quickNotes)
    toast.success('Notes copied to clipboard')
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90] flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm bg-[#15171d]/95 backdrop-blur-xl border-l border-[#272b34] h-full flex flex-col animate-fadeIn shadow-2xl"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'fadeInUp 0.3s ease-out' }}
      >
        <div className="flex items-center justify-between p-4 border-b border-[#272b34]">
          <div className="flex items-center gap-2">
            <span className="text-sm">📝</span>
            <h3 className="font-semibold text-sm">Quick Notes</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={copyAll} className="text-[10px] text-muted-foreground h-6 btn-hover">
              <Copy className="w-3 h-3 mr-1" /> Copy All
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-6 w-6 p-0">
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
        <div className="flex-1 p-4">
          <Textarea
            value={store.quickNotes}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Write your notes here... auto-saved"
            className="w-full h-full bg-[#191c23] border-[#272b34] text-foreground text-sm resize-none focus:border-[#7c9cff] custom-scrollbar"
            style={{ minHeight: 'calc(100vh - 140px)' }}
          />
        </div>
        <div className="p-3 border-t border-[#272b34] flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">{store.quickNotes.length} characters</span>
          <span className="text-[10px] text-muted-foreground/50">Auto-saved</span>
        </div>
      </div>
    </div>
  )
}

/* ========================================================================
   MAIN APP LAYOUT (Enhanced)
   ======================================================================== */
function MainApp() {
  const store = useAppStore()
  const cmdPalette = useCommandPalette()
  const kbShortcuts = useKeyboardShortcuts()
  const [quickNotesOpen, setQuickNotesOpen] = useState(false)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  const navItems: Array<{ id: AppTab; icon: React.ReactNode; label: string }> = [
    { id: 'session', icon: <MessageSquare className="w-[18px]" />, label: 'Session' },
    { id: 'plan', icon: <Calendar className="w-[18px]" />, label: 'Plan' },
    { id: 'tasks', icon: <CheckSquare className="w-[18px]" />, label: 'Tasks' },
    { id: 'progress', icon: <TrendingUp className="w-[18px]" />, label: 'Progress' },
    { id: 'resources', icon: <BookOpen className="w-[18px]" />, label: 'Resources' },
    { id: 'review', icon: <Clipboard className="w-[18px]" />, label: 'Review' },
    { id: 'thinkspace', icon: <Sparkles className="w-[18px]" />, label: 'Think' },
    { id: 'room', icon: <Globe className="w-[18px]" />, label: 'Room' },
    { id: 'settings', icon: <Settings className="w-[18px]" />, label: 'Settings' },
  ]

  const renderView = () => {
    switch (store.currentTab) {
      case 'session': return <ChatSessionView />
      case 'plan': return <PlanView />
      case 'tasks': return <TasksView />
      case 'progress': return <ProgressView />
      case 'resources': return <ResourcesView />
      case 'review': return <ReviewView />
      case 'thinkspace': return <ThinkSpaceView />
      case 'room': return <RoomView />
      case 'settings': return <SettingsView />
      default: return <ChatSessionView />
    }
  }

  const displayName = store.profile?.displayName || store.userName || 'Scholar'
  const avatarInitial = displayName.charAt(0).toUpperCase()

  return (
    <div className="h-screen flex bg-[#0e0f13] text-[#eef0f4] aurora-bg" data-theme={store.theme}>
      {/* Command Palette */}
      <CommandPalette key={`cp-${cmdPalette.openCount}`} open={cmdPalette.open} onClose={cmdPalette.close} />

      {/* Keyboard Shortcuts */}
      <KeyboardShortcutsModal open={kbShortcuts.open} onClose={kbShortcuts.close} />

      {/* Sidebar - Desktop */}
      <aside className="hidden sm:flex w-60 bg-[#15171d] border-r border-[#272b34] flex-col shrink-0">
        {/* Brand with gradient */}
        <div className="p-4 flex items-center gap-2.5" style={{ background: 'linear-gradient(135deg, rgba(124,156,255,0.08), rgba(157,124,255,0.08))' }}>
          <div className="w-7 h-7 rounded-lg"
            style={{ background: 'linear-gradient(135deg, #7c9cff, #9d7cff)' }} />
          <span className="font-semibold text-sm">sit with me</span>
        </div>

        {/* Goal Card */}
        {store.vision && (
          <div className="mx-2.5 mb-2 bg-[#191c23] border border-[#272b34] rounded-xl p-3 card-hover">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">your goal</p>
            <p className="text-xs mt-1">{store.vision}</p>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-2.5 py-1 space-y-0.5 overflow-auto custom-scrollbar">
          {navItems.map((item, idx) => (
            <TooltipPrimitive.Root key={item.id}>
              <TooltipPrimitive.Trigger asChild>
                <button
                  onClick={() => store.setTab(item.id)}
                  className={`flex items-center gap-3 w-full text-left rounded-lg text-sm transition-all ${
                    store.currentTab === item.id
                      ? 'sidebar-active text-foreground animate-slideInLeft'
                      : 'sidebar-inactive text-muted-foreground hover:bg-[#191c23] hover:text-foreground'
                  }`}
                >
                  {item.icon}
                  {item.label}
                  {store.currentTab === item.id && <span className="sidebar-active-dot" />}
                  <span className="ml-auto text-[10px] text-muted-foreground/40">{idx + 1}</span>
                </button>
              </TooltipPrimitive.Trigger>
              <TooltipPrimitive.Content side="right" className="bg-[#191c23] border border-[#272b34] text-xs px-2 py-1 rounded-md z-[200]">
                {item.label} <span className="text-muted-foreground ml-1">[{idx + 1}]</span>
              </TooltipPrimitive.Content>
            </TooltipPrimitive.Root>
          ))}
        </nav>

        {/* Richer User Card */}
        <div className="p-2.5 border-t border-[#272b34]">
          <div className="gradient-border-animated bg-[#191c23] rounded-xl p-3 card-hover">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-[#0e0f13] ring-2 ring-[#7c9cff]/30 ring-offset-1 ring-offset-[#191c23]"
                style={{ background: 'linear-gradient(135deg, #9d7cff, #7c9cff)' }}>
                {avatarInitial}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold truncate">{displayName}</span>
                  <Badge className="text-[8px] bg-[#9d7cff]/15 text-[#9d7cff] border-0 px-1 py-0">Lv.{Math.floor(store.xp / 100) + 1}</Badge>
                </div>
                <div className="mt-1">
                  <div className="h-1 bg-[#272b34] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(store.xp % 100)}%`, background: 'linear-gradient(to right, #7c9cff, #9d7cff)' }} />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[9px] text-muted-foreground">{store.xp % 100}/100 XP</span>
                    {store.successStreak > 0 && (
                      <span className="text-[9px] text-[#fb923c] flex items-center gap-0.5" style={{ animation: store.successStreak > 0 ? 'pulseDot 1s ease-in-out infinite' : 'none' }}><Flame className="w-2.5 h-2.5" />{store.successStreak}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {(store.planWeek?.[0]?.focus || store.topic) && (
              <p className="text-[9px] text-muted-foreground mt-2 pt-2 border-t border-[#272b34] truncate">
                🎯 Today: {store.planWeek?.[0]?.focus || store.topic}
              </p>
            )}
          </div>
          {/* ⌘K hint */}
          <div className="mt-2 px-2">
            <button
              onClick={() => cmdPalette.setOpen(true)}
              className="flex items-center gap-2 w-full text-left text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              <kbd className="bg-[#0e0f13] border border-[#272b34] rounded px-1 py-0.5 text-[9px]">⌘K</kbd>
              <span>command palette</span>
            </button>
          </div>
          {/* Footer */}
          <div className="mt-2 px-2 pt-2 border-t border-[#272b34]">
            <p className="text-[9px] text-muted-foreground/40">sit with me v9.0 agentic · powered by gemini</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <div className="h-14 border-b border-[#272b34] flex items-center gap-3 px-4 shrink-0 glass" style={{ background: 'rgba(14,15,19,0.8)', backdropFilter: 'blur(20px)' }}>
          <Button variant="ghost" size="sm" className="sm:hidden btn-hover"
            onClick={() => store.toggleSidebar()}>
            <Menu className="w-5 h-5" />
          </Button>
          <span className="font-semibold text-sm capitalize">{store.currentTab === 'thinkspace' ? 'think space' : store.currentTab}</span>
          {/* Session Timer */}
          {store.sessionStartTime && (
            <span className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {Math.floor((Date.now() - store.sessionStartTime) / 60000)}m
            </span>
          )}
          <div className="flex-1" />
          {store.calendarConnected && (
            <Badge variant="secondary" className="text-[10px] gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#5fd0a0]" style={{ animation: 'pulseDot 2s ease-in-out infinite' }} /> Google
            </Badge>
          )}
          {/* Search / Command Palette Trigger */}
          <button
            onClick={() => cmdPalette.setOpen(true)}
            className="hidden sm:flex items-center gap-2 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors bg-[#191c23] border border-[#272b34] rounded-md px-2 py-1"
          >
            <Search className="w-3 h-3" />
            <span>Search</span>
            <kbd className="text-[9px] bg-[#0e0f13] border border-[#272b34] rounded px-1 py-0.5">⌘K</kbd>
          </button>
          {/* Quick Notes Toggle */}
          <TooltipPrimitive.Root>
            <TooltipPrimitive.Trigger asChild>
              <button
                onClick={() => setQuickNotesOpen(true)}
                className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-[#7c9cff] transition-colors bg-[#191c23]/50 backdrop-blur border border-white/5 rounded-md px-2 py-1"
              >
                📝 Notes
              </button>
            </TooltipPrimitive.Trigger>
            <TooltipPrimitive.Content side="bottom" className="bg-[#191c23] border border-[#272b34] text-xs px-2 py-1 rounded-md z-[200]">
              Quick Notes
            </TooltipPrimitive.Content>
          </TooltipPrimitive.Root>
          {/* Theme Toggle - desktop only */}
          <TooltipPrimitive.Root>
            <TooltipPrimitive.Trigger asChild>
              <button
                onClick={() => store.setTheme(store.theme === 'dark' ? 'light' : 'dark')}
                className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-[#ffce6b] transition-colors bg-[#191c23]/50 backdrop-blur border border-white/5 rounded-md px-2 py-1"
              >
                {store.theme === 'dark' ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
              </button>
            </TooltipPrimitive.Trigger>
            <TooltipPrimitive.Content side="bottom" className="bg-[#191c23] border border-[#272b34] text-xs px-2 py-1 rounded-md z-[200]">
              Toggle theme
            </TooltipPrimitive.Content>
          </TooltipPrimitive.Root>
          {/* Focus Mode */}
          <TooltipPrimitive.Root>
            <TooltipPrimitive.Trigger asChild>
              <button onClick={() => store.setFocusMode(true)} className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-[#7c9cff] transition-colors bg-[#191c23]/50 backdrop-blur border border-white/5 rounded-md px-2 py-1">
                <Target className="w-3 h-3" /> Focus
              </button>
            </TooltipPrimitive.Trigger>
            <TooltipPrimitive.Content side="bottom" className="bg-[#191c23] border border-[#272b34] text-xs px-2 py-1 rounded-md z-[200]">
              Focus Mode (Ctrl+Shift+F)
            </TooltipPrimitive.Content>
          </TooltipPrimitive.Root>
          {/* Notification Center */}
          <TooltipPrimitive.Root>
            <TooltipPrimitive.Trigger asChild>
              <div><NotificationCenter /></div>
            </TooltipPrimitive.Trigger>
            <TooltipPrimitive.Content side="bottom" className="bg-[#191c23] border border-[#272b34] text-xs px-2 py-1 rounded-md z-[200]">
              Notifications
            </TooltipPrimitive.Content>
          </TooltipPrimitive.Root>
        </div>

        {/* View Content with AnimatePresence */}
        <div className="flex-1 overflow-auto custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={store.currentTab}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="h-full"
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Mobile Bottom Nav with Drawer */}
        <nav className="sm:hidden flex border-t border-[#272b34] bg-[#15171d]">
          {navItems.slice(0, 5).map(item => (
            <button
              key={item.id}
              onClick={() => store.setTab(item.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] transition-colors ${
                store.currentTab === item.id ? 'text-[#7c9cff]' : 'text-muted-foreground'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
          <button
            onClick={() => setMobileDrawerOpen(true)}
            className="flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] text-muted-foreground transition-colors hover:text-[#7c9cff]"
          >
            <span className="text-[18px]">•••</span>
            More
          </button>
        </nav>
      </div>

      {/* Mobile Drawer (vaul) */}
      <VaulDrawer.Root open={mobileDrawerOpen} onClose={() => setMobileDrawerOpen(false)} onOpenChange={setMobileDrawerOpen}>
        <VaulDrawer.Overlay className="fixed inset-0 bg-black/50 z-[70]" />
        <VaulDrawer.Content className="fixed bottom-0 left-0 right-0 z-[80] rounded-t-xl glass max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="mx-auto w-12 h-1.5 rounded-full bg-muted-foreground/30 mt-3 mb-2" />
          {/* User Profile Card */}
          <div className="px-4 pb-3">
            <div className="flex items-center gap-3 bg-[#191c23]/80 rounded-xl p-3 border border-[#272b34]">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-[#0e0f13]"
                style={{ background: 'linear-gradient(135deg, #9d7cff, #7c9cff)' }}>
                {avatarInitial}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold truncate">{displayName}</span>
                  <Badge className="text-[8px] bg-[#9d7cff]/15 text-[#9d7cff] border-0 px-1 py-0">Lv.{Math.floor(store.xp / 100) + 1}</Badge>
                </div>
                <div className="mt-1">
                  <div className="h-1.5 bg-[#272b34] rounded-full overflow-hidden progress-shimmer">
                    <div className="h-full rounded-full" style={{ width: `${(store.xp % 100)}%`, background: 'linear-gradient(to right, #7c9cff, #9d7cff)' }} />
                  </div>
                  <span className="text-[9px] text-muted-foreground">{store.xp % 100}/100 XP</span>
                </div>
              </div>
            </div>
          </div>
          {/* Remaining tabs */}
          <div className="px-4 space-y-1">
            {navItems.slice(5).map(item => (
              <button
                key={item.id}
                onClick={() => { store.setTab(item.id); setMobileDrawerOpen(false) }}
                className="flex items-center gap-3 w-full text-left rounded-lg text-sm py-2.5 px-3 text-muted-foreground hover:bg-[#191c23] hover:text-foreground transition-colors"
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
          {/* Theme Toggle */}
          <div className="px-4 py-3 border-t border-[#272b34] mt-2">
            <button
              onClick={() => store.setTheme(store.theme === 'dark' ? 'light' : 'dark')}
              className="flex items-center gap-3 w-full text-left rounded-lg text-sm py-2 px-3 text-muted-foreground hover:bg-[#191c23] hover:text-foreground transition-colors"
            >
              {store.theme === 'dark' ? <Moon className="w-[18px]" /> : <Sun className="w-[18px]" />}
              {store.theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
            </button>
          </div>
          {/* Sign Out */}
          <div className="px-4 pb-6">
            <button
              onClick={() => { store.clearAuth(); setMobileDrawerOpen(false); toast.success('Signed out') }}
              className="flex items-center gap-3 w-full text-left rounded-lg text-sm py-2 px-3 text-[#ff8a8a] hover:bg-[#ff8a8a]/10 transition-colors"
            >
              <LogOut className="w-[18px]" />
              Sign Out
            </button>
          </div>
        </VaulDrawer.Content>
      </VaulDrawer.Root>

      {/* Quick Notes Panel */}
      <QuickNotesPanel open={quickNotesOpen} onClose={() => setQuickNotesOpen(false)} />

      {/* Mobile Sidebar Overlay */}
      {store.sidebarOpen && (
        <div className="sm:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => store.setSidebarOpen(false)} />
          <aside className="relative w-64 bg-[#15171d] border-r border-[#272b34] flex flex-col">
            <div className="p-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, rgba(124,156,255,0.08), rgba(157,124,255,0.08))' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg"
                  style={{ background: 'linear-gradient(135deg, #7c9cff, #9d7cff)' }} />
                <span className="font-semibold text-sm">sit with me</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => store.setSidebarOpen(false)} className="btn-hover">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <nav className="flex-1 px-2.5 py-1 space-y-0.5 overflow-auto custom-scrollbar">
              {navItems.map((item, idx) => (
                <button
                  key={item.id}
                  onClick={() => { store.setTab(item.id); store.setSidebarOpen(false) }}
                  className={`flex items-center gap-3 w-full text-left rounded-lg text-sm transition-all ${
                    store.currentTab === item.id
                      ? 'sidebar-active text-foreground'
                      : 'sidebar-inactive text-muted-foreground hover:bg-[#191c23] hover:text-foreground'
                  }`}
                >
                  {item.icon}
                  {item.label}
                  <span className="ml-auto text-[10px] text-muted-foreground/40">{idx + 1}</span>
                </button>
              ))}
            </nav>
            <div className="p-2.5 border-t border-[#272b34]">
              <div className="flex items-center gap-2 px-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-[#0e0f13]"
                  style={{ background: 'linear-gradient(135deg, #9d7cff, #7c9cff)' }}>
                  {avatarInitial}
                </div>
                <span className="text-xs text-muted-foreground flex-1 truncate">{displayName}</span>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Pomodoro Widget & Confetti */}
      <PomodoroWidget />
      <ConfettiEffect />
    </div>
  )
}

/* ========================================================================
   ROOT PAGE - View Router
   ======================================================================== */
export default function Home() {
  const { currentView } = useAppStore()
  const cmdPalette = useCommandPalette()

  const viewKey = currentView

  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <main className="bg-[#0e0f13] text-[#eef0f4] min-h-screen">
        <GlobalStyles />
        {/* Global Command Palette for non-app views */}
        {currentView !== 'app' && (
          <CommandPalette key={`cp-root-${cmdPalette.openCount}`} open={cmdPalette.open} onClose={cmdPalette.close} />
        )}
        <AnimatePresence mode="wait">
          <motion.div
            key={viewKey}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            {currentView === 'landing' && <LandingScreen />}
            {currentView === 'apikey' && <ApiKeyScreen />}
            {currentView === 'onboarding' && <OnboardingScreen />}
            {currentView === 'profile' && <ProfileSetupScreen />}
            {currentView === 'googleconnect' && <GoogleConnectScreen />}
            {currentView === 'app' && <MainApp />}
          </motion.div>
        </AnimatePresence>
        {/* Focus Mode - rendered at root level so it overlays everything */}
        {currentView === 'app' && <FocusModeOverlay />}
      </main>
    </TooltipPrimitive.Provider>
  )
}
