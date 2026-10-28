import React, { useState } from 'react';
import { AlertTriangle, X, Download } from 'lucide-react';
import { exportBackupFile } from '../services/backup';

interface Props {
  lastBackupDate?: string;
  onBackupCompleted?: () => void;
}

export const BackupReminderBanner: React.FC<Props> = ({
  lastBackupDate,
  onBackupCompleted
}) => {
  const [dismissed, setDismissed] = useState(false);
  const [exporting, setExporting] = useState(false);

  if (dismissed) return null;

  // Check if last backup was > 7 days ago
  let needsReminder = false;
  if (!lastBackupDate) {
    needsReminder = true;
  } else {
    const diffDays = Math.floor((Date.now() - new Date(lastBackupDate).getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 7) {
      needsReminder = true;
    }
  }

  if (!needsReminder) return null;

  const handleQuickBackup = async () => {
    setExporting(true);
    try {
      await exportBackupFile();
      onBackupCompleted?.();
      setDismissed(true);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      data-light-pill="true"
      className="bg-[#FFF4BD] border-b border-amber-300/80 px-3.5 py-2.5 flex items-center justify-between text-xs text-[#0F172A] font-extrabold select-none shadow-sm"
    >
      <div className="flex items-center space-x-2.5 flex-1 pr-2">
        <div className="bg-[#FF6B5B] text-white p-1.5 rounded-[10px] shrink-0 shadow-sm">
          <AlertTriangle size={14} strokeWidth={2.8} className="text-white" />
        </div>
        <span className="tracking-tight text-[#0F172A] font-extrabold">
          DİKKAT: Verilerini kaybetmemek için düzenli yedek al!
        </span>
      </div>
      <div className="flex items-center space-x-2 shrink-0">
        <button
          onClick={handleQuickBackup}
          disabled={exporting}
          className="flex items-center space-x-1 bg-[#FF6B5B] text-white hover:opacity-95 font-extrabold px-3 py-1.5 rounded-full text-[11px] shadow-sm transition-all uppercase"
        >
          <Download size={13} strokeWidth={2.8} className="text-white" />
          <span className="text-white">{exporting ? 'Yedekleniyor' : 'Yedek Al'}</span>
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="w-7 h-7 bg-white/80 rounded-full border border-amber-400/50 flex items-center justify-center text-[#0F172A] hover:bg-white transition-all"
          title="Kapat"
        >
          <X size={14} strokeWidth={2.8} />
        </button>
      </div>
    </div>
  );
};
