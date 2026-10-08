import { BadgeDefinition } from '../types';

export const BADGES: BadgeDefinition[] = [
  { id: 'first_word', title: 'İlk Adım', description: 'İlk kelimeyi başarıyla öğren', icon: '🌱' },
  { id: 'words_25', title: 'Kelime Çırağı', description: '25 kelimeyi tamamla', icon: '🥉' },
  { id: 'words_100', title: 'Kelime Ustası', description: '100 kelimeyi tamamla', icon: '🥇' },
  { id: 'words_500', title: 'Sözlük Fatihi', description: '500 kelimeyi hafızaya kazı', icon: '👑' },
  { id: 'streak_3', title: 'Isınma Turu', description: '3 gün kesintisiz seri yap', icon: '⚡' },
  { id: 'streak_7', title: 'Haftalık Zafer', description: '7 gün üst üste çalış', icon: '🔥' },
  { id: 'streak_21', title: 'Alışkanlık Canavarı', description: '21 günlük efsanevi seriye ulaş', icon: '💎' },
  { id: 'combo_10', title: 'Kombo Kralı', description: 'Üst üste 10 doğru cevap ver', icon: '🎯' },
  { id: 'speed_20', title: 'Şimşek Hızı', description: 'Hızlı Turda 20 kelime bil', icon: '⚡' },
  { id: 'custom_creator', title: 'Özgün Yazar', description: 'Kendi kelimeni ekle', icon: '✍️' }
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
