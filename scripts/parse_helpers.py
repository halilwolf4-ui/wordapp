import sys
import os
import glob
import re
import json
import pymupdf

sys.stdout.reconfigure(encoding='utf-8')

def extract_answer_key_from_doc(doc):
    # Search last 3 pages for answer key table
    # Pattern: "1. B" or "1.   B" or "1 B"
    answers = {}
    for page_idx in range(len(doc) - 1, max(-1, len(doc) - 4), -1):
        text = doc[page_idx].get_text()
        matches = re.findall(r'(\b\d{1,2})\s*[\.:\)]\s*([A-E])\b', text)
        if len(matches) >= 20: # Likely the answer key page!
            for num_str, letter in matches:
                q_num = int(num_str)
                if 1 <= q_num <= 80:
                    answers[q_num] = letter
            if len(answers) >= 60:
                break
    return answers

def extract_exam_info(doc, filename, folder_cat):
    # Extract year, exam name from first 3 pages
    header_text = ''
    for i in range(min(3, len(doc))):
        header_text += ' ' + doc[i].get_text()
    
    # Try finding exam pattern
    # e.g. 2024-YÖKDİL/2 or 2021-YÖKDİL/1 or 2020-YÖKDİL/1
    m = re.search(r'(20\d\d)\s*[-/ ]\s*YÖKD[İI]L\s*[/ ]\s*([12])', header_text, re.IGNORECASE)
    if m:
        year = int(m.group(1))
        term = m.group(2)
        exam_name = f"{year} YÖKDİL/{term}"
    else:
        # Check filename for hints
        # e.g. ing-fen11082024.pdf -> 2024
        m_file = re.search(r'20(\d\d)', filename)
        year = int("20" + m_file.group(1)) if m_file else 2024
        m_term = re.search(r'yokdil([12])', filename, re.IGNORECASE)
        term = m_term.group(1) if m_term else ("1" if "02" in filename or "03" in filename else "2")
        exam_name = f"{year} YÖKDİL/{term}"

    field_name = "Fen Bilimleri" if folder_cat == "fen" else "Sosyal Bilimler"
    return {
        "year": year,
        "term": term,
        "exam_name": f"{exam_name} ({field_name})",
        "short_exam": exam_name,
        "category": folder_cat
    }

print("Testing parser setup...")
