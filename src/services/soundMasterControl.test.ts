import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setSpeechEnabled, isSpeechEnabled, speakEnglish } from './speech';
import { sound } from './audio';
import { UserSettings } from '../types';

describe('Ses Kontrolü (Master Sound Control)', () => {
  let cancelMock: ReturnType<typeof vi.fn>;
  let speakMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    cancelMock = vi.fn();
    speakMock = vi.fn();

    // Mock window.speechSynthesis
    (globalThis as any).window = (globalThis as any).window || {};
    (globalThis as any).window.speechSynthesis = {
      cancel: cancelMock,
      speak: speakMock,
      getVoices: vi.fn().mockReturnValue([])
    };
    (globalThis as any).SpeechSynthesisUtterance = vi.fn().mockImplementation((text) => ({
      text,
      lang: 'en-US',
      rate: 0.9
    }));
  });

  afterEach(() => {
    setSpeechEnabled(true);
    sound.setPreferences(true, true, true);
    vi.restoreAllMocks();
  });

  it('1. soundEnabled undefined olduğunda (eski kullanıcı verisi): açık sayılmalı', () => {
    const legacySettings: Partial<UserSettings> = {
      soundEffects: true,
      vibration: true
      // soundEnabled is undefined
    };

    const isMasterSound = legacySettings.soundEnabled !== false;
    expect(isMasterSound).toBe(true);

    // Servisler açık olarak yapılandırılır
    sound.setPreferences(legacySettings.soundEffects!, legacySettings.vibration!, isMasterSound);
    setSpeechEnabled(isMasterSound);

    expect(isSpeechEnabled()).toBe(true);
    expect(sound.isMasterEnabled()).toBe(true);
    expect(sound.isSoundActive()).toBe(true);
  });

  it('2. Ses kapalıyken speakEnglish konuşmamalı ve speechSynthesis.cancel() çağrılmalı', () => {
    setSpeechEnabled(false);
    expect(isSpeechEnabled()).toBe(false);

    // Kapatıldığında cancel çağrılmış olmalı
    expect(cancelMock).toHaveBeenCalled();

    // speakEnglish çağrıldığında
    speakEnglish('apple');

    // Asla speak() çağrılmamalı, tekrar cancel() çağrılarak konuşma kuyruğu boşaltılmalı
    expect(speakMock).not.toHaveBeenCalled();
    expect(cancelMock).toHaveBeenCalledTimes(2);
  });

  it('3. Ana ses kapalıyken efektler (sound) çalmamalı', () => {
    // Ses efektleri ayarı true olsa bile ana ses false ise efekt devre dışı kalmalı
    sound.setPreferences(true, true, false);

    expect(sound.isMasterEnabled()).toBe(false);
    expect(sound.isSoundActive()).toBe(false);

    // AudioContext oluşturulamaz / null kalır, efekt tetiklenmez
    sound.playCorrect(1);
    sound.playWrong();
    sound.playLevelUp();

    // Titreşim ise ana sesten bağımsız çalışmaya devam eder
    expect(sound['vibrationEnabled']).toBe(true);
  });

  it('4. Açılışta ve ayar güncellendiğinde bayrak ayardan doğru okunmalı ve kapatılabilmeli', () => {
    const userSettings: UserSettings = {
      id: 1,
      dailyNewTarget: 10,
      dailyReviewLimit: 20,
      prioritizeCustomWords: false,
      enabledCategories: [],
      surpriseMasteredCheck: true,
      soundEnabled: false, // Kullanıcı sesi kapattı
      soundEffects: true,
      vibration: true,
      speechSpeed: 0.9,
      theme: 'dark'
    };

    const isMasterSound = userSettings.soundEnabled !== false;
    expect(isMasterSound).toBe(false);

    sound.setPreferences(userSettings.soundEffects, userSettings.vibration, isMasterSound);
    setSpeechEnabled(isMasterSound);

    expect(sound.isMasterEnabled()).toBe(false);
    expect(isSpeechEnabled()).toBe(false);

    // Kullanıcı tekrar açtığında
    const updatedSettings = { ...userSettings, soundEnabled: true };
    const isMasterSoundNow = updatedSettings.soundEnabled !== false;
    sound.setPreferences(updatedSettings.soundEffects, updatedSettings.vibration, isMasterSoundNow);
    setSpeechEnabled(isMasterSoundNow);

    expect(sound.isMasterEnabled()).toBe(true);
    expect(isSpeechEnabled()).toBe(true);
  });
});
