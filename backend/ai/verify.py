import sys
import json
import cv2
import numpy as np
import pytesseract
import re
import os
from PIL import Image, ExifTags

# ✅ CONFIGURATION: Tesseract Path (Updated)
# We point directly to the .exe you just installed
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

def check_tampering(image_path):
    """
    AI FINGERPRINTING:
    Checks file metadata for traces of editing software (Photoshop, GIMP, etc.).
    Returns (True, Reason) if tampering is detected.
    """
    try:
        img = Image.open(image_path)
        exif_data = img._getexif()
        
        if not exif_data:
            return False, "No Metadata (Neutral)"

        # Look for Software tags
        for tag, value in exif_data.items():
            tag_name = ExifTags.TAGS.get(tag, tag)
            if tag_name == "Software":
                software_name = str(value).lower()
                suspicious_tools = ["photoshop", "gimp", "canva", "paint", "adobe"]
                
                if any(tool in software_name for tool in suspicious_tools):
                    return True, f"Editing Software Detected: {value}"
                    
        return False, "Clean Metadata"
    except Exception:
        return False, "Metadata Read Error"

def verify_document(image_path):
    result = {
        "valid": False,
        "score": 0,
        "checks": {
            "face_detected": False,
            "qr_detected": False,
            "id_pattern_found": None,
            "tampering_detected": False, 
            "govt_keywords": 0
        },
        "message": "Processing Failed"
    }

    try:
        # --- 1. AI FINGERPRINTING (PHISHING CHECK) ---
        is_tampered, tampering_msg = check_tampering(image_path)
        if is_tampered:
            result["checks"]["tampering_detected"] = True
            result["valid"] = False
            result["message"] = f"❌ Security Alert: {tampering_msg}"
            print(json.dumps(result))
            return

        # --- 2. IMAGE LOADING ---
        img = cv2.imread(image_path)
        if img is None: raise Exception("Cannot open image file")
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # --- 3. FACE DETECTION (30 Pts) ---
        cascade_path = os.path.join(os.path.dirname(__file__), 'haarcascade_frontalface_default.xml')
        if os.path.exists(cascade_path):
            face_cascade = cv2.CascadeClassifier(cascade_path)
            faces = face_cascade.detectMultiScale(gray, 1.1, 4)
            if len(faces) > 0:
                result["checks"]["face_detected"] = True
                result["score"] += 30

        # --- 4. QR CODE DETECTION (20 Pts) ---
        qr_detector = cv2.QRCodeDetector()
        retval, decoded_info, points = qr_detector.detectAndDecode(img)
        if retval:
            result["checks"]["qr_detected"] = True
            result["score"] += 20

        # --- 5. OCR & PATTERN MATCHING (50 Pts) ---
        text = pytesseract.image_to_string(gray).upper()

        keywords = ["GOVERNMENT", "INDIA", "INCOME TAX", "UIDAI", "MALE", "FEMALE", "DOB"]
        found_keys = [k for k in keywords if k in text]
        result["checks"]["govt_keywords"] = len(found_keys)
        result["score"] += min(len(found_keys) * 10, 20)

        # Regex Patterns
        pan_pattern = r"[A-Z]{5}[0-9]{4}[A-Z]{1}"
        aadhaar_pattern = r"\d{4}\s\d{4}\s\d{4}"

        if re.search(pan_pattern, text):
            result["checks"]["id_pattern_found"] = "PAN Card"
            result["score"] += 50
        elif re.search(aadhaar_pattern, text):
            result["checks"]["id_pattern_found"] = "Aadhaar Card"
            result["score"] += 50

        # --- 6. FINAL VERDICT ---
        if result["score"] >= 50:
            result["valid"] = True
            doc_type = result["checks"]["id_pattern_found"] or "Government ID"
            result["message"] = f"✅ Valid {doc_type} Verified (Original)"
        else:
            result["valid"] = False
            result["message"] = "⚠️ Verification Failed: Document unclear or missing ID features."

        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"valid": False, "error": str(e), "message": "AI Engine Error"}))

if __name__ == "__main__":
    if len(sys.argv) > 1:
        verify_document(sys.argv[1])
    else:
        print(json.dumps({"valid": False, "error": "No file path"}))