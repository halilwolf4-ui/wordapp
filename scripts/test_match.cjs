const fs = require('fs');
const readline = require('readline');

const wordsData = JSON.parse(fs.readFileSync('words.json', 'utf8')).words;
const wordMap = new Map();
wordsData.forEach(w => {
  const clean = w.en.replace(/^to\s+/, '').trim().toLowerCase();
  if (clean.length >= 2) {
    if (!wordMap.has(clean)) wordMap.set(clean, { id: w.id, en: w.en, base: clean, sentences: [] });
  }
});

console.log('Unique base words:', wordMap.size);

const rl = readline.createInterface({
  input: fs.createReadStream('cloze/sentences.csv'),
  crlfDelay: Infinity
});

let lineCount = 0;
let engCount = 0;
let found = 0;

rl.on('line', (line) => {
  lineCount++;
  const parts = line.split('\t');
  if (parts.length >= 3 && parts[1] === 'eng') {
    engCount++;
    const sentence = parts[2].trim();
    if (sentence.length >= 20 && sentence.length <= 110) {
      // Split into words
      const words = sentence.toLowerCase().match(/\b[a-z]+(?:'[a-z]+)?\b/g);
      if (words) {
        for (const w of words) {
          const entry = wordMap.get(w);
          if (entry && entry.sentences.length < 2) {
            entry.sentences.push(sentence);
            if (entry.sentences.length === 1) found++;
          }
        }
      }
    }
  }

  if (lineCount % 2000000 === 0) {
    console.log(`Line: ${lineCount}, English: ${engCount}, Words matched: ${found}`);
  }
});

rl.on('close', () => {
  console.log(`Finished! Total lines: ${lineCount}, English: ${engCount}, Words matched: ${found} / ${wordMap.size}`);
  const sample = wordMap.get('disrupt');
  console.log('disrupt sample:', sample);
  const sample2 = wordMap.get('disruption');
  console.log('disruption sample:', sample2);
});
