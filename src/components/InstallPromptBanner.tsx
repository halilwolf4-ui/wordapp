import React, { useState, useEffect } from 'react';
import { Download, Smartphone, X } from 'lucide-react';

export const InstallPromptBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);

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

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      // Guide user if browser event not fired yet
      alert(
        'Uygulama olarak yüklemek için:\n1. Chrome sağ üst köşedeki üç noktaya (⋮) dokunun.\n2. "Uygulamayı Yükle" veya "Ana Ekrana Ekle" seçeneğini seçin.'
      );
    }
  };

  if (isStandalone || dismissed) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-indigo-900/90 via-purple-900/90 to-slate-900/90 border border-indigo-500/40 rounded-2xl p-3.5 mb-4 shadow-xl backdrop-blur-md relative animate-fadeIn">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2.5 right-2.5 text-slate-400 hover:text-white p-1 rounded-full"
        title="Kapat"
      >
        <X size={16} />
      </button>

      <div className="flex items-center space-x-3 pr-6">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-lg">
          <Smartphone size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-white truncate">Uygulamayı Telefona İndir</h4>
          <p className="text-xs text-indigo-200/80">Tam ekran mobil uygulama deneyimi</p>
        </div>
      </div>

      <div className="mt-3">
        <button
          onClick={handleInstallClick}
          className="w-full py-2.5 px-4 bg-indigo-500 hover:bg-indigo-600 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-2 shadow-md transition-all"
        >
          <Download size={16} />
          <span>Telefona Yükle (Ana Ekrana Ekle)</span>
        </button>
      </div>
    </div>
  );
};
