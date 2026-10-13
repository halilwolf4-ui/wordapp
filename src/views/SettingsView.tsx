import React, { useState, useRef } from 'react';
import { UserSettings, BrutalDarkPalette } from '../types';
import { exportBackupFile, inspectBackupFile, restoreBackup, BackupPreview } from '../services/backup';
import { sound } from '../services/audio';
import { Download, Upload, Volume2, Sliders, ShieldCheck, Check, ArrowLeft, Sparkles, RotateCcw, Moon, Sun, Palette } from 'lucide-react';

const PALETTES: { id: BrutalDarkPalette; name: string; color: string; desc: string }[] = [
  { id: 'cyber-yellow', name: 'SİBER SARI', color: '#FFE600', desc: 'Klasik Neon Sarı' },
  { id: 'toxic-lime', name: 'ASİT YEŞİL', color: '#4ADE80', desc: 'Matrix Toksik Yeşil' },
  { id: 'neon-pink', name: 'CYBER PEMBE', color: '#FF5588', desc: 'Vaporwave Fuşya' },
  { id: 'cyan-glitch', name: 'BUZUL MAVİ', color: '#00F0FF', desc: 'Elektrik Glitch Camgöbeği' },
  { id: 'ultraviolet', name: 'ULTRA MOR', color: '#C084FC', desc: 'Neon Ametist Moru' },
  { id: 'monochrome', name: 'MONOKROM', color: '#FFFFFF', desc: 'Saf Siyah & Beyaz' },
];

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
  const [customColor, setCustomColor] = useState(settings.customDarkColor || '#FFE600');
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
    <div className="space-y-4 pb-28 pt-2 select-none text-black">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onClose}
          className="p-2 bg-white border-2 border-black shadow-[2px_2px_0px_0px_#000] text-black hover:bg-[#FFE600] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
        >
          <ArrowLeft size={18} strokeWidth={3} />
        </button>
        <h2 className="text-xl font-black text-black uppercase tracking-tight">AYARLAR</h2>
        <div className="w-8" />
      </div>

      {/* 1. Appearance, Night Mode & Color Tool (Görünüm & Gece Modu & Renk Aleti) */}
      <div className="bg-white border-4 border-black p-5 space-y-4 shadow-[6px_6px_0px_0px_#000] text-black">
        <div className="flex items-center justify-between border-b-2 border-black pb-2">
          <h3 className="text-sm font-black uppercase flex items-center space-x-2 tracking-tight">
            <Palette size={16} strokeWidth={2.5} />
            <span>GÖRÜNÜM & GECE MODU</span>
          </h3>
          <span className="text-[10px] font-black uppercase bg-[#FFE600] px-2 py-0.5 border border-black shadow-[1px_1px_0px_0px_#000]">
            NEO-BRUTALİST
          </span>
        </div>

        {/* Day / Night Mode Toggle */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => onUpdateSettings({ theme: 'light' })}
            className={`p-3 border-3 border-black text-left font-black uppercase transition-all flex flex-col justify-between ${
              settings.theme !== 'dark'
                ? 'bg-[#FFE600] text-black shadow-[4px_4px_0px_0px_#000] -translate-y-0.5'
                : 'bg-zinc-100 text-zinc-600 shadow-[2px_2px_0px_0px_#000] hover:bg-zinc-200'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <Sun size={20} strokeWidth={2.5} className="text-black" />
              {settings.theme !== 'dark' && (
                <span className="text-[10px] bg-black text-[#FFE600] px-1.5 py-0.5 font-black">
                  AKTİF
                </span>
              )}
            </div>
            <span className="text-xs font-black block">AÇIK MOD</span>
            <span className="text-[10px] font-bold text-zinc-700 normal-case">Krem kanvas & siyah gölgeler</span>
          </button>

          <button
            type="button"
            onClick={() => onUpdateSettings({ theme: 'dark' })}
            className={`p-3 border-3 border-black text-left font-black uppercase transition-all flex flex-col justify-between ${
              settings.theme === 'dark'
                ? 'bg-black text-[#FFE600] shadow-[4px_4px_0px_0px_#FFE600] -translate-y-0.5'
                : 'bg-zinc-100 text-zinc-600 shadow-[2px_2px_0px_0px_#000] hover:bg-zinc-200'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <Moon size={20} strokeWidth={2.5} className={settings.theme === 'dark' ? 'text-[#FFE600]' : 'text-black'} />
              {settings.theme === 'dark' && (
                <span className="text-[10px] bg-[#FFE600] text-black px-1.5 py-0.5 font-black">
                  AKTİF
                </span>
              )}
            </div>
            <span className="text-xs font-black block">GECE MODU</span>
            <span className="text-[10px] font-bold text-zinc-400 normal-case">Koyu kanvas & neon gölgeler</span>
          </button>
        </div>

        {/* Dark Mode Color Palette Section */}
        <div className="pt-2 border-t-2 border-black space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black uppercase block">
              GECE MODU RENK PALETİ
            </label>
            <span className="text-[10px] font-bold text-zinc-600">
              {settings.darkPalette === 'custom' ? 'Özel Renk Seçili' : '6 Hazır Stil'}
            </span>
          </div>

          {/* Palette Preset Grid */}
          <div className="grid grid-cols-3 gap-2">
            {PALETTES.map((pal) => {
              const isSelected = (settings.darkPalette || 'cyber-yellow') === pal.id;
              return (
                <button
                  key={pal.id}
                  type="button"
                  onClick={() => onUpdateSettings({ darkPalette: pal.id, theme: 'dark' })}
                  className={`p-2 border-2 border-black text-center transition-all flex flex-col items-center justify-between relative ${
                    isSelected
                      ? 'bg-zinc-100 shadow-[3px_3px_0px_0px_#000] ring-2 ring-black font-black'
                      : 'bg-white shadow-[1px_1px_0px_0px_#000] hover:bg-zinc-50'
                  }`}
                >
                  <div
                    className="w-full h-5 border border-black mb-1.5 flex items-center justify-center shadow-[1px_1px_0px_0px_#000]"
                    style={{ backgroundColor: pal.color }}
                  >
                    {isSelected && (
                      <Check size={12} strokeWidth={3} className="text-black" />
                    )}
                  </div>
                  <span className="text-[10px] font-black uppercase block leading-tight text-black">
                    {pal.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Color Tool (Renk Aleti) Card */}
          <div className="p-3 bg-[#FDFBF7] border-2 border-black space-y-2 shadow-[2px_2px_0px_0px_#000]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase text-black flex items-center space-x-1.5">
                <Palette size={14} strokeWidth={2.5} />
                <span>RENK ALETİ (ÖZEL RENK SEÇİCİ)</span>
              </span>
              {settings.darkPalette === 'custom' && (
                <span className="text-[9px] bg-black text-[#FFE600] px-1.5 py-0.5 font-black uppercase">
                  AKTİF
                </span>
              )}
            </div>
            <p className="text-[10px] font-bold text-zinc-600">
              İstediğin herhangi bir rengi seç, tüm gece modu gölgeleri ve vurguları bu renge uyarlansın.
            </p>

            <div className="flex items-center space-x-2 pt-1">
              {/* Native Color Picker */}
              <div
                className="relative w-10 h-10 border-2 border-black shrink-0 overflow-hidden shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                title="Renk Seçiciyi Aç"
              >
                <input
                  type="color"
                  value={customColor}
                  onChange={(e) => {
                    setCustomColor(e.target.value);
                    onUpdateSettings({
                      darkPalette: 'custom',
                      customDarkColor: e.target.value,
                      theme: 'dark'
                    });
                  }}
                  className="absolute inset-[-10px] w-[60px] h-[60px] cursor-pointer opacity-100"
                />
              </div>

              {/* Hex Code Input */}
              <input
                type="text"
                value={customColor}
                onChange={(e) => {
                  setCustomColor(e.target.value);
                  if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                    onUpdateSettings({
                      darkPalette: 'custom',
                      customDarkColor: e.target.value,
                      theme: 'dark'
                    });
                  }
                }}
                placeholder="#FFE600"
                className="flex-1 px-3 py-2 bg-white border-2 border-black font-mono font-black text-xs text-black uppercase shadow-[2px_2px_0px_0px_#000] focus:outline-none"
              />

              {/* Apply / Select Button */}
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({
                    darkPalette: 'custom',
                    customDarkColor: customColor,
                    theme: 'dark'
                  })
                }
                className="px-3 py-2 bg-black text-[#FFE600] border-2 border-black font-black uppercase text-xs shadow-[2px_2px_0px_0px_#FFE600] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
              >
                UYGULA
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Target Settings */}
      <div className="bg-white border-4 border-black p-5 space-y-4 shadow-[6px_6px_0px_0px_#000] text-black">
        <h3 className="text-sm font-black text-black uppercase flex items-center space-x-2 tracking-tight border-b-2 border-black pb-2">
          <Sliders size={16} strokeWidth={2.5} className="text-black" />
          <span>ÇALIŞMA HEDEFLERİ</span>
        </h3>

        {/* Daily New Target */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-xs font-black text-black block uppercase">
              GÜNLÜK YENİ KELİME HEDEFİ
            </label>
            <span className="text-[11px] font-semibold text-zinc-700">Her gün öğrenilecek yeni kelime</span>
          </div>
          <select
            value={settings.dailyNewTarget}
            onChange={(e) => onUpdateSettings({ dailyNewTarget: Number(e.target.value) })}
            className="bg-white border-2 border-black px-3 py-1.5 text-xs font-black text-black shadow-[2px_2px_0px_0px_#000] focus:outline-none"
          >
            {[5, 10, 15, 20, 30].map(n => (
              <option key={n} value={n}>{n} KELİME</option>
            ))}
          </select>
        </div>

        {/* Daily Review Limit */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-xs font-black text-black block uppercase">
              GÜNLÜK TEKRAR LİMİTİ
            </label>
            <span className="text-[11px] font-semibold text-zinc-700">Günde sorulacak maksimum tekrar sayısı</span>
          </div>
          <select
            value={settings.dailyReviewLimit}
            onChange={(e) => onUpdateSettings({ dailyReviewLimit: Number(e.target.value) })}
            className="bg-white border-2 border-black px-3 py-1.5 text-xs font-black text-black shadow-[2px_2px_0px_0px_#000] focus:outline-none"
          >
            {[20, 30, 40, 50, 75, 100].map(n => (
              <option key={n} value={n}>{n} TEKRAR</option>
            ))}
          </select>
        </div>

        {/* Prioritize Custom Words Toggle */}
        <div className="flex items-center justify-between pt-1 border-t-2 border-black">
          <div>
            <label className="text-xs font-black text-black uppercase flex items-center space-x-1.5">
              <Sparkles size={14} strokeWidth={2.5} />
              <span>ÖZEL KELİMELERİME ÖNCELİK VER</span>
            </label>
            <span className="text-[11px] font-semibold text-zinc-700">
              Özel eklenen veya Reword kelimeleri sıralamada en başa alır
            </span>
          </div>
          <input
            type="checkbox"
            checked={settings.prioritizeCustomWords}
            onChange={(e) => onUpdateSettings({ prioritizeCustomWords: e.target.checked })}
            className="w-5 h-5 accent-black border-2 border-black cursor-pointer"
          />
        </div>

        {/* Surprise Mastered Check */}
        <div className="flex items-center justify-between pt-1 border-t-2 border-black">
          <div>
            <label className="text-xs font-black text-black block uppercase">
              SÜRPRİZ MASTERED KONTROLÜ
            </label>
            <span className="text-[11px] font-semibold text-zinc-700">
              60 günde bir rastgele 5 mastered kelimeyi hatırlatma amaçlı sor
            </span>
          </div>
          <input
            type="checkbox"
            checked={settings.surpriseMasteredCheck}
            onChange={(e) => onUpdateSettings({ surpriseMasteredCheck: e.target.checked })}
            className="w-5 h-5 accent-black border-2 border-black cursor-pointer"
          />
        </div>
      </div>

      {/* Audio & Haptic Settings */}
      <div className="bg-white border-4 border-black p-5 space-y-4 shadow-[6px_6px_0px_0px_#000] text-black">
        <h3 className="text-sm font-black text-black uppercase flex items-center space-x-2 tracking-tight border-b-2 border-black pb-2">
          <Volume2 size={16} strokeWidth={2.5} className="text-black" />
          <span>SES VE TİTREŞİM</span>
        </h3>

        {/* Sound FX */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-xs font-black text-black block uppercase">
              SES EFEKTLERİ
            </label>
            <span className="text-[11px] font-semibold text-zinc-700">Doğru/yanlış cevap sesleri</span>
          </div>
          <input
            type="checkbox"
            checked={settings.soundEffects}
            onChange={(e) => {
              onUpdateSettings({ soundEffects: e.target.checked });
              sound.setPreferences(e.target.checked, settings.vibration);
            }}
            className="w-5 h-5 accent-black border-2 border-black cursor-pointer"
          />
        </div>

        {/* Vibration */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-xs font-black text-black block uppercase">
              TİTREŞİM GERİ BİLDİRİMİ
            </label>
            <span className="text-[11px] font-semibold text-zinc-700">Cevaplarda kısa haptik titreşim</span>
          </div>
          <input
            type="checkbox"
            checked={settings.vibration}
            onChange={(e) => {
              onUpdateSettings({ vibration: e.target.checked });
              sound.setPreferences(settings.soundEffects, e.target.checked);
            }}
            className="w-5 h-5 accent-black border-2 border-black cursor-pointer"
          />
        </div>

        {/* Speech Speed */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-xs font-black text-black block uppercase">
              İNGİLİZCE TELAFFUZ HIZI
            </label>
            <span className="text-[11px] font-semibold text-zinc-700">{settings.speechSpeed}x</span>
          </div>
          <select
            value={settings.speechSpeed}
            onChange={(e) => onUpdateSettings({ speechSpeed: Number(e.target.value) })}
            className="bg-white border-2 border-black px-3 py-1.5 text-xs font-black text-black shadow-[2px_2px_0px_0px_#000] focus:outline-none"
          >
            {[0.7, 0.8, 0.9, 1.0, 1.2].map(speed => (
              <option key={speed} value={speed}>{speed}x</option>
            ))}
          </select>
        </div>
      </div>

      {/* Backup & Restore Section */}
      <div className="bg-white border-4 border-black p-5 space-y-4 shadow-[6px_6px_0px_0px_#000] text-black">
        <div className="flex items-center justify-between border-b-2 border-black pb-2">
          <h3 className="text-sm font-black text-black uppercase flex items-center space-x-2 tracking-tight">
            <ShieldCheck size={16} strokeWidth={2.5} className="text-black" />
            <span>YEDEKLEME VE GERİ YÜKLEME</span>
          </h3>
          {settings.lastBackupDate && (
            <span className="text-[10px] font-black bg-[#FFE600] border border-black px-1.5 py-0.5">
              {settings.lastBackupDate}
            </span>
          )}
        </div>

        <p className="text-xs font-bold text-zinc-800">
          Tüm ilerlemenizi, özel kelimelerinizi ve istatistiklerinizi tek tıkla cihazınıza indirin veya geri yükleyin.
        </p>

        <div className="grid grid-cols-2 gap-3 pt-1">
          {/* Export */}
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="py-3 px-4 bg-[#4ADE80] text-black border-2 border-black font-black uppercase text-xs shadow-[3px_3px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none flex items-center justify-center space-x-2 transition-all"
          >
            <Download size={16} strokeWidth={2.5} />
            <span>{isExporting ? 'HAZIRLANIYOR...' : 'YEDEK AL'}</span>
          </button>

          {/* Import */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="py-3 px-4 bg-[#FFE600] text-black border-2 border-black font-black uppercase text-xs shadow-[3px_3px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none flex items-center justify-center space-x-2 transition-all"
          >
            <Upload size={16} strokeWidth={2.5} />
            <span>YEDEKTEN YÜKLE</span>
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
      <div className="bg-white border-4 border-black p-5 space-y-4 shadow-[6px_6px_0px_0px_#000] text-black">
        <h3 className="text-sm font-black text-black uppercase flex items-center space-x-2 tracking-tight border-b-2 border-black pb-2">
          <Sliders size={16} strokeWidth={2.5} className="text-black" />
          <span>KATEGORİ SEÇİMİ ({settings.enabledCategories?.length || 0} AÇIK)</span>
        </h3>
        <p className="text-xs font-bold text-zinc-700">
          Çalışmak istediğin kelime gruplarını açıp kapatabilirsin.
        </p>

        <div className="grid grid-cols-2 gap-2 pt-1 max-h-64 overflow-y-auto pr-1">
          {Object.entries(categoryNames).map(([key, name]) => {
            const isEnabled = settings.enabledCategories?.includes(key);
            return (
              <button
                key={key}
                onClick={() => toggleCategory(key)}
                className={`p-2.5 border-2 border-black text-left text-xs font-black uppercase flex items-center justify-between transition-all ${
                  isEnabled
                    ? 'bg-[#BBF7D0] text-black shadow-[2px_2px_0px_0px_#000]'
                    : 'bg-zinc-100 text-zinc-500 opacity-60'
                }`}
              >
                <span className="truncate pr-1">{name || key}</span>
                {isEnabled && <Check size={14} strokeWidth={3} className="text-black shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Danger Zone: Reset Progress */}
      <div className="bg-[#FFE4E6] border-4 border-black p-5 space-y-3 shadow-[6px_6px_0px_0px_#000] text-black">
        <h3 className="text-sm font-black text-black uppercase flex items-center space-x-2 tracking-tight border-b-2 border-black pb-2">
          <RotateCcw size={16} strokeWidth={3} className="text-[#FF5588]" />
          <span>İLERLEMEYİ SIFIRLA (BAŞTAN BAŞLA)</span>
        </h3>
        <p className="text-xs font-bold text-zinc-800 leading-relaxed">
          Öğrenilen kelimeleri, tekrarları, XP ve seriyi sıfırlar. Kelimelerin silinmez; tüm kelimelerin Öğren sekmesinde en baştan sıfır olarak açılır.
        </p>
        <button
          onClick={handleResetProgressClick}
          className="w-full py-3.5 px-4 bg-[#FF5588] text-black border-[3px] border-black font-black uppercase text-xs shadow-[4px_4px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center space-x-2"
        >
          <RotateCcw size={15} strokeWidth={3} />
          <span>TÜM ÇALIŞMA İLERLEMESİNİ SIFIRLA</span>
        </button>
      </div>

      {/* Backup Preview & Restore Modal */}
      {previewModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black w-full max-w-md p-6 space-y-4 shadow-[8px_8px_0px_0px_#000] text-black animate-scaleUp">
            <h3 className="text-lg font-black uppercase tracking-tight border-b-2 border-black pb-2">YEDEK ÖNİZLEMESİ</h3>

            <div className="bg-[#FDFBF7] p-4 border-2 border-black text-xs space-y-2 text-black font-bold shadow-[2px_2px_0px_0px_#000]">
              <div className="flex justify-between">
                <span>Kelime İlerlemesi:</span>
                <span className="font-black">{previewModal.progressCount} KELİME</span>
              </div>
              <div className="flex justify-between">
                <span>Özel Kelimeler:</span>
                <span className="font-black">{previewModal.customWordCount} ADET</span>
              </div>
              <div className="flex justify-between">
                <span>Seviye & XP:</span>
                <span className="font-black">LV.{previewModal.level} ({previewModal.totalXp} XP)</span>
              </div>
              <div className="flex justify-between">
                <span>Seri:</span>
                <span className="font-black">{previewModal.streak} GÜN</span>
              </div>
              {previewModal.lastStudyDate && (
                <div className="flex justify-between">
                  <span>Son Çalışma:</span>
                  <span className="font-black">{previewModal.lastStudyDate}</span>
                </div>
              )}
            </div>

            {/* Merge toggle */}
            <div className="bg-white p-3 border-2 border-black flex items-center justify-between text-xs shadow-[2px_2px_0px_0px_#000]">
              <div>
                <span className="font-black block uppercase">BİRLEŞTİREREK YÜKLE</span>
                <span className="text-[11px] font-bold text-zinc-600">Mevcut veriyi silmeden korur</span>
              </div>
              <input
                type="checkbox"
                checked={mergeMode}
                onChange={(e) => setMergeMode(e.target.checked)}
                className="w-5 h-5 accent-black border-2 border-black cursor-pointer"
              />
            </div>

            {restoreSuccess ? (
              <div className="p-3 bg-[#4ADE80] text-black text-center font-black uppercase border-2 border-black">
                ✓ BAŞARIYLA GERİ YÜKLENDİ!
              </div>
            ) : (
              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPreviewModal(null)}
                  className="flex-1 py-3 bg-white text-black border-2 border-black font-black uppercase text-xs shadow-[2px_2px_0px_0px_#000]"
                >
                  İPTAL
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRestore}
                  disabled={isRestoring}
                  className="flex-1 py-3 bg-black text-[#FFE600] border-2 border-black font-black uppercase text-xs shadow-[3px_3px_0px_0px_#FFE600]"
                >
                  {isRestoring ? 'YÜKLENİYOR...' : 'ONAYLA VE YÜKLE'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
