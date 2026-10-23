const fs = require('fs');
const readline = require('readline');
const path = require('path');

const inputFile = path.join(__dirname, '../cloze/kaikki.org-dictionary-English.jsonl');
const outputFile = path.join(__dirname, '../public/dict_kaikki.json');

console.time('extractKaikki');

const dict = Object.create(null);

const rl = readline.createInterface({
  input: fs.createReadStream(inputFile),
  crlfDelay: Infinity
});

let lineCount = 0;

function addTranslation(word, trList, ipa) {
  if (!word || typeof word !== 'string') return;
  const w = word.trim().toLowerCase();
  // Filter out very long phrases or symbols
  if (w.length < 2 || w.length > 35 || /[^a-z0-9\- ']/i.test(w)) return;

  if (!dict[w]) {
    dict[w] = {
      tr: [],
      ipa: ipa || undefined
    };
  } else if (!dict[w].ipa && ipa) {
    dict[w].ipa = ipa;
  }

  for (const item of trList) {
    if (!item || typeof item !== 'string') continue;
    const cleanTr = item.trim().toLowerCase();
    if (cleanTr && cleanTr !== w && !dict[w].tr.includes(cleanTr)) {
      dict[w].tr.push(cleanTr);
    }
  }
}

function extractTrsFromList(arr) {
  const result = [];
  if (!Array.isArray(arr)) return result;
  for (const item of arr) {
    if (
      (item.code === 'tr' || item.lang_code === 'tr' || item.lang === 'Turkish' || item.lang === 'tr') &&
      item.word
    ) {
      result.push(item.word);
    }
  }
  return result;
}

rl.on('line', (line) => {
  lineCount++;
  // Quick pre-check
  if (
    !line.includes('"tr"') &&
    !line.includes('"code": "tr"') &&
    !line.includes('"lang_code": "tr"') &&
    !line.includes('"lang": "Turkish"') &&
    !line.includes('"Turkish"')
  ) {
    return;
  }

  try {
    const data = JSON.parse(line);
    const word = data.word;
    if (!word) return;

    // Extract IPA if present
    let ipa;
    if (data.sounds && Array.isArray(data.sounds)) {
      const snd = data.sounds.find(s => s.ipa && typeof s.ipa === 'string');
      if (snd) ipa = snd.ipa;
    }

    const trs = [];

    // 1. Top-level translations
    if (data.translations) {
      trs.push(...extractTrsFromList(data.translations));
    }

    // 2. Senses translations
    if (data.senses && Array.isArray(data.senses)) {
      for (const sense of data.senses) {
        if (sense.translations) {
          trs.push(...extractTrsFromList(sense.translations));
        }
      }
    }

    if (trs.length > 0) {
      addTranslation(word, trs, ipa);
    }
  } catch (err) {}
});

rl.on('close', () => {
  console.timeEnd('extractKaikki');
  const words = Object.keys(dict);
  console.log(`Finished processing ${lineCount} lines.`);
  console.log(`Extracted ${words.length} English words with Turkish translations!`);

  // Compact the data: tr array -> comma-separated string, limit to top 4 meanings
  const compactDict = {};
  for (const w of words) {
    const entry = dict[w];
    if (entry.tr.length > 0) {
      const trStr = entry.tr.slice(0, 4).join(', ');
      compactDict[w] = entry.ipa ? { tr: trStr, ipa: entry.ipa } : { tr: trStr };
    }
  }

  const jsonStr = JSON.stringify(compactDict);
  fs.writeFileSync(outputFile, jsonStr, 'utf8');
  const sizeMB = (Buffer.byteLength(jsonStr, 'utf8') / (1024 * 1024)).toFixed(2);
  console.log(`Saved dictionary to ${outputFile} (${sizeMB} MB)`);
});
