import re

class PanRules:
    def validate(self, text):
        score = 0
        flags = []
        text_upper = text.upper()
        
        # 1. Fuzzy Keyword Matching
        # Looks for context keywords that appear on PAN cards
        keywords = ["INCOME TAX", "PERMANENT", "ACCOUNT", "DEPARTMENT", "SIGNATURE"]
        matched_keywords = [k for k in keywords if k in text_upper]
        
        if len(matched_keywords) >= 1:
            score += 30
            flags.append(f"PAN Header Matches: {matched_keywords}")

        # 2. Strict Alphanumeric Structure
        # Regex: 5 Letters, 4 Numbers, 1 Letter (e.g., ABCDE1234F)
        pan_pattern = r'[A-Z]{5}[0-9]{4}[A-Z]{1}'
        found_pan = re.search(pan_pattern, text_upper)
        
        if found_pan:
            score += 70
            flags.append(f"Valid PAN Structure Found: {found_pan.group()}")
        else:
            # Fallback: Check for "Broken" PANs (e.g., misread letter as number)
            # This handles cases where OCR sees 'O' as '0' or 'I' as '1'
            loose_pattern = r'[A-Z0-9]{10}' 
            if re.search(loose_pattern, text_upper):
                score += 20
                flags.append("Partial PAN structure detected (check image quality)")

        return {"score": score, "flags": flags}