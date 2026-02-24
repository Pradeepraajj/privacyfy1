import requests
import cv2
import os
import json

# --- 1. PIXEL MODIFICATION LOGIC ---
def modify_pixel(image_path):
    """
    Slightly alters the first pixel of the image to ensure 
    the file hash is unique for every test run.
    """
    if not os.path.exists(image_path):
        print(f"❌ Error: File not found at {image_path}")
        return False
        
    # --- NEW LOGIC: Skip modification if it's a PDF ---
    if image_path.lower().endswith('.pdf'):
        print(f"📄 PDF detected. Skipping pixel modification (OpenCV cannot edit PDFs).")
        return True

    img = cv2.imread(image_path)
    if img is not None:
        # Change the very first pixel to a slightly different color [B, G, R]
        img[0, 0] = [1, 2, 3] 
        cv2.imwrite(image_path, img)
        print(f"✅ Modified {image_path}. Hash is now unique for this run.")
        return True
    else:
        print("❌ Error: Could not read image for modification.")
        return False

# --- 2. SETUP VARIABLES ---
url = "http://127.0.0.1:8000/verify-document"
user_wallet = "0x3760EeaaE0FF273c611C9E9127e234b6e98ABE9C"
file_path = r"P:\test images\driving liscene\driving pradeep.pdf"

params = {"user_wallet": user_wallet}

# --- 3. EXECUTION ---
if modify_pixel(file_path):
    try:
        with open(file_path, "rb") as f:
            # Set mime-type correctly for PDF
            mime_type = "application/pdf" if file_path.lower().endswith(".pdf") else "image/png"
            files = {"file": (os.path.basename(file_path), f, mime_type)}
            
            print(f"🚀 Sending request to AI Worker for wallet {user_wallet}...")
            response = requests.post(url, params=params, files=files)
            
        # 4. PRINT RESULTS
        print("-" * 30)
        print("Status Code:", response.status_code)
        
        result = response.json()
        print("Response Detail:\n", json.dumps(result, indent=4))
        
        if result.get("blockchain_tx") and "ERROR" not in result["blockchain_tx"] and result["blockchain_tx"] != "NOT_SUBMITTED":
            print(f"\n🎉 SUCCESS! View your transaction here:")
            print(f"https://sepolia.etherscan.io/tx/{result['blockchain_tx']}")
            
    except Exception as e:
        print("❌ Request Error:", str(e))