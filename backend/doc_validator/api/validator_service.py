# doc_validator/api/validator_service.py

# This Service class is optional if you are using 'main.py' as the orchestrator.
# However, for cleaner architecture, 'main.py' should call this Service.

import cv2
import pytesseract
from core.classifier import DocumentClassifier
from core.forgery_detector import ForgeryDetector
from core.layout_validator import LayoutValidator
from rules.aadhaar import AadhaarRules
from rules.pan import PanRules

class ValidatorService:
    def __init__(self):
        self.classifier = DocumentClassifier()
        self.forgery = ForgeryDetector()
        self.layout = LayoutValidator()

    def process_document(self, image_path):
        response = {
            "status": "PROCESSING",
            "flags": [],
            "score": 0
        }
        
        # 1. Load Image
        img = cv2.imread(image_path)
        if img is None:
            return {"status": "ERROR", "message": "Image load failed"}

        # 2. Layout Check (Face Detection)
        face_check = self.layout.has_face(img)
        if face_check["valid"]:
            response["score"] += 20
            response["flags"].append("Face Detected")
        else:
            response["flags"].append("No Face Detected (Warning)")

        # 3. Text Extraction
        text = pytesseract.image_to_string(img)
        
        # 4. Classification
        doc_type = self.classifier.classify(text)
        response["document_type"] = doc_type

        # 5. Route to Specific Logic
        rule_result = {"score": 0, "flags": []}
        
        if doc_type == "AADHAAR":
            rule_result = AadhaarRules().validate(text)
        elif doc_type == "PAN":
            rule_result = PanRules().validate(text)
        
        # Merge Scores
        response["score"] += rule_result["score"]
        response["flags"].extend(rule_result["flags"])
        
        return response