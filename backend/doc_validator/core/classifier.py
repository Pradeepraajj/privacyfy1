import re

class DocumentClassifier:
    def classify(self, text):
        """
        Determines if the document is Aadhaar, PAN, or Unknown.
        Uses 'Fuzzy Logic' and 'Regex Patterns' to handle bad OCR.
        """
        # 1. Clean the text (Lower case, remove special chars)
        clean_text = text.lower()
        
        # DEBUG: Print what the AI actually read (Check your terminal for this!)
        print(f"🔍 AI READ TEXT: {clean_text[:150]}...")

        # 2. Define Keyword Lists (Common OCR typos included)
        aadhaar_keywords = [
            "government of india", "govt of india", "unique identification",
            "aadhaar", "adhar", "uidai", "mera aadhaar", "yob", "dob",
            "male", "female", "father", "address", "help@uidai"
        ]
        
        pan_keywords = [
            "income tax", "incometax", "permanent account", "account number",
            "pan card", "govt of india", "date of birth", "signature",
            "father's name", "tax department"
        ]

        # 3. Score the Document based on keywords
        aadhaar_score = 0
        pan_score = 0

        for word in aadhaar_keywords:
            if word in clean_text:
                aadhaar_score += 1
        
        for word in pan_keywords:
            if word in clean_text:
                pan_score += 1

        # 4. Check for "The Smoking Gun" (Regex Patterns)
        # These are worth 5 points because they are unique to the ID.
        
        # Aadhaar Pattern: 12 digit number (e.g., 1234 5678 9012)
        # Looks for: 4 digits, space, 4 digits, space, 4 digits
        if re.search(r'\b\d{4}\s?\d{4}\s?\d{4}\b', text):
            print("✅ Pattern Found: 12-Digit UID")
            aadhaar_score += 5  
            
        # PAN Pattern: 5 letters, 4 numbers, 1 letter (e.g., ABCDE1234F)
        if re.search(r'[A-Z]{5}[0-9]{4}[A-Z]{1}', text):
            print("✅ Pattern Found: PAN Number")
            pan_score += 5      

        print(f"📊 FINAL SCORES -> Aadhaar: {aadhaar_score} | PAN: {pan_score}")

        # 5. Final Verdict
        if aadhaar_score > pan_score and aadhaar_score >= 1:
            return "AADHAAR"
        elif pan_score > aadhaar_score and pan_score >= 1:
            return "PAN"
        
        # Fallback: If messy text but contains "India", guess Aadhaar
        if "india" in clean_text and aadhaar_score > 0:
             return "AADHAAR"

        return "UNKNOWN"