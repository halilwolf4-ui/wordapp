const fs = require('fs');
const path = require('path');
const readline = require('readline');

console.time('buildCloze');

const wordsData = JSON.parse(fs.readFileSync('words.json', 'utf8')).words;
console.log('Total words in dictionary:', wordsData.length);

const resultMap = {};

// Helper to normalize
function cleanBase(str) {
  return str.replace(/^to\s+/, '').trim().toLowerCase();
}

// 1. First, check word.examples in words.json
let fromWordsJson = 0;
wordsData.forEach(w => {
  if (w.examples && w.examples.length > 0) {
    const base = cleanBase(w.en);
    // Prefer matching base word in hash
    const matchEx = w.examples.find(e => {
      const m = e.en.match(/#([^#]+)#/);
      return m && m[1].toLowerCase() === base;
    }) || w.examples.find(e => /#[^#]+#/.test(e.en));

    if (matchEx) {
      const m = matchEx.en.match(/#([^#]+)#/);
      if (m) {
        const ans = m[1];
        const s = matchEx.en.replace(/#[^#]+#/g, '[MASK]');
        resultMap[w.id] = {
          sentence: s,
          answer: ans,
          translationTr: matchEx.tr
        };
        fromWordsJson++;
      }
    }
  }
});

console.log('Words covered from words.json examples:', fromWordsJson);

// 2. Second, check CLOTH dataset for remaining words
console.log('Checking CLOTH dataset...');
const test = JSON.parse(fs.readFileSync('cloze/CLOTH_test_cleaned.json', 'utf8'));
const valid = JSON.parse(fs.readFileSync('cloze/CLOTH_valid_cleaned.json', 'utf8'));
const train = JSON.parse(fs.readFileSync('cloze/CLOTH_train_cleaned.json', 'utf8'));

const clothByAnswer = new Map();
[...test, ...valid, ...train].forEach(item => {
  const ans = item.answer.trim().toLowerCase();
  if (!clothByAnswer.has(ans)) {
    clothByAnswer.set(ans, []);
  }
  if (clothByAnswer.get(ans).length < 2) {
    clothByAnswer.get(ans).push(item);
  }
});

let fromCloth = 0;
wordsData.forEach(w => {
  if (resultMap[w.id]) return;
  const base = cleanBase(w.en);
  const clothItems = clothByAnswer.get(base) || clothByAnswer.get(w.en.trim().toLowerCase());
  if (clothItems && clothItems.length > 0) {
    const item = clothItems[0];
    const s = item.sentence.replace(/\s+/g, ' ').replace(/\s*\[MASK\]\s*/g, ' [MASK] ').trim();
    if (s.includes('[MASK]') && (s.match(/\[MASK\]/g) || []).length === 1) {
      resultMap[w.id] = {
        sentence: s,
        answer: item.answer.trim(),
        distractors: item.distractors.slice(0, 3)
      };
      fromCloth++;
    }
  }
});

console.log('Words covered from CLOTH:', fromCloth);

// 3. Third, stream sentences.csv for all remaining words
const remainingWords = wordsData.filter(w => !resultMap[w.id]);
console.log('Remaining words to find in sentences.csv:', remainingWords.length);

const baseToWords = new Map();
remainingWords.forEach(w => {
  const base = cleanBase(w.en);
  if (!baseToWords.has(base)) baseToWords.set(base, []);
  baseToWords.get(base).push(w);
});

console.log('Unique base tokens to search in sentences.csv:', baseToWords.size);

const rl = readline.createInterface({
  input: fs.createReadStream('cloze/sentences.csv'),
  crlfDelay: Infinity
});

let remainingCount = baseToWords.size;
let linesProcessed = 0;

rl.on('line', (line) => {
  if (remainingCount === 0) {
    rl.close();
    return;
  }

  const tab1 = line.indexOf('\t');
  if (tab1 === -1) return;
  const tab2 = line.indexOf('\t', tab1 + 1);
  if (tab2 === -1) return;

  const lang = line.slice(tab1 + 1, tab2);
  if (lang !== 'eng') return;

  const sentence = line.slice(tab2 + 1).trim();
  if (sentence.length < 25 || sentence.length > 120) return;

  const words = sentence.toLowerCase().match(/\b[a-z]+(?:'[a-z]+)?\b/g);
  if (!words) return;

  for (const w of words) {
    const targets = baseToWords.get(w);
    if (targets && targets.length > 0) {
      // Find exact case-insensitive match in sentence to preserve capitalization
      const match = sentence.match(new RegExp('\\b(' + w + ')\\b', 'i'));
      if (match) {
        const exactWord = match[1];
        // Replace ONLY this specific word with [MASK]
        const masked = sentence.replace(new RegExp('\\b' + exactWord + '\\b'), '[MASK]');
        
        targets.forEach(targetWord => {
          if (!resultMap[targetWord.id]) {
            resultMap[targetWord.id] = {
              sentence: masked,
              answer: exactWord
            };
          }
        });

        baseToWords.delete(w);
        remainingCount--;
      }
    }
  }

  linesProcessed++;
});

rl.on('close', () => {
  console.timeEnd('buildCloze');
  const totalCovered = Object.keys(resultMap).length;
  console.log(`FINAL RESULT: ${totalCovered} / ${wordsData.length} words covered (${(totalCovered/wordsData.length*100).toFixed(1)}%)!`);

  // Let's inspect disrupt & disruption
  const disrupt = wordsData.find(w => w.en === 'to disrupt');
  const disruption = wordsData.find(w => w.en === 'disruption');
  console.log('Disrupt result:', disrupt ? resultMap[disrupt.id] : null);
  console.log('Disruption result:', disruption ? resultMap[disruption.id] : null);

  // Save to public/cloze_vocab.json
  const publicPath = path.join(__dirname, '../public/cloze_vocab.json');
  fs.writeFileSync(publicPath, JSON.stringify(resultMap));
  console.log('Saved public/cloze_vocab.json, size:', (fs.statSync(publicPath).size / 1024).toFixed(1), 'KB');
});
