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

# --- NEW ENCRYPTION IMPORTS ---
from utils.encryption import encrypt_file, generate_key

# --- LOAD ENVIRONMENT VARIABLES ---
# Searching in multiple locations to ensure .env is found
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(dotenv_path=env_path)

PINATA_JWT = os.getenv("JWT_SECRET")
PINATA_API_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS"

# --- BLOCKCHAIN CONFIG ---
PRIVATE_KEY = os.getenv("PRIVATE_KEY")
RPC_URL = os.getenv("RPC_URL") 
CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS") 

# UPDATED ABI: Matches FileRegistry.sol
CONTRACT_ABI = json.loads('[{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":false,"internalType":"string","name":"cid","type":"string"},{"indexed":false,"internalType":"bytes32","name":"docHash","type":"bytes32"},{"indexed":false,"internalType":"bool","name":"status","type":"bool"}],"name":"FileVerified","type":"event"},{"inputs":[{"internalType":"address","name":"_user","type":"address"},{"internalType":"string","name":"_cid","type":"string"},{"internalType":"string","name":"_fileName","type":"string"},{"internalType":"bytes32","name":"_docHash","type":"bytes32"}],"name":"addVerifiedFile","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"admin","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_user","type":"address"}],"name":"getFiles","outputs":[{"components":[{"internalType":"string","name":"cid","type":"string"},{"internalType":"string","name":"fileName","type":"string"},{"internalType":"bytes32","name":"docHash","type":"bytes32"},{"internalType":"bool","name":"isVerified","type":"bool"},{"internalType":"uint256","name":"timestamp","type":"uint256"}],"internalType":"struct FileRegistry.FileData[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"uint256","name":"","type":"uint256"}],"name":"userFiles","outputs":[{"internalType":"string","name":"cid","type":"string"},{"internalType":"string","name":"fileName","type":"string"},{"internalType":"bytes32","name":"docHash","type":"bytes32"},{"internalType":"bool","name":"isVerified","type":"bool"},{"internalType":"uint256","name":"timestamp","type":"uint256"}],"stateMutability":"view","type":"function"}]')

w3 = Web3(Web3.HTTPProvider(RPC_URL))

sys.stdout.reconfigure(encoding="utf-8")
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

# --- DYNAMIC PATH FOR MODEL ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "best.pt")

try:
    yolo_model = YOLO(MODEL_PATH)
    print(f"✅ Success: Loaded YOLO model from {MODEL_PATH}")
    if PRIVATE_KEY:
        acc = Account.from_key(PRIVATE_KEY)
        print(f"DEBUG: Operating Wallet: {acc.address}")
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

# --- IPFS LOGIC ---
def upload_to_ipfs(file_path):
    if not PINATA_JWT:
        return None
    try:
        headers = {'Authorization': f'Bearer {PINATA_JWT}'}
        with open(file_path, 'rb') as f:
            file_data = f.read()
        files = {'file': (os.path.basename(file_path), file_data)}
        response = requests.post(PINATA_API_URL, headers=headers, files=files)
        if response.status_code == 200:
            return response.json()['IpfsHash']
        return None
    except Exception as e:
        print(f"❌ IPFS Error: {e}")
        return None

# --- BLOCKCHAIN TRANSACTION LOGIC (FIXED FOR DATA FIELD) ---
def send_to_blockchain(doc_hash, ipfs_cid, user_wallet, file_name, encryption_key):
    """
    Writes verification record and appends the encryption key in the 
    transaction 'input data' using manual transaction construction.
    """
    if not RPC_URL or not CONTRACT_ADDRESS or not PRIVATE_KEY:
        return "MISSING_CONFIG"
    try:
        account = Account.from_key(PRIVATE_KEY)
        contract = w3.eth.contract(address=Web3.to_checksum_address(CONTRACT_ADDRESS), abi=CONTRACT_ABI)
        
        doc_hash_bytes = Web3.to_bytes(hexstr=doc_hash)
        nonce = w3.eth.get_transaction_count(account.address)
        
        # 1. Manually encode the smart contract function call
        base_data = contract.encode_abi("addVerifiedFile", [
            Web3.to_checksum_address(user_wallet),
            ipfs_cid,
            file_name,
            doc_hash_bytes
        ])
        
        # 2. Add the encryption key as extra metadata at the end of the transaction
        # Prefix with '|KEY:' to make it easy to find when reading transaction logs
        key_metadata = Web3.to_hex(text=f"|KEY:{encryption_key}")
        
        # Combine base contract data + our secret key metadata (stripping the second '0x')
        combined_data = base_data + key_metadata[2:]
        
        # 3. Create the manual transaction dictionary
        tx_dict = {
            'from': account.address,
            'to': Web3.to_checksum_address(CONTRACT_ADDRESS),
            'nonce': nonce,
            'gas': 600000, 
            'gasPrice': w3.eth.gas_price,
            'data': combined_data,
            'chainId': 11155111 # Sepolia Testnet ID
        }

        # 4. Sign and Broadcast
        signed_tx = w3.eth.account.sign_transaction(tx_dict, PRIVATE_KEY)
        tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        
        return w3.to_hex(tx_hash)
    except Exception as e:
        print(f"❌ Blockchain Error: {e}")
        return f"ERROR: {str(e)}"

def generate_blockchain_signature(user_wallet, doc_hash, cid):
    try:
        message_hash = Web3.solidity_keccak(
            ['address', 'string', 'bytes32'],
            [Web3.to_checksum_address(user_wallet), cid, bytes.fromhex(doc_hash)]
        )
        message = encode_defunct(primitive=message_hash)
        signed_message = w3.eth.account.sign_message(message, private_key=PRIVATE_KEY)
        return signed_message.signature.hex()
    except Exception as e:
        return f"SIGNING_ERROR: {str(e)}"

def clean_extracted_name(name_str):
    clean = re.sub(r'[^A-Z\s]', '', name_str.upper())
    words = [w for w in clean.split() if len(w) > 2]
    ocr_noise = ["ART", "UHR", "EAT", "BOE", "TAX", "IND", "GOVT", "INDIA", "DEPARTMENT", "INCOME"]
    final_words = [w for w in words if w not in ocr_noise]
    return " ".join(final_words).strip()

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
        img = cv2.imread(image_path)
        if img is None: raise ValueError("Could not read image file")

        detector = ForgeryDetector()
        meta_check = detector.check_metadata(image_path)
        response["forensics"]["metadata"] = meta_check
        
        ela_check = detector.error_level_analysis(image_path)
        response["forensics"]["ela"] = ela_check
        response["flags"].append(f"ELA_SCORE: {ela_check['score']:.2f}")

        visual_score = 0
        yolo_detected_type = "UNKNOWN"
        if yolo_model:
            results = yolo_model(img, conf=0.20) 
            if len(results[0].boxes) > 0:
                visual_score = 45 
                cls_id = int(results[0].boxes[0].cls[0])
                yolo_detected_type = "AADHAAR" if cls_id == 0 else "PAN"
                response["flags"].append(f"YOLO: Visual {yolo_detected_type} confirmed")

        processed_img = preprocess_for_ocr(img)
        text_v1 = pytesseract.image_to_string(processed_img, config=r"--oem 3 --psm 6")
        text_v2 = pytesseract.image_to_string(processed_img, config=r"--oem 3 --psm 11")
        combined_text = text_v1 + "\n" + text_v2
        
        lines = [line.strip() for line in combined_text.split('\n') if len(line.strip()) > 2]
        
        classifier = DocumentClassifier()
        doc_type = classifier.classify(combined_text)

        if doc_type == "UNKNOWN":
            upper_text = combined_text.upper()
            if any(k in upper_text for k in ["INCOME", "TAX", "PERMANENT", "PAN CARD"]):
                doc_type = "PAN"
            elif any(k in upper_text for k in ["UNIQUE", "AADHAAR", "GOVERNMENT", "INDIA"]):
                doc_type = "AADHAAR"

        response["document_type"] = doc_type

        rule_score = 0
        final_name = "User Found"

        if doc_type == "AADHAAR":
            rule_result = AadhaarRules().validate(combined_text)
            rule_score = rule_result["score"]
            for i, line in enumerate(lines):
                if re.search(r'(DOB|Year|Birth|Male|Female)', line, re.IGNORECASE):
                    if i > 0:
                        candidate = clean_extracted_name(lines[i-1])
                        if candidate and "INDIA" not in candidate:
                            final_name = candidate
                    break

        elif doc_type == "PAN":
            rule_result = PanRules().validate(combined_text)
            rule_score = rule_result["score"]
            candidates = []
            for line in lines:
                clean = clean_extracted_name(line)
                if len(clean) > 3: candidates.append(clean)
            if candidates: final_name = candidates[0]

        response["extracted_data"] = {"full_name": final_name, "uid_type": doc_type, "timestamp": datetime.now().isoformat()}
        total_score = visual_score + rule_score
        response["confidence_score"] = max(0, total_score)
        response["status"] = "LIKELY_AUTHENTIC" if response["confidence_score"] >= 45 else "REJECTED"

    except Exception as e:
        response["status"] = "ERROR"
        response["flags"].append(f"System: {str(e)}")

    return response

@app.post("/verify-document")
async def verify_document(file: UploadFile = File(...), user_wallet: str = None):
    if not user_wallet:
        raise HTTPException(status_code=400, detail="User wallet address required.")

    temp_path = f"temp_{file.filename}"
    try:
        contents = await file.read()
        doc_hash = hashlib.sha256(contents).hexdigest()
        
        with open(temp_path, "wb") as f:
            f.write(contents)
        
        result = process_document(temp_path)
        is_valid = result["status"] == "LIKELY_AUTHENTIC"
        
        final_cid = "NOT_UPLOADED"
        blockchain_tx = "NOT_SUBMITTED"
        encryption_key_used = "NONE"

        if is_valid:
            # 1. Generate AES Encryption Key
            file_key = generate_key()
            encryption_key_used = file_key.decode()
            
            # 2. Encrypt the file locally before upload
            encrypt_file(temp_path, file_key)
            
            # 3. IPFS Upload (Uploading encrypted 'garbage' data)
            uploaded_cid = upload_to_ipfs(temp_path)
            if uploaded_cid:
                final_cid = uploaded_cid
            
            # 4. Final Blockchain Step (Stores record and the key)
            blockchain_tx = send_to_blockchain(doc_hash, final_cid, user_wallet, file.filename, encryption_key_used)
        
        signature = generate_blockchain_signature(user_wallet, doc_hash, final_cid)
        
        return {
            "valid": is_valid,
            "doc_hash": doc_hash,
            "ipfs_cid": final_cid,
            "encryption_key": encryption_key_used,
            "blockchain_tx": blockchain_tx,
            "signature": signature,
            "details": result
        }
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)