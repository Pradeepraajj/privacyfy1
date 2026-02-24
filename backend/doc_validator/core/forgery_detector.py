import cv2
import numpy as np
from PIL import Image, ImageChops, ExifTags, ImageEnhance
import os
from pdf2image import convert_from_path

# Path to poppler for PDF conversion
POPPLER_PATH = r'C:\poppler\poppler-25.12.0\Library\bin'

class ForgeryDetector:
    def __init__(self):
        pass

    def _get_pil_image(self, path):
        """Helper to safely open Image or PDF for forensic analysis"""
        if path.lower().endswith('.pdf'):
            pages = convert_from_path(path, dpi=200, poppler_path=POPPLER_PATH)
            if not pages:
                raise ValueError("Could not convert PDF for forensics")
            return pages[0].convert('RGB')
        return Image.open(path).convert('RGB')

    def check_metadata(self, image_path):
        """
        Scans EXIF data for editing software signatures.
        """
        try:
            # Check if PDF - PDFs usually don't have EXIF software tags like JPEGs
            if image_path.lower().endswith('.pdf'):
                return {"tampered": False, "reason": "PDF format: Standard metadata only"}

            img = Image.open(image_path)
            exif = img._getexif()
            if not exif: return {"tampered": False, "reason": "No Metadata found"}

            suspicious_software = ["photoshop", "gimp", "paint.net", "adobe", "editor"]
            
            for tag, value in exif.items():
                tag_name = ExifTags.TAGS.get(tag, tag)
                if tag_name == "Software":
                    val_str = str(value).lower()
                    if any(s in val_str for s in suspicious_software):
                        return {"tampered": True, "reason": f"Editing software detected: {value}"}
            
            return {"tampered": False, "reason": "Clean metadata"}
        except Exception as e:
            return {"tampered": False, "reason": f"Metadata Warning: {str(e)}"}

    def error_level_analysis(self, image_path, quality=90):
        """
        Performs Error Level Analysis (ELA).
        """
        temp_path = f"{image_path}.ela.jpg"
        try:
            # Use our helper to handle PDF or Image consistently
            original = self._get_pil_image(image_path)
            
            # 1. Save a temporary copy at known quality
            original.save(temp_path, 'JPEG', quality=quality)
            resaved = Image.open(temp_path)
            
            # 2. Calculate difference
            ela_image = ImageChops.difference(original, resaved)
            
            # 3. Calculate Scale (Maximize the noise visibility)
            extrema = ela_image.getextrema()
            max_diff = max([ex[1] for ex in extrema])
            
            if max_diff == 0:
                max_diff = 1 # Prevent divide by zero
            scale = 255.0 / max_diff
            
            # Use ImageEnhance to brighten the noise
            ela_image = ImageEnhance.Brightness(ela_image).enhance(scale)
            
            # 4. Analyze Variance
            np_ela = np.array(ela_image)
            avg_brightness = np.mean(np_ela)
            
            # Cleanup
            if os.path.exists(temp_path):
                os.remove(temp_path)

            # Threshold: If the "noise" is too bright, it's suspicious
            if avg_brightness > 15: 
                return {"tampered": True, "score": float(avg_brightness), "reason": "High Compression Variance"}
            
            return {"tampered": False, "score": float(avg_brightness), "reason": "Consistent compression levels"}
            
        except Exception as e:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            return {"tampered": False, "reason": f"ELA Analysis Error: {str(e)}"}