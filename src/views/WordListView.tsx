import React, { useState, useMemo } from 'react';
import { Word, Progress } from '../types';
import { AudioButton } from '../components/AudioButton';
import { HighlightedText } from '../components/HighlightedText';
import { Plus, Search, RotateCcw, CheckCircle, Sparkles, Filter, X } from 'lucide-react';

interface Props {
  allWords: Word[];
  progressMap: Map<number, Progress>;
  onAddCustomWord: (word: Omit<Word, 'id'>) => Promise<void>;
  onRestoreMasteredWord: (wordId: number) => Promise<void>;
}

export const WordListView: React.FC<Props> = ({
  allWords,
  progressMap,
  onAddCustomWord,
  onRestoreMasteredWord
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'custom' | 'mastered' | 'learning'>('custom');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New Word Form State
  const [newEn, setNewEn] = useState('');
  const [newTr, setNewTr] = useState('');
  const [newIpa, setNewIpa] = useState('');
  const [newExampleEn, setNewExampleEn] = useState('');
  const [newExampleTr, setNewExampleTr] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleCreateWord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEn.trim() || !newTr.trim()) return;

    setIsSubmitting(true);
    try {
      const examples = newExampleEn.trim()
        ? [{ en: newExampleEn.trim(), tr: newExampleTr.trim() }]
        : [];

      await onAddCustomWord({
        en: newEn.trim(),
        tr: newTr.trim(),
        ipa: newIpa.trim() || undefined,
        examples,
        categories: ['custom'],
        isCustom: true,
        createdAt: Date.now()
      });

      // Reset
      setNewEn('');
      setNewTr('');
      setNewIpa('');
      setNewExampleEn('');
      setNewExampleTr('');
      setIsAddModalOpen(false);
      setActiveFilter('custom');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Top Header & Add Button */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h2 className="text-xl font-black text-white">Kelime Kütüphanesi</h2>
          <p className="text-xs text-slate-400">
            {allWords.length} kelime kayıtlı
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md transition-all"
        >
          <Plus size={16} />
          <span>Kelime Ekle</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search size={18} className="absolute left-3.5 top-3 text-slate-500" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="İngilizce veya Türkçe kelime ara..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-3 text-slate-400 hover:text-white"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-2 overflow-x-auto pb-1 text-xs font-semibold no-scrollbar">
        <button
          onClick={() => setActiveFilter('custom')}
          className={`flex items-center space-x-1 px-3 py-1.5 rounded-xl shrink-0 transition-all ${
            activeFilter === 'custom'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <Sparkles size={14} />
          <span>Özel Kelimelerim</span>
        </button>
        <button
          onClick={() => setActiveFilter('mastered')}
          className={`flex items-center space-x-1 px-3 py-1.5 rounded-xl shrink-0 transition-all ${
            activeFilter === 'mastered'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <CheckCircle size={14} />
          <span>Öğrenilenler (Mastered)</span>
        </button>
        <button
          onClick={() => setActiveFilter('learning')}
          className={`flex items-center space-x-1 px-3 py-1.5 rounded-xl shrink-0 transition-all ${
            activeFilter === 'learning'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <RotateCcw size={14} />
          <span>Tekrardakiler</span>
        </button>
        <button
          onClick={() => setActiveFilter('all')}
          className={`flex items-center space-x-1 px-3 py-1.5 rounded-xl shrink-0 transition-all ${
            activeFilter === 'all'
              ? 'bg-slate-700 text-white'
              : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700'
          }`}
        >
          <Filter size={14} />
          <span>Tümü</span>
        </button>
      </div>

      {/* Word Cards List */}
      <div className="space-y-2.5">
        {filteredWords.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            Eşleşen kelime bulunamadı.
          </div>
        ) : (
          filteredWords.map((w) => {
            const prog = progressMap.get(w.id);
            const isMastered = prog?.status === 'mastered';
            const isCustom = w.isCustom || w.categories?.includes('custom');

            return (
              <div
                key={w.id}
                className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 flex flex-col space-y-2 hover:border-slate-600 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg font-black text-white">{w.en}</span>
                    <AudioButton text={w.en} size={18} />
                    {isCustom && (
                      <span className="px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-bold">
                        Özel
                      </span>
                    )}
                  </div>

                  {/* Status Indicator / Action */}
                  {isMastered ? (
                    <button
                      onClick={() => onRestoreMasteredWord(w.id)}
                      className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-xs font-semibold border border-emerald-500/30 active:scale-95 transition-all"
                      title="Tekrar havuzuna geri al"
                    >
                      <RotateCcw size={12} />
                      <span>Tekrara Al</span>
                    </button>
                  ) : prog?.status === 'learning' ? (
                    <span className="text-[11px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                      Adım {prog.step + 1}/6
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded-md">
                      Yeni
                    </span>
                  )}
                </div>

                <div className="text-sm font-semibold text-emerald-400">
                  {w.tr}
                </div>

                {w.ipa && (
                  <div className="text-xs font-mono text-slate-400">
                    {w.ipa}
                  </div>
                )}

                {w.examples && w.examples.length > 0 && (
                  <div className="pt-1 text-xs text-slate-300 bg-slate-900/40 p-2 rounded-xl">
                    <p className="italic">
                      <HighlightedText text={w.examples[0].en} />
                    </p>
                    <p className="text-slate-400 text-[11px] mt-0.5">
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <Sparkles size={18} className="text-purple-400" />
                <span>Kendi Kelimeni Ekle</span>
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateWord} className="space-y-3.5 text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  İngilizce Kelime *
                </label>
                <input
                  type="text"
                  required
                  value={newEn}
                  onChange={(e) => setNewEn(e.target.value)}
                  placeholder="örn: resilient"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Türkçe Anlamı *
                </label>
                <input
                  type="text"
                  required
                  value={newTr}
                  onChange={(e) => setNewTr(e.target.value)}
                  placeholder="örn: dirençli, dayanıklı"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">
                  Telaffuz / IPA (Opsiyonel)
                </label>
                <input
                  type="text"
                  value={newIpa}
                  onChange={(e) => setNewIpa(e.target.value)}
                  placeholder="örn: [rɪˈzɪliənt]"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">
                  Örnek Cümle (İngilizce - Opsiyonel, kelimeyi #kelime# ile sarın)
                </label>
                <input
                  type="text"
                  value={newExampleEn}
                  onChange={(e) => setNewExampleEn(e.target.value)}
                  placeholder="örn: She is very #resilient#."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">
                  Örnek Cümle (Türkçe Çevirisi - Opsiyonel)
                </label>
                <input
                  type="text"
                  value={newExampleTr}
                  onChange={(e) => setNewExampleTr(e.target.value)}
                  placeholder="örn: O çok dirençlidir."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold shadow-lg"
                >
                  {isSubmitting ? 'Ekleniyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
