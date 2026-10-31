export interface SnakeGameConfig {
  initialDistance: number;       // Saniye cinsinden başlangıç mesafesi (default: 60)
  maxDistance: number;           // Mesafe tavanı (default: 120)
  minDistance: number;           // Oyun bitiş mesafesi (default: 0)
  
  initialSpeedMultiplier: number;// Başlangıç hız çarpanı (default: 1.0)
  maxSpeedMultiplier: number;    // Hız çarpanı tavanı (default: 2.0)
  speedMultiplierIncrement: number; // Her yanlışta hız artış oranı (default: 1.04)

  wrongPenaltyDistance: number;  // Yanlış cevap mesafe cezası (default: 4 saniye)

  // Serpentine Yol & Yılan Tasarım Parametreleri
  pathRows: number;              // Zikzak düz yol sayısı (default: 6)
  turnSec: number;               // Her bir U dönüşünün süresi (default: 2 sn)
  snakeBodySec: number;          // Yılan gövdesinin uzunluğu (saniye cinsinden, default: 12 sn)

  // Kelime Tekrar & Dağılım Parametreleri
  maxAsksPerWord: number;        // Bir kelimenin oyunda en fazla sorulma sayısı (default: 2)
  retryGapMin: number;           // Yanlış/pas tekrarı için minimum kelime aralığı (default: 6)
  retryGapMax: number;           // Yanlış/pas tekrarı için maksimum kelime aralığı (default: 10)
  weakWordShare: number;         // DB'deki geçmiş zayıf kelimelerin sorulma payı (default: 0.25 - %25)

  // Kombo Ödül Adımları
  comboSteps: {
    step1Count: number;          // 3 doğru
    step1Bonus: number;          // +%20 ödül
    step2Count: number;          // 5 doğru
    step2Bonus: number;          // +%40 ödül
  };
  
  // Seviyelere göre doğru cevap mesafe ödülleri (saniye)
  rewardsByLevel: {
    A1: number;
    A2: number;
    B1: number;
    B2: number;
    C1: number;
    C2: number;
    default: number;
  };

  // Seviye ağırlıkları (toplam ~1.0)
  levelWeights: {
    A1_A2: number; // 0.10 (%10)
    B1: number;    // 0.20 (%20)
    B2: number;    // 0.25 (%25)
    C1: number;    // 0.25 (%25)
    C2: number;    // 0.20 (%20)
  };

  userWordsRatio: number;        // Kullanıcının çalıştığı kelimelerden gelme oranı (0.70)

  wrongReviewDurationMs: number; // Yanlış cevap gösterilme ve yılanın duraklama süresi (2000 ms)
  passReviewDurationMs: number;  // Pas cevap gösterilme ve yılanın duraklama süresi (1500 ms)
  correctFlashDurationMs: number;// Doğru cevap bildirim süresi (800 ms)
}

export const DEFAULT_SNAKE_CONFIG: SnakeGameConfig = {
  initialDistance: 60,
  maxDistance: 120, // 90'dan 120'ye çıkarıldı
  minDistance: 0,

  initialSpeedMultiplier: 1.0,
  maxSpeedMultiplier: 2.0,
  speedMultiplierIncrement: 1.04,

  wrongPenaltyDistance: 4,

  pathRows: 6,
  turnSec: 2,
  snakeBodySec: 12,

  maxAsksPerWord: 2,
  retryGapMin: 6,
  retryGapMax: 10,
  weakWordShare: 0.25,

  comboSteps: {
    step1Count: 3,
    step1Bonus: 0.20, // +%20
    step2Count: 5,
    step2Bonus: 0.40  // +%40
  },

  rewardsByLevel: {
    A1: 3,
    A2: 3,
    B1: 5,
    B2: 6,
    C1: 7,
    C2: 8,
    default: 5
  },

  levelWeights: {
    A1_A2: 0.10,
    B1: 0.20,
    B2: 0.25,
    C1: 0.25,
    C2: 0.20
  },

  userWordsRatio: 0.70,

  wrongReviewDurationMs: 2000,
  passReviewDurationMs: 1500,
  correctFlashDurationMs: 800
};
