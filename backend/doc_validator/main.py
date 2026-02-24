import sys
import json
import cv2
import pytesseract
import os
import re
import shutil
import hashlib
import numpy as np
import requests  
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, HTTPException
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
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
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

# Add Poppler to system path for this session to prevent "pdftoppm" errors
os.environ["PATH"] += os.pathsep + POPPLER_PATH

# --- ABI CONFIG ---
CONTRACT_ABI = json.loads('[{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":false,"internalType":"string","name":"cid","type":"string"},{"indexed":false,"internalType":"bytes32","name":"docHash","type":"bytes32"},{"indexed":false,"internalType":"bool","name":"status","type":"bool"}],"name":"FileVerified","type":"event"},{"inputs":[{"internalType":"address","name":"_user","type":"address"},{"internalType":"string","name":"_cid","type":"string"},{"internalType":"string","name":"_fileName","type":"string"},{"internalType":"bytes32","name":"_docHash","type":"bytes32"}],"name":"addVerifiedFile","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"admin","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_user","type":"address"}],"name":"getFiles","outputs":[{"components":[{"internalType":"string","name":"cid","type":"string"},{"internalType":"string","name":"fileName","type":"string"},{"internalType":"bytes32","name":"docHash","type":"bytes32"},{"internalType":"bool","name":"isVerified","type":"bool"},{"internalType":"uint256","name":"timestamp","type":"uint256"}],"internalType":"struct FileRegistry.FileData[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"uint256","name":"","type":"uint256"}],"name":"userFiles","outputs":[{"internalType":"string","name":"cid","type":"string"},{"internalType":"string","name":"fileName","type":"string"},{"internalType":"bytes32","name":"docHash","type":"bytes32"},{"internalType":"bool","name":"isVerified","type":"bool"},{"internalType":"uint256","name":"timestamp","type":"uint256"}],"stateMutability":"view","type":"function"}]')

w3 = Web3(Web3.HTTPProvider(RPC_URL))
sys.stdout.reconfigure(encoding="utf-8")

# --- DYNAMIC PATH FOR MODEL ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "best.pt")

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
    # Importing updated Tesseract-based rules
    from rules.driving_license import verify_driving_license_text
    from rules.voter_id import verify_voter_id_text
except ImportError as e:
    print(json.dumps({"status": "ERROR", "flags": [f"Import Error: {str(e)}"]}))
    sys.exit(1)

app = FastAPI(title="PrivacyFy AI Worker & Gatekeeper")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def upload_to_ipfs(file_path):
    if not PINATA_JWT: return None
    try:
        headers = {'Authorization': f'Bearer {PINATA_JWT}'}
        with open(file_path, 'rb') as f: file_data = f.read()
        files = {'file': (os.path.basename(file_path), file_data)}
        response = requests.post(PINATA_API_URL, headers=headers, files=files)
        return response.json()['IpfsHash'] if response.status_code == 200 else None
    except Exception: return None

def send_to_blockchain(doc_hash, ipfs_cid, user_wallet, file_name, encryption_key):
    if not RPC_URL or not CONTRACT_ADDRESS or not PRIVATE_KEY: return "MISSING_CONFIG"
    try:
        account = Account.from_key(PRIVATE_KEY)
        contract = w3.eth.contract(address=Web3.to_checksum_address(CONTRACT_ADDRESS), abi=CONTRACT_ABI)
        nonce = w3.eth.get_transaction_count(account.address)
        base_data = contract.encode_abi("addVerifiedFile", [Web3.to_checksum_address(user_wallet), ipfs_cid, file_name, Web3.to_bytes(hexstr=doc_hash)])
        key_metadata = Web3.to_hex(text=f"|KEY:{encryption_key}")
        tx_dict = {'from': account.address, 'to': Web3.to_checksum_address(CONTRACT_ADDRESS), 'nonce': nonce, 'gas': 600000, 'gasPrice': w3.eth.gas_price, 'data': base_data + key_metadata[2:], 'chainId': 11155111}
        signed_tx = w3.eth.account.sign_transaction(tx_dict, PRIVATE_KEY)
        return w3.to_hex(w3.eth.send_raw_transaction(signed_tx.raw_transaction))
    except Exception as e: return f"ERROR: {str(e)}"

def generate_blockchain_signature(user_wallet, doc_hash, cid):
    try:
        message_hash = Web3.solidity_keccak(['address', 'string', 'bytes32'], [Web3.to_checksum_address(user_wallet), cid, bytes.fromhex(doc_hash)])
        signed_message = w3.eth.account.sign_message(encode_defunct(primitive=message_hash), private_key=PRIVATE_KEY)
        return signed_message.signature.hex()
    except Exception as e: return f"SIGNING_ERROR: {str(e)}"

def clean_extracted_name(name_str):
    clean = re.sub(r'[^A-Z\s]', '', name_str.upper())
    words = [w for w in clean.split() if len(w) > 2]
    ocr_noise = ["ART", "UHR", "EAT", "BOE", "TAX", "IND", "GOVT", "INDIA", "DEPARTMENT", "INCOME"]
    return " ".join([w for w in words if w not in ocr_noise]).strip()

def process_document(image_path: str) -> dict:
    response = {"status": "PROCESSING", "document_type": "UNKNOWN", "confidence_score": 0, "extracted_data": {}, "flags": [], "forensics": {}}
    try:
        is_pdf = image_path.lower().endswith('.pdf')
        img_for_yolo = None
        pages = []

        # --- STEP 1: LOAD DOCUMENT ---
        if is_pdf:
            response["flags"].append("Format: PDF detected")
            pages = convert_from_path(image_path, dpi=300, poppler_path=POPPLER_PATH)
            if not pages:
                raise ValueError("Poppler could not extract pages from PDF")
            img_for_yolo = cv2.cvtColor(np.array(pages[0]), cv2.COLOR_RGB2BGR)
        else:
            img_for_yolo = cv2.imread(image_path)
            pages = [Image.open(image_path)]

        if img_for_yolo is None:
            raise ValueError("Could not read image for analysis.")

        # --- STEP 2: FORENSICS ---
        detector = ForgeryDetector()
        response["forensics"]["metadata"] = detector.check_metadata(image_path)
        
        if is_pdf:
            temp_ela = "temp_ela_buffer.jpg"
            cv2.imwrite(temp_ela, img_for_yolo)
            response["forensics"]["ela"] = detector.error_level_analysis(temp_ela)
            if os.path.exists(temp_ela): os.remove(temp_ela)
        else:
            response["forensics"]["ela"] = detector.error_level_analysis(image_path)

        # --- STEP 3: YOLO VISUAL CHECK ---
        visual_score = 0
        if yolo_model:
            results = yolo_model(img_for_yolo, conf=0.20)
            if len(results[0].boxes) > 0:
                visual_score = 45
                response["flags"].append("YOLO: Visual Match confirmed")

        # --- STEP 4: OCR EXTRACTION (TESSERACT) ---
        combined_text = ""
        for page in pages:
            open_cv_image = np.array(page.convert('RGB'))
            open_cv_image = open_cv_image[:, :, ::-1].copy() 
            processed_img = preprocess_for_ocr(open_cv_image)
            # PSM 6 for sparse text, PSM 11 for finding more text blocks
            combined_text += pytesseract.image_to_string(processed_img, config=r"--oem 3 --psm 6") + "\n"
            combined_text += pytesseract.image_to_string(processed_img, config=r"--oem 3 --psm 11") + "\n"

        # --- STEP 5: CLASSIFICATION & RULES ---
        classifier = DocumentClassifier()
        doc_type = classifier.classify(combined_text)
        
        # Enhanced keyword check for DL and Voter ID
        upper_text = combined_text.upper()
        if any(k in upper_text for k in ["DRIVING", "LICENSE", "DL"]):
            doc_type = "DRIVING_LICENSE"
        elif any(k in upper_text for k in ["ELECTION", "VOTER", "EPIC"]):
            doc_type = "VOTER_ID"
        elif "PAN CARD" in upper_text: 
            doc_type = "PAN"
        elif "AADHAAR" in upper_text: 
            doc_type = "AADHAAR"

        response["document_type"] = doc_type
        rule_score = 0
        final_name = "User Found"
        final_id = "N/A"

        # Routing to specific logic functions
        if doc_type == "DRIVING_LICENSE":
            dl_res = verify_driving_license_text(combined_text)
            if dl_res["valid"]:
                rule_score = 45
                final_id = dl_res["id_number"]
                final_name = dl_res.get("name", "User Found")

        elif doc_type == "VOTER_ID":
            voter_res = verify_voter_id_text(combined_text)
            if voter_res["valid"]:
                rule_score = 45
                final_id = voter_res["id_number"]

        elif doc_type == "AADHAAR":
            rule_score = AadhaarRules().validate(combined_text)["score"]
            # Basic UID extraction if AadhaarRules doesn't provide it
            match = re.search(r'\d{4}\s\d{4}\s\d{4}', combined_text)
            if match: final_id = match.group(0)

        elif doc_type == "PAN":
            rule_score = PanRules().validate(combined_text)["score"]
            match = re.search(r'[A-Z]{5}\d{4}[A-Z]{1}', upper_text)
            if match: final_id = match.group(0)

        response["extracted_data"] = {
            "full_name": final_name, 
            "id_number": final_id,
            "uid_type": doc_type, 
            "timestamp": datetime.now().isoformat()
        }
        
        response["confidence_score"] = visual_score + rule_score
        response["status"] = "LIKELY_AUTHENTIC" if response["confidence_score"] >= 80 else "REJECTED"

    except Exception as e:
        response["status"] = "ERROR"
        response["flags"].append(f"System: {str(e)}")

    return response

@app.post("/verify-document")
async def verify_document(file: UploadFile = File(...), user_wallet: str = None):
    if not user_wallet: raise HTTPException(status_code=400, detail="User wallet address required.")
    
    temp_path = f"temp_{file.filename}"
    try:
        contents = await file.read()
        doc_hash = hashlib.sha256(contents).hexdigest()
        with open(temp_path, "wb") as f: f.write(contents)
        
        result = process_document(temp_path)
        is_valid = result["status"] == "LIKELY_AUTHENTIC"
        
        final_cid, blockchain_tx, enc_key = "NOT_UPLOADED", "NOT_SUBMITTED", "NONE"
        if is_valid:
            key = generate_key()
            enc_key = key.decode()
            encrypt_file(temp_path, key)
            final_cid = upload_to_ipfs(temp_path) or "UPLOAD_FAILED"
            blockchain_tx = send_to_blockchain(doc_hash, final_cid, user_wallet, file.filename, enc_key)
        
        return {
            "valid": is_valid, "doc_hash": doc_hash, "ipfs_cid": final_cid, 
            "encryption_key": enc_key, "blockchain_tx": blockchain_tx, 
            "signature": generate_blockchain_signature(user_wallet, doc_hash, final_cid), 
            "details": result
        }
    finally:
        if os.path.exists(temp_path): os.remove(temp_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)