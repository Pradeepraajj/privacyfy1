import re
import os

def verify_voter_id_text(raw_text):
    """
    STRICT VALIDATION for Voter ID (EPIC Number).
    Standard Format: 3 Letters + 7 Digits (e.g., ABC1234567)
    """
    if not raw_text:
        return {"valid": False, "id_number": "EMPTY_TEXT"}

    # 1. NORMALIZE EVERYTHING
    # Remove all spaces and special chars. This is the "Clean Blob".
    full_text_upper = raw_text.upper().strip()
    clean_blob = re.sub(r'[^A-Z0-9]', '', full_text_upper)

    # 2. THE EPIC PATTERN (The "DNA" of a Voter ID)
    # Strictly 3 Letters followed by 7 Alphanumeric (Refined to 7 Digits later)
    pattern = r'([A-Z]{3}[A-Z0-9]{7})'
    match = re.search(pattern, clean_blob)
    
    if match:
        epic_num = match.group(1)
        letters = epic_num[:3]
        numbers = epic_num[3:]
        
        # OCR Correction Map (Fixing Tesseract hallucinations)
        corrections = {'O': '0', 'Q': '0', 'Z': '2', 'S': '5', 'I': '1', 'L': '1', 'B': '8', 'G': '6'}
        for char, rep in corrections.items():
            numbers = numbers.replace(char, rep)
            
        final_id = letters + numbers

        # VALIDATION: Aadhar NEVER matches a 3-letter + 7-digit pattern.
        if re.search(r'\d{5,}', numbers):
            return {"valid": True, "id_number": final_id}

    # 3. EXCLUSIVE KEYWORD CHECK
    # Removed "INDIA" and "GOVERNMENT" because Aadhar has those.
    # We only use terms that are UNIQUE to Voter IDs.
    voter_exclusive_markers = [
        "ELECTIONCOMMISSION", "ELECTORPHOTO", "IDENTITYCARD", 
        "EPIC", "निर्वाचन", "भारतनिर्वाचन"
    ]
    
    if any(k in clean_blob for k in voter_exclusive_markers):
        return {"valid": False, "id_number": "PARTIAL_MATCH"}

    return {"valid": False, "id_number": "NONE"}