import os
import pytesseract
from PIL import Image
from pdf2image import convert_from_path

# Update to your actual Tesseract path
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

# Your confirmed Poppler path (pointing to the bin folder)
POPPLER_PATH = r'C:\poppler\poppler-25.12.0\Library\bin'

class OCRService:
    @staticmethod
    def extract_text(file_path):
        try:
            # Check if it's a PDF
            if file_path.lower().endswith('.pdf'):
                print(f"📄 Converting PDF to Image: {os.path.basename(file_path)}")
                
                # Convert PDF pages to images using your specified Poppler path
                pages = convert_from_path(
                    file_path, 
                    dpi=300, 
                    poppler_path=POPPLER_PATH
                )
                
                full_text = ""
                for page in pages:
                    # Convert to grayscale for Tesseract accuracy
                    page = page.convert('L') 
                    full_text += pytesseract.image_to_string(page) + "\n"
                return full_text
            
            # If it's a standard image (PNG/JPG)
            else:
                img = Image.open(file_path).convert('L')
                return pytesseract.image_to_string(img)
                
        except Exception as e:
            print(f"❌ OCR Error: {str(e)}")
            return ""

ocr_engine = OCRService()