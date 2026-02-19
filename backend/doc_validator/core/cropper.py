import cv2
import numpy as np
from ultralytics import YOLO
import os

class DocumentCropper:
    def __init__(self, model_path=None):
        # If no custom model is provided, it downloads a tiny generic one
        # Ideally, you replace 'yolov8n.pt' with your trained 'best.pt'
        self.model_path = model_path if model_path else 'yolov8n.pt' 
        self.model = YOLO(self.model_path)

    def crop(self, image_path):
        """
        Detects the document and returns the cropped image.
        If no document is found, returns the original image.
        """
        try:
            # 1. Run YOLO Inference
            results = self.model.predict(source=image_path, save=False, conf=0.4, verbose=False)
            
            if not results or len(results[0].boxes) == 0:
                print("⚠️ YOLO: No document detected. Using full image.")
                return cv2.imread(image_path)

            # 2. Get the box with highest confidence
            # Box format: [x1, y1, x2, y2]
            best_box = results[0].boxes.data[0] 
            x1, y1, x2, y2 = map(int, best_box[:4])
            
            # 3. Crop the Image
            img = cv2.imread(image_path)
            cropped_img = img[y1:y2, x1:x2]
            
            print(f"✅ YOLO: Cropped document to {x1},{y1} -> {x2},{y2}")
            return cropped_img

        except Exception as e:
            print(f"❌ YOLO Error: {e}")
            return cv2.imread(image_path) # Fallback to original