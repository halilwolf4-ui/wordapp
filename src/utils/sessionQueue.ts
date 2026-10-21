import { Word } from '../types';

export const MIN_QUESTION_GAP = 5;

export interface PoolQueueItem {
  wordId: number;
  isBuffer: boolean;
}

export interface GenericSessionItem {
  word: Word;
  choicePassed: boolean;
  typingPassed: boolean;
  choicePassedAtStep: number | null;
  lastAskedStep: number | null;
}

export interface NextQuestionResult {
  pickedItem: PoolQueueItem;
  chosenWord: Word;
  questionType: 'choice' | 'typing';
  isBuffer: boolean;
  nextQueue: PoolQueueItem[];
}

/**
 * Oturum sırasında soru sırasını, döngüsel kuyruğu (Pool Queue) ve
 * en az 5 soru aralık kuralını (MIN_QUESTION_GAP = 5) yöneten saf fonksiyon.
 *
 * Kurallar:
 * 1. Aktif döngüde DAİMA en az 5 kelime bulunur. Hedefte 1 kelime kalsa bile araya 4 farklı buffer kelime girer.
 * 2. Bir kelime sorulduktan veya yanlış yapıldıktan sonra araya en az 5 soru girmeden tekrar sorulamaz.
 * 3. Şıkkı geçmiş bir kelime klavye olarak sorulmadan önce de araya en az 5 soru girmelidir.
 * 4. Hedef kelimeler tamamlandığında (uncompleted.length === 0) null döner.
 */
export function syncAndSelectNextQuestion<T extends GenericSessionItem>(params: {
  list: T[];
  currentStep: number;
  excludeWordId: number | null;
  currentQueue: PoolQueueItem[];
  candidateBuffers: Word[];
  allWordsMap: Map<number, Word>;
  bufferLastAskedMap: Map<number, number>;
  minGap?: number;
}): NextQuestionResult | null {
  const {
    list,
    currentStep,
    excludeWordId,
    candidateBuffers,
    allWordsMap,
    bufferLastAskedMap,
    minGap = MIN_QUESTION_GAP
  } = params;

  const uncompleted = list.filter(item => !item.typingPassed);
  if (uncompleted.length === 0) {
    return null;
  }

  const uncompletedIds = new Set(uncompleted.map(i => i.word.id));

  // 1. Kuyruğu Senkronize Et:
  let queue = params.currentQueue.filter(item => {
    // Tamamlanmış hedef kelimeleri kuyruktan çıkar
    if (!item.isBuffer && !uncompletedIds.has(item.wordId)) {
      return false;
    }
    return true;
  });

  // Kuyrukta henüz yer almayan uncompleted kelimeleri ekle
  uncompleted.forEach(u => {
    if (!queue.some(q => q.wordId === u.word.id)) {
      queue.push({ wordId: u.word.id, isBuffer: false });
    }
  });

  const uncompCount = queue.filter(q => !q.isBuffer).length;
  const existingQueueIds = new Set(queue.map(q => q.wordId));

  // Eğer uncompleted sayısı < 5 ise en az 5 elemana tamamlayacak kadar buffer ekle
  if (uncompCount < 5) {
    const neededBuffers = 5 - uncompCount;
    // Buffer adaylarını sırasını koruyarak seç (önceden harmanlanmış düzeni korur)
    const availableBuffers = candidateBuffers
      .filter(w => !existingQueueIds.has(w.id) && !uncompletedIds.has(w.id));

    for (const w of availableBuffers) {
      const currentBufferCount = queue.filter(q => q.isBuffer).length;
      if (currentBufferCount >= neededBuffers && queue.length >= 5) break;
      queue.push({ wordId: w.id, isBuffer: true });
      existingQueueIds.add(w.id);
    }

    // Fazla buffer varsa toplam 5 olacak şekilde kırp
    if (queue.length > 5) {
      const uncompInQueue = queue.filter(q => !q.isBuffer);
      const buffersInQueue = queue.filter(q => q.isBuffer);
      queue = [...uncompInQueue, ...buffersInQueue.slice(0, Math.max(0, 5 - uncompInQueue.length))];
    }
  } else {
    // uncompleted sayısı >= 5 ise buffer'lara gerek yok
    queue = queue.filter(q => !q.isBuffer);
  }

  // 2. Kuyruktan uygun kelimeyi seç:
  const isEligible = (item: PoolQueueItem): boolean => {
    if (excludeWordId !== null && item.wordId === excludeWordId) return false;

    if (item.isBuffer) {
      const lastAsked = bufferLastAskedMap.get(item.wordId);
      return lastAsked === undefined || (currentStep - lastAsked >= minGap);
    }

    const targetItem = list.find(i => i.word.id === item.wordId);
    if (!targetItem || targetItem.typingPassed) return false;

    const lastAsked = targetItem.lastAskedStep;
    const gapOk = lastAsked === null || (currentStep - lastAsked >= minGap);
    if (!gapOk) return false;

    if (!targetItem.choicePassed) {
      return true; // Şık sorusu için uygun
    }

    // Klavye için şık geçildikten sonra da en az 5 soru geçmiş olmalı
    return (
      targetItem.choicePassedAtStep !== null &&
      currentStep - targetItem.choicePassedAtStep >= minGap
    );
  };

  const eligibleIndices: number[] = [];
  queue.forEach((item, idx) => {
    if (isEligible(item)) {
      eligibleIndices.push(idx);
    }
  });

  let pickIdx = -1;

  if (eligibleIndices.length > 0) {
    // 1. Öncelik: Şıkkı henüz geçilmemiş hedef kelimeler (şıkları kendi içinde karıştırarak sor)
    const choiceEligible = eligibleIndices.filter(idx => {
      const item = queue[idx];
      if (item.isBuffer) return false;
      const target = list.find(i => i.word.id === item.wordId);
      return target && !target.choicePassed;
    });

    // 2. Öncelik: Şıkkı geçmiş, yazma zamanı gelmiş hedef kelimeler (yazmaları rastgele karıştırarak sor)
    const typingEligible = eligibleIndices.filter(idx => {
      const item = queue[idx];
      if (item.isBuffer) return false;
      const target = list.find(i => i.word.id === item.wordId);
      return target && target.choicePassed && !target.typingPassed;
    });

    // 3. Öncelik: Tampon (Buffer) kelimeler
    const bufferEligible = eligibleIndices.filter(idx => queue[idx].isBuffer);

    if (choiceEligible.length > 0) {
      // Şık soruları arasında rastgele seç (sırayla değil)
      pickIdx = choiceEligible[Math.floor(Math.random() * choiceEligible.length)];
    } else if (typingEligible.length > 0) {
      // Yazma soruları arasında rastgele seç (15'li ilk tur bittiğinde aynı sırayla gelmez!)
      pickIdx = typingEligible[Math.floor(Math.random() * typingEligible.length)];
    } else if (bufferEligible.length > 0) {
      // Tampon kelimeler arasında rastgele seç
      pickIdx = bufferEligible[Math.floor(Math.random() * bufferEligible.length)];
    } else {
      pickIdx = eligibleIndices[Math.floor(Math.random() * eligibleIndices.length)];
    }
  }

  // Eğer kuyruktaki hiçbir kelime henüz 5 soru aralığı kuralını doldurmadıysa:
  // Araya kurala uyan bir tampon (buffer) kelime sok (rastgele seç)!
  if (pickIdx === -1) {
    const fallbackBuffers = candidateBuffers.filter(w => {
      if (excludeWordId !== null && w.id === excludeWordId) return false;
      if (uncompletedIds.has(w.id)) return false;
      const lastAsked = bufferLastAskedMap.get(w.id);
      return lastAsked === undefined || (currentStep - lastAsked >= minGap);
    });

    if (fallbackBuffers.length > 0) {
      const randomFallback = fallbackBuffers[Math.floor(Math.random() * fallbackBuffers.length)];
      queue.push({ wordId: randomFallback.id, isBuffer: true });
      pickIdx = queue.length - 1;
    } else {
      // Güvenlik fallback:
      // 1. Henüz şıkkı çözülmemiş hedef kelime varsa rastgele seç (asla şık çözülmeden yazma öne geçmesin)
      const unpassedChoiceIndices = queue
        .map((q, idx) => ({ q, idx }))
        .filter(({ q }) => {
          if (excludeWordId !== null && q.wordId === excludeWordId) return false;
          const target = list.find(i => i.word.id === q.wordId);
          return target && !target.choicePassed && !target.typingPassed;
        })
        .map(({ idx }) => idx);

      if (unpassedChoiceIndices.length > 0) {
        pickIdx = unpassedChoiceIndices[Math.floor(Math.random() * unpassedChoiceIndices.length)];
      } else {
        // 2. Eğer yoksa, araya girebilecek herhangi bir aday tampon kelimeyi rastgele buffer olarak ekle
        const anyBuffers = candidateBuffers.filter(w => {
          if (excludeWordId !== null && w.id === excludeWordId) return false;
          if (uncompletedIds.has(w.id)) return false;
          return true;
        });
        if (anyBuffers.length > 0) {
          const randomAny = anyBuffers[Math.floor(Math.random() * anyBuffers.length)];
          queue.push({ wordId: randomAny.id, isBuffer: true });
          pickIdx = queue.length - 1;
        } else {
          // 3. Son çare güvenlik fallback: excludeWordId hariç rastgele eleman
          const otherIndices = queue
            .map((_, idx) => idx)
            .filter(idx => queue[idx].wordId !== excludeWordId);
          if (otherIndices.length > 0) {
            pickIdx = otherIndices[Math.floor(Math.random() * otherIndices.length)];
          } else {
            pickIdx = 0;
          }
        }
      }
    }
  }

  const pickedItem = queue[pickIdx];
  const nextQueue = [...queue];
  nextQueue.splice(pickIdx, 1);

  if (pickedItem.isBuffer) {
    // Soru olarak sorulan tampon kelimenin yerine havuzdan henüz kuyrukta olmayan YENİ bir tampon kelime ekle
    // Böylece kullanıcı hep aynı 3 kelimenin döngüsüne hapsolmaz, sürekli farklı öğrendiği kelimeler çıkar!
    const inNextQueueIds = new Set(nextQueue.map(q => q.wordId));
    const freshBuffers = candidateBuffers.filter(w =>
      !inNextQueueIds.has(w.id) &&
      !uncompletedIds.has(w.id) &&
      w.id !== pickedItem.wordId
    );

    if (freshBuffers.length > 0) {
      const nextFresh = freshBuffers[0];
      nextQueue.push({ wordId: nextFresh.id, isBuffer: true });
    } else {
      // Eğer havuzda başka tampon kalmadıysa mecburen mevcut olanı arkaya at
      nextQueue.push(pickedItem);
    }
  } else {
    // Hedef kelime ise arkaya at (döngü devam etsin)
    nextQueue.push(pickedItem);
  }

  let chosenWord: Word;
  let questionType: 'choice' | 'typing';

  if (pickedItem.isBuffer) {
    chosenWord = allWordsMap.get(pickedItem.wordId) || uncompleted[0].word;
    questionType = 'choice';
  } else {
    const targetItem = list.find(i => i.word.id === pickedItem.wordId)!;
    chosenWord = targetItem.word;
    questionType = targetItem.choicePassed ? 'typing' : 'choice';
  }

  return {
    pickedItem,
    chosenWord,
    questionType,
    isBuffer: pickedItem.isBuffer,
    nextQueue
  };
}
