export interface WordExample {
  en: string;
  tr: string;
}

export interface Word {
  id: number;
  en: string;
  ipa?: string;
  tr: string;
  examples: WordExample[];
  categories: string[];
  isCustom?: boolean;
  createdAt?: number;
  reword?: {
    stage: number;
    lastSeen: number;
  };
}

export type WordStatus = 'new' | 'learning' | 'mastered';

export interface Progress {
  wordId: number;
  step: number;
  streakDays: number;
  dueDate: string; // YYYY-MM-DD
  lastReviewDate?: string; // YYYY-MM-DD
  status: WordStatus;
  lapses: number;
  totalCorrect: number;
  totalWrong: number;
  updatedAt: number;
}

export interface UserSettings {
  id: number; // 1
  dailyNewTarget: number;
  dailyReviewLimit: number;
  prioritizeCustomWords: boolean;
  enabledCategories: string[];
  surpriseMasteredCheck: boolean;
  soundEffects: boolean;
  vibration: boolean;
  speechSpeed: number;
  theme: 'dark' | 'light';
  lastBackupDate?: string;
  lastSurpriseCheckDate?: string;
}

export interface UserProfile {
  id: number; // 1
  xp: number;
  level: number;
  streak: number;
  lastActiveDate: string;
  unlockedBadges: string[];
  highScoreSpeedRound: number;
}

export interface DailyLog {
  date: string; // YYYY-MM-DD
  correctCount: number;
  wrongCount: number;
  newLearnedCount: number;
  reviewsDone: number;
  xpEarned: number;
}

export interface BadgeDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export interface BackupData {
  schema: number;
  appVersion: string;
  exportedAt: string;
  progress: Progress[];
  customWords: Word[];
  settings: Partial<UserSettings>;
  profile: Partial<UserProfile>;
  dailyLogs: DailyLog[];
}
