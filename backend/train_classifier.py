from ultralytics import YOLO

def main():
    print("🤖 Initializing YOLOv8 Nano model...")
    # 1. Load the base model (Nano version is fast and lightweight)
    model = YOLO('yolov8n.pt') 

    print("🚀 Starting training process...")
    # 2. Train the model on your custom dataset
    # Notice the path matches exactly where your data.yaml is located
    results = model.train(
        data='P:/projects/privacyfy.v2i.yolov8/data.yaml', 
        epochs=50,                  # 50 rounds of learning
        imgsz=640,                  # Standard image size
        name='privacyfy_docs',      # Name of the folder where results are saved
        patience=10                 # Stops early if it stops improving for 10 epochs
    )

    print("✅ Training Complete! Your new brain is saved in the 'runs/detect/privacyfy_docs/weights' folder.")

if __name__ == '__main__':
    # This wrapper is required on Windows to prevent multiprocessing errors
    main()
    