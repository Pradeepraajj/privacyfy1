import re

class DocumentClassifier:
    def classify(self, text):
        """
        Determines if the document is Aadhaar, PAN, or Unknown.
        Uses Keyword Scoring, Regex Patterns, and OCR Error Tolerance.
        """
        if not text:
            return "UNKNOWN"

        # 1. Clean the text for Keyword matching
        # Convert to lower and remove multiple spaces/newlines
        clean_text = " ".join(text.lower().split())
        
        # DEBUG: Useful for seeing what Tesseract actually extracted
        print("-" * 30)
        print(f"🔍 OCR SAMPLE: {clean_text[:200]}...")

        # 2. Define Keyword Lists (Including common OCR typos)
        # Typo examples: 'indla' for 'india', 'aadhar' for 'aadhaar'
        aadhaar_keywords = [
            "government of india", "govt of india", "unique identification",
            "aadhaar", "adhar", "uidai", "mera aadhaar", "yob", "dob",
            "male", "female", "father", "address", "help@uidai", "indla", 
            "unlque", "identiflcation", "enrollment", "vid:"
        ]
        
        pan_keywords = [
            "income tax", "incometax", "permanent account", "account number",
            "pan card", "govt of india", "date of birth", "signature",
            "father's name", "tax department", "department", "pancard",
            "income-tax", "goi", "permanent", "account"
        ]

        # 3. Score the Document
        aadhaar_score = 0
        pan_score = 0

        # Keyword Scoring
        for word in aadhaar_keywords:
            if word in clean_text:
                aadhaar_score += 1
        
        for word in pan_keywords:
            if word in clean_text:
                pan_score += 1

        # 4. Regex Pattern Matching ("The Smoking Gun")
        # We use the raw 'text' here to avoid lowercase issues with PAN regex
        
        # Aadhaar Pattern: 12 digit number (xxxx xxxx xxxx)
        # Matches: 1234 5678 9012 OR 123456789012
        aadhaar_num_pattern = re.search(r'\b\d{4}\s?\d{4}\s?\d{4}\b', text)
        if aadhaar_num_pattern:
            print(f"✅ Pattern Found: Aadhaar UID ({aadhaar_num_pattern.group()})")
            aadhaar_score += 7  # High weight

        # PAN Pattern: 5 letters, 4 numbers, 1 letter (ABCDE1234F)
        pan_num_pattern = re.search(r'[A-Z]{5}[0-9]{4}[A-Z]{1}', text)
        if pan_num_pattern:
            print(f"✅ Pattern Found: PAN Number ({pan_num_pattern.group()})")
            pan_score += 7  # High weight

        print(f"📊 SCORES -> Aadhaar: {aadhaar_score} | PAN: {pan_score}")
        print("-" * 30)

        # 5. Final Verdict Logic
        # Require a minimum score of 2 to avoid false positives on random text
        if aadhaar_score > pan_score and aadhaar_score >= 2:
            return "AADHAAR"
        elif pan_score > aadhaar_score and pan_score >= 2:
            return "PAN"
        
        # 6. Final "Common Sense" Fallback
        # If text is messy but contains very specific markers
        if "unique identification" in clean_text or "uidai" in clean_text:
            return "AADHAAR"
        if "permanent account" in clean_text or "income tax" in clean_text:
            return "PAN"

        return "UNKNOWN"