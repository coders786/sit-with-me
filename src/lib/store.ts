'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AppView = 'landing' | 'apikey' | 'onboarding' | 'profile' | 'googleconnect' | 'app'
export type AppTab = 'session' | 'plan' | 'tasks' | 'progress' | 'resources' | 'review' | 'room' | 'settings' | 'thinkspace'

export interface ChatMsg {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

export interface TaskItem {
  id: string
  title: string
  notes?: string
  due?: string
  priority?: 'high' | 'medium' | 'low'
  status: 'pending' | 'completed'
  source: 'local' | 'google' | 'ai-extracted'
}

export interface PlanDay {
  day: string
  focus: string
  minutes: number
  firstStep: string
  time: string
}

export interface UserProfile {
  displayName: string
  bio: string
  avatar: string
  goal: string
  isPublic: boolean
}

export interface Notification {
  id: string
  text: string
  time: number
  read: boolean
}

export interface LearningResource {
  id: string
  title: string
  type: 'video' | 'article' | 'interactive' | 'podcast'
  source: string
  difficulty: string
  url?: string
}

export interface BookmarkedMessage {
  id: string
  content: string
  timestamp: number
}

export interface PomodoroState {
  running: boolean
  timeLeft: number
  sessionsCompleted: number
  mode: 'work' | 'break'
}

export interface SessionSummary {
  id: string
  date: number
  summary: string
  keyPoints: string[]
  xp: number
}

export interface DailyChallenge {
  id: string
  title: string
  description: string
  xpReward: number
  completed: boolean
}

export interface ReviewCard {
  id: string
  front: string
  back: string
  interval: number
  nextReview: number
  easeFactor: number
  repetitions: number
}

export interface MoodLog {
  id: string
  mood: number // 1-5
  timestamp: number
}

export interface MessageReaction {
  messageId: string
  reaction: '👍' | '👎' | '💡' | '📌'
}

interface AppState {
  // Navigation
  currentView: AppView
  currentTab: AppTab
  sidebarOpen: boolean

  // Auth
  sessionToken: string | null
  userId: string | null
  userName: string | null
  userEmail: string | null
  userPicture: string | null
  provider: string | null

  // Learning Profile
  topic: string | null
  vision: string | null
  domain: string | null
  level: string | null
  minutesPerDay: string | null
  learningStyle: string | null
  whyNow: string | null
  obstacle: string | null

  // Progress
  sessionCount: number
  wins: number
  successStreak: number
  bestStreak: number
  mastery: number
  xp: number

  // Google
  googleToken: string | null
  googleEmail: string | null
  calendarConnected: boolean
  tasksConnected: boolean
  gmailConnected: boolean

  // Settings
  autoTasks: boolean
  autoSchedule: boolean
  voiceEnabled: boolean

  // Chat
  chatMessages: ChatMsg[]
  chatBusy: boolean

  // Onboarding
  onboardingMessages: ChatMsg[]
  onboardingDone: boolean

  // Tasks
  tasks: TaskItem[]

  // Plan
  planWeek: PlanDay[] | null
  planSummary: string | null

  // Profile
  profile: UserProfile | null

  // Notifications
  notifications: Notification[]

  // Plan Day Progress
  planDayProgress: Record<number, 'not-started' | 'in-progress' | 'completed'>

  // Task Filter
  taskFilter: 'all' | 'active' | 'completed'

  // Pomodoro
  pomodoroState: PomodoroState
  setPomodoroState: (state: Partial<PomodoroState>) => void

  // Learning Resources
  learningResources: LearningResource[]
  setLearningResources: (resources: LearningResource[]) => void

  // Bookmarks
  bookmarkedMessages: BookmarkedMessage[]
  addBookmark: (msg: BookmarkedMessage) => void
  removeBookmark: (id: string) => void

  // Confetti
  confettiActive: boolean
  triggerConfetti: () => void

  // Focus Mode
  focusMode: boolean
  setFocusMode: (mode: boolean) => void

  // Theme
  theme: 'dark' | 'light'
  setTheme: (theme: 'dark' | 'light') => void

  // Session Summaries
  sessionSummaries: SessionSummary[]
  addSessionSummary: (summary: SessionSummary) => void

  // Daily Challenge
  dailyChallenge: DailyChallenge | null
  setDailyChallenge: (challenge: DailyChallenge | null) => void
  completeDailyChallenge: () => void

  // Quick Notes
  quickNotes: string
  setQuickNotes: (notes: string) => void

  // Review Cards (Spaced Repetition)
  reviewCards: ReviewCard[]
  addReviewCard: (card: ReviewCard) => void
  updateReviewCard: (id: string, updates: Partial<ReviewCard>) => void
  removeReviewCard: (id: string) => void

  // Mood Tracker
  moodLogs: MoodLog[]
  addMoodLog: (mood: number) => void

  // Message Reactions
  messageReactions: MessageReaction[]
  addMessageReaction: (messageId: string, reaction: MessageReaction['reaction']) => void

  // Session Timer
  sessionStartTime: number | null
  setSessionStartTime: (time: number | null) => void

  // Actions
  setView: (view: AppView) => void
  setTab: (tab: AppTab) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void

  setAuth: (data: { sessionToken: string; userId: string; userName: string; userEmail: string; userPicture?: string; provider?: string }) => void
  clearAuth: () => void

  setLearningProfile: (data: Partial<{
    topic: string; vision: string; domain: string; level: string;
    minutesPerDay: string; learningStyle: string; whyNow: string; obstacle: string
  }>) => void

  setGoogle: (data: { googleToken: string; googleEmail: string }) => void
  setGoogleConnections: (data: { calendar?: boolean; tasks?: boolean; gmail?: boolean }) => void

  addChatMessage: (msg: ChatMsg) => void
  setChatBusy: (busy: boolean) => void
  clearChat: () => void

  addOnboardingMessage: (msg: ChatMsg) => void
  setOnboardingDone: (done: boolean) => void
  clearOnboarding: () => void

  addTask: (task: TaskItem) => void
  completeTask: (taskId: string) => void
  setTasks: (tasks: TaskItem[]) => void

  setPlan: (summary: string, week: PlanDay[]) => void

  setProfile: (profile: UserProfile) => void

  setProgress: (data: Partial<{
    sessionCount: number; wins: number; successStreak: number;
    bestStreak: number; mastery: number; xp: number
  }>) => void

  setSettings: (data: Partial<{
    autoTasks: boolean; autoSchedule: boolean; voiceEnabled: boolean
  }>) => void

  // Notification actions
  addNotification: (text: string) => void
  markNotificationsRead: () => void

  // Plan day progress actions
  setPlanDayProgress: (day: number, status: 'not-started' | 'in-progress' | 'completed') => void

  // Task filter actions
  setTaskFilter: (filter: 'all' | 'active' | 'completed') => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Navigation
      currentView: 'landing',
      currentTab: 'session',
      sidebarOpen: false,

      // Auth
      sessionToken: null,
      userId: null,
      userName: null,
      userEmail: null,
      userPicture: null,
      provider: null,

      // Learning Profile
      topic: null,
      vision: null,
      domain: null,
      level: null,
      minutesPerDay: null,
      learningStyle: null,
      whyNow: null,
      obstacle: null,

      // Progress
      sessionCount: 0,
      wins: 0,
      successStreak: 0,
      bestStreak: 0,
      mastery: 0.35,
      xp: 0,

      // Google
      googleToken: null,
      googleEmail: null,
      calendarConnected: false,
      tasksConnected: false,
      gmailConnected: false,

      // Settings
      autoTasks: true,
      autoSchedule: true,
      voiceEnabled: false,

      // Chat
      chatMessages: [],
      chatBusy: false,

      // Onboarding
      onboardingMessages: [],
      onboardingDone: false,

      // Tasks
      tasks: [],

      // Plan
      planWeek: null,
      planSummary: null,

      // Profile
      profile: null,

      // Notifications
      notifications: [],

      // Plan Day Progress
      planDayProgress: {},

      // Task Filter
      taskFilter: 'all' as const,

      // Pomodoro
      pomodoroState: { running: false, timeLeft: 25 * 60, sessionsCompleted: 0, mode: 'work' as const },
      setPomodoroState: (state) => set((s) => ({ pomodoroState: { ...s.pomodoroState, ...state } })),

      // Learning Resources
      learningResources: [],
      setLearningResources: (resources) => set({ learningResources: resources }),

      // Bookmarks
      bookmarkedMessages: [],
      addBookmark: (msg) => set((s) => ({
        bookmarkedMessages: s.bookmarkedMessages.some(b => b.id === msg.id) ? s.bookmarkedMessages : [...s.bookmarkedMessages, msg],
      })),
      removeBookmark: (id) => set((s) => ({
        bookmarkedMessages: s.bookmarkedMessages.filter(b => b.id !== id),
      })),

      // Confetti
      confettiActive: false,
      triggerConfetti: () => set({ confettiActive: true }),

      // Focus Mode
      focusMode: false,
      setFocusMode: (mode) => set({ focusMode: mode }),

      // Theme
      theme: 'dark' as const,
      setTheme: (theme) => set({ theme }),

      // Session Summaries
      sessionSummaries: [],
      addSessionSummary: (summary) => set((s) => ({
        sessionSummaries: [...s.sessionSummaries, summary].slice(-20),
      })),

      // Daily Challenge
      dailyChallenge: null,
      setDailyChallenge: (challenge) => set({ dailyChallenge: challenge }),
      completeDailyChallenge: () => set((s) => {
        if (!s.dailyChallenge) return {}
        return {
          dailyChallenge: { ...s.dailyChallenge, completed: true },
          xp: s.xp + s.dailyChallenge.xpReward,
        }
      }),

      // Quick Notes
      quickNotes: '',
      setQuickNotes: (notes) => set({ quickNotes: notes }),

      // Review Cards
      reviewCards: [],
      addReviewCard: (card) => set((s) => ({
        reviewCards: [...s.reviewCards, card],
      })),
      updateReviewCard: (id, updates) => set((s) => ({
        reviewCards: s.reviewCards.map(c => c.id === id ? { ...c, ...updates } : c),
      })),
      removeReviewCard: (id) => set((s) => ({
        reviewCards: s.reviewCards.filter(c => c.id !== id),
      })),

      // Mood Tracker
      moodLogs: [],
      addMoodLog: (mood) => set((s) => ({
        moodLogs: [...s.moodLogs, { id: Date.now().toString() + Math.random().toString(36).slice(2), mood, timestamp: Date.now() }].slice(-100),
      })),

      // Message Reactions
      messageReactions: [],
      addMessageReaction: (messageId, reaction) => set((s) => ({
        messageReactions: [
          ...s.messageReactions.filter(r => !(r.messageId === messageId && r.reaction === reaction)),
          { messageId, reaction },
        ].slice(-200),
      })),

      // Session Timer
      sessionStartTime: null,
      setSessionStartTime: (time) => set({ sessionStartTime: time }),

      // Actions
      setView: (view) => set({ currentView: view }),
      setTab: (tab) => set({ currentTab: tab }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      setAuth: (data) => set({
        sessionToken: data.sessionToken,
        userId: data.userId,
        userName: data.userName,
        userEmail: data.userEmail,
        userPicture: data.userPicture || null,
        provider: data.provider || 'guest',
      }),

      clearAuth: () => set({
        sessionToken: null, userId: null, userName: null, userEmail: null,
        userPicture: null, provider: null, topic: null, vision: null,
        domain: null, level: null, minutesPerDay: null, learningStyle: null,
        whyNow: null, obstacle: null, googleToken: null, googleEmail: null,
        calendarConnected: false, tasksConnected: false, gmailConnected: false,
        chatMessages: [], onboardingMessages: [], onboardingDone: false,
        tasks: [], planWeek: null, planSummary: null, profile: null,
        notifications: [], planDayProgress: {}, taskFilter: 'all' as const,
        pomodoroState: { running: false, timeLeft: 25 * 60, sessionsCompleted: 0, mode: 'work' as const },
        learningResources: [], bookmarkedMessages: [], focusMode: false,
        confettiActive: false, currentView: 'landing',
        sessionSummaries: [], dailyChallenge: null, quickNotes: '',
        reviewCards: [], moodLogs: [], messageReactions: [],
        sessionStartTime: null,
      }),

      setLearningProfile: (data) => set((s) => ({ ...s, ...data })),

      setGoogle: (data) => set({
        googleToken: data.googleToken,
        googleEmail: data.googleEmail,
        calendarConnected: true,
        tasksConnected: true,
        gmailConnected: true,
      }),

      setGoogleConnections: (data) => set((s) => ({
        calendarConnected: data.calendar ?? s.calendarConnected,
        tasksConnected: data.tasks ?? s.tasksConnected,
        gmailConnected: data.gmail ?? s.gmailConnected,
      })),

      addChatMessage: (msg) => set((s) => ({
        chatMessages: [...s.chatMessages, msg],
      })),
      setChatBusy: (busy) => set({ chatBusy: busy }),
      clearChat: () => set({ chatMessages: [] }),

      addOnboardingMessage: (msg) => set((s) => ({
        onboardingMessages: [...s.onboardingMessages, msg],
      })),
      setOnboardingDone: (done) => set({ onboardingDone: done }),
      clearOnboarding: () => set({ onboardingMessages: [], onboardingDone: false }),

      addTask: (task) => set((s) => ({
        tasks: [...s.tasks, task],
      })),
      completeTask: (taskId) => set((s) => ({
        tasks: s.tasks.map(t => t.id === taskId ? { ...t, status: 'completed' as const } : t),
        wins: s.wins + 1,
        successStreak: s.successStreak + 1,
        bestStreak: Math.max(s.bestStreak, s.successStreak + 1),
        xp: s.xp + 15,
      })),
      setTasks: (tasks) => set({ tasks }),

      setPlan: (summary, week) => set({ planSummary: summary, planWeek: week }),

      setProfile: (profile) => set({ profile }),

      setProgress: (data) => set((s) => ({ ...s, ...data })),

      setSettings: (data) => set((s) => ({ ...s, ...data })),

      // Notification actions
      addNotification: (text) => set((s) => ({
        notifications: [
          { id: Date.now().toString() + Math.random().toString(36).slice(2), text, time: Date.now(), read: false },
          ...s.notifications,
        ].slice(0, 10),
      })),
      markNotificationsRead: () => set((s) => ({
        notifications: s.notifications.map(n => ({ ...n, read: true })),
      })),

      // Plan day progress actions
      setPlanDayProgress: (day, status) => set((s) => ({
        planDayProgress: { ...s.planDayProgress, [day]: status },
      })),

      // Task filter actions
      setTaskFilter: (filter) => set({ taskFilter: filter }),
    }),
    {
      name: 'sitwithme-v9',
      partialize: (state) => ({
        sessionToken: state.sessionToken,
        userId: state.userId,
        userName: state.userName,
        userEmail: state.userEmail,
        userPicture: state.userPicture,
        provider: state.provider,
        topic: state.topic,
        vision: state.vision,
        domain: state.domain,
        level: state.level,
        minutesPerDay: state.minutesPerDay,
        learningStyle: state.learningStyle,
        whyNow: state.whyNow,
        obstacle: state.obstacle,
        sessionCount: state.sessionCount,
        wins: state.wins,
        successStreak: state.successStreak,
        bestStreak: state.bestStreak,
        mastery: state.mastery,
        xp: state.xp,
        googleToken: state.googleToken,
        googleEmail: state.googleEmail,
        calendarConnected: state.calendarConnected,
        tasksConnected: state.tasksConnected,
        gmailConnected: state.gmailConnected,
        autoTasks: state.autoTasks,
        autoSchedule: state.autoSchedule,
        voiceEnabled: state.voiceEnabled,
        onboardingDone: state.onboardingDone,
        currentView: state.currentView,
        currentTab: state.currentTab,
        profile: state.profile,
        planWeek: state.planWeek,
        planSummary: state.planSummary,
        notifications: state.notifications,
        planDayProgress: state.planDayProgress,
        taskFilter: state.taskFilter,
        tasks: state.tasks,
        pomodoroState: state.pomodoroState,
        learningResources: state.learningResources,
        bookmarkedMessages: state.bookmarkedMessages,
        focusMode: state.focusMode,
        theme: state.theme,
        sessionSummaries: state.sessionSummaries,
        dailyChallenge: state.dailyChallenge,
        quickNotes: state.quickNotes,
        reviewCards: state.reviewCards,
        moodLogs: state.moodLogs,
        messageReactions: state.messageReactions,
        sessionStartTime: state.sessionStartTime,
      }),
    }
  )
)
