import re
import os

def extract_name_from_dl(extracted_lines):
    """
    Heuristic to find the Name in a Driving License.
    Usually, the name appears after 'Name' or 'Name:' and before 'S/D/W of'.
    """
    name = ""
    # Common labels that precede the actual name
    name_markers = ["NAME", "NAME:", "NAM", "NME", "NAME :"]
    # Common labels that follow the name
    stop_markers = ["S/D/W", "FATHER", "SON", "DAUGHTER", "WIFE", "OF", "DOB", "ADDRESS", "D.O.B"]

    for i, line in enumerate(extracted_lines):
        # Clean the line for comparison
        clean_line = line.replace(" ", "").upper()
        
        # If we find a name marker
        if any(marker in clean_line for marker in name_markers):
            # Check the same line first (e.g., "NAME: PRADEEP KUMAR")
            potential_name = line.upper()
            for m in name_markers:
                potential_name = potential_name.replace(m, "")
            
            potential_name = potential_name.strip(": ").strip()
            
            # If the line was just the word "NAME", look at the next line
            if len(potential_name) < 3 and i + 1 < len(extracted_lines):
                potential_name = extracted_lines[i+1].strip()

            # Final validation: Ensure it's not a stop marker or a date
            if potential_name and not any(stop in potential_name.upper() for stop in stop_markers):
                if not re.search(r'\d', potential_name): # Names rarely have numbers
                    name = potential_name
                    break
    
    return name

def verify_driving_license_text(raw_text):
    """
    Universal Indian DL Parser optimized for Tesseract OCR output.
    Processes raw text directly to identify State Codes and DL Patterns.
    """
    if not raw_text:
        return {"valid": False, "id_number": "EMPTY_TEXT", "name": ""}

    # 1. SPLIT TEXT INTO LINES FOR HEURISTICS
    # Tesseract output needs cleaning as it often adds noise symbols
    raw_lines_with_spaces = [line.strip().upper() for line in raw_text.split('\n') if line.strip()]
    extracted_lines = [line.replace(" ", "") for line in raw_lines_with_spaces]

    # print(f"DEBUG TESSERACT EXTRACTED LINES: {extracted_lines}")

    # 2. DEFINE STATE CODES & GHOSTS
    state_codes = [
        "AN","AP","AR","AS","BR","CH","CG","DN","DD","DL","GA","GJ",
        "HR","HP","JK","JH","KA","KL","LA","LD","MP","MH","MN","ML",
        "MZ","NL","OD","PY","PB","RJ","SK","TN","TG","TR","UP","UK","WB"
    ]

    # Ghost words/Common boilerplate to ignore if they appear alone
    ghosts = ["UNION", "INDIA", "DRIVING", "LICENSE", "LICENCE", "DEPT", "GOVT", "TRANSPORT"]

    # 3. PATTERN MATCHING PER LINE
    # Standard format: State Code (2L) + 13 Alpha-Numeric digits (Total 15 chars)
    universal_pattern = r'([A-Z]{2}[0-9A-Z]{13})'
    # Fallback for older or varyingly formatted licenses
    fallback_pattern = r'([A-Z]{2}[0-9A-Z]{10,14})'

    found_id = "NONE"
    is_valid = False

    for line in extracted_lines:
        # Skip lines that are just ghost words/boilerplate to reduce false positives
        if any(g in line for g in ghosts) and len(line) < 10:
            continue

        match = re.search(universal_pattern, line)
        if not match:
            match = re.search(fallback_pattern, line)

        if match:
            target = match.group(1)
            state = target[:2]
            
            # Verify the first two characters are a valid Indian State Code
            if state in state_codes:
                rest = target[2:]
                
                # 4. OCR ERROR CORRECTION (Numeric Body)
                # Corrects common OCR visual misidentifications (e.g., 'O' instead of '0')
                corrections = {
                    'O': '0', 'Q': '0', 'Z': '2', 
                    'S': '5', 'I': '1', 'L': '1', 
                    'B': '8', 'G': '6', 'T': '7'
                }
                
                for char, rep in corrections.items():
                    rest = rest.replace(char, rep)
                
                final_id = state + rest
                
                # 5. VALIDATION: Ensure the body contains enough digits to be a real DL
                if re.search(r'\d{8,}', final_id):
                    found_id = final_id
                    is_valid = True
                    break
    
    # 6. NAME EXTRACTION (Using original heuristic)
    extracted_name = extract_name_from_dl(raw_lines_with_spaces)
    
    return {
        "valid": is_valid, 
        "id_number": found_id,
        "name": extracted_name
    }