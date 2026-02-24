from ultralytics import YOLO
import os

# Get the path to your best.pt
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "best.pt")

model = YOLO(MODEL_PATH)
print("\n--- YOUR REAL YOLO LABELS ---")
print(model.names)
print("-----------------------------\n")