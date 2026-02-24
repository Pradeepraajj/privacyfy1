import re
import os

def verify_voter_id_text(raw_text):
    """
    Validates Voter ID (EPIC Number) using Tesseract-extracted text.
    Standard Format: 3 Letters + 7 Digits (e.g., ABC1234567)
    
    This function replaces the PaddleOCR implementation to work within
    the lightweight Tesseract pipeline.
    """
    if not raw_text:
        return {"valid": False, "id_number": "EMPTY_TEXT"}

    # 1. PROCESS TESSERACT TEXT BLOB
    # We split the text into lines and full blob for context checks
    full_text_blob = raw_text.upper().strip()
    raw_lines = [line.strip().upper() for line in raw_text.split('\n') if line.strip()]
    
    extracted_lines = []
    for line in raw_lines:
        # Normalize text: remove spaces and non-alphanumeric symbols
        text_clean = line.replace(" ", "")
        text_clean = re.sub(r'[^A-Z0-9]', '', text_clean)
        extracted_lines.append(text_clean)

    # print(f"DEBUG VOTER TESSERACT LINES: {extracted_lines}")

    # 2. PATTERN MATCHING (EPIC NUMBER)
    # Standard EPIC: 3 Letters followed by 7 Digits.
    # We use [A-Z0-9]{7} for the body initially to catch OCR swaps (like 'O' for '0')
    pattern = r'([A-Z]{3}[A-Z0-9]{7})'
    
    found_epic = None
    
    for line in extracted_lines:
        match = re.search(pattern, line)
        
        if match:
            epic_num = match.group(1)
            
            # 3. POSITION-BASED OCR CORRECTION
            # Index 0-2: Prefix Letters | Index 3-9: Numeric Body
            letters = epic_num[:3]
            numbers = epic_num[3:]
            
            # Common Hallucination Map: Correcting letters in the numeric section
            # Tesseract often confuses 'S' with '5' and 'O' with '0'
            corrections = {
                'O': '0', 'Q': '0', 'Z': '2', 'S': '5', 
                'I': '1', 'L': '1', 'B': '8', 'G': '6'
            }
            
            for char, rep in corrections.items():
                numbers = numbers.replace(char, rep)
                
            final_id = letters + numbers
            
            # 4. VALIDATION: Ensure the numeric part actually contains enough digits
            # Standard EPIC is 3 + 7, so we check for at least 5 digits in the body
            if re.search(r'\d{5,}', numbers):
                found_epic = final_id
                return {"valid": True, "id_number": final_id}

    # 5. KEYWORD BACKUP (Fuzzy Context Check)
    # Context keywords specific to the Election Commission of India
    # If we find these but no EPIC, it's a "PARTIAL_MATCH" (Likely a Voter ID, but OCR failed)
    voter_keywords = [
        "ELECTION", "COMMISSION", "INDIA", "ELECTOR", 
        "PHOTO", "IDENTITY", "भारत", "निर्वाचन", "ELECTION COMMISSION"
    ]
    
    if any(k in full_text_blob for k in voter_keywords):
        # We found a Voter ID context but the EPIC number was not extracted cleanly
        return {"valid": False, "id_number": "PARTIAL_MATCH"}

    return {"valid": False, "id_number": "NONE"}