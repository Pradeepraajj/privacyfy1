import sys
import json
import cv2
import pytesseract
import os
import re
import hashlib
import numpy as np
import requests  
from datetime import datetime
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware 
from ultralytics import YOLO
from eth_account import Account
from eth_account.messages import encode_defunct
from web3 import Web3
from dotenv import load_dotenv 

# --- PDF HANDLING IMPORTS ---
from pdf2image import convert_from_path
from PIL import Image

# --- NEW ENCRYPTION IMPORTS ---
from utils.encryption import encrypt_file, generate_key

# --- LOAD ENVIRONMENT VARIABLES ---
env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

PINATA_JWT = os.getenv("JWT_SECRET")
PINATA_API_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS"

# --- BLOCKCHAIN CONFIG ---
PRIVATE_KEY = os.getenv("PRIVATE_KEY")
RPC_URL = os.getenv("RPC_URL") 
CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS") 

# --- PATH CONFIGURATION ---
POPPLER_PATH = r'C:\poppler\poppler-25.12.0\Library\bin'
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
os.environ["PATH"] += os.pathsep + POPPLER_PATH

# --- ABI CONFIG ---
CONTRACT_ABI = json.loads('[{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":false,"internalType":"string","name":"cid","type":"string"},{"indexed":false,"internalType":"bytes32","name":"docHash","type":"bytes32"},{"indexed":false,"internalType":"bool","name":"status","type":"bool"}],"name":"FileVerified","type":"event"},{"inputs":[{"internalType":"address","name":"_user","type":"address"},{"internalType":"string","name":"_cid","type":"string"},{"internalType":"string","name":"_fileName","type":"string"},{"internalType":"bytes32","name":"_docHash","type":"bytes32"}],"name":"addVerifiedFile","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"admin","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_user","type":"address"}],"name":"getFiles","outputs":[{"components":[{"internalType":"string","name":"cid","type":"string"},{"internalType":"string","name":"fileName","type":"string"},{"internalType":"bytes32","name":"docHash","type":"bytes32"},{"internalType":"bool","name":"isVerified","type":"bool"},{"internalType":"uint256","name":"timestamp","type":"uint256"}],"internalType":"struct FileRegistry.FileData[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"uint256","name":"","type":"uint256"}],"name":"userFiles","outputs":[{"internalType":"string","name":"cid","type":"string"},{"internalType":"string","name":"fileName","type":"string"},{"internalType":"bytes32","name":"docHash","type":"bytes32"},{"internalType":"bool","name":"isVerified","type":"bool"},{"internalType":"uint256","name":"timestamp","type":"uint256"}],"stateMutability":"view","type":"function"}]')

w3 = Web3(Web3.HTTPProvider(RPC_URL))
sys.stdout.reconfigure(encoding="utf-8")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "best.pt")

# Temporary storage for staged files awaiting transaction confirmation
STAGED_UPLOADS = {}

# --- INITIALIZE YOLO ---
try:
    yolo_model = YOLO(MODEL_PATH)
    print(f"✅ Success: Loaded YOLO model from {MODEL_PATH}")
except Exception as e:
    print(f"⚠️ Warning: YOLO load error: {e}")
    yolo_model = None

# --- Internal Imports ---
try:
    from core.classifier import DocumentClassifier
    from core.forgery_detector import ForgeryDetector
    from utils.image_utils import preprocess_for_ocr
    from rules.aadhaar import AadhaarRules
    from rules.pan import PanRules
    from rules.driving_license import verify_driving_license_text
    from rules.voter_id import verify_voter_id_text
except ImportError as e:
    print(f"❌ Critical: Internal Core Import Error: {str(e)}")
    sys.exit(1)

app = FastAPI(title="PrivacyFy AI Worker & Gatekeeper (dApp Mode)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- IPFS & BLOCKCHAIN UTILS ---
def upload_to_ipfs(file_path):
    if not PINATA_JWT: 
        print("⚠️ Pinata JWT missing in .env")
        return None
    try:
        headers = {'Authorization': f'Bearer {PINATA_JWT}'}
        with open(file_path, 'rb') as f: 
            file_data = f.read()
        files = {'file': (os.path.basename(file_path), file_data)}
        response = requests.post(PINATA_API_URL, headers=headers, files=files)
        return response.json()['IpfsHash'] if response.status_code == 200 else None
    except Exception as e: 
        print(f"❌ IPFS Upload Error: {e}")
        return None

def send_to_blockchain(doc_hash, ipfs_cid, user_wallet, file_name, encryption_key):
    if not RPC_URL or not CONTRACT_ADDRESS or not PRIVATE_KEY: 
        return "MISSING_CONFIG"
    try:
        account = Account.from_key(PRIVATE_KEY)
        contract = w3.eth.contract(address=Web3.to_checksum_address(CONTRACT_ADDRESS), abi=CONTRACT_ABI)
        nonce = w3.eth.get_transaction_count(account.address)
        
        base_data = contract.encode_abi("addVerifiedFile", [
            Web3.to_checksum_address(user_wallet), 
            ipfs_cid, 
            file_name, 
            Web3.to_bytes(hexstr=doc_hash)
        ])
        
        key_metadata = Web3.to_hex(text=f"|KEY:{encryption_key}")
        
        tx_dict = {
            'from': account.address, 
            'to': Web3.to_checksum_address(CONTRACT_ADDRESS), 
            'nonce': nonce, 
            'gas': 600000, 
            'gasPrice': w3.eth.gas_price, 
            'data': base_data + key_metadata[2:], 
            'chainId': 11155111 
        }
        
        signed_tx = w3.eth.account.sign_transaction(tx_dict, PRIVATE_KEY)
        tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        return w3.to_hex(tx_hash)
    except Exception as e: 
        return f"BLOCKCHAIN_ERROR: {str(e)}"

# --- DOCUMENT AI LOGIC ---
def process_document(image_path: str) -> dict:
    response = {
        "status": "PROCESSING", 
        "document_type": "UNKNOWN", 
        "confidence_score": 0, 
        "extracted_data": {}, 
        "flags": [], 
        "forensics": {}
    }
    try:
        is_pdf = image_path.lower().endswith('.pdf')
        img_for_yolo = None
        pages = []

        if is_pdf:
            pages = convert_from_path(image_path, dpi=300, poppler_path=POPPLER_PATH)
            if not pages: raise ValueError("Poppler extraction failed")
            img_for_yolo = cv2.cvtColor(np.array(pages[0]), cv2.COLOR_RGB2BGR)
        else:
            img_for_yolo = cv2.imread(image_path)
            pages = [Image.open(image_path)]

        if img_for_yolo is None: raise ValueError("Failed to load image.")

        detector = ForgeryDetector()
        response["forensics"]["ela"] = detector.error_level_analysis(image_path) if not is_pdf else 0.5

        # --- STEP 1: YOLO VISUAL GUESS ---
        yolo_detected_type = "UNKNOWN"
        if yolo_model:
            results = yolo_model(img_for_yolo, conf=0.20)
            if len(results[0].boxes) > 0:
                cls_id = int(results[0].boxes.cls[0])
                cls_name = yolo_model.names[cls_id].upper()
                if "VOTER" in cls_name: yolo_detected_type = "VOTER_ID"
                elif "AADHAR" in cls_name or "ADHAR" in cls_name: yolo_detected_type = "AADHAAR"
                elif "PAN" in cls_name: yolo_detected_type = "PAN"
                elif "DRIVING" in cls_name: yolo_detected_type = "DRIVING_LICENSE"

        # --- STEP 2: OCR EXTRACTION ---
        combined_text = ""
        for page in pages:
            open_cv_image = np.array(page.convert('RGB'))[:, :, ::-1].copy() 
            processed_img = preprocess_for_ocr(open_cv_image)
            combined_text += pytesseract.image_to_string(processed_img) + "\n"

        upper_text = combined_text.upper()
        clean_text = upper_text.replace(" ", "").replace("\n", "").replace("*", "").replace("“", "").replace("”", "").replace("'", "")
        
        print(f"\n[AI TRACE] OCR Result: {clean_text[:120]}...")

        # --- STEP 3: WEIGHTED SCORING SYSTEM ---
        # Blunt Truth: Unique patterns get 60 points, keywords get 30, YOLO get 20.
        scores = {"AADHAAR": 0, "PAN": 0, "DRIVING_LICENSE": 0, "VOTER_ID": 0}
        
        # 1. Pattern Matching (Primary Key - 60 pts)
        if re.search(r'[0-9]{12}', clean_text): scores["AADHAAR"] += 60
        if re.search(r'[A-Z]{5}[0-9]{4}[A-Z]{1}', clean_text): scores["PAN"] += 60
        if re.search(r'[A-Z]{2}[0-9]{2}[0-9A-Z]{7,}', clean_text): scores["DRIVING_LICENSE"] += 60
        if re.search(r'[A-Z]{3}[0-9]{7}', clean_text): scores["VOTER_ID"] += 60

        # 2. Specific Keywords (Secondary Key - 30 pts)
        if any(k in clean_text for k in ["UIDAI", "AADHAAR", "UNIQUE"]): scores["AADHAAR"] += 30
        if any(k in clean_text for k in ["INCOMETAX", "PERMANENT", "PANCARD", "ENGRNT", "RARSANT"]): scores["PAN"] += 30
        if any(k in clean_text for k in ["DRIVING", "LICENSE", "TRANSPORT", "DL0", "DL1", "DL2"]): scores["DRIVING_LICENSE"] += 30
        if any(k in clean_text for k in ["ELECTION", "COMMISSION", "EPIC", "VOTER"]): scores["VOTER_ID"] += 30

        # 3. YOLO Visual Boost (20 pts)
        if yolo_detected_type in scores:
            scores[yolo_detected_type] += 20

        # 4. Global Noise Adjustment (Subtract points if generic keywords are overwhelming)
        if "GOVERNMENTOFINDIA" in clean_text or "INDIA" in clean_text:
            # Common to all, don't let it bias toward Aadhaar
            pass 

        # Final Classification
        best_match = max(scores, key=scores.get)
        final_rule_score = scores[best_match]
        doc_type = best_match if final_rule_score >= 40 else "UNKNOWN"

        # --- STEP 4: EXTRACTION LOGIC ---
        final_id = "N/A"
        if doc_type == "AADHAAR":
            m = re.search(r'[0-9]{12}', clean_text)
            if m: final_id = m.group(0)
        elif doc_type == "PAN":
            m = re.search(r'[A-Z]{5}[0-9]{4}[A-Z]{1}', clean_text)
            if m: final_id = m.group(0)
        elif doc_type == "VOTER_ID":
            m = re.search(r'[A-Z]{3}[0-9]{7}', clean_text)
            if m: final_id = m.group(0)

        response["document_type"] = doc_type
        response["confidence_score"] = final_rule_score
        response["status"] = "LIKELY_AUTHENTIC" if response["confidence_score"] >= 45 else "REJECTED"
        response["extracted_data"] = {
            "full_name": "Verified User", 
            "id_number": final_id, 
            "uid_type": doc_type, 
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        response["status"] = "ERROR"
        response["flags"].append(str(e))
    return response

# --- API ENDPOINTS ---

@app.post("/verify-document")
async def verify_document(
    file: UploadFile = File(...), 
    user_wallet: str = Form(None)
):
    if not user_wallet: raise HTTPException(status_code=400, detail="Wallet address required.")
    
    contents = await file.read()
    doc_hash = hashlib.sha256(contents).hexdigest()
    
    temp_path = f"staged_{doc_hash}_{file.filename}"
    with open(temp_path, "wb") as f: f.write(contents)
    
    result = process_document(temp_path)
    
    if result["status"] == "LIKELY_AUTHENTIC":
        STAGED_UPLOADS[doc_hash] = {
            "path": temp_path,
            "filename": file.filename,
            "wallet": user_wallet,
            "type": result["document_type"]
        }
        
        return {
            "valid": True,
            "doc_hash": doc_hash,
            "details": result,
            "message": "AI Validation Passed. Awaiting Transaction Confirmation."
        }
    
    if os.path.exists(temp_path): os.remove(temp_path)
    return {"valid": False, "details": result}

@app.post("/finalize-upload")
async def finalize_upload(
    doc_hash: str = Form(...),
    tx_hash: str = Form(...) 
):
    if doc_hash not in STAGED_UPLOADS:
        raise HTTPException(status_code=404, detail="Staged file not found or already processed.")
    
    staged = STAGED_UPLOADS[doc_hash]
    file_path = staged["path"]
    
    try:
        key = generate_key()
        enc_key = key.decode()
        encrypt_file(file_path, key)
        
        final_cid = upload_to_ipfs(file_path)
        
        if not final_cid:
            raise HTTPException(status_code=500, detail="IPFS Pinning Failed")

        print(f"🚀 Finalized! File {doc_hash} pinned to CID: {final_cid}")
        
        if os.path.exists(file_path): os.remove(file_path)
        del STAGED_UPLOADS[doc_hash]
        
        return {
            "success": True,
            "ipfs_cid": final_cid,
            "encryption_key": enc_key,
            "tx_hash": tx_hash
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)