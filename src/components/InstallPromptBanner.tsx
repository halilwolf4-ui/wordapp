import React, { useState, useEffect } from 'react';
import { Download, Smartphone, X } from 'lucide-react';

export const InstallPromptBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem('kelime_avi_pwa_dismissed') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    // Check if already opened as PWA standalone app
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(isStandaloneMode);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleDismiss = () => {
    try {
      localStorage.setItem('kelime_avi_pwa_dismissed', '1');
    } catch {}
    setDismissed(true);
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      alert(
        'Uygulama olarak yüklemek için:\n1. Chrome sağ üst köşedeki üç noktaya (⋮) dokunun.\n2. "Uygulamayı Yükle" veya "Ana Ekrana Ekle" seçeneğini seçin.'
      );
    }
  };

  if (isStandalone || dismissed) {
    return null;
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 mb-3 shadow-sm flex items-center justify-between text-xs animate-fadeIn select-none">
      <div className="flex items-center space-x-2.5 min-w-0 pr-2">
        <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
          <Smartphone size={16} />
        </div>
        <div className="truncate">
          <span className="font-bold text-white block truncate">Uygulamayı Yükle</span>
          <span className="text-[11px] text-slate-400 block truncate">Tam ekran hızlı mobil deneyim</span>
        </div>
      </div>

      <div className="flex items-center space-x-1.5 shrink-0">
        <button
          onClick={handleInstallClick}
          className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-[11px] font-bold rounded-lg flex items-center space-x-1.5 shadow-sm transition-all"
        >
          <Download size={13} />
          <span>Yükle</span>
        </button>
        <button
          onClick={handleDismiss}
          className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
          title="Kapat"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
};
