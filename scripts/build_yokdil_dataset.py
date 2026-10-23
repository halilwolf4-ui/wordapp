import os
import sys
import glob
import re
import json
import pymupdf

sys.stdout.reconfigure(encoding='utf-8')

def extract_answer_key_from_doc(doc):
    answers = {}
    for page_idx in range(len(doc) - 1, max(-1, len(doc) - 4), -1):
        text = doc[page_idx].get_text()
        matches = re.findall(r'(\b\d{1,2})\s*[\.:\)]\s*([A-E])\b', text)
        if len(matches) >= 20:
            for num_str, letter in matches:
                q_num = int(num_str)
                if 1 <= q_num <= 80:
                    answers[q_num] = letter
            if len(answers) >= 60:
                break
    return answers

def extract_exam_meta(doc, filename, folder_cat):
    header_text = ''
    for i in range(min(4, len(doc))):
        header_text += ' ' + doc[i].get_text()
    
    m = re.search(r'(20\d\d)\s*[-/ ]\s*YÖKD[İI]L\s*[/ ]\s*([12])', header_text, re.IGNORECASE)
    if m:
        year = int(m.group(1))
        term = m.group(2)
    else:
        m_file_year = re.search(r'20(\d\d)', filename)
        year = int("20" + m_file_year.group(1)) if m_file_year else 2024
        m_file_term = re.search(r'yokdil([12])', filename, re.IGNORECASE)
        term = m_file_term.group(1) if m_file_term else ("1" if "02" in filename or "03" in filename or "1" in filename else "2")
    
    exam_label = f"{year} YÖKDİL/{term}"
    cat_label = "Fen Bilimleri" if folder_cat == "fen" else "Sosyal Bilimler"
    full_exam = f"{exam_label} ({cat_label})"
    
    return {
        "year": year,
        "term": term,
        "exam": full_exam,
        "short_exam": exam_label,
        "category": folder_cat
    }

def group_words_into_lines(words):
    sorted_words = sorted(words, key=lambda w: (w[1], w[0]))
    lines = []
    current_line = []
    current_y = None
    for w in sorted_words:
        if current_y is None or abs(w[1] - current_y) <= 3:
            current_line.append(w)
            current_y = w[1]
        else:
            current_line.sort(key=lambda x: x[0])
            line_text = " ".join([x[4] for x in current_line])
            lines.append((current_y, line_text))
            current_line = [w]
            current_y = w[1]
    if current_line:
        current_line.sort(key=lambda x: x[0])
        line_text = " ".join([x[4] for x in current_line])
        lines.append((current_y, line_text))
    return lines

def clean_text(text):
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def parse_column_lines(lines, answer_key, meta, page_num):
    # Parse items in a column
    # lines is a list of (y, text)
    questions = []
    
    # State tracking
    current_q_num = None
    current_prompt_lines = []
    current_options = {}
    current_answer = None
    collecting_option = None
    
    def finalize_question():
        nonlocal current_q_num, current_prompt_lines, current_options, current_answer, collecting_option
        if current_q_num and len(current_options) == 5:
            prompt_str = clean_text(" ".join(current_prompt_lines))
            ans = current_answer or answer_key.get(current_q_num)
            if prompt_str and ans in ['A', 'B', 'C', 'D', 'E']:
                q_id = f"{meta['category']}-{meta['year']}-{meta['term']}-q{current_q_num}"
                questions.append({
                    "id": q_id,
                    "category": meta["category"],
                    "year": meta["year"],
                    "term": meta["term"],
                    "exam": meta["exam"],
                    "shortExam": meta["short_exam"],
                    "questionNumber": current_q_num,
                    "prompt": prompt_str,
                    "options": {
                        "A": clean_text(current_options.get("A", "")),
                        "B": clean_text(current_options.get("B", "")),
                        "C": clean_text(current_options.get("C", "")),
                        "D": clean_text(current_options.get("D", "")),
                        "E": clean_text(current_options.get("E", ""))
                    },
                    "answer": ans
                })
        # Reset
        current_q_num = None
        current_prompt_lines = []
        current_options = {}
        current_answer = None
        collecting_option = None

    i = 0
    while i < len(lines):
        y, line = lines[i]
        line_clean = line.strip()
        
        # Check for DOĞRU CEVAP marker
        m_ans = re.search(r'DOĞRU\s+CEVAP\s*:\s*([A-E])', line_clean, re.IGNORECASE)
        if m_ans:
            current_answer = m_ans.group(1).upper()
            i += 1
            continue

        # Check for instruction lines like "1. - 20. sorularda..." or "Bu testte 80 soru..."
        if re.search(r'sorularda,\s*cümlede|soruları\s+aşağıdaki|Bu testte\s+\d+|Diğer sayfaya geçiniz', line_clean, re.IGNORECASE):
            i += 1
            continue

        # Check for Question Number header
        # Either "1. Some question text..." or "1." alone
        m_q_start = re.match(r'^(\d{1,2})\.\s*(.*)', line_clean)
        if m_q_start:
            q_num = int(m_q_start.group(1))
            rest = m_q_start.group(2).strip()
            
            # Check if this might be an instruction like "1. - 20. sorularda"
            if re.match(r'^-\s*\d{1,2}\.\s*soru', rest, re.IGNORECASE):
                i += 1
                continue
                
            # Finalize previous question if one was in progress
            finalize_question()
            
            # Check if rest is empty or has content
            current_q_num = q_num
            current_prompt_lines = []
            current_options = {}
            current_answer = None
            collecting_option = None
            
            if rest:
                current_prompt_lines.append(rest)
            i += 1
            continue
            
        if current_q_num is None:
            i += 1
            continue

        # Check for option patterns on this line
        # Pattern 1: A) optA B) optB
        m_ab = re.match(r'^A\)\s*(.*?)\s+B\)\s*(.*)', line_clean)
        if m_ab:
            current_options['A'] = m_ab.group(1)
            current_options['B'] = m_ab.group(2)
            collecting_option = 'B'
            i += 1
            continue

        # Pattern 2: C) optC D) optD
        m_cd = re.match(r'^C\)\s*(.*?)\s+D\)\s*(.*)', line_clean)
        if m_cd:
            current_options['C'] = m_cd.group(1)
            current_options['D'] = m_cd.group(2)
            collecting_option = 'D'
            i += 1
            continue

        # Pattern 3: E) optE
        m_e = re.match(r'^E\)\s*(.*)', line_clean)
        if m_e:
            current_options['E'] = m_e.group(1)
            collecting_option = 'E'
            i += 1
            continue

        # Pattern 4: Single option A) optA, B) optB, etc.
        m_single = re.match(r'^([A-E])\)\s*(.*)', line_clean)
        if m_single:
            opt_letter = m_single.group(1)
            opt_text = m_single.group(2)
            current_options[opt_letter] = opt_text
            collecting_option = opt_letter
            i += 1
            continue

        # Continuation of an option text
        if collecting_option:
            current_options[collecting_option] = current_options[collecting_option] + " " + line_clean
            i += 1
            continue

        # If we haven't seen any options yet, this line is part of prompt
        if not current_options:
            current_prompt_lines.append(line_clean)
            
        i += 1

    finalize_question()
    return questions

def parse_pdf(pdf_path, folder_cat):
    doc = pymupdf.open(pdf_path)
    filename = os.path.basename(pdf_path)
    meta = extract_exam_meta(doc, filename, folder_cat)
    answer_key = extract_answer_key_from_doc(doc)
    
    all_questions = []
    
    # Iterate through content pages (usually page index 1 to len(doc)-2)
    for p_idx in range(len(doc)):
        page = doc[p_idx]
        words = page.get_text("words")
        if not words:
            continue
            
        # Left column & right column
        left_words = [w for w in words if w[0] < 285 and 65 <= w[1] <= 780]
        right_words = [w for w in words if w[0] >= 285 and 65 <= w[1] <= 780]
        
        # Check if page has DOĞRU CEVAP anywhere
        page_text = page.get_text()
        page_ans_m = re.findall(r'DOĞRU\s+CEVAP\s*:\s*([A-E])', page_text, re.IGNORECASE)
        default_ans = page_ans_m[0].upper() if page_ans_m else None
        
        col1_lines = group_words_into_lines(left_words)
        col2_lines = group_words_into_lines(right_words)
        
        q1 = parse_column_lines(col1_lines, answer_key, meta, p_idx)
        q2 = parse_column_lines(col2_lines, answer_key, meta, p_idx)
        
        # If any question lacked answer from table, check if page had DOĞRU CEVAP
        for q in q1 + q2:
            if not q.get('answer') and default_ans:
                q['answer'] = default_ans
                
        all_questions.extend(q1)
        all_questions.extend(q2)
        
    return meta, all_questions

print("Parser module ready.")
