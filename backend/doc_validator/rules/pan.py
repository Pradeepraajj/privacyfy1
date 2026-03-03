import re

class PanRules:
    def validate(self, text):
        score = 0
        flags = []
        # Normalize text: Remove spaces/newlines to help regex find the ID
        text_clean = text.upper().replace(" ", "").replace("\n", "")
        text_upper = text.upper()
        
        # 1. Fuzzy Keyword Matching
        keywords = ["INCOME", "TAX", "PERMANENT", "ACCOUNT", "DEPARTMENT"]
        matched_keywords = [k for k in keywords if k in text_upper]
        
        if len(matched_keywords) >= 1:
            # Finding 2+ keywords is a very strong indicator
            score += 35 if len(matched_keywords) > 1 else 25
            flags.append(f"PAN Keywords: {matched_keywords}")

        # 2. Strict Alphanumeric Structure (5L-4D-1L)
        pan_pattern = r'[A-Z]{5}[0-9]{4}[A-Z]{1}'
        found_pan = re.search(pan_pattern, text_clean) # Check cleaned text
        
        if found_pan:
            score += 65 
            flags.append(f"PAN ID Verified: {found_pan.group()}")
        else:
            # 3. Loosened Fallback (Handles O vs 0 or I vs 1)
            # Looks for any 10-char alphanumeric block that is mostly correct
            loose_pattern = r'[A-Z0-9]{10}'
            if re.search(loose_pattern, text_clean):
                score += 20
                flags.append("Partial/Noisy PAN ID detected")

        return {"score": score, "flags": flags}