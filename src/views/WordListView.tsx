import React, { useState, useMemo, useEffect } from 'react';
import { Word, Progress } from '../types';
import { AudioButton } from '../components/AudioButton';
import { HighlightedText } from '../components/HighlightedText';
import { Plus, Search, RotateCcw, CheckCircle, Sparkles, X, Loader2, BookOpen, Wand2, Trash2, Edit2 } from 'lucide-react';
import { lookupWord } from '../services/dictionaryService';

interface Props {
  allWords: Word[];
  progressMap: Map<number, Progress>;
  onAddCustomWord: (word: Omit<Word, 'id'>) => Promise<void>;
  onUpdateCustomWord?: (word: Word) => Promise<void>;
  onDeleteCustomWord?: (wordId: number) => Promise<void>;
  onRestoreMasteredWord: (wordId: number) => Promise<void>;
}

export const WordListView: React.FC<Props> = ({
  allWords,
  progressMap,
  onAddCustomWord,
  onUpdateCustomWord,
  onDeleteCustomWord,
  onRestoreMasteredWord
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'custom' | 'mastered' | 'learning'>('custom');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New / Edit Word Form State
  const [editingWord, setEditingWord] = useState<Word | null>(null);
  const [newEn, setNewEn] = useState('');
  const [newTr, setNewTr] = useState('');
  const [newIpa, setNewIpa] = useState('');
  const [newExampleEn, setNewExampleEn] = useState('');
  const [newExampleTr, setNewExampleTr] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dictionary Lookup State
  const [isSearchingDict, setIsSearchingDict] = useState(false);
  const [dictStatus, setDictStatus] = useState<{
    text: string;
    source: 'local' | 'online' | 'none';
  } | null>(null);

  // Form Reset / Open / Close Helpers
  const resetForm = () => {
    setEditingWord(null);
    setNewEn('');
    setNewTr('');
    setNewIpa('');
    setNewExampleEn('');
    setNewExampleTr('');
    setDictStatus(null);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (w: Word) => {
    setEditingWord(w);
    setNewEn(w.en);
    setNewTr(w.tr);
    setNewIpa(w.ipa || '');
    setNewExampleEn(w.examples?.[0]?.en || '');
    setNewExampleTr(w.examples?.[0]?.tr || '');
    setDictStatus(null);
    setIsAddModalOpen(true);
  };

  const handleCloseModal = () => {
    resetForm();
    setIsAddModalOpen(false);
  };

  // Trigger dictionary lookup
  const performLookup = async (englishWord: string, allowOnline = true) => {
    const q = englishWord.trim();
    if (!q || q.length < 2) return;

    setIsSearchingDict(true);
    setDictStatus(null);

    // Her "Sözlükten Getir" tuşuna basıldığında alttaki tüm alanları temizle
    setNewTr('');
    setNewIpa('');
    setNewExampleEn('');
    setNewExampleTr('');

    try {
      const result = await lookupWord(q, allWords, allowOnline);
      if (result) {
        setNewTr(result.tr || '');
        setNewIpa(result.ipa || '');
        setNewExampleEn(result.exampleEn || '');
        setNewExampleTr(result.exampleTr || '');

        setDictStatus({
          text: result.source === 'local'
            ? '✓ Yerel sözlükte bulundu ve otomatik dolduruldu!'
            : '✓ Çevrimiçi sözlükte bulundu ve otomatik dolduruldu!',
          source: result.source
        });
      } else {
        setDictStatus({
          text: 'Sözlükte bulunamadı, bilgileri elle girebilirsiniz.',
          source: 'none'
        });
      }
    } catch {
      setDictStatus({
        text: 'Sözlük araması sırasında hata oluştu.',
        source: 'none'
      });
    } finally {
      setIsSearchingDict(false);
    }
  };

  // Debounced auto-lookup from local dictionary while typing
  useEffect(() => {
    const trimmed = newEn.trim();
    if (!trimmed || trimmed.length < 2 || !isAddModalOpen) {
      setDictStatus(null);
      if (!trimmed) {
        setNewTr('');
        setNewIpa('');
        setNewExampleEn('');
        setNewExampleTr('');
      }
      return;
    }

    const timer = setTimeout(() => {
      // Auto-lookup locally first silently (fast offline experience)
      lookupWord(trimmed, allWords, false).then(result => {
        if (result) {
          // If found in local words, update fields
          setNewTr(result.tr || '');
          setNewIpa(result.ipa || '');
          setNewExampleEn(result.exampleEn || '');
          setNewExampleTr(result.exampleTr || '');
          setDictStatus({
            text: '✓ Yerel sözlükte bulundu ve otomatik dolduruldu!',
            source: 'local'
          });
        }
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [newEn, allWords, isAddModalOpen]);

  // Filtered words
  const filteredWords = useMemo(() => {
    let list = allWords;

    if (activeFilter === 'custom') {
      list = list.filter(w => !!w.isCustom || w.categories?.includes('custom'));
    } else if (activeFilter === 'mastered') {
      list = list.filter(w => progressMap.get(w.id)?.status === 'mastered');
    } else if (activeFilter === 'learning') {
      list = list.filter(w => progressMap.get(w.id)?.status === 'learning');
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(w =>
        w.en.toLowerCase().includes(q) || w.tr.toLowerCase().includes(q)
      );
    }

    return list.slice(0, 100); // paginate / limit to 100 for render speed
  }, [allWords, progressMap, activeFilter, searchTerm]);

  const handleSaveWord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEn.trim() || !newTr.trim()) return;

    setIsSubmitting(true);
    try {
      const examples = newExampleEn.trim()
        ? [{ en: newExampleEn.trim(), tr: newExampleTr.trim() }]
        : [];

      if (editingWord && onUpdateCustomWord) {
        await onUpdateCustomWord({
          ...editingWord,
          en: newEn.trim(),
          tr: newTr.trim(),
          ipa: newIpa.trim() || undefined,
          examples
        });
      } else {
        await onAddCustomWord({
          en: newEn.trim(),
          tr: newTr.trim(),
          ipa: newIpa.trim() || undefined,
          examples,
          categories: ['custom'],
          isCustom: true,
          createdAt: Date.now()
        });
      }

      handleCloseModal();
      setActiveFilter('custom');
    } catch (err) {
      console.error('Error saving word:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pb-24 select-none text-black">
      {/* Top Header & Add Button */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h2 className="text-xl font-black text-black uppercase tracking-tight">KELİME KÜTÜPHANESİ</h2>
          <p className="text-xs font-bold text-zinc-700">
            <span className="bg-[#FFE600] border border-black px-1.5 py-0.2 font-black">{allWords.length}</span> KELİME KAYITLI
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center space-x-1.5 px-3.5 py-2 bg-black text-[#FFE600] hover:bg-zinc-800 active:translate-x-[1px] active:translate-y-[1px] font-black text-xs uppercase border-2 border-black shadow-[2px_2px_0px_0px_#FFE600] active:shadow-none transition-all"
        >
          <Plus size={16} strokeWidth={3} />
          <span>KELİME EKLE</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search size={18} strokeWidth={3} className="absolute left-3.5 top-3.5 text-black" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="İngilizce veya Türkçe kelime ara..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border-[3px] border-black text-black placeholder-zinc-500 font-bold text-sm shadow-[3px_3px_0px_0px_#000] focus:outline-none focus:bg-[#FFFBEB]"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3.5 top-3.5 text-black font-black"
          >
            <X size={16} strokeWidth={3} />
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-2 overflow-x-auto pb-1 text-xs font-black no-scrollbar">
        <button
          onClick={() => setActiveFilter('custom')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 shrink-0 border-2 border-black uppercase transition-all ${
            activeFilter === 'custom'
              ? 'bg-[#C084FC] text-black shadow-[2px_2px_0px_0px_#000] -translate-y-0.5'
              : 'bg-white text-zinc-800 hover:bg-[#F3E8FF]'
          }`}
        >
          <Sparkles size={14} strokeWidth={2.5} />
          <span>ÖZEL KELİMELERİM</span>
        </button>
        <button
          onClick={() => setActiveFilter('mastered')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 shrink-0 border-2 border-black uppercase transition-all ${
            activeFilter === 'mastered'
              ? 'bg-[#4ADE80] text-black shadow-[2px_2px_0px_0px_#000] -translate-y-0.5'
              : 'bg-white text-zinc-800 hover:bg-[#DCFCE7]'
          }`}
        >
          <CheckCircle size={14} strokeWidth={2.5} />
          <span>ÖĞRENİLENLER</span>
        </button>
        <button
          onClick={() => setActiveFilter('learning')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 shrink-0 border-2 border-black uppercase transition-all ${
            activeFilter === 'learning'
              ? 'bg-[#00F0FF] text-black shadow-[2px_2px_0px_0px_#000] -translate-y-0.5'
              : 'bg-white text-zinc-800 hover:bg-[#E0F2FE]'
          }`}
        >
          <RotateCcw size={14} strokeWidth={2.5} />
          <span>TEKRARDAKİLER</span>
        </button>
        <button
          onClick={() => setActiveFilter('all')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 shrink-0 border-2 border-black uppercase transition-all ${
            activeFilter === 'all'
              ? 'bg-[#FFE600] text-black shadow-[2px_2px_0px_0px_#000] -translate-y-0.5'
              : 'bg-white text-zinc-800 hover:bg-[#FEF9C3]'
          }`}
        >
          <span>TÜMÜ</span>
        </button>
      </div>

      {/* Word Cards List */}
      <div className="space-y-3">
        {filteredWords.length === 0 ? (
          <div className="text-center py-12 bg-white border-2 border-black shadow-[3px_3px_0px_0px_#000] font-black text-sm uppercase">
            EŞLEŞEN KELİME BULUNAMADI.
          </div>
        ) : (
          filteredWords.map((w) => {
            const prog = progressMap.get(w.id);
            const isMastered = prog?.status === 'mastered';
            const isCustom = w.isCustom || w.categories?.includes('custom');

            return (
              <div
                key={w.id}
                className="bg-white border-[3px] border-black p-4 flex flex-col space-y-2 shadow-[4px_4px_0px_0px_#000] text-black"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-xl font-black text-black uppercase tracking-tight">{w.en}</span>
                    <AudioButton text={w.en} size={17} />
                    {isCustom && (
                      <span className="px-1.5 py-0.5 bg-[#C084FC] text-black border border-black text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#000]">
                        ÖZEL
                      </span>
                    )}
                  </div>

                  {/* Actions & Status */}
                  <div className="flex items-center space-x-1.5">
                    {isCustom && (
                      <div className="flex items-center space-x-1 mr-1">
                        {onUpdateCustomWord && (
                          <button
                            onClick={() => handleOpenEditModal(w)}
                            className="p-1.5 bg-white border border-black hover:bg-[#FFE600] text-black active:scale-95 shadow-[1px_1px_0px_0px_#000]"
                            title="Kelimeyi düzenle"
                          >
                            <Edit2 size={13} strokeWidth={2.5} />
                          </button>
                        )}
                        {onDeleteCustomWord && (
                          <button
                            onClick={() => onDeleteCustomWord(w.id)}
                            className="p-1.5 bg-white border border-black hover:bg-[#FF5588] text-black active:scale-95 shadow-[1px_1px_0px_0px_#000]"
                            title="Özel kelimeyi sil"
                          >
                            <Trash2 size={13} strokeWidth={2.5} />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Status Indicator / Action */}
                    {isMastered ? (
                      <button
                        onClick={() => onRestoreMasteredWord(w.id)}
                        className="flex items-center space-x-1 px-2.5 py-1 bg-[#4ADE80] text-black text-xs font-black border-2 border-black shadow-[1.5px_1.5px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] uppercase"
                        title="Tekrar havuzuna geri al"
                      >
                        <RotateCcw size={12} strokeWidth={3} />
                        <span>TEKRARA AL</span>
                      </button>
                    ) : prog?.status === 'learning' ? (
                      <span className="text-[11px] font-black text-black bg-[#00F0FF] px-2 py-0.5 border border-black uppercase shadow-[1px_1px_0px_0px_#000]">
                        ADIM {prog.step + 1}/6
                      </span>
                    ) : (
                      <span className="text-[11px] font-black text-black bg-zinc-200 px-2 py-0.5 border border-black uppercase">
                        YENİ
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-base font-black text-black uppercase">
                  {w.tr}
                </div>

                {w.ipa && (
                  <div className="text-xs font-mono font-bold text-zinc-700">
                    {w.ipa}
                  </div>
                )}

                {w.examples && w.examples.length > 0 && (
                  <div className="pt-1 text-xs text-black bg-[#FDFBF7] p-2.5 border-2 border-black shadow-[2px_2px_0px_0px_#000]">
                    <p className="font-bold">
                      <HighlightedText text={w.examples[0].en} />
                    </p>
                    <p className="text-zinc-700 text-[11px] font-semibold mt-0.5">
                      {w.examples[0].tr}
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add Custom Word Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black w-full max-w-md p-6 space-y-4 shadow-[8px_8px_0px_0px_#000] animate-scaleUp text-black">
            <div className="flex items-center justify-between pb-2 border-b-2 border-black">
              <h3 className="text-lg font-black text-black uppercase flex items-center space-x-2 tracking-tight">
                <Sparkles size={18} strokeWidth={3} className="text-black" />
                <span>{editingWord ? 'KELİMEYİ DÜZENLE' : 'KENDİ KELİMENİ EKLE'}</span>
              </h3>
              <button
                onClick={handleCloseModal}
                className="w-7 h-7 bg-white border border-black flex items-center justify-center text-black hover:bg-[#FF5588]"
              >
                <X size={18} strokeWidth={3} />
              </button>
            </div>

            <form onSubmit={handleSaveWord} className="space-y-3.5 text-sm">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-black text-black uppercase">
                    İNGİLİZCE KELİME *
                  </label>
                  <button
                    type="button"
                    onClick={() => performLookup(newEn, true)}
                    disabled={isSearchingDict || !newEn.trim()}
                    className="flex items-center space-x-1 text-[11px] font-black uppercase text-black bg-[#FFE600] border border-black px-2 py-0.5 shadow-[1px_1px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-40"
                    title="Sözlükten çeviri, telaffuz ve örnek cümleyi otomatik çek"
                  >
                    {isSearchingDict ? (
                      <>
                        <Loader2 size={12} className="animate-spin text-black" />
                        <span>ARANIYOR...</span>
                      </>
                    ) : (
                      <>
                        <Wand2 size={12} strokeWidth={2.5} />
                        <span>SÖZLÜKTEN GETİR</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    required
                    value={newEn}
                    onChange={(e) => setNewEn(e.target.value)}
                    onBlur={() => {
                      if (newEn.trim() && !dictStatus && !newTr.trim()) {
                        performLookup(newEn, true);
                      }
                    }}
                    placeholder="örn: resilient"
                    className="w-full px-3.5 py-2.5 bg-white border-2 border-black text-black placeholder-zinc-500 font-bold focus:outline-none focus:bg-[#FFFBEB] shadow-[2px_2px_0px_0px_#000]"
                  />
                </div>

                {/* Status indicator */}
                {dictStatus && (
                  <div className="mt-1.5">
                    {dictStatus.source === 'local' ? (
                      <div className="flex items-center space-x-1.5 text-[11px] font-black text-black bg-[#BBF7D0] px-2.5 py-1 border border-black uppercase">
                        <CheckCircle size={13} strokeWidth={3} className="shrink-0" />
                        <span>{dictStatus.text}</span>
                      </div>
                    ) : dictStatus.source === 'online' ? (
                      <div className="flex items-center space-x-1.5 text-[11px] font-black text-black bg-[#BAE6FD] px-2.5 py-1 border border-black uppercase">
                        <BookOpen size={13} strokeWidth={3} className="shrink-0" />
                        <span>{dictStatus.text}</span>
                      </div>
                    ) : (
                      <div className="text-[11px] font-black text-black bg-[#FEF08A] px-2.5 py-1 border border-black uppercase">
                        {dictStatus.text}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-black text-black uppercase mb-1">
                  TÜRKÇE ANLAMI *
                </label>
                <input
                  type="text"
                  required
                  value={newTr}
                  onChange={(e) => setNewTr(e.target.value)}
                  placeholder="örn: dirençli, dayanıklı"
                  className="w-full px-3.5 py-2.5 bg-white border-2 border-black text-black font-bold focus:outline-none focus:bg-[#FFFBEB] shadow-[2px_2px_0px_0px_#000]"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-black uppercase mb-1">
                  TELAFFUZ / IPA (OPSİYONEL)
                </label>
                <input
                  type="text"
                  value={newIpa}
                  onChange={(e) => setNewIpa(e.target.value)}
                  placeholder="örn: [rɪˈzɪliənt]"
                  className="w-full px-3.5 py-2.5 bg-white border-2 border-black text-black font-bold focus:outline-none focus:bg-[#FFFBEB] shadow-[2px_2px_0px_0px_#000]"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-black uppercase mb-1">
                  ÖRNEK CÜMLE (İNGİLİZCE - #kelime# ile sarın)
                </label>
                <input
                  type="text"
                  value={newExampleEn}
                  onChange={(e) => setNewExampleEn(e.target.value)}
                  placeholder="örn: She is very #resilient#."
                  className="w-full px-3.5 py-2.5 bg-white border-2 border-black text-black font-bold focus:outline-none focus:bg-[#FFFBEB] shadow-[2px_2px_0px_0px_#000]"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-black uppercase mb-1">
                  ÖRNEK CÜMLE ÇEVİRİSİ (TÜRKÇE)
                </label>
                <input
                  type="text"
                  value={newExampleTr}
                  onChange={(e) => setNewExampleTr(e.target.value)}
                  placeholder="örn: O çok dirençlidir."
                  className="w-full px-3.5 py-2.5 bg-white border-2 border-black text-black font-bold focus:outline-none focus:bg-[#FFFBEB] shadow-[2px_2px_0px_0px_#000]"
                />
              </div>

              <div className="pt-2 flex space-x-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 py-2.5 bg-white text-black border-2 border-black font-black uppercase text-xs shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5"
                >
                  İPTAL
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-black text-[#FFE600] border-2 border-black font-black uppercase text-xs shadow-[3px_3px_0px_0px_#FFE600] active:translate-x-0.5 active:translate-y-0.5"
                >
                  {isSubmitting ? 'KAYDEDİLİYOR...' : editingWord ? 'GÜNCELLE' : 'KAYDET'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
