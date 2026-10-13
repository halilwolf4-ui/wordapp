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
    <div className="bg-[#FFE600] border-b-[3px] border-black px-3.5 py-2 flex items-center justify-between text-xs text-black font-black select-none shadow-[0_2px_0px_0px_#000]">
      <div className="flex items-center space-x-2 flex-1 pr-2">
        <div className="bg-black text-[#FFE600] p-1 border border-black shrink-0">
          <AlertTriangle size={14} strokeWidth={3} />
        </div>
        <span className="tracking-tight uppercase">DİKKAT: Verilerini kaybetmemek için düzenli yedek al!</span>
      </div>
      <div className="flex items-center space-x-2 shrink-0">
        <button
          onClick={handleQuickBackup}
          disabled={exporting}
          className="flex items-center space-x-1 bg-black text-white hover:bg-zinc-800 font-black px-3 py-1 border-2 border-black text-[11px] shadow-[2px_2px_0px_0px_#fff] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all uppercase"
        >
          <Download size={13} strokeWidth={3} />
          <span>{exporting ? 'Yedekleniyor' : 'Yedek Al'}</span>
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="w-6 h-6 bg-white border border-black flex items-center justify-center text-black hover:bg-zinc-100"
          title="Kapat"
        >
          <X size={14} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
};
