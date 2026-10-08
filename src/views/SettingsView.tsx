import React, { useState, useRef } from 'react';
import { UserSettings } from '../types';
import { exportBackupFile, inspectBackupFile, restoreBackup, BackupPreview } from '../services/backup';
import { sound } from '../services/audio';
import { Download, Upload, Volume2, Sliders, ShieldCheck, Check, ArrowLeft, Sparkles, RotateCcw } from 'lucide-react';

interface Props {
  settings: UserSettings;
  categoryNames: Record<string, string>;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  onReloadData: () => Promise<void>;
  onResetProgress?: () => Promise<void>;
  onClose: () => void;
}

export const SettingsView: React.FC<Props> = ({
  settings,
  categoryNames,
  onUpdateSettings,
  onReloadData,
  onResetProgress,
  onClose
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [previewModal, setPreviewModal] = useState<BackupPreview | null>(null);
  const [mergeMode, setMergeMode] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export backup
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await exportBackupFile();
      await onUpdateSettings({ lastBackupDate: new Date().toISOString().split('T')[0] });
      alert(`Yedek başarıyla alındı: ${res.fileName}`);
    } catch (e) {
      alert(`Yedek alınırken hata oluştu: ${(e as Error).message}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Select file for restore
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const preview = inspectBackupFile(text);
      if (!preview.valid) {
        alert(preview.error || 'Dosya geçersiz.');
        return;
      }
      setPreviewModal(preview);
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  // Confirm restore
  const handleConfirmRestore = async () => {
    if (!previewModal) return;
    setIsRestoring(true);
    try {
      await restoreBackup(previewModal.data, mergeMode);
      setRestoreSuccess(true);
      await onReloadData();
      setTimeout(() => {
        setPreviewModal(null);
        setRestoreSuccess(false);
      }, 1500);
    } catch (e) {
      alert(`Geri yükleme başarısız: ${(e as Error).message}`);
    } finally {
      setIsRestoring(false);
    }
  };

  // Toggle category
  const toggleCategory = (catKey: string) => {
    const currentList = settings.enabledCategories || [];
    let updated: string[];
    if (currentList.includes(catKey)) {
      if (currentList.length <= 1) {
        alert('En az 1 kategori açık kalmalıdır.');
        return;
      }
      updated = currentList.filter(c => c !== catKey);
    } else {
      updated = [...currentList, catKey];
    }
    onUpdateSettings({ enabledCategories: updated });
  };

  const handleResetProgressClick = async () => {
    const ok = window.confirm(
      'Tüm çalışma ilerlemeni sıfırlamak istediğinden emin misin?\n\nKelimelerin silinmez; tüm kelimelerin (başta kendi kelimelerin olmak üzere) Öğren sekmesinde en baştan açılır.'
    );
    if (!ok) return;

    if (onResetProgress) {
      await onResetProgress();
    }
  };

  return (
    <div className="space-y-6 pb-28 pt-2">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onClose}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-black text-white">Ayarlar</h2>
        <div className="w-8" />
      </div>

      {/* Target Settings */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-3xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center space-x-2">
          <Sliders size={16} className="text-indigo-400" />
          <span>Çalışma Hedefleri</span>
        </h3>

        {/* Daily New Target */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-xs font-semibold text-slate-200 block">
              Günlük Yeni Kelime Hedefi
            </label>
            <span className="text-[11px] text-slate-400">Her gün öğrenilecek yeni kelime</span>
          </div>
          <select
            value={settings.dailyNewTarget}
            onChange={(e) => onUpdateSettings({ dailyNewTarget: Number(e.target.value) })}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none"
          >
            {[5, 10, 15, 20, 30].map(n => (
              <option key={n} value={n}>{n} kelime</option>
            ))}
          </select>
        </div>

        {/* Daily Review Limit */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-xs font-semibold text-slate-200 block">
              Günlük Tekrar Limiti
            </label>
            <span className="text-[11px] text-slate-400">Günde sorulacak maksimum tekrar sayısı</span>
          </div>
          <select
            value={settings.dailyReviewLimit}
            onChange={(e) => onUpdateSettings({ dailyReviewLimit: Number(e.target.value) })}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none"
          >
            {[20, 30, 40, 50, 75, 100].map(n => (
              <option key={n} value={n}>{n} tekrar</option>
            ))}
          </select>
        </div>

        {/* Prioritize Custom Words Toggle */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-800">
          <div>
            <label className="text-xs font-bold text-purple-300 flex items-center space-x-1.5">
              <Sparkles size={14} className="text-purple-400" />
              <span>Kendi Kelimelerime Öncelik Ver</span>
            </label>
            <span className="text-[11px] text-slate-400">
              Özel eklenen veya Reword kelimeleri sıralamada en başa alır
            </span>
          </div>
          <input
            type="checkbox"
            checked={settings.prioritizeCustomWords}
            onChange={(e) => onUpdateSettings({ prioritizeCustomWords: e.target.checked })}
            className="w-5 h-5 accent-purple-600 rounded cursor-pointer"
          />
        </div>

        {/* Surprise Mastered Check */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-800">
          <div>
            <label className="text-xs font-semibold text-slate-200 block">
              Sürpriz Mastered Kontrolü
            </label>
            <span className="text-[11px] text-slate-400">
              60 günde bir rastgele 5 mastered kelimeyi hatırlatma amaçlı sor
            </span>
          </div>
          <input
            type="checkbox"
            checked={settings.surpriseMasteredCheck}
            onChange={(e) => onUpdateSettings({ surpriseMasteredCheck: e.target.checked })}
            className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
          />
        </div>
      </div>

      {/* Audio & Haptic Settings */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-3xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center space-x-2">
          <Volume2 size={16} className="text-amber-400" />
          <span>Ses ve Titreşim</span>
        </h3>

        {/* Sound FX */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-xs font-semibold text-slate-200 block">
              Ses Efektleri
            </label>
            <span className="text-[11px] text-slate-400">Doğru/yanlış cevap sesleri</span>
          </div>
          <input
            type="checkbox"
            checked={settings.soundEffects}
            onChange={(e) => {
              onUpdateSettings({ soundEffects: e.target.checked });
              sound.setPreferences(e.target.checked, settings.vibration);
            }}
            className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
          />
        </div>

        {/* Vibration */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-xs font-semibold text-slate-200 block">
              Titreşim Geri Bildirimi
            </label>
            <span className="text-[11px] text-slate-400">Cevaplarda kısa haptik titreşim</span>
          </div>
          <input
            type="checkbox"
            checked={settings.vibration}
            onChange={(e) => {
              onUpdateSettings({ vibration: e.target.checked });
              sound.setPreferences(settings.soundEffects, e.target.checked);
            }}
            className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
          />
        </div>

        {/* Speech Speed */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-xs font-semibold text-slate-200 block">
              İngilizce Telaffuz Hızı
            </label>
            <span className="text-[11px] text-slate-400">{settings.speechSpeed}x</span>
          </div>
          <select
            value={settings.speechSpeed}
            onChange={(e) => onUpdateSettings({ speechSpeed: Number(e.target.value) })}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none"
          >
            {[0.7, 0.8, 0.9, 1.0, 1.2].map(speed => (
              <option key={speed} value={speed}>{speed}x</option>
            ))}
          </select>
        </div>
      </div>

      {/* Backup & Restore Section */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-3xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <ShieldCheck size={16} className="text-emerald-400" />
            <span>Yedekleme ve Geri Yükleme</span>
          </h3>
          {settings.lastBackupDate && (
            <span className="text-[11px] text-slate-400">
              Son yedek: {settings.lastBackupDate}
            </span>
          )}
        </div>

        <p className="text-xs text-slate-400">
          Tüm ilerlemenizi, özel kelimelerinizi ve istatistiklerinizi tek tıkla cihazınıza indirin veya WhatsApp / Drive'a paylaşın.
        </p>

        <div className="grid grid-cols-2 gap-3 pt-1">
          {/* Export */}
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="py-3 px-4 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs rounded-2xl flex items-center justify-center space-x-2 transition-all active:scale-95"
          >
            <Download size={16} />
            <span>{isExporting ? 'Hazırlanıyor...' : 'Yedek Al'}</span>
          </button>

          {/* Import */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="py-3 px-4 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 font-bold text-xs rounded-2xl flex items-center justify-center space-x-2 transition-all active:scale-95"
          >
            <Upload size={16} />
            <span>Yedekten Yükle</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </div>

      {/* Category Management */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-3xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center space-x-2">
          <Sliders size={16} className="text-indigo-400" />
          <span>Kategori Seçimi ({settings.enabledCategories?.length || 0} Açık)</span>
        </h3>
        <p className="text-xs text-slate-400">
          Çalışmak istediğin kelime gruplarını açıp kapatabilirsin.
        </p>

        <div className="grid grid-cols-2 gap-2 pt-1 max-h-64 overflow-y-auto pr-1">
          {Object.entries(categoryNames).map(([key, name]) => {
            const isEnabled = settings.enabledCategories?.includes(key);
            return (
              <button
                key={key}
                onClick={() => toggleCategory(key)}
                className={`p-2.5 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition-all ${
                  isEnabled
                    ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-200'
                    : 'bg-slate-900/60 border-slate-800 text-slate-500'
                }`}
              >
                <span className="truncate pr-1">{name || key}</span>
                {isEnabled && <Check size={14} className="text-indigo-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Danger Zone: Reset Progress */}
      <div className="bg-rose-950/20 border border-rose-500/30 rounded-3xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-rose-300 flex items-center space-x-2">
          <RotateCcw size={16} className="text-rose-400" />
          <span>İlerlemeyi Sıfırla (Baştan Başla)</span>
        </h3>
        <p className="text-xs text-slate-300 leading-relaxed">
          Öğrenilen kelimeleri, tekrarları, XP ve seriyi sıfırlar. Kelimelerin silinmez; tüm kelimelerin (başta kendi kelimelerin olmak üzere) Öğren sekmesinde en baştan sıfır olarak açılır.
        </p>
        <button
          onClick={handleResetProgressClick}
          className="w-full py-3.5 px-4 bg-rose-600/30 hover:bg-rose-600/40 active:scale-[0.98] border border-rose-500/50 rounded-2xl text-rose-200 text-xs font-black transition-all flex items-center justify-center space-x-2 shadow-lg"
        >
          <RotateCcw size={14} />
          <span>Tüm Çalışma İlerlemesini Sıfırla</span>
        </button>
      </div>

      {/* Backup Preview & Restore Modal */}
      {previewModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Yedek Önizlemesi</h3>

            <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700 text-xs space-y-2 text-slate-300">
              <div className="flex justify-between">
                <span>Kelime İlerlemesi:</span>
                <span className="font-bold text-white">{previewModal.progressCount} kelime</span>
              </div>
              <div className="flex justify-between">
                <span>Özel Kelimeler:</span>
                <span className="font-bold text-purple-300">{previewModal.customWordCount} adet</span>
              </div>
              <div className="flex justify-between">
                <span>Seviye & XP:</span>
                <span className="font-bold text-indigo-400">Lv.{previewModal.level} ({previewModal.totalXp} XP)</span>
              </div>
              <div className="flex justify-between">
                <span>Seri:</span>
                <span className="font-bold text-amber-400">{previewModal.streak} gün</span>
              </div>
              {previewModal.lastStudyDate && (
                <div className="flex justify-between">
                  <span>Son Çalışma:</span>
                  <span className="font-bold text-white">{previewModal.lastStudyDate}</span>
                </div>
              )}
            </div>

            {/* Merge toggle */}
            <div className="bg-slate-800/40 p-3 rounded-2xl border border-slate-700 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-white block">Birleştirerek Yükle</span>
                <span className="text-[11px] text-slate-400">Mevcut veriyi silmeden, en güncel kayıtları korur</span>
              </div>
              <input
                type="checkbox"
                checked={mergeMode}
                onChange={(e) => setMergeMode(e.target.checked)}
                className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
              />
            </div>

            {restoreSuccess ? (
              <div className="p-3 bg-emerald-500/20 text-emerald-300 text-center font-bold rounded-2xl">
                ✓ Başarıyla geri yüklendi!
              </div>
            ) : (
              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPreviewModal(null)}
                  className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRestore}
                  disabled={isRestoring}
                  className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg"
                >
                  {isRestoring ? 'Yükleniyor...' : 'Onayla ve Yükle'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
