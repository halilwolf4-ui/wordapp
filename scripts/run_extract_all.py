import os
import sys
import glob
import json
from build_yokdil_dataset import parse_pdf

sys.stdout.reconfigure(encoding='utf-8')

all_extracted_questions = []
seen_ids = set()

stats = {
    'fen': 0,
    'sosyal': 0,
    'total': 0,
    'by_year': {},
    'by_exam': {}
}

pdf_files = []
for cat in ['fen', 'sosyal']:
    folder = os.path.join('sorular', cat)
    files = sorted(glob.glob(os.path.join(folder, '*.pdf')))
    for f in files:
        pdf_files.append((f, cat))

print(f"Starting extraction for {len(pdf_files)} PDF files...")

for pdf_path, cat in pdf_files:
    fname = os.path.basename(pdf_path)
    try:
        meta, questions = parse_pdf(pdf_path, cat)
        added_for_file = 0
        for q in questions:
            # Ensure uniqueness
            q_id = q['id']
            if q_id not in seen_ids:
                seen_ids.add(q_id)
                all_extracted_questions.append(q)
                added_for_file += 1
                stats[cat] += 1
                stats['total'] += 1
                y = q['year']
                stats['by_year'][y] = stats['by_year'].get(y, 0) + 1
                ex = q['shortExam'] + f" ({cat})"
                stats['by_exam'][ex] = stats['by_exam'].get(ex, 0) + 1
        print(f"✓ {fname} [{cat.upper()}] -> {meta['exam']}: extracted {len(questions)} (added {added_for_file} unique)")
    except Exception as e:
        print(f"✗ ERROR parsing {fname}: {e}")

out_path = os.path.join('public', 'yokdil_questions.json')
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(all_extracted_questions, f, ensure_ascii=False, indent=2)

print("\n" + "="*50)
print(f"EXTRACTION COMPLETE!")
print(f"Total Unique Questions Extracted: {stats['total']}")
print(f"  - Fen Bilimleri: {stats['fen']}")
print(f"  - Sosyal Bilimler: {stats['sosyal']}")
print("\nBreakdown by Year:")
for y in sorted(stats['by_year'].keys()):
    print(f"  {y}: {stats['by_year'][y]} questions")
print("\nBreakdown by Exam:")
for ex, cnt in sorted(stats['by_exam'].items()):
    print(f"  {ex}: {cnt} questions")
print(f"\nSaved to: {out_path} ({os.path.getsize(out_path):,} bytes)")
