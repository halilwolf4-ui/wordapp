import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Word, Progress } from '../types';
import {
  SecretWordPuzzle,
  SecretWordSessionManager
} from '../services/secretWordGenerator';
import { sound } from '../services/audio';
import { AudioButton } from '../components/AudioButton';
import { fireCelebration, fireMicroSpark } from '../components/Confetti';
import { checkTurkishAnswer } from '../utils/turkishMatcher';
import {
  ArrowLeft,
  Sparkles,
  HelpCircle,
  CheckCircle2,
  RotateCcw,
  KeyRound,
  Eye,
  ChevronRight
} from 'lucide-react';

interface Props {
  allWords: Word[];
  progressMap: Map<number, Progress>;
  onReviewAnswer?: (wordId: number, isCorrect: boolean, isPartial: boolean) => Promise<void>;
  onAddXp?: (amount: number) => Promise<void>;
  onClose: () => void;
}

export const SecretWordView: React.FC<Props> = ({
  allWords,
  progressMap,
  onReviewAnswer,
  onAddXp,
  onClose
}) => {
  // Session Manager (caches index and pre-generates next puzzle)
  const sessionManager = useMemo(() => {
    return new SecretWordSessionManager(allWords, progressMap);
  }, [allWords, progressMap]);

  const [puzzle, setPuzzle] = useState<SecretWordPuzzle>(() => sessionManager.getNextPuzzle());
  const [activeRowIdx, setActiveRowIdx] = useState<number>(0);
  const [solvedRowIds, setSolvedRowIds] = useState<Set<number>>(new Set());
  const [revealedRowIds, setRevealedRowIds] = useState<Set<number>>(new Set());
  const [rowRevealedLetterIndices, setRowRevealedLetterIndices] = useState<Map<number, Set<number>>>(new Map());
  const [rowInputs, setRowInputs] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [isGuessModalOpen, setIsGuessModalOpen] = useState<boolean>(false);
  const [guessInput, setGuessInput] = useState<string>('');
  const [puzzlesSolvedCount, setPuzzlesSolvedCount] = useState<number>(0);
  const [sessionXpEarned, setSessionXpEarned] = useState<number>(0);

  const inputRef = useRef<HTMLInputElement>(null);

  // Active row
  const activeRow = puzzle.rows[activeRowIdx];
  const isRowSolved = activeRow ? solvedRowIds.has(activeRow.rowId) || revealedRowIds.has(activeRow.rowId) : false;

  // Auto-focus input when active row changes or puzzle loads
  useEffect(() => {
    if (!isGameOver && inputRef.current) {
      inputRef.current.focus();
    }
  }, [activeRowIdx, puzzle, isGameOver]);

  // Load next puzzle
  const handleLoadNextPuzzle = useCallback(() => {
    const nextP = sessionManager.getNextPuzzle();
    setPuzzle(nextP);
    setActiveRowIdx(0);
    setSolvedRowIds(new Set());
    setRevealedRowIds(new Set());
    setRowRevealedLetterIndices(new Map());
    setRowInputs({});
    setFeedback(null);
    setIsGameOver(false);
    setIsGuessModalOpen(false);
    setGuessInput('');
  }, [sessionManager]);

  // Check row answer submission
  const handleSubmitRowAnswer = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeRow || isRowSolved) return;

    const inputVal = (rowInputs[activeRow.rowId] || '').trim();
    if (!inputVal) return;

    const isCorrect = checkTurkishAnswer(inputVal, activeRow.tr);

    if (isCorrect) {
      sound.playCorrect();
      fireMicroSpark();

      const newSolved = new Set(solvedRowIds);
      newSolved.add(activeRow.rowId);
      setSolvedRowIds(newSolved);

      // Award XP
      const rowXp = 15;
      if (onAddXp) {
        await onAddXp(rowXp);
      }
      setSessionXpEarned(prev => prev + rowXp);

      // SRS review update
      if (onReviewAnswer) {
        await onReviewAnswer(activeRow.wordId, true, false);
      }

      setFeedback({ type: 'success', message: `Harika! "${activeRow.tr.toUpperCase()}" doğru cevap.` });

      // Check if all rows are now completed
      if (newSolved.size + revealedRowIds.size >= puzzle.rows.length) {
        handleCompletePuzzle();
      } else {
        // Move to next unsolved row
        const nextUnsolved = puzzle.rows.findIndex(r => !newSolved.has(r.rowId) && !revealedRowIds.has(r.rowId));
        if (nextUnsolved !== -1) {
          setActiveRowIdx(nextUnsolved);
        }
      }
    } else {
      sound.playWrong();
      setFeedback({ type: 'error', message: 'Yanlış cevap. Tekrar dene veya ipucu kullan.' });
    }
  };

  // Puzzle finished celebration
  const handleCompletePuzzle = async () => {
    sound.playLevelUp();
    fireCelebration();
    setIsGameOver(true);
    setPuzzlesSolvedCount(prev => prev + 1);

    // Bonus XP for full puzzle completion
    const bonusXp = 30;
    if (onAddXp) {
      await onAddXp(bonusXp);
    }
    setSessionXpEarned(prev => prev + bonusXp);
  };

  // Give a hint for current active row (reveals one letter in the row, excluding the vertical spine)
  const handleHint = () => {
    if (!activeRow || isRowSolved) return;

    const currentRevealed = new Set(rowRevealedLetterIndices.get(activeRow.rowId) || []);
    // Find unrevealed indices strictly EXCLUDING the secret spine letter (colIndex)
    const unrevealed: number[] = [];
    for (let i = 0; i < activeRow.tr.length; i++) {
      if (i !== activeRow.colIndex && !currentRevealed.has(i)) {
        unrevealed.push(i);
      }
    }

    if (unrevealed.length > 0) {
      const pick = unrevealed[Math.floor(Math.random() * unrevealed.length)];
      currentRevealed.add(pick);

      const nextMap = new Map(rowRevealedLetterIndices);
      nextMap.set(activeRow.rowId, currentRevealed);
      setRowRevealedLetterIndices(nextMap);

      setFeedback({
        type: 'info',
        message: `İpucu: "${activeRow.tr[pick].toUpperCase()}" harfi açıldı.`
      });
    } else {
      setFeedback({
        type: 'info',
        message: 'Dikey ana harf gizli kalmalıdır; açılacak başka harf kalmadı.'
      });
    }
  };

  // Reveal row answer (Çözümü Göster)
  const handleRevealRow = async () => {
    if (!activeRow || isRowSolved) return;

    const newRevealed = new Set(revealedRowIds);
    newRevealed.add(activeRow.rowId);
    setRevealedRowIds(newRevealed);

    // Record SRS lapse
    if (onReviewAnswer) {
      await onReviewAnswer(activeRow.wordId, false, false);
    }

    setFeedback({
      type: 'info',
      message: `Doğru cevap gösterildi: "${activeRow.tr.toUpperCase()}".`
    });

    if (solvedRowIds.size + newRevealed.size >= puzzle.rows.length) {
      handleCompletePuzzle();
    } else {
      const nextUnsolved = puzzle.rows.findIndex(r => !solvedRowIds.has(r.rowId) && !newRevealed.has(r.rowId));
      if (nextUnsolved !== -1) {
        setActiveRowIdx(nextUnsolved);
      }
    }
  };

  // Direct guess for the English secret word
  const handleGuessSecretWord = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanGuess = guessInput.trim().toUpperCase();
    if (!cleanGuess) return;

    if (cleanGuess === puzzle.cleanTarget) {
      // Mark all remaining rows as solved
      const allSolved = new Set<number>();
      puzzle.rows.forEach(r => allSolved.add(r.rowId));
      setSolvedRowIds(allSolved);
      setIsGuessModalOpen(false);
      setFeedback({ type: 'success', message: 'Tebrikler! Gizli kelimeyi doğrudan bildin!' });
      handleCompletePuzzle();
    } else {
      sound.playWrong();
      setFeedback({ type: 'error', message: `"${cleanGuess}" gizli kelime değil. Tahminini kontrol et!` });
      setIsGuessModalOpen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#F8FAFC] dark:bg-[#0B0F17] flex flex-col overflow-y-auto select-none text-[#111827] dark:text-white">
      {/* Top Header */}
      <div className="sticky top-0 z-20 bg-white/95 dark:bg-[#151C2C]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-white/10 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all"
            aria-label="Kapat"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-base font-extrabold flex items-center gap-1.5 leading-tight">
              <KeyRound size={18} className="text-[#FFB703]" />
              <span>Gizli Kelime</span>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                {puzzle.cleanTarget.length} Harfli
              </span>
            </h1>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Satırları çöz, dikeydeki gizli İngilizce kelimeyi bul!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* User word ratio badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
            <Sparkles size={13} />
            <span>%{puzzle.userWordPercentage} Senin Kelimelerin</span>
          </div>

          <button
            onClick={() => setIsGuessModalOpen(true)}
            className="px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-extrabold text-xs shadow-md active:scale-95 flex items-center gap-1.5"
          >
            <KeyRound size={14} />
            <span className="hidden xs:inline">Kelimeyi</span> Tahmin Et
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 max-w-xl w-full mx-auto p-4 flex flex-col gap-4">
        {/* Mobile user-word percentage banner */}
        <div className="sm:hidden flex items-center justify-between px-3 py-1.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
          <span className="flex items-center gap-1.5">
            <Sparkles size={14} />
            <span>Kullanıcı Kelimeleri Oranı</span>
          </span>
          <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
            %{puzzle.userWordPercentage}
          </span>
        </div>

        {/* Puzzle Crossword Grid */}
        <div className="bg-white dark:bg-[#151C2C] rounded-[24px] p-4 sm:p-5 border border-slate-200/80 dark:border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.04)] flex flex-col items-center overflow-x-auto">
          <div className="inline-flex flex-col gap-1.5 py-1 min-w-max">
            {puzzle.rows.map((row, rIdx) => {
              const isSolved = solvedRowIds.has(row.rowId) || revealedRowIds.has(row.rowId);
              const isActive = rIdx === activeRowIdx && !isGameOver;
              const revealedIndices = rowRevealedLetterIndices.get(row.rowId) || new Set<number>();
              const typedInput = (rowInputs[row.rowId] || '').toLocaleLowerCase('tr-TR');

              return (
                <div
                  key={row.rowId}
                  onClick={() => !isGameOver && setActiveRowIdx(rIdx)}
                  className={`flex items-center gap-1 py-0.5 px-1.5 rounded-xl transition-all cursor-pointer ${
                    isActive
                      ? 'bg-amber-500/10 dark:bg-amber-500/20 ring-2 ring-amber-500/40 shadow-sm'
                      : 'hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                >
                  {/* Row indicator number */}
                  <span
                    className={`w-5 text-right text-[11px] font-bold mr-1 tabular-nums ${
                      isActive ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'
                    }`}
                  >
                    {rIdx + 1}
                  </span>

                  {/* Empty cells on the left */}
                  {Array.from({ length: row.paddingLeft }).map((_, i) => (
                    <div key={`pl-${i}`} className="w-7 h-7 sm:w-8 sm:h-8" />
                  ))}

                  {/* Letter boxes for the Turkish translation */}
                  {Array.from({ length: row.tr.length }).map((_, charIdx) => {
                    const isSpineLetter = charIdx === row.colIndex;
                    const charTarget = row.tr[charIdx].toUpperCase();

                    // Displayed character in this box
                    let displayChar = '';
                    if (isSolved) {
                      displayChar = charTarget;
                    } else if (revealedIndices.has(charIdx) && !isSpineLetter) {
                      displayChar = charTarget;
                    } else if (isActive && typedInput[charIdx]) {
                      displayChar = typedInput[charIdx].toUpperCase();
                    }

                    // Style for the box
                    let boxStyle =
                      'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-white';

                    if (isSolved) {
                      boxStyle = isSpineLetter
                        ? 'bg-amber-400 text-slate-900 border-amber-500 font-black shadow-sm ring-1 ring-amber-400'
                        : 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-400 dark:border-emerald-600 text-emerald-800 dark:text-emerald-200 font-extrabold';
                    } else if (isSpineLetter) {
                      boxStyle =
                        'bg-amber-400/25 dark:bg-amber-400/20 border-2 border-amber-400 dark:border-amber-500 text-amber-900 dark:text-amber-100 font-black shadow-[0_0_8px_rgba(251,191,36,0.3)] hover:brightness-110 active:scale-95 cursor-pointer';
                    } else if (isActive) {
                      boxStyle =
                        'bg-white dark:bg-slate-900 border-slate-400 dark:border-slate-600 text-slate-900 dark:text-white font-bold';
                    }

                    return (
                      <div
                        key={`cell-${charIdx}`}
                        onClick={(e) => {
                          if (isSpineLetter && !isGameOver) {
                            e.stopPropagation();
                            setIsGuessModalOpen(true);
                          }
                        }}
                        title={isSpineLetter ? 'Gizli kelimeyi erkenden tahmin et' : undefined}
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-[8px] border flex items-center justify-center text-xs sm:text-sm transition-all select-none ${boxStyle}`}
                      >
                        {displayChar ? (
                          <span>{displayChar}</span>
                        ) : null}
                      </div>
                    );
                  })}

                  {/* Empty cells on the right */}
                  {Array.from({ length: row.paddingRight }).map((_, i) => (
                    <div key={`pr-${i}`} className="w-7 h-7 sm:w-8 sm:h-8" />
                  ))}

                  {/* Status mark */}
                  <div className="w-5 ml-1 flex items-center justify-center">
                    {solvedRowIds.has(row.rowId) ? (
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    ) : revealedRowIds.has(row.rowId) ? (
                      <Eye size={15} className="text-amber-500 shrink-0" />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold flex items-center justify-between transition-all ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                : feedback.type === 'error'
                ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                : 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/30'
            }`}
          >
            <span>{feedback.message}</span>
            <button onClick={() => setFeedback(null)} className="opacity-70 hover:opacity-100 ml-2">
              ×
            </button>
          </div>
        )}

        {/* Active Row Clue Card & Input */}
        {activeRow && !isGameOver && (
          <div className="bg-white dark:bg-[#151C2C] rounded-[24px] p-5 border border-slate-200/80 dark:border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.04)] flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-500 dark:text-amber-400">
                    Satır {activeRowIdx + 1} / {puzzle.rows.length}
                  </span>
                  {activeRow.isUserWord && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Çalıştığın Kelime
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2.5 mt-1">
                  <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                    {activeRow.en}
                  </h2>
                  <AudioButton text={activeRow.en} size={18} className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 border-none shadow-none" />
                </div>
                {activeRow.word.ipa && (
                  <p className="text-xs font-mono text-slate-400 mt-0.5">{activeRow.word.ipa}</p>
                )}
              </div>

              <div className="text-right">
                <span className="text-xs font-bold text-slate-400 block">Cevap</span>
                <span className="text-sm font-black text-amber-600 dark:text-amber-400">
                  {activeRow.tr.length} Harfli
                </span>
              </div>
            </div>

            {/* Answer Input form */}
            {!isRowSolved ? (
              <form onSubmit={handleSubmitRowAnswer} className="flex flex-col gap-2.5">
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={rowInputs[activeRow.rowId] || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRowInputs(prev => ({ ...prev, [activeRow.rowId]: val }));
                    }}
                    placeholder={`Türkçe karşılığını yaz (${activeRow.tr.length} harf)...`}
                    className="flex-1 px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-base font-bold outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all placeholder:text-slate-400 placeholder:font-normal"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck="false"
                  />
                  <button
                    type="submit"
                    className="px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black text-sm shadow-md active:scale-95 transition-all"
                  >
                    Gönder
                  </button>
                </div>

                {/* Helper buttons (İpucu, Çözümü Göster, Sonraki Satır) */}
                <div className="flex items-center justify-between pt-1 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleHint}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-extrabold flex items-center gap-1.5 transition-all"
                    >
                      <HelpCircle size={14} className="text-amber-500" />
                      <span>Harf Aç</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleRevealRow}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1.5 transition-all"
                    >
                      <Eye size={14} />
                      <span>Çözümü Göster</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const nextIdx = (activeRowIdx + 1) % puzzle.rows.length;
                      setActiveRowIdx(nextIdx);
                    }}
                    className="px-3 py-1.5 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 transition-all"
                  >
                    <span>Pas / Sonraki</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20">
                <div className="flex items-center gap-2 font-black text-sm">
                  <CheckCircle2 size={18} className="text-emerald-500" />
                  <span>Cevap: {activeRow.tr.toUpperCase()}</span>
                </div>
                <button
                  onClick={() => {
                    const nextUnsolved = puzzle.rows.findIndex(
                      r => !solvedRowIds.has(r.rowId) && !revealedRowIds.has(r.rowId)
                    );
                    if (nextUnsolved !== -1) setActiveRowIdx(nextUnsolved);
                  }}
                  className="px-3 py-1 rounded-xl bg-emerald-500 text-white font-extrabold text-xs shadow-sm hover:bg-emerald-600"
                >
                  Sonraki Satıra Geç
                </button>
              </div>
            )}
          </div>
        )}

        {/* Game Completed Modal / Card */}
        {isGameOver && (
          <div className="bg-gradient-to-b from-amber-500 to-orange-600 text-white rounded-[30px] p-6 shadow-xl flex flex-col items-center text-center gap-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-3xl shadow-inner">
              🎉
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-amber-200 block mb-1">
                Tebrikler! Gizli Kelime Çözüldü
              </span>
              <h2 className="text-3xl font-black tracking-tight">{puzzle.cleanTarget}</h2>
              <p className="text-sm font-semibold text-white/90 mt-1">
                {puzzle.targetTr}
              </p>
            </div>

            {/* Custom word ratio banner */}
            <div className="w-full bg-black/20 rounded-2xl p-3 border border-white/10 flex items-center justify-around text-xs">
              <div>
                <span className="text-white/70 block text-[11px]">Kullanıcı Kelimeleri</span>
                <span className="font-black text-base text-amber-200">
                  %{puzzle.userWordPercentage}
                </span>
              </div>
              <div className="h-6 w-[1px] bg-white/20" />
              <div>
                <span className="text-white/70 block text-[11px]">Oturum XP</span>
                <span className="font-black text-base text-emerald-200">
                  +{sessionXpEarned} XP
                </span>
              </div>
              <div className="h-6 w-[1px] bg-white/20" />
              <div>
                <span className="text-white/70 block text-[11px]">Çözülen</span>
                <span className="font-black text-base text-amber-200">
                  {puzzlesSolvedCount} Bulmaca
                </span>
              </div>
            </div>

            <p className="text-xs font-medium text-white/85">
              Bu bulmacanın <strong>%{puzzle.userWordPercentage}</strong>&apos;si senin çalıştığın kelimelerden oluştu.
            </p>

            <div className="flex gap-3 w-full mt-2">
              <button
                onClick={handleLoadNextPuzzle}
                className="flex-1 py-3.5 px-4 rounded-2xl bg-white text-slate-900 font-black text-sm shadow-lg hover:bg-amber-50 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <RotateCcw size={16} />
                <span>Sonraki Bulmaca</span>
              </button>
              <button
                onClick={onClose}
                className="py-3.5 px-5 rounded-2xl bg-black/20 hover:bg-black/30 text-white font-extrabold text-sm transition-all"
              >
                Çıkış
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Guess Secret Word Modal */}
      {isGuessModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#151C2C] rounded-[28px] max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <KeyRound size={20} />
                </div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Gizli Kelimeyi Tahmin Et
                </h3>
              </div>
              <button
                onClick={() => setIsGuessModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ×
              </button>
            </div>

            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Dikey sütunda oluşan <strong>{puzzle.cleanTarget.length} harfli</strong> İngilizce gizli kelimeyi biliyorsan yaz:
            </p>

            <form onSubmit={handleGuessSecretWord} className="flex flex-col gap-3">
              <input
                type="text"
                value={guessInput}
                onChange={(e) => setGuessInput(e.target.value.toUpperCase())}
                placeholder="Örn: FRAGILE"
                maxLength={puzzle.cleanTarget.length}
                className="w-full px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-center text-lg font-black tracking-widest outline-none focus:ring-2 focus:ring-amber-500"
                autoFocus
              />

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-sm shadow-md"
                >
                  Onayla
                </button>
                <button
                  type="button"
                  onClick={() => setIsGuessModalOpen(false)}
                  className="py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm"
                >
                  Vazgeç
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
