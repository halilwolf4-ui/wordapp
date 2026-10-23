const fs = require('fs');
const path = require('path');

const preps = new Set([
  'in', 'on', 'at', 'to', 'for', 'with', 'from', 'by', 'about', 'into', 'over', 'after', 
  'under', 'through', 'between', 'before', 'without', 'against', 'during', 'towards', 
  'behind', 'across', 'around', 'among', 'off', 'up', 'down', 'out', 'of', 'upon', 'along', 'past', 'above', 'below', 'near', 'since', 'beside', 'within'
]);

function cleanSentence(s) {
  if (!s) return '';
  return s
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*\[MASK\]\s*/g, ' [MASK] ')
    .replace(/^\d+\s*\[MASK\]/, '[MASK]')
    .replace(/\s*([.,?!;:])/g, '$1')
    .replace(/\[MASK\]/g, ' [MASK] ')
    .replace(/\s+/g, ' ')
    .trim();
}

console.log('Loading words.json and CLOTH files...');
const wordsData = JSON.parse(fs.readFileSync(path.join(__dirname, '../words.json'), 'utf8')).words;
const targetWordSet = new Set(wordsData.map(w => w.en.trim().toLowerCase()));

const test = JSON.parse(fs.readFileSync(path.join(__dirname, '../cloze/CLOTH_test_cleaned.json'), 'utf8'));
const valid = JSON.parse(fs.readFileSync(path.join(__dirname, '../cloze/CLOTH_valid_cleaned.json'), 'utf8'));
const train = JSON.parse(fs.readFileSync(path.join(__dirname, '../cloze/CLOTH_train_cleaned.json'), 'utf8'));

const all = [...test, ...valid, ...train];
console.log('Total items in CLOTH:', all.length);

// 1. EXTRACT PREPOSITIONS (Up to 2,000 clean questions)
const prepQuestions = [];
const seenPrep = new Set();

for (const item of all) {
  const ans = item.answer.trim();
  const ansLower = ans.toLowerCase();
  if (preps.has(ansLower)) {
    const s = cleanSentence(item.sentence);
    const maskCount = (s.match(/\[MASK\]/g) || []).length;
    if (maskCount === 1 && s.length >= 25 && s.length <= 180) {
      const dists = item.distractors
        .map(d => d.trim())
        .filter(d => d.toLowerCase() !== ansLower && d.length > 0 && d.length < 15);
      
      const uniqueDists = [...new Set(dists)];
      if (uniqueDists.length >= 3) {
        const key = ansLower + ':::' + s;
        if (!seenPrep.has(key)) {
          seenPrep.add(key);
          prepQuestions.push({
            id: 'p_' + prepQuestions.length,
            sentence: s,
            answer: ans,
            distractors: uniqueDists.slice(0, 3)
          });
        }
      }
    }
  }
}

console.log('Clean preposition questions:', prepQuestions.length);

// 2. EXTRACT VOCABULARY MAPPING (focused on target words in words.json)
const vocabMap = {};
let vocabCount = 0;

for (const item of all) {
  const ans = item.answer.trim();
  const ansLower = ans.toLowerCase();
  if (targetWordSet.has(ansLower) && !preps.has(ansLower)) {
    const s = cleanSentence(item.sentence);
    const maskCount = (s.match(/\[MASK\]/g) || []).length;
    if (maskCount === 1 && s.length >= 25 && s.length <= 180) {
      const dists = item.distractors
        .map(d => d.trim())
        .filter(d => d.toLowerCase() !== ansLower && d.length > 0 && d.length < 20);
      
      const uniqueDists = [...new Set(dists)];
      if (uniqueDists.length >= 3) {
        if (!vocabMap[ansLower]) {
          vocabMap[ansLower] = [];
        }
        if (vocabMap[ansLower].length < 1) {
          vocabMap[ansLower].push({
            sentence: s,
            answer: ans,
            distractors: uniqueDists.slice(0, 3)
          });
          vocabCount++;
        }
      }
    }
  }
}

console.log('Words in vocab map (matching dictionary):', Object.keys(vocabMap).length, 'Total sentences:', vocabCount);

// Ensure public directory exists
const publicDir = path.join(__dirname, '../public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(path.join(publicDir, 'cloze_prepositions.json'), JSON.stringify(prepQuestions));
console.log('Saved public/cloze_prepositions.json size:', (fs.statSync(path.join(publicDir, 'cloze_prepositions.json')).size / 1024).toFixed(1), 'KB');

fs.writeFileSync(path.join(publicDir, 'cloze_vocab.json'), JSON.stringify(vocabMap));
console.log('Saved public/cloze_vocab.json size:', (fs.statSync(path.join(publicDir, 'cloze_vocab.json')).size / 1024).toFixed(1), 'KB');
