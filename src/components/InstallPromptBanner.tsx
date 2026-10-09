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
    <div className="bg-gradient-to-r from-indigo-900/80 via-purple-900/80 to-slate-900/80 border border-indigo-500/30 rounded-xl p-2.5 mb-2.5 shadow-md backdrop-blur-md flex items-center justify-between animate-fadeIn text-xs">
      <div className="flex items-center space-x-2.5 min-w-0 pr-2">
        <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow">
          <Smartphone size={16} />
        </div>
        <div className="truncate">
          <span className="font-bold text-white block truncate">Uygulamayı Yükle</span>
          <span className="text-[10px] text-indigo-200/80 block truncate">Tam ekran mobil deneyim</span>
        </div>
      </div>

      <div className="flex items-center space-x-1.5 shrink-0">
        <button
          onClick={handleInstallClick}
          className="py-1 px-2.5 bg-indigo-500 hover:bg-indigo-600 active:scale-95 text-white text-[11px] font-bold rounded-lg flex items-center space-x-1 shadow transition-all"
        >
          <Download size={13} />
          <span>Yükle</span>
        </button>
        <button
          onClick={handleDismiss}
          className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          title="Kapat"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
