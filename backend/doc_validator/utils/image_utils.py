import cv2
import numpy as np

def preprocess_for_ocr(image):
    try:
        # 1. Convert to Grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        # 2. Rescale (Only if small)
        h, w = gray.shape
        if w < 1800:
            gray = cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_LANCZOS4)

        # 3. CLAHE (Fixes lighting without destroying text)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        gray = clahe.apply(gray)

        # 4. Light Denoising
        denoised = cv2.fastNlMeansDenoising(gray, h=10)

        # 5. Simple Binary Threshold
        # Using OTSU helps the AI distinguish text from background automatically
        _, thresh = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        return thresh
    except Exception as e:
        print(f"Preprocessing Error: {e}")
        return image