import sys
import json
import cv2
import pytesseract
import os
import shutil
import numpy as np
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware  # Required for React connection
from ultralytics import YOLO

# --- Force UTF-8 for symbols ---
sys.stdout.reconfigure(encoding="utf-8")
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

# --- DYNAMIC PATH FOR MODEL ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "best.pt")

try:
    yolo_model = YOLO(MODEL_PATH)
    print(f"✅ Success: Loaded YOLO model from {MODEL_PATH}")
except Exception as e:
    print(f"⚠️ Warning: Could not load best.pt at {MODEL_PATH}: {e}")
    yolo_model = None

# --- Internal Imports ---
try:
    from core.classifier import DocumentClassifier
    from core.forgery_detector import ForgeryDetector
    from utils.image_utils import preprocess_for_ocr
    from rules.aadhaar import AadhaarRules
    from rules.pan import PanRules
except ImportError as e:
    print(json.dumps({"status": "ERROR", "flags": [f"Module Import Error: {str(e)}"]}))
    sys.exit(1)

app = FastAPI(title="PrivacyFy AI Worker")

# --- CORS CONFIGURATION ---
# This allows your React app at localhost:3000 to communicate with this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def process_document(image_path: str) -> dict:
    response = {
        "status": "PROCESSING",
        "document_type": "UNKNOWN",
        "confidence_score": 0,
        "flags": []
    }

    try:
        img = cv2.imread(image_path)
        if img is None: raise ValueError("Could not read image file")

        # 1. YOLO Visual Detection
        visual_score = 0
        if yolo_model:
            results = yolo_model(img, conf=0.35)
            if len(results[0].boxes) > 0:
                visual_score = 45 
                response["flags"].append("YOLO: Visual ID patterns confirmed")

        # 2. OCR Analysis
        processed_img = preprocess_for_ocr(img)
        text = pytesseract.image_to_string(processed_img, config=r"--oem 3 --psm 6")
        
        # 3. Document Classification (Aadhaar vs PAN)
        classifier = DocumentClassifier()
        doc_type = classifier.classify(text)
        response["document_type"] = doc_type

        # 4. Specific Rule Validation
        rule_score = 0
        if doc_type == "AADHAAR":
            rule_result = AadhaarRules().validate(text)
            rule_score = rule_result["score"]
            response["flags"].extend(rule_result.get("flags", []))
        elif doc_type == "PAN":
            rule_result = PanRules().validate(text)
            rule_score = rule_result["score"]
            response["flags"].extend(rule_result.get("flags", []))

        # 5. Final Combined Scoring
        response["confidence_score"] = visual_score + rule_score
        print(f"DEBUG: Visual({visual_score}) + Rules({rule_score}) = Total({response['confidence_score']})")

        # Logic: If combined score >= 45, it is authentic
        if response["confidence_score"] >= 45:
            response["status"] = "LIKELY_AUTHENTIC"
        else:
            response["status"] = "REJECTED"

    except Exception as e:
        response["status"] = "ERROR"
        response["flags"].append(f"System Error: {str(e)}")

    return response

@app.post("/verify-document")
async def verify_document(file: UploadFile = File(...)):
    temp_file_path = f"temp_{file.filename}"
    try:
        # Save file locally for processing
        contents = await file.read()
        with open(temp_file_path, "wb") as buffer:
            buffer.write(contents)
        
        result = process_document(temp_file_path)
        is_valid = result["status"] == "LIKELY_AUTHENTIC"
        
        # Return includes document_type for the React frontend label
        return {
            "valid": is_valid,
            "document_type": result.get("document_type", "UNKNOWN"),
            "message": f"AI Status: {result['status']} (Score: {result['confidence_score']})",
            "signature": f"PFY-SIG-{os.urandom(4).hex().upper()}" if is_valid else "UNVERIFIED",
            "details": result
        }
    finally:
        # Clean up temporary storage
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)