import requests
import cv2
import os

# --- 1. PIXEL MODIFICATION LOGIC ---
def modify_pixel(image_path):
    """
    Slightly alters the first pixel of the image to ensure 
    the file hash is unique for every test run.
    """
    if not os.path.exists(image_path):
        print(f"❌ Error: File not found at {image_path}")
        return False
        
    img = cv2.imread(image_path)
    if img is not None:
        # Change the very first pixel to a slightly different color [B, G, R]
        # This completely changes the SHA256 hash of the file
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
file_path = r"P:\test images\pan\pan 1.png"

params = {"user_wallet": user_wallet}

# --- 3. EXECUTION ---
# First, modify the image to ensure it's not a duplicate on the blockchain
if modify_pixel(file_path):
    try:
        with open(file_path, "rb") as f:
            # We use os.path.basename to send just the filename, not the full path
            files = {"file": (os.path.basename(file_path), f, "image/png")}
            
            print(f"🚀 Sending request to AI Worker for wallet {user_wallet}...")
            response = requests.post(url, params=params, files=files)
            
        # 4. PRINT RESULTS
        print("-" * 30)
        print("Status Code:", response.status_code)
        
        # Pretty print the JSON response
        result = response.json()
        import json
        print("Response Detail:\n", json.dumps(result, indent=4))
        
        if result.get("blockchain_tx") and "ERROR" not in result["blockchain_tx"]:
            print(f"\n🎉 SUCCESS! View your transaction here:")
            print(f"https://sepolia.etherscan.io/tx/{result['blockchain_tx']}")
            
    except Exception as e:
        print("❌ Request Error:", str(e))