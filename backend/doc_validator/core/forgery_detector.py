import cv2
import numpy as np
from PIL import Image, ImageChops, ExifTags, ImageEnhance
import os

class ForgeryDetector:
    def __init__(self):
        pass

    def check_metadata(self, image_path):
        """
        Scans EXIF data for editing software signatures.
        """
        try:
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
            # Metadata read errors are common and not necessarily tampering
            return {"tampered": False, "reason": f"Metadata Warning: {str(e)}"}

    def error_level_analysis(self, image_path, quality=90):
        """
        Performs Error Level Analysis (ELA).
        """
        temp_path = f"{image_path}.ela.jpg"
        try:
            original = Image.open(image_path).convert('RGB')
            
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
            
            # --- THE FIX IS HERE ---
            # Old Code: ImageChops.multiply(ela_image, scale) -> CRASHED
            # New Code: Use ImageEnhance to brighten the noise
            ela_image = ImageEnhance.Brightness(ela_image).enhance(scale)
            
            # 4. Analyze Variance
            # Convert to numpy to check average brightness of the noise
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
            # Always cleanup
            if os.path.exists(temp_path):
                os.remove(temp_path)
            return {"tampered": False, "reason": f"ELA Analysis Error: {str(e)}"}