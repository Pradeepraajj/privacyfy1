# doc_validator/core/text_validator.py
import re
from datetime import datetime

class TextValidator:
    def cleanup(self, text):
        """Removes special characters and extra spaces."""
        # Keep only alphanumeric, spaces, and basic punctuation
        clean = re.sub(r'[^A-Za-z0-9\s\/\-\.:]', '', text)
        return " ".join(clean.split())

    def extract_dob(self, text):
        """
        Attempts to find a Date of Birth in DD/MM/YYYY format.
        Returns: (date_string, is_valid_logic)
        """
        # Regex for dates like 12/05/1990 or 12-05-1990
        date_pattern = r'\b(\d{2})[\/\-](\d{2})[\/\-](\d{4})\b'
        match = re.search(date_pattern, text)
        
        if match:
            day, month, year = map(int, match.groups())
            
            # Logical Check: Is date real?
            try:
                # Check valid calendar date
                dob = datetime(year, month, day)
                
                # Check not in future
                if dob > datetime.now():
                    return (match.group(0), False, "DOB is in the future")
                
                # Check not too old (e.g., 1800s)
                if year < 1900:
                    return (match.group(0), False, "Year seems invalid (<1900)")
                    
                return (match.group(0), True, "Valid DOB")
            except ValueError:
                return (match.group(0), False, "Invalid Calendar Date (e.g. 31st Feb)")
        
        return (None, False, "No DOB found")