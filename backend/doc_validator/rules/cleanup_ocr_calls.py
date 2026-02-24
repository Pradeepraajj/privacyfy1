import os
import re

def fix_ocr_calls(directory):
    # Regex to find .ocr(any_args) or .ocr(any_args)
    # It accounts for spaces and both single/double quotes
    ocr_pattern = re.compile(r'(\.ocr\([^)]*),\s*cls\s*=\s*(True|False)\s*(\))')
    
    print(f"🔍 Scanning directory: {directory} for legacy OCR calls...")
    
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith(".py"):
                file_path = os.path.join(root, file)
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                if 'cls=' in content:
                    # Replace ".ocr(path)" with ".ocr(path)"
                    new_content = ocr_pattern.sub(r'\1\3', content)
                    
                    if new_content != content:
                        with open(file_path, 'w', encoding='utf-8') as f:
                            f.write(new_content)
                        print(f"✅ Fixed: {file_path}")
                    else:
                        print(f"⚠️  Found 'cls=' in {file_path} but couldn't auto-patch safely.")

if __name__ == "__main__":
    # This tells the script to fix files in the folder where it is sitting
    current_folder = os.getcwd()
    fix_ocr_calls(current_folder)
    
    # Also try to fix the core folder if it's nearby
    core_folder = os.path.join(os.path.dirname(os.getcwd()), "core")
    if os.path.exists(core_folder):
        fix_ocr_calls(core_folder)