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
    for (const w of candidateBuffers) {
      const currentBufferCount = queue.filter(q => q.isBuffer).length;
      if (currentBufferCount >= neededBuffers && queue.length >= 5) break;
      if (!existingQueueIds.has(w.id) && !uncompletedIds.has(w.id)) {
        queue.push({ wordId: w.id, isBuffer: true });
        existingQueueIds.add(w.id);
      }
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

  let pickIdx = queue.findIndex(isEligible);

  // Eğer kuyruktaki hiçbir kelime henüz 5 soru aralığı kuralını doldurmadıysa:
  // Araya kurala uyan bir tampon (buffer) kelime sok!
  if (pickIdx === -1) {
    const fallbackBuffer = candidateBuffers.find(w => {
      if (excludeWordId !== null && w.id === excludeWordId) return false;
      if (uncompletedIds.has(w.id)) return false;
      const lastAsked = bufferLastAskedMap.get(w.id);
      return lastAsked === undefined || (currentStep - lastAsked >= minGap);
    });

    if (fallbackBuffer) {
      queue.push({ wordId: fallbackBuffer.id, isBuffer: true });
      pickIdx = queue.length - 1;
    } else {
      // Güvenlik fallback: excludeWordId hariç ilk eleman
      pickIdx = queue.findIndex(q => q.wordId !== excludeWordId);
      if (pickIdx === -1) pickIdx = 0;
    }
  }

  const pickedItem = queue[pickIdx];
  const nextQueue = [...queue];
  nextQueue.splice(pickIdx, 1);
  nextQueue.push(pickedItem);

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
