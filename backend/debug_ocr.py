import pytesseract
import cv2
import numpy as np
import os
from pdf2image import convert_from_path
from doc_validator.utils.image_utils import preprocess_for_ocr

# --- TESSERACT PATH CONFIGURATION ---
# This line is the fix for your "not in PATH" error
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

# --- CONFIGURATION ---
FILE_PATH = r"P:\test images\driving liscene\driving pradeep.pdf"
POPPLER_PATH = r'C:\poppler\poppler-25.12.0\Library\bin' 

# Add Poppler to system path for this session
os.environ["PATH"] += os.pathsep + POPPLER_PATH

def debug_pdf_ocr():
    if not os.path.exists(FILE_PATH):
        print(f"❌ Error: File not found at {FILE_PATH}")
        return

    print(f"🔍 Analyzing: {FILE_PATH}")

    try:
        # 1. Convert PDF Page 1 to Image
        pages = convert_from_path(FILE_PATH, dpi=300, poppler_path=POPPLER_PATH)
        img = cv2.cvtColor(np.array(pages[0]), cv2.COLOR_RGB2BGR)

        # 2. Preprocess
        processed = preprocess_for_ocr(img)
        cv2.imwrite("debug_preprocessed.jpg", processed)

        # 3. Extraction - Mode 6
        print("\n--- [PSM 6] Tesseract Output ---")
        text6 = pytesseract.image_to_string(processed, config='--oem 3 --psm 6')
        print(text6)

        # 4. Extraction - Mode 11
        print("\n--- [PSM 11] Tesseract Output ---")
        text11 = pytesseract.image_to_string(processed, config='--oem 3 --psm 11')
        print(text11)

    except Exception as e:
        print(f"❌ An error occurred: {str(e)}")

if __name__ == "__main__":
    debug_pdf_ocr()