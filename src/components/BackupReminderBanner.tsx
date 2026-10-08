import React, { useState } from 'react';
import { AlertCircle, X, Download } from 'lucide-react';
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
    <div className="bg-gradient-to-r from-amber-500/15 to-orange-500/15 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between text-xs text-amber-200">
      <div className="flex items-center space-x-2 flex-1 pr-2">
        <AlertCircle size={16} className="text-amber-400 shrink-0" />
        <span>İlerlemenizi kaybetmemek için düzenli yedek alın!</span>
      </div>
      <div className="flex items-center space-x-2 shrink-0">
        <button
          onClick={handleQuickBackup}
          disabled={exporting}
          className="flex items-center space-x-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-2.5 py-1 rounded-md text-[11px] transition-all"
        >
          <Download size={12} />
          <span>{exporting ? 'Alınıyor...' : 'Yedekle'}</span>
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 text-slate-400 hover:text-slate-200"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
