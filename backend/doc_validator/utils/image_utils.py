import cv2
import numpy as np

def preprocess_for_ocr(image):
    """
    Enhanced Image Preprocessing for Tesseract OCR.
    Optimized for Indian ID cards (PAN, Aadhaar, Voter ID).
    Uses Binary Otsu Thresholding to eliminate background noise.
    """
    try:
        # 1. Validation: Prevent 'NoneType' or modification errors
        if image is None or not isinstance(image, np.ndarray):
            print("❌ Error: image_utils received an invalid image object.")
            return None

        # 2. Convert to Grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        # 3. Deskew (Straighten the document)
        # Fixes errors caused by tilted scans/photos that break regex patterns
        coords = np.column_stack(np.where(gray > 0))
        if coords.size > 0:
            angle = cv2.minAreaRect(coords)[-1]
            if angle < -45:
                angle = -(90 + angle)
            else:
                angle = -angle
            (h, w) = gray.shape[:2]
            center = (w // 2, h // 2)
            M = cv2.getRotationMatrix2D(center, angle, 1.0)
            gray = cv2.warpAffine(gray, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)

        # 4. Rescale (Upscale to improve character definition)
        # Tesseract performs best when characters are at least 30 pixels tall
        (h, w) = gray.shape[:2]
        if w < 2000:
            gray = cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)

        # 5. Denoising
        # h=10 provides strong noise reduction for graininess
        denoised = cv2.fastNlMeansDenoising(gray, h=10)

        # 6. Binary Otsu Thresholding (CRITICAL FIX)
        # Unlike Adaptive, Otsu calculates a global threshold to separate text from background
        # This fixes the 'NTPEFSAASE' noise issue by making text pure black
        _, thresh = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        # 7. Morphological Operations
        # Erosion thins out characters to prevent them from touching
        kernel = np.ones((1, 1), np.uint8)
        processed = cv2.erode(thresh, kernel, iterations=1)
        
        # Dilation to slightly sharpen edges
        processed = cv2.dilate(processed, kernel, iterations=1)

        return processed
        
    except Exception as e:
        print(f"❌ Error in image_utils.py: {e}")
        return image