import React, { useState } from 'react';
import { UserProfile, UserSettings } from '../types';
import { xpForNextLevel } from '../services/gamification';
import {
  CharacterIllustration,
  CHARACTER_STAGES,
  CharacterStageId,
  getStageForLevel,
  useCharacterGender
} from '../components/CharacterAvatar';

interface Props {
  todayCorrect: number;
  dailyGoal: number;
  dueCount: number;
  newCount: number;
  learningCount: number;
  masteredCount: number;
  totalWordsCount: number;
  customWordsCount: number;
  profile: UserProfile;
  settings: UserSettings;
  isLearnCompletedToday?: boolean;
  isReviewCompletedToday?: boolean;
  onStartReview: () => void;
  onStartLearn: () => void;
  onStartSpeedRound: () => void;
  onStartPassaparola: () => void;
  onStartClozeTest: () => void;
  onStartYdsYokdil: () => void;
  onOpenSettings?: () => void;
}

export const HomeView: React.FC<Props> = ({
  todayCorrect,
  dailyGoal,
  dueCount,
  newCount,
  learningCount,
  masteredCount,
  totalWordsCount,
  customWordsCount,
  profile,
  settings,
  isLearnCompletedToday = false,
  isReviewCompletedToday = false,
  onStartReview,
  onStartLearn,
  onStartSpeedRound,
  onStartPassaparola,
  onStartClozeTest,
  onStartYdsYokdil,
  onOpenSettings
}) => {
  const [gender, setGender] = useCharacterGender();
  const currentStage = getStageForLevel(profile.level);
  const [previewStageId, setPreviewStageId] = useState<CharacterStageId | null>(null);

  const activeStage =
    previewStageId &&
    CHARACTER_STAGES.find(s => s.id === previewStageId && profile.level >= s.minLevel)
      ? CHARACTER_STAGES.find(s => s.id === previewStageId)!
      : currentStage;

  const nextLvlXp = xpForNextLevel(profile.level);
  const prevLvlXp = xpForNextLevel(profile.level - 1);
  const currentLvlProgress = Math.max(0, profile.xp - prevLvlXp);
  const currentLvlNeeded = Math.max(1, nextLvlXp - prevLvlXp);
  const lvlPct = Math.min(100, Math.round((currentLvlProgress / currentLvlNeeded) * 100));

  const handlePrimaryStart = () => {
    if (dueCount > 0 && !isReviewCompletedToday) {
      onStartReview();
    } else {
      onStartLearn();
    }
  };

  return (
    <div className="flex flex-col gap-5 select-none pb-6 text-[#111827] dark:text-white">
      {/* 1. LEVEL & CANDY-STRIPED XP CARD */}
      <div className="bg-white dark:bg-[#151C2C] rounded-[24px] p-4 shadow-[0_10px_30px_rgba(17,24,39,0.04)] border border-slate-100/80 dark:border-white/5 flex items-center gap-3.5">
        <div
          data-light-pill="true"
          className="w-12 h-12 rounded-[16px] bg-[#FFE45E] text-[#0F172A] font-black text-base flex items-center justify-center shrink-0 shadow-[0_6px_16px_rgba(255,228,94,0.45)]"
        >
          L{profile.level}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-extrabold text-[#111827] dark:text-white tracking-tight">
              {currentStage.title} • {masteredCount} Master
            </span>
            <span className="font-bold text-[#9CA3AF] tabular-nums">
              {currentLvlProgress} / {currentLvlNeeded} XP
            </span>
          </div>

          <div className="h-3 w-full bg-[#EDF2FF] dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#5B8DEF] striped-progress rounded-full transition-all duration-500"
              style={{ width: `${Math.max(12, lvlPct)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. TODAY'S CHALLENGE HERO WITH EVOLVING CHARACTER (BEBEK -> ÇOCUK -> ERGEN -> KULAKLIKLI -> KRAVATLI -> BOSS) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center space-x-2">
            <svg viewBox="0 0 24 24" className="w-5 h-5">
              <circle cx="12" cy="12" r="6" fill="#FFB703" />
              <path
                d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"
                stroke="#FB8500"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
            <h2 className="text-[17px] font-extrabold text-[#111827] dark:text-white tracking-tight">
              Günün Antrenmanı
            </h2>
          </div>

          {/* Gender Switcher Pill (Erkek / Kadın) */}
          <div className="inline-flex items-center bg-white dark:bg-[#151C2C] p-1 rounded-full border border-slate-200/80 dark:border-white/10 shadow-sm">
            <button
              type="button"
              onClick={() => setGender('male')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold transition-all ${
                gender === 'male'
                  ? 'bg-[#3B82F6] text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              👦 Erkek
            </button>
            <button
              type="button"
              onClick={() => setGender('female')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold transition-all ${
                gender === 'female'
                  ? 'bg-[#EC4899] text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              👧 Kadın
            </button>
          </div>
        </div>

        <div className="relative rounded-[30px] bg-gradient-to-br from-[#FF7875] via-[#FF5E5B] to-[#FF6B4A] p-5 text-white overflow-hidden shadow-[0_20px_40px_-12px_rgba(255,94,91,0.45)]">
          {/* Soft ambient glow circles */}
          <div className="pointer-events-none absolute -right-8 -top-10 w-44 h-44 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute right-10 -bottom-12 w-36 h-36 rounded-full bg-black/5" />

          <div className="relative z-10 flex items-center justify-between gap-2">
            <div className="max-w-[60%] space-y-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="inline-block bg-white/25 backdrop-blur-md text-white text-[10px] font-extrabold tracking-wider uppercase px-3 py-1 rounded-full">
                  {activeStage.title}
                </span>
                {previewStageId && previewStageId !== currentStage.id && (
                  <span
                    data-light-pill="true"
                    className="inline-block bg-[#FFE45E] text-[#0F172A] text-[9px] font-black uppercase px-2 py-0.5 rounded-full"
                  >
                    Önizleme (Sv.{activeStage.minLevel})
                  </span>
                )}
              </div>

              <h3 className="text-[22px] sm:text-[25px] font-extrabold leading-[1.12] tracking-tight text-white">
                Günlük Kelime
                <br />
                Macerası
              </h3>

              <p className="text-xs font-semibold text-white/90 pt-0.5">
                +{dailyGoal * 10} XP • {todayCorrect}/{dailyGoal} Hedef ({todayCorrect >= dailyGoal ? 'Tamamlandı!' : 'Devam Et'})
              </p>

              <div className="pt-1.5">
                <button
                  type="button"
                  onClick={handlePrimaryStart}
                  data-light-pill="true"
                  className="inline-flex items-center space-x-2 bg-white text-[#0F172A] font-extrabold text-xs px-5 py-2.5 rounded-full shadow-[0_8px_20px_rgba(0,0,0,0.16)] hover:scale-[1.02] transition-all"
                >
                  <span>Hemen Başla</span>
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-[#FF5E5B]">
                    <path d="M4 2.5v11l9-5.5-9-5.5z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Right: Evolving Character Full-Body 3D SVG */}
            <div
              onClick={handlePrimaryStart}
              className="w-32 h-36 shrink-0 flex items-center justify-center relative -mr-1 -mb-1 animate-float cursor-pointer"
            >
              <CharacterIllustration
                level={profile.level}
                gender={gender}
                stageOverride={activeStage.id}
                variant="full"
                className="w-full h-full drop-shadow-[0_12px_16px_rgba(120,20,20,0.28)]"
              />
            </div>
          </div>

          {/* 6-Stage Evolution Bar at Bottom of Hero Card (Locked stages stay secret!) */}
          <div className="relative z-10 mt-4 pt-3 border-t border-white/20">
            <div className="flex items-center justify-between text-[10px] font-bold text-white/90 mb-1.5">
              <span>Karakter Evrimi (Yeni seviyelerde kilidi açılır)</span>
              {previewStageId && previewStageId !== currentStage.id && (
                <button
                  type="button"
                  onClick={() => setPreviewStageId(null)}
                  className="underline font-extrabold text-white"
                >
                  Mevcut Aşamaya Dön
                </button>
              )}
            </div>
            <div className="grid grid-cols-6 gap-1">
              {[
                { id: 'baby' as CharacterStageId, label: 'Bebek', lvl: 1 },
                { id: 'child' as CharacterStageId, label: 'Çocuk', lvl: 8 },
                { id: 'teen' as CharacterStageId, label: 'Ergen', lvl: 18 },
                { id: 'headphones' as CharacterStageId, label: 'Genç', lvl: 25 },
                { id: 'tie_adult' as CharacterStageId, label: 'Yetişkin', lvl: 35 },
                { id: 'boss' as CharacterStageId, label: 'Uzman', lvl: 50 }
              ].map((st) => {
                const isUnlocked = profile.level >= st.lvl;
                const isCurrent = activeStage.id === st.id && isUnlocked;

                return (
                  <button
                    key={st.id}
                    type="button"
                    disabled={!isUnlocked}
                    onClick={() => {
                      if (!isUnlocked) return;
                      setPreviewStageId(st.id === currentStage.id ? null : st.id);
                    }}
                    title={
                      isUnlocked
                        ? `${st.label} (Seviye ${st.lvl})`
                        : `Gizli Evrim! Seviye ${st.lvl} olduğunda açılır.`
                    }
                    data-light-pill={isCurrent ? 'true' : undefined}
                    className={`py-1 px-1 rounded-xl text-[10px] font-extrabold transition-all flex flex-col items-center ${
                      isCurrent
                        ? 'bg-white text-[#0F172A] shadow-sm scale-[1.03]'
                        : isUnlocked
                        ? 'bg-white/25 text-white hover:bg-white/35 cursor-pointer'
                        : 'bg-black/25 text-white/60 cursor-not-allowed opacity-75'
                    }`}
                  >
                    <span className="truncate max-w-full">
                      {isUnlocked ? st.label : '🔒 ???'}
                    </span>
                    <span className="text-[8px] opacity-85">
                      Sv.{st.lvl}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 3. QUICK START SQUIRCLE CARDS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[17px] font-extrabold text-[#111827] dark:text-white tracking-tight">
            Hızlı Başlangıç
          </h2>
          {customWordsCount > 0 && (
            <span className="text-xs font-bold text-[#6C8EFF]">
              {customWordsCount} Özel Kelime
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {/* Card 1: Yeni Öğren */}
          <button
            onClick={onStartLearn}
            disabled={!isLearnCompletedToday && newCount === 0}
            className="rounded-[26px] bg-gradient-to-b from-[#6C8EFF] to-[#8FAFFF] p-4 flex flex-col items-center justify-between text-center text-white shadow-[0_14px_28px_-8px_rgba(108,142,255,0.5)] min-h-[138px] disabled:opacity-50"
          >
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mt-1">
              <svg viewBox="0 0 36 36" className="w-7 h-7">
                <path d="M6 9c0-1.7 1.3-3 3-3h7c1.1 0 2 .9 2 2v19c0-.6-.4-1-1-1H9c-1.7 0-3-1.3-3-3V9z" fill="#FFE45E" />
                <path d="M30 9c0-1.7-1.3-3-3-3h-7c-1.1 0-2 .9-2 2v19c0-.6.4-1 1-1h8c1.7 0 3-1.3 3-3V9z" fill="#FFD166" />
                <path d="M18 8v18" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="mt-3">
              <span className="text-[15px] font-extrabold block leading-tight">
                Yeni Öğren
              </span>
              <span className="text-[11px] font-semibold text-white/85 mt-0.5 block">
                {isLearnCompletedToday ? 'Tamamlandı' : `${newCount} Kelime`}
              </span>
            </div>
          </button>

          {/* Card 2: Günlük Tekrar */}
          <button
            onClick={onStartReview}
            disabled={!isReviewCompletedToday && dueCount === 0}
            className="rounded-[26px] bg-gradient-to-b from-[#FFC436] to-[#FF9209] p-4 flex flex-col items-center justify-between text-center text-white shadow-[0_14px_28px_-8px_rgba(255,146,9,0.48)] min-h-[138px] disabled:opacity-50"
          >
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mt-1">
              <svg viewBox="0 0 36 36" className="w-7 h-7">
                <path
                  d="M18 4C14 10 9 13.5 9 20.5C9 26.3 13 31 18 31C23 31 27 26.3 27 20.5C27 15.5 23.5 11.5 21.5 8.5C21 11.5 19.5 13 18 13C19.2 9.5 19.2 6.5 18 4Z"
                  fill="#FF5400"
                />
                <path
                  d="M18 16C15.8 19 14.2 20.8 14.2 23.8C14.2 26.8 15.9 28.8 18 28.8C20.1 28.8 21.8 26.8 21.8 23.8C21.8 21.2 20.2 19 18 16Z"
                  fill="#FFF3B0"
                />
              </svg>
            </div>
            <div className="mt-3">
              <span className="text-[15px] font-extrabold block leading-tight">
                Tekrar Et
              </span>
              <span className="text-[11px] font-semibold text-white/90 mt-0.5 block">
                {isReviewCompletedToday ? 'Tamamlandı' : `${dueCount} Bekleyen`}
              </span>
            </div>
          </button>

          {/* Card 3: 60s Hızlı Tur */}
          <button
            onClick={onStartSpeedRound}
            className="rounded-[26px] bg-gradient-to-b from-[#42E695] to-[#12B886] p-4 flex flex-col items-center justify-between text-center text-white shadow-[0_14px_28px_-8px_rgba(18,184,134,0.45)] min-h-[138px]"
          >
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mt-1">
              <svg viewBox="0 0 36 36" className="w-7 h-7">
                <path
                  d="M20 4L8 20h9l-2 12 13-16h-9l1-12z"
                  fill="#FFE45E"
                  stroke="#F59E0B"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="mt-3">
              <span className="text-[15px] font-extrabold block leading-tight">
                Hızlı Tur
              </span>
              <span className="text-[11px] font-semibold text-white/90 mt-0.5 block">
                Rekor: {profile.highScoreSpeedRound}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* 4. STACKED ILLUSTRATED MODE BARS */}
      <div className="bg-white dark:bg-[#151C2C] rounded-[30px] p-5 shadow-[0_12px_34px_rgba(17,24,39,0.05)] border border-slate-100/80 dark:border-white/5 space-y-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[18px] font-extrabold text-[#111827] dark:text-white tracking-tight">
              Özel Çalışma Modları
            </h2>
            <p className="text-xs font-medium text-[#6B7280] dark:text-slate-400 mt-0.5">
              Sana uygun sınav veya oyun modunu seç ({learningCount + masteredCount}/{totalWordsCount} kelime aktif)
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          <button
            onClick={onStartPassaparola}
            className="w-full rounded-[20px] bg-[#52C465] hover:bg-[#47B659] px-5 py-4 text-left text-white relative overflow-hidden flex items-center justify-between shadow-[0_8px_20px_-6px_rgba(82,196,101,0.45)]"
          >
            <div className="relative z-10">
              <span className="text-[16px] font-extrabold block leading-tight">
                Passaparola Çarkı
              </span>
              <span className="text-xs font-medium text-white/90 mt-0.5 block">
                120 Saniye • A&apos;dan Z&apos;ye Kelime Yarışı
              </span>
            </div>

            <svg viewBox="0 0 80 54" className="w-20 h-14 -mr-2 shrink-0 drop-shadow-sm">
              <rect x="12" y="10" width="28" height="28" rx="6" transform="rotate(-12 26 24)" fill="#FFE45E" />
              <circle cx="40" cy="22" r="6" fill="#FFE45E" />
              <rect x="38" y="14" width="28" height="28" rx="6" transform="rotate(8 52 28)" fill="#A8F0B4" />
              <circle cx="52" cy="14" r="6" fill="#A8F0B4" />
            </svg>
          </button>

          <button
            onClick={onStartClozeTest}
            className="w-full rounded-[20px] bg-[#5B9BFF] hover:bg-[#4B8DF2] px-5 py-4 text-left text-white relative overflow-hidden flex items-center justify-between shadow-[0_8px_20px_-6px_rgba(91,155,255,0.45)]"
          >
            <div className="relative z-10">
              <span className="text-[16px] font-extrabold block leading-tight">
                Cloze Test & Edatlar
              </span>
              <span className="text-xs font-medium text-white/90 mt-0.5 block">
                Cümle İçinde Boşluk Doldurma
              </span>
            </div>

            <svg viewBox="0 0 80 54" className="w-20 h-14 -mr-2 shrink-0 drop-shadow-sm">
              <g transform="rotate(-14 44 27)">
                <rect x="20" y="10" width="44" height="34" rx="5" fill="#7F1D1D" />
                <rect x="23" y="7" width="42" height="32" rx="4" fill="#F8FAFC" />
                <rect x="20" y="5" width="40" height="32" rx="5" fill="#BE123C" />
                <rect x="26" y="11" width="26" height="4" rx="2" fill="#FDA4AF" />
                <rect x="26" y="18" width="18" height="3" rx="1.5" fill="#FDA4AF" opacity="0.7" />
              </g>
            </svg>
          </button>

          <button
            onClick={onStartYdsYokdil}
            className="w-full rounded-[20px] bg-[#7C69EF] hover:bg-[#6D5AE0] px-5 py-4 text-left text-white relative overflow-hidden flex items-center justify-between shadow-[0_8px_20px_-6px_rgba(124,105,239,0.45)]"
          >
            <div className="relative z-10">
              <span className="text-[16px] font-extrabold block leading-tight">
                YDS & YÖKDİL Soruları
              </span>
              <span className="text-xs font-medium text-white/90 mt-0.5 block">
                Fen & Sosyal Çıkmış Sınav Soruları
              </span>
            </div>

            <svg viewBox="0 0 80 54" className="w-20 h-14 -mr-2 shrink-0 drop-shadow-sm">
              <ellipse cx="46" cy="40" rx="22" ry="8" fill="#6EE7B7" opacity="0.85" />
              <polygon points="44,8 74,21 44,34 14,21" fill="#312E81" />
              <path d="M26 26v11c0 4 8 7 18 7s18-3 18-7V26L44 34 26 26z" fill="#4338CA" />
              <path d="M66 23v14" stroke="#FBBF24" strokeWidth="3" strokeLinecap="round" />
              <circle cx="66" cy="38" r="3" fill="#FBBF24" />
            </svg>
          </button>

          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              data-light-pill="true"
              className="w-full rounded-[20px] bg-[#BBF7D0] hover:bg-[#86EFAC] px-5 py-3.5 text-left text-[#0F172A] flex items-center justify-between shadow-[0_8px_20px_-6px_rgba(74,222,128,0.35)] border border-emerald-300"
            >
              <div>
                <span className="text-[15px] font-extrabold block leading-tight text-[#0F172A]">
                  📚 Kategori Seçimi ({settings?.enabledCategories?.length || 0} Açık)
                </span>
                <span className="text-xs font-bold text-[#064E3B] mt-0.5 block">
                  YÖKDİL / YDS - AŞIRI ÖNEMLİ, YÖKDİL / YDS, Oxford 3000-5000
                </span>
              </div>
              <span className="px-3 py-1 rounded-full bg-[#0F172A] text-white text-xs font-black shrink-0">
                SEÇ ➔
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
