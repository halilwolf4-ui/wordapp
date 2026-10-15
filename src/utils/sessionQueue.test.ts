import { describe, it, expect } from 'vitest';
import { syncAndSelectNextQuestion, PoolQueueItem, GenericSessionItem } from './sessionQueue';
import { Word } from '../types';

describe('sessionQueue - 5 Kelimelik Tampon Döngüsü ve Minimum 5 Soru Aralık Kuralı', () => {
  const createMockWord = (id: number, en: string, tr: string): Word => ({
    id,
    en,
    tr,
    examples: [],
    categories: ['top100']
  });

  const word1 = createMockWord(1, 'apple', 'elma');
  const buffer2 = createMockWord(2, 'book', 'kitap');
  const buffer3 = createMockWord(3, 'car', 'araba');
  const buffer4 = createMockWord(4, 'dog', 'köpek');
  const buffer5 = createMockWord(5, 'elephant', 'fil');
  const buffer6 = createMockWord(6, 'flower', 'çiçek');

  const allWordsMap = new Map<number, Word>([
    [1, word1],
    [2, buffer2],
    [3, buffer3],
    [4, buffer4],
    [5, buffer5],
    [6, buffer6]
  ]);

  const candidateBuffers = [buffer2, buffer3, buffer4, buffer5, buffer6];

  it('hedefte sadece 1 kelime kaldığında havuzda 4 farklı buffer kelime ile toplam en az 5 kelimelik döngü oluşturur', () => {
    const list: GenericSessionItem[] = [
      {
        word: word1,
        choicePassed: false,
        typingPassed: false,
        choicePassedAtStep: null,
        lastAskedStep: null
      }
    ];

    const currentQueue: PoolQueueItem[] = [];
    const bufferLastAskedMap = new Map<number, number>();

    const res = syncAndSelectNextQuestion({
      list,
      currentStep: 1,
      excludeWordId: null,
      currentQueue,
      candidateBuffers,
      allWordsMap,
      bufferLastAskedMap
    });

    expect(res).not.toBeNull();
    // İlk seçilen hedef kelimedir
    expect(res!.chosenWord.id).toBe(1);
    expect(res!.isBuffer).toBe(false);
    // Döngüde tam 5 kelime (1 hedef + 4 buffer) bulunmalıdır
    expect(res!.nextQueue.length).toBe(5);
    expect(res!.nextQueue.filter(q => q.isBuffer).length).toBe(4);
    // Seçilen kelime kuyruğun en sonuna gitmiştir
    expect(res!.nextQueue[res!.nextQueue.length - 1].wordId).toBe(1);
  });

  it('bir kelime yanlış yapıldığında araya en az 5 soru girmeden tekrar karşımıza çıkamaz', () => {
    // Adım 1: Kelime 1 soruldu ve yanlış yapıldı (lastAskedStep = 1 kaydedildi)
    const list: GenericSessionItem[] = [
      {
        word: word1,
        choicePassed: false,
        typingPassed: false,
        choicePassedAtStep: null,
        lastAskedStep: 1
      }
    ];

    let currentQueue: PoolQueueItem[] = [
      { wordId: 2, isBuffer: true },
      { wordId: 3, isBuffer: true },
      { wordId: 4, isBuffer: true },
      { wordId: 5, isBuffer: true },
      { wordId: 1, isBuffer: false }
    ];

    const bufferLastAskedMap = new Map<number, number>();

    // Adım 2: Kelime 1 henüz 1 adım önce soruldu (2 - 1 = 1 < 5) -> Seçilemez! Buffer gelmeli!
    let res = syncAndSelectNextQuestion({
      list,
      currentStep: 2,
      excludeWordId: 1,
      currentQueue,
      candidateBuffers,
      allWordsMap,
      bufferLastAskedMap
    });
    expect(res).not.toBeNull();
    expect(res!.chosenWord.id).not.toBe(1); // Kelime 1 olamaz!
    expect(res!.isBuffer).toBe(true);
    bufferLastAskedMap.set(res!.chosenWord.id, 2);
    currentQueue = res!.nextQueue;

    // Adım 3: (3 - 1 = 2 < 5) -> Kelime 1 gelemez!
    res = syncAndSelectNextQuestion({
      list,
      currentStep: 3,
      excludeWordId: res!.chosenWord.id,
      currentQueue,
      candidateBuffers,
      allWordsMap,
      bufferLastAskedMap
    });
    expect(res!.chosenWord.id).not.toBe(1);
    bufferLastAskedMap.set(res!.chosenWord.id, 3);
    currentQueue = res!.nextQueue;

    // Adım 4: (4 - 1 = 3 < 5) -> Kelime 1 gelemez!
    res = syncAndSelectNextQuestion({
      list,
      currentStep: 4,
      excludeWordId: res!.chosenWord.id,
      currentQueue,
      candidateBuffers,
      allWordsMap,
      bufferLastAskedMap
    });
    expect(res!.chosenWord.id).not.toBe(1);
    bufferLastAskedMap.set(res!.chosenWord.id, 4);
    currentQueue = res!.nextQueue;

    // Adım 5: (5 - 1 = 4 < 5) -> Kelime 1 gelemez!
    res = syncAndSelectNextQuestion({
      list,
      currentStep: 5,
      excludeWordId: res!.chosenWord.id,
      currentQueue,
      candidateBuffers,
      allWordsMap,
      bufferLastAskedMap
    });
    expect(res!.chosenWord.id).not.toBe(1);
    bufferLastAskedMap.set(res!.chosenWord.id, 5);
    currentQueue = res!.nextQueue;

    // Adım 6: Artık araya 5 soru girdi! (6 - 1 = 5 >= 5) -> Kelime 1 artık sorulabilir!
    res = syncAndSelectNextQuestion({
      list,
      currentStep: 6,
      excludeWordId: res!.chosenWord.id,
      currentQueue,
      candidateBuffers,
      allWordsMap,
      bufferLastAskedMap
    });
    expect(res!.chosenWord.id).toBe(1);
    expect(res!.isBuffer).toBe(false);
  });

  it('hedef kelime tamamlandığında oturum biter, buffer kelimelerin bitirilmesine gerek kalmaz', () => {
    // Hedef kelime doğru bilinip typingPassed = true olduğunda
    const list: GenericSessionItem[] = [
      {
        word: word1,
        choicePassed: true,
        typingPassed: true, // Tamamlandı!
        choicePassedAtStep: 6,
        lastAskedStep: 6
      }
    ];

    const currentQueue: PoolQueueItem[] = [
      { wordId: 2, isBuffer: true },
      { wordId: 3, isBuffer: true },
      { wordId: 4, isBuffer: true },
      { wordId: 5, isBuffer: true }
    ];

    const bufferLastAskedMap = new Map<number, number>();

    const res = syncAndSelectNextQuestion({
      list,
      currentStep: 7,
      excludeWordId: 1,
      currentQueue,
      candidateBuffers,
      allWordsMap,
      bufferLastAskedMap
    });

    // Oturum bitti -> null döner!
    expect(res).toBeNull();
  });

  it('şık çözülmeden asla klavye (typing) sorusu açılamaz, daima choice dönmelidir', () => {
    const list: GenericSessionItem[] = [
      {
        word: word1,
        choicePassed: false,
        typingPassed: false,
        choicePassedAtStep: null,
        lastAskedStep: null
      }
    ];

    const currentQueue: PoolQueueItem[] = [];
    const bufferLastAskedMap = new Map<number, number>();

    const res = syncAndSelectNextQuestion({
      list,
      currentStep: 1,
      excludeWordId: null,
      currentQueue,
      candidateBuffers,
      allWordsMap,
      bufferLastAskedMap
    });

    expect(res).not.toBeNull();
    expect(res!.chosenWord.id).toBe(1);
    expect(res!.questionType).toBe('choice'); // ASLA typing olamaz!
  });

  it('fallback durumunda henüz şıkkı çözülmemiş kelimeler yazma sorusunun önüne geçer', () => {
    // 1 numaralı kelime şıkkı geçmiş ama henüz aralık kuralı dolmamış
    // 2 numaralı kelime ise şıkkı henüz çözülmemiş
    const word2 = createMockWord(2, 'book', 'kitap');
    const localWordsMap = new Map<number, Word>([
      [1, word1],
      [2, word2]
    ]);

    const list: GenericSessionItem[] = [
      {
        word: word1,
        choicePassed: true,
        typingPassed: false,
        choicePassedAtStep: 5,
        lastAskedStep: 5
      },
      {
        word: word2,
        choicePassed: false,
        typingPassed: false,
        choicePassedAtStep: null,
        lastAskedStep: null
      }
    ];

    // Kuyrukta kelime 2 var, kelime 1 var
    const currentQueue: PoolQueueItem[] = [
      { wordId: 1, isBuffer: false },
      { wordId: 2, isBuffer: false }
    ];

    const res = syncAndSelectNextQuestion({
      list,
      currentStep: 6, // 6 - 5 = 1 < 5 (kelime 1 yazma için uygun değil)
      excludeWordId: 1,
      currentQueue,
      candidateBuffers: [],
      allWordsMap: localWordsMap,
      bufferLastAskedMap: new Map()
    });

    expect(res).not.toBeNull();
    expect(res!.chosenWord.id).toBe(2);
    expect(res!.questionType).toBe('choice'); // Kelime 2'nin şık sorusu sorulmalıdır!
  });
});

