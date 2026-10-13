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
    <div className="bg-[#00F0FF] border-[3px] border-black p-3 mb-3.5 shadow-[4px_4px_0px_0px_#000] flex items-center justify-between text-xs animate-fadeIn select-none text-black">
      <div className="flex items-center space-x-2.5 min-w-0 pr-2">
        <div className="w-8 h-8 bg-white border-2 border-black flex items-center justify-center text-black shrink-0 shadow-[2px_2px_0px_0px_#000]">
          <Smartphone size={16} strokeWidth={2.5} />
        </div>
        <div className="truncate">
          <span className="font-black text-black block truncate text-xs uppercase tracking-tight">UYGULAMAYI YÜKLE</span>
          <span className="text-[11px] font-bold text-zinc-900 block truncate">Tam ekran kesintisiz mobil deneyim</span>
        </div>
      </div>

      <div className="flex items-center space-x-2 shrink-0">
        <button
          onClick={handleInstallClick}
          className="py-1 px-3 bg-black text-white hover:bg-zinc-800 font-black text-xs border-2 border-black flex items-center space-x-1.5 shadow-[2px_2px_0px_0px_#FFE600] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all uppercase"
        >
          <Download size={13} strokeWidth={3} />
          <span>YÜKLE</span>
        </button>
        <button
          onClick={handleDismiss}
          className="w-6 h-6 bg-white border border-black flex items-center justify-center text-black hover:bg-zinc-100"
          title="Kapat"
        >
          <X size={14} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
};
