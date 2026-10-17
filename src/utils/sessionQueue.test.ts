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

  it('birden fazla kelime şıkkı geçtikten sonra yazma soruları daima aynı sırayla değil, rastgele karıştırılarak seçilir', () => {
    // 5 hedef kelime tanımla
    const words = [
      createMockWord(10, 'ten', 'on'),
      createMockWord(20, 'twenty', 'yirmi'),
      createMockWord(30, 'thirty', 'otuz'),
      createMockWord(40, 'forty', 'kırk'),
      createMockWord(50, 'fifty', 'elli')
    ];
    const map = new Map<number, Word>(words.map(w => [w.id, w]));

    const list: GenericSessionItem[] = words.map(w => ({
      word: w,
      choicePassed: true,
      typingPassed: false,
      choicePassedAtStep: 1, // Hepsi 1. adımda şıkkı geçti
      lastAskedStep: 1
    }));

    const queue: PoolQueueItem[] = words.map(w => ({ wordId: w.id, isBuffer: false }));

    // 10. adımda tüm kelimeler yazma için uygundur (10 - 1 = 9 >= 5)
    // Farklı rastgele seçimleri topla
    const pickedFirstIds = new Set<number>();
    for (let i = 0; i < 30; i++) {
      const res = syncAndSelectNextQuestion({
        list,
        currentStep: 10,
        excludeWordId: null,
        currentQueue: [...queue],
        candidateBuffers: [],
        allWordsMap: map,
        bufferLastAskedMap: new Map()
      });
      if (res) {
        pickedFirstIds.add(res.chosenWord.id);
        expect(res.questionType).toBe('typing');
      }
    }

    // Tek bir kelimeye kilitlenmeyip farklı kelimeleri rastgele seçebilmelidir!
    expect(pickedFirstIds.size).toBeGreaterThan(1);
  });

  it('sonda 5ten az kelime kaldığında eklenen tampon kelimeler hep aynı ilk kelimeyi seçmez, rastgele havuzdan seçer', () => {
    // 1 hedef kelime ve 10 farklı tampon kelime
    const targetWord = createMockWord(1, 'target', 'hedef');
    const buffers = Array.from({ length: 10 }, (_, i) =>
      createMockWord(100 + i, `buffer_${i}`, `tampon_${i}`)
    );
    const map = new Map<number, Word>([[1, targetWord], ...buffers.map(b => [b.id, b] as [number, Word])]);

    const list: GenericSessionItem[] = [
      {
        word: targetWord,
        choicePassed: false,
        typingPassed: false,
        choicePassedAtStep: null,
        lastAskedStep: 1 // Hedef kelime henüz sorulmuş
      }
    ];

    const pickedBufferIds = new Set<number>();
    for (let i = 0; i < 30; i++) {
      const res = syncAndSelectNextQuestion({
        list,
        currentStep: 2, // Hedef kelime 5-gap yüzünden sorulamaz
        excludeWordId: 1,
        currentQueue: [],
        candidateBuffers: buffers,
        allWordsMap: map,
        bufferLastAskedMap: new Map()
      });
      if (res && res.isBuffer) {
        pickedBufferIds.add(res.chosenWord.id);
      }
    }

    // Tampon kelime seçimleri her zaman buffers[0] olmak yerine rastgele dağılmalıdır!
    expect(pickedBufferIds.size).toBeGreaterThan(1);
  });

  it('tampon kelime sorulduktan sonra kuyruğa aynı 3 kelime yerine havuzdan taze tampon kelimeler rotasyonla girer', () => {
    const targetWord = createMockWord(1, 'target', 'hedef');
    const buffers = Array.from({ length: 15 }, (_, i) =>
      createMockWord(100 + i, `buffer_${i}`, `tampon_${i}`)
    );
    const map = new Map<number, Word>([[1, targetWord], ...buffers.map(b => [b.id, b] as [number, Word])]);

    const list: GenericSessionItem[] = [
      {
        word: targetWord,
        choicePassed: false,
        typingPassed: false,
        choicePassedAtStep: null,
        lastAskedStep: 1 // Hedef kelime sorulmuş
      }
    ];

    let currentQueue: PoolQueueItem[] = [];
    const bufferLastAskedMap = new Map<number, number>();
    const allSeenBufferIds = new Set<number>();

    // 8 adım boyunca tampon kelimelerin rotasyonunu izle
    for (let step = 2; step <= 8; step++) {
      const res = syncAndSelectNextQuestion({
        list,
        currentStep: step,
        excludeWordId: null,
        currentQueue,
        candidateBuffers: buffers,
        allWordsMap: map,
        bufferLastAskedMap
      });

      if (res && res.isBuffer) {
        allSeenBufferIds.add(res.chosenWord.id);
        bufferLastAskedMap.set(res.chosenWord.id, step);
        currentQueue = res.nextQueue;
      }
    }

    // Yalnızca 3 kelimeye saplanıp kalmamalı, havuzdan yeni tampon kelimeler rotasyona girmelidir!
    expect(allSeenBufferIds.size).toBeGreaterThan(3);
  });
});


