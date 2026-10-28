import React, { useState, useEffect } from 'react';

export type CharacterGender = 'male' | 'female';
export type CharacterStageId = 'baby' | 'child' | 'teen' | 'headphones' | 'tie_adult' | 'boss';

const STORAGE_GENDER_KEY = 'kelime_avi_character_gender';
const GENDER_EVENT = 'kelime_avi_gender_change';

export function getSavedGender(): CharacterGender {
  try {
    const val = localStorage.getItem(STORAGE_GENDER_KEY);
    return val === 'female' ? 'female' : 'male';
  } catch {
    return 'male';
  }
}

export function setSavedGender(gender: CharacterGender): void {
  try {
    localStorage.setItem(STORAGE_GENDER_KEY, gender);
    window.dispatchEvent(new CustomEvent(GENDER_EVENT, { detail: gender }));
  } catch {
    // ignore
  }
}

export function useCharacterGender(): [CharacterGender, (g: CharacterGender) => void] {
  const [gender, setGenderState] = useState<CharacterGender>(() => getSavedGender());

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<CharacterGender>;
      if (custom.detail === 'male' || custom.detail === 'female') {
        setGenderState(custom.detail);
      } else {
        setGenderState(getSavedGender());
      }
    };
    window.addEventListener(GENDER_EVENT, handler);
    return () => window.removeEventListener(GENDER_EVENT, handler);
  }, []);

  const updateGender = (g: CharacterGender) => {
    setGenderState(g);
    setSavedGender(g);
  };

  return [gender, updateGender];
}

export interface StageInfo {
  id: CharacterStageId;
  stageNum: number;
  title: string;
  subtitle: string;
  minLevel: number;
}

export const CHARACTER_STAGES: StageInfo[] = [
  { id: 'baby', stageNum: 1, title: 'Bebek Kaşif', subtitle: 'Seviye 1–7 • İlk Adımlar', minLevel: 1 },
  { id: 'child', stageNum: 2, title: 'Çocuk Avcı', subtitle: 'Seviye 8–17 • Meraklı Çocuk', minLevel: 8 },
  { id: 'teen', stageNum: 3, title: 'Ergen Gezgin', subtitle: 'Seviye 18–24 • Enerjik Ergen', minLevel: 18 },
  { id: 'headphones', stageNum: 4, title: 'Genç Yetenek', subtitle: 'Seviye 25–34 • Kulaklıklı Genç', minLevel: 25 },
  { id: 'tie_adult', stageNum: 5, title: 'Kravatlı Yetişkin', subtitle: 'Seviye 35–49 • Profesyonel', minLevel: 35 },
  { id: 'boss', stageNum: 6, title: 'Uzman Boss', subtitle: 'Seviye 50+ • Kelime Boss\'u', minLevel: 50 }
];

export function getStageForLevel(level: number): StageInfo {
  if (level >= 50) return CHARACTER_STAGES[5];
  if (level >= 35) return CHARACTER_STAGES[4];
  if (level >= 25) return CHARACTER_STAGES[3];
  if (level >= 18) return CHARACTER_STAGES[2];
  if (level >= 8) return CHARACTER_STAGES[1];
  return CHARACTER_STAGES[0];
}

interface CharacterIllustrationProps {
  level: number;
  gender?: CharacterGender;
  stageOverride?: CharacterStageId;
  variant?: 'full' | 'avatar';
  className?: string;
}

export const CharacterIllustration: React.FC<CharacterIllustrationProps> = ({
  level,
  gender: propGender,
  stageOverride,
  variant = 'full',
  className = ''
}) => {
  const [savedGender] = useCharacterGender();
  const gender = propGender || savedGender;
  const stageInfo = stageOverride
    ? CHARACTER_STAGES.find(s => s.id === stageOverride) || getStageForLevel(level)
    : getStageForLevel(level);
  const stage = stageInfo.id;

  const isFemale = gender === 'female';
  const uid = `${stage}-${gender}-${variant}`;

  return (
    <svg
      viewBox={variant === 'avatar' ? '25 8 90 92' : '0 0 140 155'}
      className={className}
    >
      <defs>
        <linearGradient id={`skin-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFD8BE" />
          <stop offset="100%" stopColor="#F3AA82" />
        </linearGradient>
        <linearGradient id={`hair-${uid}`} x1="0" y1="0" x2="1" y2="1">
          {stage === 'boss' ? (
            <>
              <stop offset="0%" stopColor="#374151" />
              <stop offset="100%" stopColor="#111827" />
            </>
          ) : isFemale ? (
            <>
              <stop offset="0%" stopColor="#B45309" />
              <stop offset="100%" stopColor="#78350F" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#EA580C" />
              <stop offset="100%" stopColor="#9A3412" />
            </>
          )}
        </linearGradient>
        <linearGradient id={`gold-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFF3A1" />
          <stop offset="50%" stopColor="#FFD700" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
      </defs>

      {/* Ambient Sparkles on Full Hero Mode */}
      {variant === 'full' && (
        <>
          <path d="M18 26 L21 33 L28 36 L21 39 L18 46 L15 39 L8 36 L15 33 Z" fill="#FFE45E" />
          <circle cx="122" cy="28" r="4" fill="#FFE45E" />
          {stage === 'boss' && (
            <circle cx="70" cy="78" r="56" fill="url(#gold-boss-male-full)" opacity="0.16" />
          )}
        </>
      )}

      {/* Female Long Hair Back Layer (for child, teen, headphones, tie_adult, boss) */}
      {isFemale && stage !== 'baby' && (
        <path
          d="M36 44 C32 68 34 86 44 92 L96 92 C106 86 108 68 104 44 Z"
          fill={`url(#hair-${uid})`}
        />
      )}

      {/* Female Twin Pigtails for Child Stage */}
      {isFemale && stage === 'child' && (
        <>
          <circle cx="34" cy="46" r="11" fill={`url(#hair-${uid})`} />
          <circle cx="106" cy="46" r="11" fill={`url(#hair-${uid})`} />
          <circle cx="41" cy="40" r="4" fill="#FF69B4" />
          <circle cx="99" cy="40" r="4" fill="#FF69B4" />
        </>
      )}

      {/* ============================================================
          LEGS & SHOES (Full Body Mode)
          ============================================================ */}
      {variant === 'full' && (
        <>
          {stage === 'baby' ? (
            /* Chubby Baby Legs + Booties */
            <>
              <rect x="52" y="110" width="14" height="18" rx="7" fill={`url(#skin-${uid})`} />
              <rect x="74" y="110" width="14" height="18" rx="7" fill={`url(#skin-${uid})`} />
              <rect x="49" y="123" width="19" height="10" rx="5" fill={isFemale ? '#F472B6' : '#60A5FA'} />
              <rect x="72" y="123" width="19" height="10" rx="5" fill={isFemale ? '#F472B6' : '#60A5FA'} />
            </>
          ) : stage === 'tie_adult' || stage === 'boss' ? (
            /* Formal Suit Trousers & Dress Shoes */
            <>
              <rect x="52" y="110" width="14" height="25" rx="6" fill={stage === 'boss' ? '#111827' : '#1E293B'} />
              <rect x="74" y="110" width="14" height="25" rx="6" fill={stage === 'boss' ? '#111827' : '#1E293B'} />
              <rect x="48" y="129" width="20" height="10" rx="5" fill={stage === 'boss' ? '#F59E0B' : '#0F172A'} />
              <rect x="72" y="129" width="20" height="10" rx="5" fill={stage === 'boss' ? '#F59E0B' : '#0F172A'} />
            </>
          ) : (
            /* Casual Jeans / Sport Pants & Sneakers */
            <>
              <rect x="52" y="109" width="14" height="24" rx="7" fill={isFemale ? '#6366F1' : '#2563EB'} />
              <rect x="74" y="109" width="14" height="24" rx="7" fill={isFemale ? '#6366F1' : '#2563EB'} />
              <rect x="48" y="127" width="20" height="10.5" rx="5" fill="#FFFFFF" />
              <rect x="72" y="127" width="20" height="10.5" rx="5" fill="#FFFFFF" />
            </>
          )}
        </>
      )}

      {/* ============================================================
          TORSO / OUTFIT BY STAGE
          ============================================================ */}
      {stage === 'baby' && (
        <>
          {/* Baby Onesie & White Bib (Önlük) */}
          <rect
            x="47"
            y="76"
            width="46"
            height="38"
            rx="19"
            fill={isFemale ? '#F9A8D4' : '#93C5FD'}
          />
          <path d="M53 76 Q70 98 87 76 Z" fill="#FFFFFF" />
          <circle cx="70" cy="84" r="3.5" fill="#FBBF24" />
          {/* Diaper Bottom */}
          <path d="M49 102 Q70 118 91 102 L89 114 Q70 120 51 114 Z" fill="#FFFFFF" />
        </>
      )}

      {stage === 'child' && (
        <>
          {/* Bright Kid T-Shirt with Star */}
          <rect
            x="46"
            y="73"
            width="48"
            height="41"
            rx="18"
            fill={isFemale ? '#F472B6' : '#FACC15'}
          />
          <circle cx="70" cy="93" r="9" fill="#FFFFFF" opacity="0.92" />
          <path
            d="M70 87l1.8 3.6 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.8 4-.6z"
            fill={isFemale ? '#EC4899' : '#EA580C'}
          />
        </>
      )}

      {stage === 'teen' && (
        <>
          {/* Cool Streetwear Hoodie with Drawstrings */}
          <rect
            x="45"
            y="72"
            width="50"
            height="42"
            rx="17"
            fill={isFemale ? '#A855F7' : '#10B981'}
          />
          <path d="M56 73 Q70 84 84 73" stroke="#FFFFFF" strokeWidth="3" fill="none" strokeLinecap="round" />
          <line x1="65" y1="77" x2="65" y2="90" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="75" y1="77" x2="75" y2="90" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
          <rect x="55" y="96" width="30" height="12" rx="5" fill="rgba(255,255,255,0.22)" />
        </>
      )}

      {stage === 'headphones' && (
        <>
          {/* Modern Tech Jacket + Glowing Equalizer Badge */}
          <rect
            x="45"
            y="72"
            width="50"
            height="42"
            rx="17"
            fill={isFemale ? '#EC4899' : '#3B82F6'}
          />
          <rect x="61" y="72" width="18" height="42" fill="#FFFFFF" opacity="0.9" />
          {/* Neckband / Cord accent */}
          <circle cx="70" cy="92" r="7" fill="#111827" />
          <path d="M68 89v6l5-3-5-3z" fill="#38BDF8" />
        </>
      )}

      {(stage === 'tie_adult' || stage === 'boss') && (
        <>
          {/* Tailored Suit Jacket + Crisp White Shirt + Red/Gold Power Tie */}
          <rect
            x="44"
            y="72"
            width="52"
            height="43"
            rx="16"
            fill={stage === 'boss' ? '#111827' : isFemale ? '#312E81' : '#1E293B'}
          />
          {/* White V-Shirt */}
          <polygon points="58,72 82,72 70,104" fill="#FFFFFF" />
          {/* Suit Lapels */}
          <polygon
            points="54,72 62,72 70,100 50,88"
            fill={stage === 'boss' ? '#F59E0B' : '#334155'}
          />
          <polygon
            points="86,72 78,72 70,100 90,88"
            fill={stage === 'boss' ? '#F59E0B' : '#334155'}
          />
          {/* Power Tie (Kravat) */}
          <polygon
            points="67,73 73,73 74,97 70,103 66,97"
            fill={stage === 'boss' ? `url(#gold-${uid})` : '#EF4444'}
          />
          {/* Boss Pocket Square / Gold Lapel Pin */}
          {stage === 'boss' && (
            <circle cx="83" cy="86" r="3.5" fill={`url(#gold-${uid})`} />
          )}
        </>
      )}

      {/* ============================================================
          ARMS
          ============================================================ */}
      <path
        d="M47 82 C31 76 26 60 32 48"
        stroke={
          stage === 'tie_adult' || stage === 'boss'
            ? stage === 'boss'
              ? '#111827'
              : '#1E293B'
            : `url(#skin-${uid})`
        }
        strokeWidth="12"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M93 82 C109 76 114 60 108 48"
        stroke={
          stage === 'tie_adult' || stage === 'boss'
            ? stage === 'boss'
              ? '#111827'
              : '#1E293B'
            : `url(#skin-${uid})`
        }
        strokeWidth="12"
        strokeLinecap="round"
        fill="none"
      />
      {/* Hands */}
      <circle cx="32" cy="47" r="6" fill={`url(#skin-${uid})`} />
      <circle cx="108" cy="47" r="6" fill={`url(#skin-${uid})`} />

      {/* ============================================================
          HEAD & FACE
          ============================================================ */}
      {/* Ears */}
      <circle cx="43" cy="52" r="5.5" fill="#F3AA82" />
      <circle cx="97" cy="52" r="5.5" fill="#F3AA82" />

      {/* Head Base */}
      <rect
        x="44"
        y="27"
        width="52"
        height="46"
        rx={stage === 'baby' ? '24' : '21'}
        fill={`url(#skin-${uid})`}
      />

      {/* Rosy Cheeks */}
      <ellipse cx="54" cy="56" rx="4.5" ry="2.6" fill="#FF6B6B" opacity="0.55" />
      <ellipse cx="86" cy="56" rx="4.5" ry="2.6" fill="#FF6B6B" opacity="0.55" />

      {/* Eyes (or Boss Sunglasses!) */}
      {stage === 'boss' ? (
        /* Executive Boss Sunglasses */
        <g>
          <line x1="45" y1="48" x2="95" y2="48" stroke="#FBBF24" strokeWidth="2.5" />
          <rect x="49" y="43" width="18" height="12" rx="4" fill="#0F172A" stroke="#FBBF24" strokeWidth="2" />
          <rect x="73" y="43" width="18" height="12" rx="4" fill="#0F172A" stroke="#FBBF24" strokeWidth="2" />
          <line x1="52" y1="46" x2="57" y2="52" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
          <line x1="76" y1="46" x2="81" y2="52" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
        </g>
      ) : (
        <>
          <circle cx="59" cy="50" r="3.6" fill="#1F2937" />
          <circle cx="81" cy="50" r="3.6" fill="#1F2937" />
          <circle cx="60.3" cy="48.8" r="1.3" fill="#FFFFFF" />
          <circle cx="82.3" cy="48.8" r="1.3" fill="#FFFFFF" />
          {/* Female Eyelashes */}
          {isFemale && (
            <>
              <path d="M55 47 L53 45 M85 47 L87 45" stroke="#1F2937" strokeWidth="1.8" strokeLinecap="round" />
            </>
          )}
        </>
      )}

      {/* Mouth / Pacifier (for Baby) */}
      {stage === 'baby' ? (
        /* Cute 3D Baby Pacifier (Emzik) */
        <g>
          <ellipse cx="70" cy="60" rx="8" ry="5.5" fill={isFemale ? '#FF69B4' : '#38BDF8'} />
          <circle cx="70" cy="60" r="3.2" fill="#FFFFFF" />
          <path
            d="M65 62 C65 67 75 67 75 62"
            stroke="#FFFFFF"
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
          />
        </g>
      ) : (
        /* Confident Happy Smile */
        <path
          d="M63 58 Q70 65 77 58 Z"
          fill={isFemale ? '#E11D48' : '#D9383A'}
        />
      )}

      {/* ============================================================
          HAIR & HEADGEAR BY STAGE
          ============================================================ */}
      {stage === 'baby' ? (
        /* Single Cute Baby Curl + Optional Female Bow */
        <>
          <path
            d="M68 28 C68 18 78 18 75 26 C73 30 67 29 68 25"
            stroke={`url(#hair-${uid})`}
            strokeWidth="4.5"
            strokeLinecap="round"
            fill="none"
          />
          {isFemale && (
            <g transform="translate(76, 22)">
              <polygon points="0,0 -8,-5 -8,5" fill="#FF69B4" />
              <polygon points="0,0 8,-5 8,5" fill="#FF69B4" />
              <circle cx="0" cy="0" r="2.8" fill="#FCE7F3" />
            </g>
          )}
        </>
      ) : (
        /* Full Hair Top */
        <>
          <path
            d="M43 43 C43 19 97 19 97 43 C90 31 76 29 62 31 C52 32 46 37 43 43 Z"
            fill={`url(#hair-${uid})`}
          />
          {!isFemale && (
            <>
              <circle cx="70" cy="23" r="9" fill={`url(#hair-${uid})`} />
              <circle cx="57" cy="25" r="7.5" fill={`url(#hair-${uid})`} />
            </>
          )}
          {isFemale && (
            <>
              <path d="M44 38 Q56 26 70 33 Q84 26 96 38" fill={`url(#hair-${uid})`} />
              <circle cx="52" cy="31" r="4" fill="#F472B6" />
            </>
          )}
        </>
      )}

      {/* Child Cap (for Male Child) */}
      {stage === 'child' && !isFemale && (
        <g>
          <path d="M44 34 C44 17 96 17 96 34 Z" fill="#3B82F6" />
          <rect x="65" y="30" width="36" height="6" rx="3" fill="#1D4ED8" />
          <circle cx="70" cy="19" r="3.5" fill="#FACC15" />
        </g>
      )}

      {/* Stage 4: Oversized Studio Headphones (Kulaklıklı Yetişkin) */}
      {stage === 'headphones' && (
        <g>
          {/* Headband Arc */}
          <path
            d="M39 50 C39 14 101 14 101 50"
            stroke="#111827"
            strokeWidth="6.5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M43 46 C43 18 97 18 97 46"
            stroke="#38BDF8"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
          {/* Left & Right Ear Cups */}
          <rect x="33" y="40" width="12" height="22" rx="6" fill="#111827" stroke="#38BDF8" strokeWidth="2" />
          <rect x="95" y="40" width="12" height="22" rx="6" fill="#111827" stroke="#38BDF8" strokeWidth="2" />
        </g>
      )}

      {/* Stage 6: Uzman Boss Golden Crown */}
      {stage === 'boss' && (
        <g transform="translate(48, 6)">
          <polygon
            points="4,22 0,6 12,14 22,2 32,14 44,6 40,22"
            fill={`url(#gold-${uid})`}
            stroke="#B45309"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="22" cy="15" r="2.8" fill="#EF4444" />
          <circle cx="11" cy="17" r="2" fill="#3B82F6" />
          <circle cx="33" cy="17" r="2" fill="#10B981" />
        </g>
      )}
    </svg>
  );
};

