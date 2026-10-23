import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Flame,
  Volume2,
  Sparkles,
  Plus,
  Check,
  RefreshCw,
  HelpCircle,
  Eye,
  EyeOff,
  GraduationCap,
  FlaskConical,
  Globe2,
  Layers,
  Calendar,
  Award
} from 'lucide-react';
import { Word } from '../types';
import { sound } from '../services/audio';
import { speakEnglish } from '../services/speech';
import { fireCelebration, fireMicroSpark } from '../components/Confetti';
import { lookupWord } from '../services/dictionaryService';
import { getSentenceTranslation } from '../services/translationService';
import { YdsQuestion, loadYdsQuestions, getRandomYdsQuestions, getAvailableYears } from '../services/ydsService';

interface Props {
  allWords: Word[];
  onAddXp?: (amount: number) => Promise<void>;
  onAddCustomWord?: (word: Omit<Word, 'id'>, silent?: boolean) => Promise<void>;
  onClose: () => void;
}

type YdsCategory = 'fen' | 'sosyal' | 'all';
type RoundSize = 10 | 20 | 0;

const OPTION_KEYS: ('A' | 'B' | 'C' | 'D' | 'E')[] = ['A', 'B', 'C', 'D', 'E'];

interface ActiveWordPopup {
  word: string;
  rect: { top: number; left: number; width: number; height: number };
  translation?: string;
  ipa?: string;
  source?: 'local' | 'online';
  isLoading: boolean;
  isAdded: boolean;
  isAlreadyCustom: boolean;
}

export const YdsYokdilView: React.FC<Props> = ({
  allWords,
  onAddXp,
  onAddCustomWord,
  onClose
}) => {
  // Navigation & session state
  const [phase, setPhase] = useState<'select' | 'quiz' | 'summary'>('select');
  const [category, setCategory] = useState<YdsCategory>('fen');
  const [roundSize, setRoundSize] = useState<RoundSize>(10);
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');

  // Question dataset
  const [allQuestions, setAllQuestions] = useState<YdsQuestion[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [quizQuestions, setQuizQuestions] = useState<YdsQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Active question interaction
  const [selectedOption, setSelectedOption] = useState<'A' | 'B' | 'C' | 'D' | 'E' | null>(null);
  const [hasFeedback, setHasFeedback] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [promptTranslation, setPromptTranslation] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  // Floating Word Popup State (interactive vocabulary capture)
  const [activePopup, setActivePopup] = useState<ActiveWordPopup | null>(null);
  const activePopupRef = useRef<ActiveWordPopup | null>(null);
  activePopupRef.current = activePopup;
  const popupRef = useRef<HTMLDivElement | null>(null);

  // Scoring & Stats
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [earnedXp, setEarnedXp] = useState(0);
  const [missedQuestions, setMissedQuestions] = useState<{ q: YdsQuestion; selected: string }[]>([]);

  // Load question bank on mount
  useEffect(() => {
    let mounted = true;
    loadYdsQuestions()
      .then(data => {
        if (mounted) {
          setAllQuestions(data);
          setIsLoadingData(false);
        }
      })
      .catch(err => {
        console.error('Failed to load YÖKDİL questions:', err);
        if (mounted) setIsLoadingData(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const availableYears = useMemo(() => {
    return getAvailableYears(allQuestions);
  }, [allQuestions]);

  const currentQ: YdsQuestion | undefined = quizQuestions[currentIndex];

  // Trigger word lookup when clicked
  const handleWordTrigger = useCallback(
    async (rawWord: string, element: HTMLElement) => {
      const clean = rawWord.trim().replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
      if (!clean || clean.length < 1) return;

      if (activePopupRef.current && activePopupRef.current.word.toLowerCase() === clean.toLowerCase()) {
        setActivePopup(null);
        return;
      }

      const rect = element.getBoundingClientRect();
      const isAlreadyCustom = allWords.some(
        w =>
          (w.isCustom || w.categories?.includes('custom')) &&
          w.en.toLowerCase().trim() === clean.toLowerCase()
      );

      setActivePopup({
        word: clean,
        rect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height
        },
        isLoading: true,
        isAdded: false,
        isAlreadyCustom
      });

      try {
        let res = await lookupWord(clean, allWords, true);
        let tr = res?.tr;
        if (!tr || tr === 'Çeviri bulunamadı' || tr === 'Çeviri alınamadı') {
          // Direct fallback to Google Translate for resilient online translation
          try {
            const gUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=tr&dt=t&q=${encodeURIComponent(clean)}`;
            const gRes = await fetch(gUrl);
            if (gRes.ok) {
              const gData = await gRes.json();
              if (Array.isArray(gData) && Array.isArray(gData[0])) {
                const gText = gData[0]
                  .map((item: unknown) => (Array.isArray(item) ? item[0] : ''))
                  .filter(Boolean)
                  .join(' ')
                  .trim();
                if (gText) tr = gText;
              }
            }
          } catch {
            // fallback error handled below
          }
        }

        setActivePopup(prev => {
          if (!prev || prev.word !== clean) return prev;
          return {
            ...prev,
            isLoading: false,
            translation: tr || 'Çeviri bulunamadı',
            ipa: res?.ipa,
            source: res?.source
          };
        });
      } catch {
        setActivePopup(prev => {
          if (!prev || prev.word !== clean) return prev;
          return {
            ...prev,
            isLoading: false,
            translation: 'Çeviri alınamadı'
          };
        });
      }
    },
    [allWords]
  );

  // Add word to custom words list
  const handleAddWordToCustom = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!activePopup || !onAddCustomWord || activePopup.isAdded || activePopup.isAlreadyCustom) return;

    const currentSentenceClean = currentQ ? currentQ.prompt.replace(/\s+/g, ' ').trim() : undefined;

    const wordData: Omit<Word, 'id'> = {
      en: activePopup.word,
      tr:
        activePopup.translation &&
        activePopup.translation !== 'Çeviri bulunamadı' &&
        activePopup.translation !== 'Çeviri alınamadı'
          ? activePopup.translation
          : activePopup.word,
      ipa: activePopup.ipa,
      examples: currentSentenceClean
        ? [
            {
              en: currentSentenceClean,
              tr: promptTranslation || ''
            }
          ]
        : [],
      categories: ['custom', 'yds', currentQ?.category || 'fen'],
      isCustom: true
    };

    try {
      await onAddCustomWord(wordData, true);
      sound.playCorrect();
      fireMicroSpark(0.5, 0.4);
      setActivePopup(prev => (prev ? { ...prev, isAdded: true } : null));
    } catch (err) {
      console.error('Failed to add custom word:', err);
    }
  };

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('[data-interactive-word]')) {
        return;
      }
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setActivePopup(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActivePopup(null);
    };

    if (activePopup) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activePopup]);

  // Start test
  const handleStartQuiz = (cat: YdsCategory) => {
    setCategory(cat);
    const selected = getRandomYdsQuestions(allQuestions, cat, roundSize, selectedYear);
    if (selected.length === 0) {
      alert('Seçilen kriterlere uygun soru bulunamadı. Lütfen filtreleri kontrol edin.');
      return;
    }
    setQuizQuestions(selected);
    setCurrentIndex(0);
    setSelectedOption(null);
    setHasFeedback(false);
    setShowTranslation(false);
    setPromptTranslation(null);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setEarnedXp(0);
    setMissedQuestions([]);
    setActivePopup(null);
    setPhase('quiz');
  };

  // Answer selection handler
  const handleSelectOption = (key: 'A' | 'B' | 'C' | 'D' | 'E') => {
    if (hasFeedback || !currentQ) return;

    setSelectedOption(key);
    setHasFeedback(true);
    const isCorrect = key.toUpperCase() === currentQ.answer.toUpperCase();

    if (isCorrect) {
      sound.playCorrect();
      const newCombo = combo + 1;
      setCombo(newCombo);
      if (newCombo > maxCombo) setMaxCombo(newCombo);
      setScore(prev => prev + 1);

      const gainedXp = 10 + Math.min(newCombo * 2, 20);
      setEarnedXp(prev => prev + gainedXp);
      if (onAddXp) onAddXp(gainedXp);

      if (newCombo % 5 === 0) {
        fireCelebration();
      } else {
        fireMicroSpark(0.5, 0.4);
      }
    } else {
      sound.playWrong();
      setCombo(0);
      setMissedQuestions(prev => [...prev, { q: currentQ, selected: key }]);
    }
  };

  // Next question
  const handleNextQuestion = () => {
    setActivePopup(null);
    setSelectedOption(null);
    setHasFeedback(false);
    setShowTranslation(false);
    setPromptTranslation(null);

    if (currentIndex + 1 < quizQuestions.length) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // Completed round
      if (score > quizQuestions.length * 0.7) {
        fireCelebration();
      }
      setPhase('summary');
    }
  };

  // Toggle Turkish translation of prompt
  const handleToggleTranslation = async () => {
    if (!currentQ) return;
    if (showTranslation) {
      setShowTranslation(false);
      return;
    }

    setShowTranslation(true);
    if (!promptTranslation && !isTranslating) {
      setIsTranslating(true);
      try {
        const tr = await getSentenceTranslation(currentQ.prompt);
        setPromptTranslation(tr || 'Çeviri hazır değil');
      } catch {
        setPromptTranslation('Çeviri alınamadı');
      } finally {
        setIsTranslating(false);
      }
    }
  };

  // Render clickable words inside prompt or options
  const renderInteractiveText = (text: string) => {
    if (!text) return null;
    const parts = text.split(/([a-zA-Z0-9'-]+)/g);

    return parts.map((part, idx) => {
      const isWord = /[a-zA-Z0-9]/.test(part);
      if (!isWord) {
        return <span key={idx}>{part}</span>;
      }

      return (
        <span
          key={idx}
          data-interactive-word="true"
          onClick={e => {
            e.stopPropagation();
            handleWordTrigger(part, e.currentTarget);
          }}
          title="Tıklayarak anlamına bakın ve kelimelerinize kaydedin"
          className="cursor-pointer hover:bg-[#FFE600] hover:text-black rounded-none px-0.5 transition-colors select-none inline-block active:scale-95 border-b border-dashed border-black/40"
          style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
        >
          {part}
        </span>
      );
    });
  };

  // ----------------------------------------------------
  // RENDER: LOADING STATE
  // ----------------------------------------------------
  if (isLoadingData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center">
        <div className="w-12 h-12 border-4 border-black border-t-[#FFE600] rounded-full animate-spin shadow-[3px_3px_0px_0px_#000]" />
        <h3 className="text-sm font-black uppercase tracking-wider text-black">
          YÖKDİL / YDS Soru Havuzu Yükleniyor...
        </h3>
        <p className="text-xs text-zinc-600 font-bold max-w-xs">
          Fen ve Sosyal Bilimler çıkmış soruları hazırlanıyor.
        </p>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: SELECTION PHASE
  // ----------------------------------------------------
  if (phase === 'select') {
    const fenCount = allQuestions.filter(q => q.category === 'fen').length;
    const sosyalCount = allQuestions.filter(q => q.category === 'sosyal').length;

    return (
      <div className="flex flex-col min-h-[85vh] select-none text-black pb-8">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b-2 border-black">
          <button
            onClick={onClose}
            className="p-2 bg-white border-2 border-black font-black uppercase text-xs shadow-[2px_2px_0px_0px_#000] hover:bg-zinc-100 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
            title="Geri"
          >
            <ArrowLeft size={16} strokeWidth={2.5} />
          </button>
          <div className="flex items-center space-x-2 bg-[#FFE600] border-2 border-black px-3 py-1 shadow-[2px_2px_0px_0px_#000]">
            <GraduationCap size={16} strokeWidth={2.5} />
            <span className="text-xs font-black uppercase tracking-wider">YDS / YÖKDİL HAZIRLIK</span>
          </div>
          <div className="w-8" />
        </div>

        {/* Hero Card */}
        <div className="bg-white border-[3px] border-black p-4 mb-4 shadow-[4px_4px_0px_0px_#000]">
          <div className="flex items-center justify-between mb-2">
            <span className="bg-[#FFE600] border-2 border-black px-2 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-[1.5px_1.5px_0px_0px_#000]">
              ÇIKMIŞ ÖSYM SORULARI
            </span>
            <span className="text-xs font-mono font-black bg-black text-white px-2 py-0.5 border border-black">
              {allQuestions.length} SORU
            </span>
          </div>
          <h2 className="text-base font-black uppercase tracking-tight text-black">
            Fen & Sosyal Bilimler Testi
          </h2>
          <p className="text-xs font-bold text-zinc-700 mt-1">
            Soruları çözerken bilmediğin kelimelere tıkla, Türkçe anlamını anında gör ve kendi kelime listene ekle!
          </p>
        </div>

        {/* Category Selection Cards */}
        <div className="space-y-3 mb-4">
          <label className="text-[11px] font-black uppercase tracking-wider text-black block">
            1. Alanını Seç
          </label>

          {/* FEN BİLİMLERİ CARD */}
          <button
            onClick={() => handleStartQuiz('fen')}
            className="w-full bg-[#00F0FF] border-[3px] border-black p-4 text-left transition-all active:translate-x-[2px] active:translate-y-[2px] shadow-[4px_4px_0px_0px_#000] active:shadow-[1px_1px_0px_0px_#000] hover:bg-[#38f3ff] group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-white border-2 border-black shadow-[2px_2px_0px_0px_#000] flex items-center justify-center text-black">
                <FlaskConical size={20} strokeWidth={2.5} />
              </div>
              <span className="text-[11px] font-mono font-black px-2 py-0.5 bg-black text-white border border-black uppercase tracking-wider">
                {fenCount} SORU
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight text-black">
                  FEN BİLİMLERİ
                </h3>
                <p className="text-[11px] font-bold text-zinc-900 mt-0.5">
                  Fizik, Kimya, Biyoloji, Mühendislik, Tıp & Çevre
                </p>
              </div>
              <div className="w-8 h-8 bg-white border-2 border-black flex items-center justify-center shadow-[1.5px_1.5px_0px_0px_#000] group-hover:bg-[#FFE600] transition-colors">
                <span className="font-black text-sm">➔</span>
              </div>
            </div>
          </button>

          {/* SOSYAL BİLİMLER CARD */}
          <button
            onClick={() => handleStartQuiz('sosyal')}
            className="w-full bg-[#FF69B4] border-[3px] border-black p-4 text-left transition-all active:translate-x-[2px] active:translate-y-[2px] shadow-[4px_4px_0px_0px_#000] active:shadow-[1px_1px_0px_0px_#000] hover:bg-[#ff80c0] group text-black"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-white border-2 border-black shadow-[2px_2px_0px_0px_#000] flex items-center justify-center text-black">
                <Globe2 size={20} strokeWidth={2.5} />
              </div>
              <span className="text-[11px] font-mono font-black px-2 py-0.5 bg-black text-white border border-black uppercase tracking-wider">
                {sosyalCount} SORU
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight text-black">
                  SOSYAL BİLİMLER
                </h3>
                <p className="text-[11px] font-bold text-zinc-900 mt-0.5">
                  Tarih, Ekonomi, Psikoloji, Sosyoloji, Edebiyat
                </p>
              </div>
              <div className="w-8 h-8 bg-white border-2 border-black flex items-center justify-center shadow-[1.5px_1.5px_0px_0px_#000] group-hover:bg-[#FFE600] transition-colors">
                <span className="font-black text-sm">➔</span>
              </div>
            </div>
          </button>

          {/* KARMA / TÜMÜ CARD */}
          <button
            onClick={() => handleStartQuiz('all')}
            className="w-full bg-[#FFE600] border-[3px] border-black p-3.5 text-left transition-all active:translate-x-[2px] active:translate-y-[2px] shadow-[4px_4px_0px_0px_#000] active:shadow-[1px_1px_0px_0px_#000] hover:bg-[#ffea2e] group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-white border-2 border-black shadow-[1.5px_1.5px_0px_0px_#000] flex items-center justify-center text-black">
                  <Layers size={17} strokeWidth={2.5} />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-tight text-black">
                    KARMA (FEN + SOSYAL)
                  </h4>
                  <p className="text-[10px] font-bold text-zinc-800">
                    Tüm alanlardan karışık rastgele sorular
                  </p>
                </div>
              </div>
              <span className="font-black text-sm px-2 py-1 bg-white border border-black shadow-[1px_1px_0px_0px_#000]">
                Başla ➔
              </span>
            </div>
          </button>
        </div>

        {/* Filter & Preferences Controls */}
        <div className="bg-white border-[3px] border-black p-4 space-y-3.5 shadow-[4px_4px_0px_0px_#000]">
          {/* Round Size Options */}
          <div>
            <label className="text-[11px] font-black uppercase tracking-wider text-black block mb-1.5 flex items-center space-x-1">
              <span>Soru Sayısı:</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([10, 20, 0] as RoundSize[]).map(size => {
                const isSel = roundSize === size;
                return (
                  <button
                    key={size}
                    onClick={() => setRoundSize(size)}
                    className={`py-1.5 px-2 border-2 border-black text-xs font-black transition-all ${
                      isSel
                        ? 'bg-black text-[#FFE600] shadow-[2px_2px_0px_0px_#000]'
                        : 'bg-zinc-100 text-black hover:bg-zinc-200'
                    }`}
                  >
                    {size === 0 ? 'TÜMÜ' : `${size} SORU`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Year Filter */}
          <div>
            <label className="text-[11px] font-black uppercase tracking-wider text-black block mb-1.5 flex items-center space-x-1">
              <Calendar size={13} strokeWidth={2.5} />
              <span>Sınav Yılı Filtresi:</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setSelectedYear('all')}
                className={`py-1 px-2.5 border-2 border-black text-[11px] font-black uppercase transition-all ${
                  selectedYear === 'all'
                    ? 'bg-[#FFE600] text-black shadow-[1.5px_1.5px_0px_0px_#000]'
                    : 'bg-white text-zinc-700 hover:bg-zinc-100'
                }`}
              >
                TÜM YILLAR
              </button>
              {availableYears.map(yr => {
                const isSel = selectedYear === yr;
                return (
                  <button
                    key={yr}
                    onClick={() => setSelectedYear(yr)}
                    className={`py-1 px-2.5 border-2 border-black text-[11px] font-black font-mono transition-all ${
                      isSel
                        ? 'bg-[#FFE600] text-black shadow-[1.5px_1.5px_0px_0px_#000]'
                        : 'bg-white text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    {yr}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: SUMMARY PHASE
  // ----------------------------------------------------
  if (phase === 'summary') {
    const totalCount = quizQuestions.length;
    const accuracy = Math.round((score / Math.max(1, totalCount)) * 100);

    return (
      <div className="flex flex-col min-h-[85vh] select-none text-black pb-8">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b-2 border-black">
          <button
            onClick={() => setPhase('select')}
            className="p-2 bg-white border-2 border-black font-black uppercase text-xs shadow-[2px_2px_0px_0px_#000] hover:bg-zinc-100"
          >
            <ArrowLeft size={16} strokeWidth={2.5} />
          </button>
          <span className="text-xs font-black uppercase tracking-wider bg-white px-3 py-1 border-2 border-black shadow-[2px_2px_0px_0px_#000]">
            TEST SONUCU
          </span>
          <div className="w-8" />
        </div>

        {/* Score Card */}
        <div className="bg-white border-[3px] border-black p-5 mb-4 shadow-[5px_5px_0px_0px_#000] text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-[#FFE600] border-2 border-black shadow-[2px_2px_0px_0px_#000] mb-3">
            <Award size={30} strokeWidth={2.5} />
          </div>
          <h2 className="text-xl font-black uppercase tracking-tight text-black mb-1">
            {accuracy >= 70 ? 'TEBRİKLER! HARİKA İŞ!' : 'TEST TAMAMLANDI!'}
          </h2>
          <p className="text-xs font-bold text-zinc-600 mb-4">
            {category === 'fen' ? 'Fen Bilimleri' : category === 'sosyal' ? 'Sosyal Bilimler' : 'Karma'} Testi
          </p>

          <div className="grid grid-cols-3 gap-2 py-3 border-y-2 border-black mb-4">
            <div className="bg-zinc-50 p-2 border border-black">
              <span className="text-[10px] font-black uppercase text-zinc-500 block">DOĞRU</span>
              <span className="text-lg font-black font-mono text-[#16a34a]">{score}</span>
            </div>
            <div className="bg-zinc-50 p-2 border border-black">
              <span className="text-[10px] font-black uppercase text-zinc-500 block">YANLIŞ</span>
              <span className="text-lg font-black font-mono text-[#dc2626]">
                {totalCount - score}
              </span>
            </div>
            <div className="bg-zinc-50 p-2 border border-black">
              <span className="text-[10px] font-black uppercase text-zinc-500 block">BAŞARI</span>
              <span className="text-lg font-black font-mono text-black">%{accuracy}</span>
            </div>
          </div>

          <div className="flex items-center justify-center space-x-3 text-xs font-black">
            <div className="bg-[#FFE600] border-2 border-black px-3 py-1 shadow-[2px_2px_0px_0px_#000] flex items-center space-x-1">
              <Sparkles size={14} />
              <span>+{earnedXp} XP KAZANDIN</span>
            </div>
            {maxCombo > 1 && (
              <div className="bg-[#FB923C] border-2 border-black px-3 py-1 shadow-[2px_2px_0px_0px_#000] flex items-center space-x-1">
                <Flame size={14} />
                <span>MAX {maxCombo} COMBO</span>
              </div>
            )}
          </div>
        </div>

        {/* Missed Questions Review */}
        {missedQuestions.length > 0 && (
          <div className="bg-white border-[3px] border-black p-4 mb-4 shadow-[4px_4px_0px_0px_#000]">
            <h3 className="text-xs font-black uppercase tracking-wider text-black mb-3 flex items-center space-x-1.5">
              <XCircle size={15} className="text-red-500" strokeWidth={2.5} />
              <span>Yanlış Yapılan Sorular ({missedQuestions.length})</span>
            </h3>
            <p className="text-[11px] font-bold text-zinc-600 mb-3">
              Kelimelere tıklayarak Türkçe anlamına bakabilir ve sözlüğüne ekleyebilirsin:
            </p>
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {missedQuestions.map(({ q, selected }, idx) => (
                <div key={idx} className="bg-zinc-50 border-2 border-black p-3 text-xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono font-black text-[10px] bg-black text-[#FFE600] px-1.5 py-0.5 border border-black">
                      {q.shortExam} - Soru {q.questionNumber}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase">
                      {q.category === 'fen' ? 'Fen' : 'Sosyal'}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed mb-2 text-zinc-900">
                    {renderInteractiveText(q.prompt)}
                  </p>
                  <div className="flex items-center space-x-3 text-[11px] font-bold">
                    <span className="text-red-600">
                      Seçimin: <span className="font-black font-mono">({selected})</span>{' '}
                      {q.options[selected as 'A' | 'B' | 'C' | 'D' | 'E']}
                    </span>
                    <span className="text-emerald-700 font-black">
                      Doğru: <span className="font-mono">({q.answer})</span> {q.options[q.answer]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 mt-auto">
          <button
            onClick={() => handleStartQuiz(category)}
            className="py-3 px-4 bg-[#FFE600] border-[3px] border-black font-black uppercase text-xs tracking-wider shadow-[3px_3px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none flex items-center justify-center space-x-2"
          >
            <RefreshCw size={15} strokeWidth={2.5} />
            <span>YENİ TEST</span>
          </button>
          <button
            onClick={() => setPhase('select')}
            className="py-3 px-4 bg-white border-[3px] border-black font-black uppercase text-xs tracking-wider shadow-[3px_3px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
          >
            ALAN DEĞİŞTİR
          </button>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: ACTIVE QUIZ PHASE
  // ----------------------------------------------------
  if (!currentQ) {
    return null;
  }

  const progressPercent = Math.round(((currentIndex + 1) / quizQuestions.length) * 100);
  const isSelectedCorrect = selectedOption?.toUpperCase() === currentQ.answer.toUpperCase();

  return (
    <div className="flex flex-col min-h-[85vh] select-none text-black pb-6 relative">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-2 mb-2">
        <button
          onClick={() => setPhase('select')}
          className="p-2 bg-white border-2 border-black font-black uppercase text-xs shadow-[2px_2px_0px_0px_#000] hover:bg-zinc-100 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
          title="Çıkış"
        >
          <ArrowLeft size={16} strokeWidth={2.5} />
        </button>

        {/* Question Counter Pill */}
        <div className="flex items-center space-x-2 bg-white px-3 py-1 border-2 border-black shadow-[2px_2px_0px_0px_#000]">
          <span className="text-xs font-black text-black font-mono">
            {currentIndex + 1} / {quizQuestions.length}
          </span>
          <span className="text-black font-black">•</span>
          <span className="text-[11px] font-black uppercase text-black">
            {currentQ.category === 'fen' ? 'FEN' : 'SOSYAL'}
          </span>
        </div>

        {/* Combo flame */}
        <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-[#FFE600] border-2 border-black text-xs font-black text-black shadow-[2px_2px_0px_0px_#000]">
          <Flame size={14} className={combo > 1 ? 'fill-black animate-pulse' : 'text-black'} />
          <span>{combo}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-3 bg-white border-2 border-black overflow-hidden mb-3 shadow-[2px_2px_0px_0px_#000]">
        <div
          className="h-full bg-[#FFE600] border-r-2 border-black transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Main Question Card */}
      <div className="bg-white border-[3px] border-black p-4 sm:p-5 mb-4 shadow-[4px_4px_0px_0px_#000] relative">
        {/* Top-Right Exam & Year Badge (as user requested: "sağ üste seneleri yazabiliriz hangi seneden soru") */}
        <div className="flex items-center justify-between pb-2.5 mb-3 border-b-2 border-black">
          <div className="flex items-center space-x-1.5 text-[11px] font-black uppercase text-zinc-700">
            <HelpCircle size={13} strokeWidth={2.5} />
            <span>Soru {currentQ.questionNumber}</span>
          </div>

          {/* Exam Tag */}
          <div className="flex items-center space-x-1.5">
            <span className="px-2.5 py-0.5 bg-black text-[#FFE600] font-mono font-black text-xs border border-black shadow-[1.5px_1.5px_0px_0px_#000] uppercase tracking-wider">
              {currentQ.shortExam}
            </span>
            <span className="px-2 py-0.5 bg-zinc-100 text-black font-black text-[10px] uppercase border border-black">
              {currentQ.category === 'fen' ? 'FEN' : 'SOSYAL'}
            </span>
          </div>
        </div>

        {/* Interactive Question Prompt */}
        <div className="mb-3">
          <div className="text-[10px] font-black uppercase text-zinc-500 mb-1 tracking-wider">
            Sözcük anlamına bakmak için kelimelere tıkla:
          </div>
          <div className="text-sm sm:text-base font-bold leading-relaxed text-black">
            {renderInteractiveText(currentQ.prompt)}
          </div>
        </div>

        {/* Translation Toggle & View */}
        <div className="mt-2 pt-2 border-t border-dashed border-black/30">
          <button
            onClick={handleToggleTranslation}
            className="inline-flex items-center space-x-1.5 text-[11px] font-black uppercase text-zinc-700 hover:text-black py-1 px-2 bg-zinc-100 hover:bg-zinc-200 border border-black shadow-[1px_1px_0px_0px_#000] active:translate-x-[0.5px] active:translate-y-[0.5px]"
          >
            {showTranslation ? <EyeOff size={13} /> : <Eye size={13} />}
            <span>{showTranslation ? 'Türkçe Çeviriyi Gizle' : 'Türkçe Çeviriyi Gör'}</span>
          </button>

          {showTranslation && (
            <div className="mt-2 p-3 bg-zinc-100 dark:bg-zinc-800 border-2 border-black text-xs font-bold text-black dark:text-white leading-relaxed shadow-[2px_2px_0px_0px_#000]">
              {isTranslating ? (
                <span className="italic text-zinc-500 dark:text-zinc-400">Çevriliyor...</span>
              ) : (
                promptTranslation || 'Çeviri bulunamadı'
              )}
            </div>
          )}
        </div>
      </div>

      {/* 5 Options (A, B, C, D, E) */}
      <div className="space-y-2 mb-4">
        {OPTION_KEYS.map(key => {
          const optText = currentQ.options[key];
          if (!optText) return null;

          const isSelected = selectedOption === key;
          const isCorrectAnswer = currentQ.answer.toUpperCase() === key;

          let btnClass = 'bg-white hover:bg-zinc-50 text-black';
          let letterBg = 'bg-zinc-100 text-black';

          if (hasFeedback) {
            if (isCorrectAnswer) {
              btnClass = 'bg-[#BBF7D0] border-emerald-700 text-black shadow-[3px_3px_0px_0px_#15803d]';
              letterBg = 'bg-[#15803d] text-white';
            } else if (isSelected && !isSelectedCorrect) {
              btnClass = 'bg-[#FECDD3] border-red-700 text-black shadow-[3px_3px_0px_0px_#b91c1c]';
              letterBg = 'bg-[#b91c1c] text-white';
            } else {
              btnClass = 'bg-zinc-100/60 opacity-60 text-zinc-600';
            }
          }

          return (
            <button
              key={key}
              disabled={hasFeedback}
              onClick={() => handleSelectOption(key)}
              className={`w-full p-3 border-2 border-black text-left flex items-start space-x-3 transition-all duration-100 shadow-[3px_3px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] ${btnClass}`}
            >
              <div
                className={`w-7 h-7 shrink-0 border border-black flex items-center justify-center font-black font-mono text-xs shadow-[1px_1px_0px_0px_#000] ${letterBg}`}
              >
                {key}
              </div>
              <div className="flex-1 pt-0.5 text-xs sm:text-sm font-bold leading-normal">
                {hasFeedback ? (
                  <span>{optText}</span>
                ) : (
                  <span>{renderInteractiveText(optText)}</span>
                )}
              </div>
              {hasFeedback && isCorrectAnswer && (
                <CheckCircle2 size={18} className="text-emerald-700 shrink-0 mt-0.5" strokeWidth={2.5} />
              )}
              {hasFeedback && isSelected && !isSelectedCorrect && (
                <XCircle size={18} className="text-red-600 shrink-0 mt-0.5" strokeWidth={2.5} />
              )}
            </button>
          );
        })}
      </div>

      {/* Feedback Bar & Next Button */}
      {hasFeedback && (
        <div className="sticky bottom-2 z-30 mt-auto bg-white border-[3px] border-black p-3.5 shadow-[4px_4px_0px_0px_#000] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {isSelectedCorrect ? (
              <>
                <div className="w-8 h-8 bg-[#BBF7D0] border-2 border-black flex items-center justify-center text-emerald-800">
                  <CheckCircle2 size={18} strokeWidth={3} />
                </div>
                <div>
                  <span className="text-xs font-black uppercase text-emerald-800 block">DOĞRU CEVAP!</span>
                  <span className="text-[11px] font-bold text-zinc-600">+{10 + Math.min(combo * 2, 20)} XP</span>
                </div>
              </>
            ) : (
              <>
                <div className="w-8 h-8 bg-[#FECDD3] border-2 border-black flex items-center justify-center text-red-800">
                  <XCircle size={18} strokeWidth={3} />
                </div>
                <div>
                  <span className="text-xs font-black uppercase text-red-800 block">YANLIŞ CEVAP</span>
                  <span className="text-[11px] font-bold text-zinc-600">
                    Doğru Seçenek: <strong className="font-mono text-black">({currentQ.answer})</strong>
                  </span>
                </div>
              </>
            )}
          </div>

          <button
            onClick={handleNextQuestion}
            className="py-2.5 px-5 bg-[#FFE600] border-2 border-black font-black uppercase text-xs tracking-wider shadow-[2px_2px_0px_0px_#000] hover:bg-[#ffea2e] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
          >
            {currentIndex + 1 < quizQuestions.length ? 'SONRAKİ ➔' : 'SONUCU GÖR ➔'}
          </button>
        </div>
      )}

      {/* FLOATING WORD POPUP (Interactive vocabulary lookup & save) */}
      {activePopup && (
        <div
          ref={popupRef}
          className="fixed z-50 bg-white border-[3px] border-black p-3.5 shadow-[6px_6px_0px_0px_#000] w-72 max-w-[90vw] animate-in fade-in zoom-in-95 duration-150"
          style={{
            top: `${Math.min(Math.max(16, activePopup.rect.top - 120), window.innerHeight - 200)}px`,
            left: `${Math.min(Math.max(16, activePopup.rect.left - 40), window.innerWidth - 300)}px`
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-1.5 mb-2 border-b-2 border-black">
            <div className="flex items-center space-x-2 min-w-0">
              <span className="text-sm font-black text-black capitalize truncate">
                {activePopup.word}
              </span>
              {activePopup.ipa && (
                <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 font-bold">
                  /{activePopup.ipa.replace(/^\/+|\/+$/g, '')}/
                </span>
              )}
            </div>
            <button
              onClick={() => speakEnglish(activePopup.word)}
              className="p-1 bg-zinc-100 hover:bg-[#FFE600] border border-black text-black transition-colors"
              title="Telaffuz Dinle"
            >
              <Volume2 size={13} strokeWidth={2.5} />
            </button>
          </div>

          {/* Translation */}
          <div className="mb-3">
            {activePopup.isLoading ? (
              <div className="flex items-center space-x-1.5 text-xs text-black dark:text-white font-bold animate-pulse">
                <div className="w-3 h-3 border-2 border-black dark:border-white border-t-transparent rounded-full animate-spin shrink-0" />
                <span>Çevirisi yükleniyor...</span>
              </div>
            ) : (
              <p className="text-xs font-black text-black dark:text-white leading-snug">
                {activePopup.translation}
              </p>
            )}
          </div>

          {/* Action: Add to Custom Words */}
          {onAddCustomWord && (
            <button
              disabled={activePopup.isAdded || activePopup.isAlreadyCustom || activePopup.isLoading}
              onClick={handleAddWordToCustom}
              className={`w-full py-1.5 px-2 border-2 border-black text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all shadow-[2px_2px_0px_0px_#000] ${
                activePopup.isAdded || activePopup.isAlreadyCustom
                  ? 'bg-zinc-200 text-zinc-600 border-zinc-400 shadow-none cursor-default'
                  : 'bg-[#FFE600] hover:bg-[#ffea2e] text-black active:translate-x-[1px] active:translate-y-[1px]'
              }`}
            >
              {activePopup.isAdded ? (
                <>
                  <Check size={13} strokeWidth={3} />
                  <span>KELİMELERİME EKLENDİ</span>
                </>
              ) : activePopup.isAlreadyCustom ? (
                <>
                  <Check size={13} strokeWidth={3} />
                  <span>ZATEN LİSTEDE VAR</span>
                </>
              ) : (
                <>
                  <Plus size={13} strokeWidth={3} />
                  <span>KELİMELERİME EKLE</span>
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
