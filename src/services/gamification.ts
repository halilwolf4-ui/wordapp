import { BadgeDefinition } from '../types';

export const BADGES: BadgeDefinition[] = [
  // --- KELİME ROZETLERİ (Words) ---
  { id: 'first_word', title: 'İlk Adım', description: 'İlk kelimeyi başarıyla öğren', icon: '🌱', category: 'words' },
  { id: 'words_25', title: 'Kelime Çırağı', description: '25 kelimeyi tamamla', icon: '🥉', category: 'words' },
  { id: 'words_100', title: 'Kelime Avcısı', description: '100 kelimeyi tamamla', icon: '🥈', category: 'words' },
  { id: 'words_250', title: 'Çalışkan Kaşif', description: '250 kelimeyi tamamla', icon: '📚', category: 'words' },
  { id: 'words_500', title: 'Kelime Ustası', description: '500 kelimeyi tamamla', icon: '🥇', category: 'words' },
  { id: 'words_1000', title: 'Sözlük Fatihi', description: '1.000 kelimeyi hafızaya kazı', icon: '👑', category: 'words' },
  { id: 'words_2000', title: 'Kelime Samurayı', description: '2.000 kelimeyi hafızaya kazı', icon: '🗡️', category: 'words' },
  { id: 'words_3000', title: 'Kelime Efsanesi', description: '3.000 kelimeyi hafızaya kazı', icon: '🏛️', category: 'words' },

  // --- SERİ ROZETLERİ (Streaks) ---
  { id: 'streak_3', title: 'Isınma Turu', description: '3 gün kesintisiz seri yap', icon: '⚡', category: 'streak' },
  { id: 'streak_7', title: 'Haftalık Zafer', description: '7 gün üst üste çalış', icon: '🔥', category: 'streak' },
  { id: 'streak_14', title: 'İstikrar Yıldızı', description: '14 gün kesintisiz seri', icon: '⭐', category: 'streak' },
  { id: 'streak_21', title: 'Alışkanlık Canavarı', description: '21 günlük efsanevi seriye ulaş', icon: '💎', category: 'streak' },
  { id: 'streak_30', title: 'Aylık Şampiyon', description: '30 gün kesintisiz disiplin', icon: '🛡️', category: 'streak' },
  { id: 'streak_50', title: 'Yenilmez Savaşçı', description: '50 gün kesintisiz seri', icon: '⚔️', category: 'streak' },
  { id: 'streak_100', title: 'Seri Kralı', description: '100 günlük efsanevi seri', icon: '🏆', category: 'streak' },

  // --- HIZLI TUR ROZETLERİ (Speed Round) ---
  { id: 'speed_10', title: 'Hızlı Başlangıç', description: 'Hızlı Turda 10 doğru cevap ver', icon: '⏱️', category: 'speed' },
  { id: 'speed_20', title: 'Şimşek Hızı', description: 'Hızlı Turda 20 doğru cevap ver', icon: '⚡', category: 'speed' },
  { id: 'speed_30', title: 'Keskin Nişancı', description: 'Hızlı Turda 30 doğru cevap ver', icon: '🎯', category: 'speed' },
  { id: 'speed_40', title: 'Kasırga', description: 'Hızlı Turda 40 doğru cevap ver', icon: '🌪️', category: 'speed' },
  { id: 'speed_50', title: 'Refleks Ustası', description: 'Hızlı Turda 50 doğru cevap ver', icon: '🥋', category: 'speed' },
  { id: 'speed_100', title: 'Hız Kralı', description: 'Hızlı Turda 100 doğru kelime bil', icon: '👑', category: 'speed' },

  // --- MASTER ROZETLERİ (Mastered Words) ---
  { id: 'master_50', title: 'Master Zihin', description: '50 kelimeyi mastered yap', icon: '🧠', category: 'master' },
  { id: 'master_100', title: 'Usta Zihin', description: '100 kelimeyi mastered yap', icon: '🔮', category: 'master' },
  { id: 'master_200', title: 'Hafıza Samurayı', description: '200 kelimeyi mastered yap', icon: '🗡️', category: 'master' },
  { id: 'master_500', title: 'Kusursuz Bellek', description: '500 kelimeyi mastered yap', icon: '💎', category: 'master' },
  { id: 'master_1000', title: 'Master Kralı', description: '1.000 kelimeyi mastered yap', icon: '👑', category: 'master' },

  // --- ÖZEL / DİĞER ROZETLER (Special) ---
  { id: 'combo_10', title: 'Kombo Çırağı', description: 'Üst üste 10 doğru cevap ver', icon: '🎯', category: 'special' },
  { id: 'combo_25', title: 'Kombo Kralı', description: 'Üst üste 25 doğru cevap ver', icon: '💥', category: 'special' },
  { id: 'custom_creator', title: 'Özgün Yazar', description: 'Kendi özel kelimeni ekle', icon: '✍️', category: 'special' }
];

export function calculateLevel(xp: number): number {
  return Math.floor(Math.sqrt(xp / 80)) + 1;
}

export function xpForNextLevel(currentLevel: number): number {
  return currentLevel * currentLevel * 80;
}

export function getComboMultiplier(combo: number): number {
  if (combo >= 15) return 2.5;
  if (combo >= 10) return 2.0;
  if (combo >= 5) return 1.5;
  if (combo >= 3) return 1.2;
  return 1.0;
}

export function checkUnlockedBadges(params: {
  currentBadges: string[];
  totalLearned: number;
  streak: number;
  speedScore?: number;
  masteredCount?: number;
  comboCount?: number;
  hasCustomWord?: boolean;
}): string[] {
  const existing = new Set(params.currentBadges || []);

  // Words
  if (params.totalLearned >= 1) existing.add('first_word');
  if (params.totalLearned >= 25) existing.add('words_25');
  if (params.totalLearned >= 100) existing.add('words_100');
  if (params.totalLearned >= 250) existing.add('words_250');
  if (params.totalLearned >= 500) existing.add('words_500');
  if (params.totalLearned >= 1000) existing.add('words_1000');
  if (params.totalLearned >= 2000) existing.add('words_2000');
  if (params.totalLearned >= 3000) existing.add('words_3000');

  // Streaks
  if (params.streak >= 3) existing.add('streak_3');
  if (params.streak >= 7) existing.add('streak_7');
  if (params.streak >= 14) existing.add('streak_14');
  if (params.streak >= 21) existing.add('streak_21');
  if (params.streak >= 30) existing.add('streak_30');
  if (params.streak >= 50) existing.add('streak_50');
  if (params.streak >= 100) existing.add('streak_100');

  // Speed Round
  const speed = params.speedScore || 0;
  if (speed >= 10) existing.add('speed_10');
  if (speed >= 20) existing.add('speed_20');
  if (speed >= 30) existing.add('speed_30');
  if (speed >= 40) existing.add('speed_40');
  if (speed >= 50) existing.add('speed_50');
  if (speed >= 100) existing.add('speed_100');

  // Master Badges
  const mastered = params.masteredCount || 0;
  if (mastered >= 50) existing.add('master_50');
  if (mastered >= 100) existing.add('master_100');
  if (mastered >= 200) existing.add('master_200');
  if (mastered >= 500) existing.add('master_500');
  if (mastered >= 1000) existing.add('master_1000');

  // Special
  if (params.hasCustomWord) existing.add('custom_creator');
  if ((params.comboCount || 0) >= 10) existing.add('combo_10');
  if ((params.comboCount || 0) >= 25) existing.add('combo_25');

  return Array.from(existing);
}

