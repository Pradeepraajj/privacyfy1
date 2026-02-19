# doc_validator/core/layout_validator.py
import cv2
import os

class LayoutValidator:
    def __init__(self):
        # Load Haar Cascade for Face Detection
        # We assume the XML is in the same folder or standard path
        self.cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        self.face_cascade = cv2.CascadeClassifier(self.cascade_path)

    def has_face(self, image):
        """
        Returns True if at least one face is detected.
        IDs must have a photo of the user.
        """
        try:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            # ScaleFactor=1.1, MinNeighbors=5 (Standard for robust detection)
            faces = self.face_cascade.detectMultiScale(gray, 1.1, 5)
            
            if len(faces) > 0:
                return {"valid": True, "count": len(faces)}
            else:
                return {"valid": False, "count": 0}
        except Exception as e:
            return {"valid": False, "error": str(e)}

    def check_aspect_ratio(self, image):
        """
        Checks if the image dimensions match standard ID card ratios (Credit Card size).
        Standard Ratio is roughly 1.58 (85.6mm / 53.98mm)
        """
        h, w = image.shape[:2]
        if h == 0: return False
        
        ratio = w / h
        # Allow landscape (approx 1.5) or portrait (approx 0.6)
        if 1.3 < ratio < 1.8: 
            return "LANDSCAPE_ID"
        elif 0.5 < ratio < 0.8:
            return "PORTRAIT_ID"
        else:
            return "NON_STANDARD_RATIO"