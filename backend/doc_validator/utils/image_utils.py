import cv2
import numpy as np

def preprocess_for_ocr(image):
    """
    Enhanced preprocessing for Tesseract OCR using resolution-aware scaling
    and noise reduction while maintaining established error handling.
    """
    try:
        # 1. Convert to Grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        # 2. Rescaling for OCR accuracy
        # Tesseract performs best when text is high resolution.
        height, width = gray.shape
        if width < 1500: 
            scale_factor = 2 
            gray = cv2.resize(gray, None, fx=scale_factor, fy=scale_factor, interpolation=cv2.INTER_CUBIC)

        # 3. Bilateral Filtering (Superior to standard Gaussian Blur)
        # It removes background noise while keeping the edges of characters sharp.
        denoised = cv2.bilateralFilter(gray, 9, 75, 75)

        # 4. Adaptive Thresholding
        # Binarizes the image to pure black and white for the OCR engine.
        thresh = cv2.adaptiveThreshold(
            denoised, 255, 
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv2.THRESH_BINARY, 
            11, 2
        )

        # 5. Dilation and Erosion (Cleans up character artifacts)
        kernel = np.ones((1, 1), np.uint8)
        processed = cv2.dilate(thresh, kernel, iterations=1)
        processed = cv2.erode(processed, kernel, iterations=1)

        return processed

    except Exception as e:
        print(f"⚠️ Preprocessing Error: {e}")
        return image