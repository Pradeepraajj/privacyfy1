from cryptography.fernet import Fernet
import os

def generate_key():
    """Generates and returns a key for AES encryption"""
    return Fernet.generate_key()

def encrypt_file(file_path, key):
    """Encrypts the file and overwrites it (or saves to new path)"""
    f = Fernet(key)
    with open(file_path, "rb") as file:
        file_data = file.read()
    
    encrypted_data = f.encrypt(file_data)
    
    with open(file_path, "wb") as file:
        file.write(encrypted_data)
    return True

def decrypt_file(file_path, key):
    """Decrypts the file back to its original state"""
    f = Fernet(key)
    with open(file_path, "rb") as file:
        encrypted_data = file.read()
    
    decrypted_data = f.decrypt(encrypted_data)
    
    with open(file_path, "wb") as file:
        file.write(decrypted_data)
    return True