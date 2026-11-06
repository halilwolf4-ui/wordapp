import { describe, it, expect } from 'vitest';
import { decideReviewAnswer } from './srsEngine';
import { Progress } from '../types';

describe('ADIM 1: decideReviewAnswer - Oyunlar ve Tekrar Ayrımı', () => {
  const effectiveDate = '2026-11-06';

  it('Oyundan gelen ham kelime (progress kaydı YOK): progress yazılmamalı, review kaydedilmeli', () => {
    const wordId = 9999;
    const existingProg = null; // Ham kelime, henüz çalışılmadı
    const isCorrect = true;
    const isPartial = false;
    const source = 'game'; // Yılan Savaşı veya Gizli Kelime

    const decision = decideReviewAnswer(
      existingProg,
      wordId,
      isCorrect,
      isPartial,
      effectiveDate,
      undefined,
      source
    );

    // Progress DB'ye yazılmamalı (aktif kelime sayısını şişirmemek için)
    expect(decision.shouldSaveProgress).toBe(false);
    expect(decision.nextProgress).toBeNull();
    // Ancak tekrar sayısı (reviewsDone), XP ve kombo işlenmeli
    expect(decision.shouldRecordReview).toBe(true);
  });

  it('Oyundan gelen kayıtlı kelime (progress kaydı VAR): SRS güncellenmeli ve kaydedilmeli', () => {
    const wordId = 135;
    const existingProg: Progress = {
      wordId: 135,
      step: 1,
      streakDays: 1,
      dueDate: effectiveDate,
      lastReviewDate: '2026-11-05',
      status: 'learning',
      lapses: 0,
      totalCorrect: 2,
      totalWrong: 0,
      updatedAt: Date.now()
    };
    const isCorrect = true;
    const isPartial = false;
    const source = 'game';

    const decision = decideReviewAnswer(
      existingProg,
      wordId,
      isCorrect,
      isPartial,
      effectiveDate,
      undefined,
      source
    );

    // Kayıtlı kelime olduğu için progress güncellenmeli
    expect(decision.shouldSaveProgress).toBe(true);
    expect(decision.nextProgress).not.toBeNull();
    expect(decision.nextProgress?.step).toBe(2);
    expect(decision.nextProgress?.totalCorrect).toBe(3);
    expect(decision.shouldRecordReview).toBe(true);
  });

  it('Normal Tekrar akışında (source review veya undefined): eski davranış korunmalı (yeni kayıt oluşturulmalı)', () => {
    const wordId = 404;
    const existingProg = null;
    const isCorrect = true;
    const isPartial = false;

    // source belirtilmemiş veya 'review'
    const decision = decideReviewAnswer(
      existingProg,
      wordId,
      isCorrect,
      isPartial,
      effectiveDate,
      undefined,
      'review'
    );

    expect(decision.shouldSaveProgress).toBe(true);
    expect(decision.nextProgress).not.toBeNull();
    expect(decision.nextProgress?.status).toBe('learning');
    expect(decision.nextProgress?.step).toBe(1);
    expect(decision.shouldRecordReview).toBe(true);
  });
});

