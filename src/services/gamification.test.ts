import { describe, it, expect } from 'vitest';
import { BADGES, checkUnlockedBadges } from './gamification';

describe('Gamification & Badges', () => {
  it('contains all requested badge milestones', () => {
    const ids = BADGES.map(b => b.id);
    // Words
    expect(ids).toContain('first_word');
    expect(ids).toContain('words_25');
    expect(ids).toContain('words_100');
    expect(ids).toContain('words_250');
    expect(ids).toContain('words_500');
    expect(ids).toContain('words_1000');
    expect(ids).toContain('words_2000');
    expect(ids).toContain('words_3000');

    // Streaks
    expect(ids).toContain('streak_3');
    expect(ids).toContain('streak_7');
    expect(ids).toContain('streak_14');
    expect(ids).toContain('streak_21');
    expect(ids).toContain('streak_30');
    expect(ids).toContain('streak_50');
    expect(ids).toContain('streak_100');

    // Speed
    expect(ids).toContain('speed_10');
    expect(ids).toContain('speed_20');
    expect(ids).toContain('speed_30');
    expect(ids).toContain('speed_40');
    expect(ids).toContain('speed_50');
    expect(ids).toContain('speed_100');
  });

  it('unlocks word milestones progressively up to 3000 words', () => {
    let unlocked = checkUnlockedBadges({
      currentBadges: [],
      totalLearned: 500,
      streak: 1
    });
    expect(unlocked).toContain('words_500');
    expect(unlocked).not.toContain('words_1000');

    unlocked = checkUnlockedBadges({
      currentBadges: unlocked,
      totalLearned: 1000,
      streak: 1
    });
    expect(unlocked).toContain('words_1000');
    expect(unlocked).not.toContain('words_3000');

    unlocked = checkUnlockedBadges({
      currentBadges: unlocked,
      totalLearned: 3000,
      streak: 1
    });
    expect(unlocked).toContain('words_3000');
  });

  it('unlocks streak milestones 21, 50, and 100', () => {
    let unlocked = checkUnlockedBadges({
      currentBadges: [],
      totalLearned: 0,
      streak: 21
    });
    expect(unlocked).toContain('streak_21');
    expect(unlocked).not.toContain('streak_50');

    unlocked = checkUnlockedBadges({
      currentBadges: unlocked,
      totalLearned: 0,
      streak: 50
    });
    expect(unlocked).toContain('streak_50');
    expect(unlocked).not.toContain('streak_100');

    unlocked = checkUnlockedBadges({
      currentBadges: unlocked,
      totalLearned: 0,
      streak: 100
    });
    expect(unlocked).toContain('streak_100');
  });

  it('unlocks speed round milestones 20, 30, 40, 50, and 100', () => {
    const unlocked = checkUnlockedBadges({
      currentBadges: [],
      totalLearned: 0,
      streak: 0,
      speedScore: 55
    });
    expect(unlocked).toContain('speed_20');
    expect(unlocked).toContain('speed_30');
    expect(unlocked).toContain('speed_40');
    expect(unlocked).toContain('speed_50');
    expect(unlocked).not.toContain('speed_100');
  });

  it('unlocks master milestones 50, 100, 200, 500, and 1000', () => {
    let unlocked = checkUnlockedBadges({
      currentBadges: [],
      totalLearned: 0,
      streak: 0,
      masteredCount: 150
    });
    expect(unlocked).toContain('master_50');
    expect(unlocked).toContain('master_100');
    expect(unlocked).not.toContain('master_200');

    unlocked = checkUnlockedBadges({
      currentBadges: unlocked,
      totalLearned: 0,
      streak: 0,
      masteredCount: 500
    });
    expect(unlocked).toContain('master_200');
    expect(unlocked).toContain('master_500');
    expect(unlocked).not.toContain('master_1000');

    unlocked = checkUnlockedBadges({
      currentBadges: unlocked,
      totalLearned: 0,
      streak: 0,
      masteredCount: 1000
    });
    expect(unlocked).toContain('master_1000');
  });
});
