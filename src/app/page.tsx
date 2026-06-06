'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useAppStore, type AppView, type AppTab, type ChatMsg } from '@/lib/store'
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
  Zap, Star, Trophy, Flame, Eye, Mail, Check, X, Menu, Command
} from 'lucide-react'
import { toast } from 'sonner'

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
   ANIMATED ORB
   ======================================================================== */
function Orb({ speaking }: { speaking?: boolean }) {
  return (
    <div className="relative mx-auto mb-6">
      <div
        className={`w-20 h-20 rounded-full mx-auto ${speaking ? 'animate-pulse' : ''}`}
        style={{
          background: 'radial-gradient(circle at 35% 30%, #a9bdff, #7c9cff 45%, #9d7cff 100%)',
          boxShadow: speaking ? '0 0 40px rgba(124,156,255,0.5)' : '0 0 30px rgba(124,156,255,0.3)',
          animation: speaking ? 'glow 1.4s ease-in-out infinite' : 'glow 3s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 30px rgba(124,156,255,0.3); }
          50% { box-shadow: 0 0 50px rgba(124,156,255,0.5); }
        }
      `}</style>
    </div>
  )
}

/* ========================================================================
   LANDING / SIGN UP SCREEN
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden"
      style={{ background: 'radial-gradient(1200px 700px at 50% -10%, #1a1d27 0%, #0e0f13 60%)' }}>

      {/* Hero */}
      <div className="text-center max-w-2xl mx-auto mb-8">
        <Orb />
        <Badge className="mb-4 bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] text-[#0e0f13] font-bold text-xs px-4 py-1">
          v4.0 AGENTIC
        </Badge>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-4">
          sit with me
        </h1>
        <p className="text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">
          the teacher you always wished you had. an agentic AI mentor that sits next to you,
          plans your learning, and adapts to how you learn.
        </p>
      </div>

      {/* Feature Pills */}
      <div className="flex flex-wrap gap-2 justify-center mb-8">
        {['🧠 agentic AI mentor', '📅 calendar + tasks sync', '🖥 screen-aware', '🎙 voice support'].map((f) => (
          <span key={f} className="bg-[#191c23] border border-[#272b34] rounded-full px-3 py-1.5 text-xs text-muted-foreground">
            {f}
          </span>
        ))}
      </div>

      {/* Auth Card */}
      <Card className="w-full max-w-md bg-[#15171d] border-[#272b34] shadow-2xl">
        <CardContent className="p-6">
          {/* Tab Switcher */}
          <div className="flex gap-2 mb-6">
            <Button
              variant={authMode === 'signup' ? 'default' : 'ghost'}
              className={authMode === 'signup' ? 'flex-1 bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] text-[#0e0f13] font-semibold' : 'flex-1 text-muted-foreground'}
              onClick={() => setAuthMode('signup')}
            >
              <Sparkles className="w-4 h-4 mr-2" /> Create Account
            </Button>
            <Button
              variant={authMode === 'login' ? 'default' : 'ghost'}
              className={authMode === 'login' ? 'flex-1 bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] text-[#0e0f13] font-semibold' : 'flex-1 text-muted-foreground'}
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
                className="w-full bg-white text-gray-900 hover:bg-gray-100 font-semibold flex items-center justify-center gap-2 h-11"
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
                className="w-full bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] text-[#0e0f13] font-semibold h-11"
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
                className="w-full bg-white text-gray-900 hover:bg-gray-100 font-semibold flex items-center justify-center gap-2 h-11"
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
                className="w-full bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] text-[#0e0f13] font-semibold h-11"
              >
                {loading ? 'Resuming...' : 'Resume Saved Session'} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground mt-6 text-center max-w-sm">
        Free forever. Your learning progress is kept safe in your browser.
      </p>

      <p className="absolute bottom-4 text-[11px] text-muted-foreground">
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
      // Allow continuing anyway for demo purposes
    }
  }

  const skip = () => {
    toast.info('You can add your API key later in settings.')
    setView('onboarding')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: 'radial-gradient(1200px 700px at 50% -10%, #1a1d27 0%, #0e0f13 60%)' }}>
      <div className="w-full max-w-lg text-center">
        <Orb />
        <h2 className="text-2xl font-bold mb-2">one quick thing</h2>
        <p className="text-muted-foreground mb-6">
          to power your AI mentor, paste a free Gemini API key. You can skip this and add it later.
        </p>

        <Card className="bg-[#191c23] border-[#272b34] text-left">
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
              <Button variant="ghost" onClick={() => setView('landing')}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button onClick={testAndContinue} disabled={status === 'testing'}
                className="bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] text-[#0e0f13] font-semibold">
                {status === 'testing' ? 'Testing...' : 'Continue'} <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
              <Button variant="ghost" onClick={skip} className="text-muted-foreground text-sm">
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

  // Initial greeting
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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6"
      style={{ background: 'radial-gradient(1200px 700px at 50% -10%, #1a1d27 0%, #0e0f13 60%)' }}>
      <div className="w-full max-w-2xl">
        <Orb speaking={busy} />
        <h2 className="text-2xl font-bold text-center mb-4">let&apos;s discover your learning path</h2>

        {/* Chat Messages */}
        <div ref={chatRef}
          className="max-h-[45vh] overflow-y-auto space-y-3 mb-4 pr-2 scrollbar-thin">
          {onboardingMessages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : msg.role === 'system' ? 'justify-center' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
                  style={{ background: 'linear-gradient(135deg, #7c9cff, #9d7cff)' }}>
                  🧠
                </div>
              )}
              <div className={`max-w-[78%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-[#2c3450] text-foreground rounded-tr-sm'
                  : msg.role === 'system'
                    ? 'bg-transparent border border-dashed border-[#272b34] text-muted-foreground text-xs max-w-[90%]'
                    : 'bg-[#1d2129] text-foreground rounded-tl-sm'
              }`}>
                {msg.content}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm bg-[#1f232c] text-muted-foreground shrink-0">
                  🧑
                </div>
              )}
            </div>
          ))}
          {busy && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                style={{ background: 'linear-gradient(135deg, #7c9cff, #9d7cff)' }}>🧠</div>
              <div className="bg-[#1d2129] px-4 py-3 rounded-2xl rounded-tl-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
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
            className="bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] text-[#0e0f13] px-4 shrink-0">
            <Send className="w-4 h-4" />
          </Button>
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-4">
          <Button variant="ghost" onClick={() => setView('apikey')} className="text-muted-foreground">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          {store.topic && (
            <Button onClick={() => setView('profile')}
              className="bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] text-[#0e0f13] font-semibold">
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
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6"
      style={{ background: 'radial-gradient(1200px 700px at 50% -10%, #1a1d27 0%, #0e0f13 60%)' }}>
      <div className="w-full max-w-lg">
        <Orb />
        <h2 className="text-2xl font-bold text-center mb-2">almost done</h2>
        <p className="text-muted-foreground text-center mb-6">let&apos;s set up your profile.</p>

        <Card className="bg-[#191c23] border-[#272b34]">
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
          <Button variant="ghost" onClick={() => store.setView('onboarding')} className="text-muted-foreground">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <Button onClick={saveAndContinue} disabled={loading}
            className="bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] text-[#0e0f13] font-semibold">
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
  const [loading, setLoading] = useState(false)

  const connectGoogle = () => {
    toast.info('Google OAuth requires server-side configuration (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET). For now, you can simulate the connection.')
    // Simulate Google connection for demo
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
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6"
      style={{ background: 'radial-gradient(1200px 700px at 50% -10%, #1a1d27 0%, #0e0f13 60%)' }}>
      <div className="w-full max-w-lg">
        <Orb />
        <h2 className="text-2xl font-bold text-center mb-2">last step</h2>
        <p className="text-muted-foreground text-center mb-6">connect your google services so i can schedule your learning.</p>

        <div className="space-y-3">
          {googleServices.map((svc) => {
            const connected = store[svc.key]
            return (
              <Card key={svc.key} className={`bg-[#191c23] border-[#272b34] transition-colors ${connected ? 'border-[#5fd0a0] bg-[#5fd0a0]/5' : ''}`}>
                <CardContent className="p-4 flex items-center gap-4">
                  <span className="text-3xl shrink-0">{svc.icon}</span>
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm">{svc.name}</h4>
                    <p className="text-xs text-muted-foreground">{svc.desc}</p>
                  </div>
                  {connected ? (
                    <Badge className="bg-[#5fd0a0]/15 text-[#5fd0a0]">connected</Badge>
                  ) : (
                    <Button size="sm" variant="outline" className="border-[#272b34]"
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
          <Button variant="ghost" onClick={() => store.setView('profile')} className="text-muted-foreground">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <Button onClick={finish}
            className="bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] text-[#0e0f13] font-semibold">
            I&apos;m Ready to Learn <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ========================================================================
   CHAT SESSION VIEW
   ======================================================================== */
function ChatSessionView() {
  const store = useAppStore()
  const [input, setInput] = useState('')
  const chatRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [store.chatMessages])

  // Initial greeting
  useEffect(() => {
    if (store.chatMessages.length === 0) {
      store.addChatMessage({
        role: 'assistant',
        content: `welcome${store.userName ? ', ' + store.userName : ''}. your goal: ${store.vision || store.topic || 'learning'}.\n\nlet's start with one small thing. what part of this feels most confusing right now?`,
        timestamp: Date.now(),
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

      // Handle agentic actions
      if (data.actions?.includes('suggest-task')) {
        store.addChatMessage({
          role: 'system',
          content: '💡 Tip: You can create a task from this — check the Tasks tab!',
          timestamp: Date.now(),
        })
      }
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

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3 max-w-3xl mx-auto w-full">
        {store.chatMessages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : msg.role === 'system' ? 'justify-center' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
                style={{ background: 'linear-gradient(135deg, #7c9cff, #9d7cff)' }}>
                🧠
              </div>
            )}
            <div className={`max-w-[78%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-[#2c3450] text-foreground rounded-tr-sm'
                : msg.role === 'system'
                  ? 'bg-transparent border border-dashed border-[#272b34] text-muted-foreground text-xs max-w-[90%]'
                  : 'bg-[#1d2129] text-foreground rounded-tl-sm'
            }`}>
              {msg.content}
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm bg-[#1f232c] text-muted-foreground shrink-0">
                🧑
              </div>
            )}
          </div>
        ))}
        {store.chatBusy && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
              style={{ background: 'linear-gradient(135deg, #7c9cff, #9d7cff)' }}>🧠</div>
            <div className="bg-[#1d2129] px-4 py-3 rounded-2xl rounded-tl-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-[#272b34] p-4">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="type or use the mic..."
            className="flex-1 bg-[#191c23] border-[#272b34] text-foreground focus:border-[#7c9cff] resize-none min-h-[48px]"
            rows={1}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          />
          <Button onClick={send} disabled={store.chatBusy}
            className="bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] text-[#0e0f13] px-4 shrink-0">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ========================================================================
   PLAN VIEW
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
    } catch (err: unknown) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-1">your learning plan</h2>
      <p className="text-muted-foreground text-sm mb-6">
        AI builds a 7-day plan, pushes it to your calendar, and creates daily tasks.
      </p>

      {!plan && !loading && (
        <Card className="bg-[#191c23] border-[#272b34]">
          <CardContent className="p-8 text-center">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-[#7c9cff]" />
            <h3 className="font-semibold mb-2">No plan yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Generate a personalized 7-day learning plan</p>
            <Button onClick={generatePlan}
              className="bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] text-[#0e0f13] font-semibold">
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

      {plan && !loading && (
        <div className="space-y-4">
          {plan.summary && (
            <Card className="bg-[#191c23] border-[#272b34]">
              <CardContent className="p-4">
                <p className="font-semibold">{plan.summary}</p>
                {plan.adapts && <p className="text-sm text-muted-foreground mt-1">🎯 {plan.adapts}</p>}
              </CardContent>
            </Card>
          )}
          {plan.week?.map((day, i) => (
            <Card key={i} className="bg-[#191c23] border-[#272b34]">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold">{day.day} · {day.focus}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{day.firstStep}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">{day.minutes}m</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
          <div className="flex gap-3 justify-center pt-2">
            <Button onClick={generatePlan} variant="outline" className="border-[#272b34]">
              🔄 Regenerate
            </Button>
            <Button className="bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] text-[#0e0f13] font-semibold">
              📅 Push to Calendar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ========================================================================
   TASKS VIEW
   ======================================================================== */
function TasksView() {
  const store = useAppStore()
  const [newTask, setNewTask] = useState('')
  const [loading, setLoading] = useState(false)

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
      toast.success('Done ✓')
    } catch (err: unknown) {
      toast.error((err as Error).message)
    }
  }

  const loadTasks = useCallback(async () => {
    try {
      const data = await api('/tasks', { sessionToken: store.sessionToken })
      if (data.tasks) store.setTasks(data.tasks)
    } catch { /* ignore */ }
  }, [store.sessionToken]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadTasks() }, [loadTasks])

  const pending = store.tasks.filter(t => t.status === 'pending')
  const completed = store.tasks.filter(t => t.status === 'completed')

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-1">your tasks</h2>
      <p className="text-muted-foreground text-sm mb-6">learning tasks — check them off as you go.</p>

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
          className="bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] text-[#0e0f13] shrink-0">
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <div className="space-y-2 mb-6">
          <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Active Tasks</h3>
          {pending.map(task => (
            <Card key={task.id} className="bg-[#191c23] border-[#272b34]">
              <CardContent className="p-3 flex items-center gap-3">
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-[#5fd0a0]"
                  onClick={() => completeTask(task.id)}>
                  <Check className="w-4 h-4" />
                </Button>
                <div className="flex-1">
                  <p className="text-sm font-medium">{task.title}</p>
                  {task.notes && <p className="text-xs text-muted-foreground">{task.notes}</p>}
                </div>
                {task.due && <span className="text-xs text-muted-foreground">{task.due}</span>}
                <Badge variant="secondary" className="text-[10px]">{task.source}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Completed ({completed.length})</h3>
          {completed.slice(0, 10).map(task => (
            <Card key={task.id} className="bg-[#191c23] border-[#272b34] opacity-60">
              <CardContent className="p-3 flex items-center gap-3">
                <Check className="w-4 h-4 text-[#5fd0a0]" />
                <p className="text-sm line-through text-muted-foreground">{task.title}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pending.length === 0 && completed.length === 0 && (
        <Card className="bg-[#191c23] border-[#272b34]">
          <CardContent className="p-8 text-center">
            <CheckSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No tasks yet. Chat with your mentor and tasks will be auto-created, or generate a plan.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/* ========================================================================
   PROGRESS VIEW
   ======================================================================== */
function ProgressView() {
  const store = useAppStore()
  const totalSessions = store.sessionCount
  const wins = store.wins
  const streak = store.successStreak
  const bestStreak = store.bestStreak
  const completedTasks = store.tasks.filter(t => t.status === 'completed').length
  const pendingTasks = store.tasks.filter(t => t.status === 'pending').length
  const mastery = Math.min(100, Math.round(((wins * 3) + (completedTasks * 2) + (totalSessions * 1)) / Math.max(1, 10) * 100))

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-1">your progress</h2>
      <p className="text-muted-foreground text-sm mb-6">no percentages. just me, noticing you.</p>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { value: totalSessions, label: 'sessions', color: 'text-[#7c9cff]', icon: MessageSquare },
          { value: wins, label: 'wins', color: 'text-[#5fd0a0]', icon: Trophy },
          { value: `${streak}🔥`, label: 'streak', color: 'text-[#ffce6b]', icon: Flame },
          { value: `${mastery}%`, label: 'mastery', color: 'text-[#9d7cff]', icon: Star },
        ].map((stat, i) => (
          <Card key={i} className="bg-[#191c23] border-[#272b34]">
            <CardContent className="p-4 text-center">
              <stat.icon className={`w-5 h-5 mx-auto mb-2 ${stat.color}`} />
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Mastery Bar */}
      <Card className="bg-[#191c23] border-[#272b34] mb-4">
        <CardContent className="p-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>mastery bar</span><span>{mastery}%</span>
          </div>
          <Progress value={mastery} className="h-2" />
        </CardContent>
      </Card>

      {/* Tasks Progress */}
      <Card className="bg-[#191c23] border-[#272b34] mb-4">
        <CardContent className="p-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>tasks</span><span>{completedTasks} done · {pendingTasks} pending</span>
          </div>
          <Progress value={completedTasks + pendingTasks > 0 ? Math.round(completedTasks / (completedTasks + pendingTasks) * 100) : 0}
            className="h-2" />
        </CardContent>
      </Card>

      {/* Best Streak */}
      <Card className="bg-[#191c23] border-[#272b34]">
        <CardContent className="p-4">
          <p className="font-medium mb-2"><Flame className="w-4 h-4 inline mr-1 text-[#ffce6b]" />best streak: {bestStreak} 🔥</p>
          <p className="text-xs text-muted-foreground">
            topic: {store.topic || '—'} · goal: {store.vision || '—'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

/* ========================================================================
   ROOM VIEW
   ======================================================================== */
function RoomView() {
  const store = useAppStore()
  const [messages, setMessages] = useState<Array<{ id: string; name: string; avatar: string; text: string; createdAt: string }>>([])
  const [input, setInput] = useState('')

  const fetchMessages = useCallback(async () => {
    try {
      const data = await api('/room', { sessionToken: store.sessionToken })
      setMessages(data.messages || [])
    } catch { /* ignore */ }
  }, [store.sessionToken])

  const postMessage = async () => {
    const text = input.trim()
    if (!text) return
    setInput('')
    try {
      await api('/room', { sessionToken: store.sessionToken, text })
      fetchMessages()
    } catch (err: unknown) {
      toast.error((err as Error).message)
    }
  }

  useEffect(() => {
    fetchMessages()
    const t = setInterval(fetchMessages, 5000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.sessionToken])

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-[#272b34]">
        <h2 className="text-lg font-bold">the world room</h2>
        <p className="text-xs text-muted-foreground">everyone learning, in one place</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-8">No messages yet. Say something!</p>
        )}
        {messages.map(msg => (
          <div key={msg.id} className="flex items-start gap-2">
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
            className="bg-gradient-to-r from-[#7c9cff] to-[#9d7cff] text-[#0e0f13] shrink-0">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
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
    localStorage.removeItem('sitwithme-v4')
    window.location.reload()
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-1">settings</h2>

      <Card className="bg-[#191c23] border-[#272b34] mt-4">
        <CardContent className="p-6 space-y-6">
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

          <Separator className="bg-[#272b34]" />

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

          <div className="text-xs text-muted-foreground">⌘K = command palette · version 4.0 agentic</div>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={handleSignOut} className="text-muted-foreground">
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </Button>
            <Button variant="ghost" onClick={handleReset} className="text-[#ff8a8a]">
              Reset Everything
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ========================================================================
   MAIN APP LAYOUT
   ======================================================================== */
function MainApp() {
  const store = useAppStore()

  const navItems: Array<{ id: AppTab; icon: React.ReactNode; label: string }> = [
    { id: 'session', icon: <MessageSquare className="w-[18px]" />, label: 'Session' },
    { id: 'plan', icon: <Calendar className="w-[18px]" />, label: 'Plan' },
    { id: 'tasks', icon: <CheckSquare className="w-[18px]" />, label: 'Tasks' },
    { id: 'progress', icon: <TrendingUp className="w-[18px]" />, label: 'Progress' },
    { id: 'room', icon: <Globe className="w-[18px]" />, label: 'Room' },
    { id: 'settings', icon: <Settings className="w-[18px]" />, label: 'Settings' },
  ]

  const renderView = () => {
    switch (store.currentTab) {
      case 'session': return <ChatSessionView />
      case 'plan': return <PlanView />
      case 'tasks': return <TasksView />
      case 'progress': return <ProgressView />
      case 'room': return <RoomView />
      case 'settings': return <SettingsView />
      default: return <ChatSessionView />
    }
  }

  return (
    <div className="h-screen flex bg-[#0e0f13] text-[#eef0f4]">
      {/* Sidebar - Desktop */}
      <aside className="hidden sm:flex w-60 bg-[#15171d] border-r border-[#272b34] flex-col shrink-0">
        {/* Brand */}
        <div className="p-4 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg"
            style={{ background: 'linear-gradient(135deg, #7c9cff, #9d7cff)' }} />
          <span className="font-semibold text-sm">sit with me</span>
        </div>

        {/* Goal Card */}
        {store.vision && (
          <div className="mx-2.5 mb-2 bg-[#191c23] border border-[#272b34] rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">your goal</p>
            <p className="text-xs mt-1">{store.vision}</p>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-2.5 py-1 space-y-0.5 overflow-auto">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => store.setTab(item.id)}
              className={`flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                store.currentTab === item.id
                  ? 'bg-[#1f232c] text-foreground'
                  : 'text-muted-foreground hover:bg-[#191c23] hover:text-foreground'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* User Footer */}
        <div className="p-2.5 border-t border-[#272b34]">
          <div className="flex items-center gap-2 px-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
              style={{ background: 'linear-gradient(135deg, #9d7cff, #7c9cff)' }}>
              🧠
            </div>
            <span className="text-xs text-muted-foreground flex-1 truncate">{store.userName || 'Scholar'}</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <div className="h-14 border-b border-[#272b34] flex items-center gap-3 px-4 shrink-0">
          <Button variant="ghost" size="sm" className="sm:hidden"
            onClick={() => store.toggleSidebar()}>
            <Menu className="w-5 h-5" />
          </Button>
          <span className="font-semibold text-sm capitalize">{store.currentTab}</span>
          <div className="flex-1" />
          {store.calendarConnected && (
            <Badge variant="secondary" className="text-[10px] gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#5fd0a0]" /> Google
            </Badge>
          )}
        </div>

        {/* View Content */}
        <div className="flex-1 overflow-auto">
          {renderView()}
        </div>

        {/* Mobile Bottom Nav */}
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
        </nav>
      </div>

      {/* Mobile Sidebar Overlay */}
      {store.sidebarOpen && (
        <div className="sm:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => store.setSidebarOpen(false)} />
          <aside className="relative w-64 bg-[#15171d] border-r border-[#272b34] flex flex-col">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg"
                  style={{ background: 'linear-gradient(135deg, #7c9cff, #9d7cff)' }} />
                <span className="font-semibold text-sm">sit with me</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => store.setSidebarOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <nav className="flex-1 px-2.5 py-1 space-y-0.5">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => { store.setTab(item.id); store.setSidebarOpen(false) }}
                  className={`flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    store.currentTab === item.id
                      ? 'bg-[#1f232c] text-foreground'
                      : 'text-muted-foreground hover:bg-[#191c23] hover:text-foreground'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>
        </div>
      )}
    </div>
  )
}

/* ========================================================================
   ROOT PAGE - View Router
   ======================================================================== */
export default function Home() {
  const { currentView } = useAppStore()

  return (
    <main className="bg-[#0e0f13] text-[#eef0f4] min-h-screen">
      {currentView === 'landing' && <LandingScreen />}
      {currentView === 'apikey' && <ApiKeyScreen />}
      {currentView === 'onboarding' && <OnboardingScreen />}
      {currentView === 'profile' && <ProfileSetupScreen />}
      {currentView === 'googleconnect' && <GoogleConnectScreen />}
      {currentView === 'app' && <MainApp />}
    </main>
  )
}
