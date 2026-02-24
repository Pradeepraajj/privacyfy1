import cv2
import numpy as np

def preprocess_for_ocr(image):
    """
    Refined preprocessing for Tesseract OCR.
    Takes an OpenCV image (numpy array).
    """
    try:
        # Check if image is valid (This prevents the 'modification' error)
        if image is None or not isinstance(image, np.ndarray):
            print("❌ Error: image_utils received an invalid image object.")
            return None

        # 1. Convert to Grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        # 2. Deskew (Straighten the document)
        # This fixes errors caused by tilted scans/photos
        coords = np.column_stack(np.where(gray > 0))
        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle
        (h, w) = gray.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        gray = cv2.warpAffine(gray, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)

        # 3. Rescale (Upscale to improve character definition)
        if w < 1800:
            gray = cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)

        # 4. CLAHE (Local Contrast Enhancement)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        gray = clahe.apply(gray)

        # 5. Denoising
        denoised = cv2.fastNlMeansDenoising(gray, h=7)

        # 6. Adaptive Thresholding (Better for uneven lighting)
        thresh = cv2.adaptiveThreshold(
            denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv2.THRESH_BINARY, 11, 2
        )

        # 7. Morphological Dilation
        kernel = np.ones((1, 1), np.uint8)
        thresh = cv2.dilate(thresh, kernel, iterations=1)

        return thresh
        
    except Exception as e:
        # This is where your specific error message likely originated
        print(f"❌ Error: Could not read image for modification. System: {e}")
        return image