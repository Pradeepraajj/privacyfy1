import requests
import os
from cryptography.fernet import Fernet
from web3 import Web3
import json

# --- CONFIG ---
RPC_URL = "YOUR_RPC_URL" # Change to your Alchemy/Infura link
CONTRACT_ADDRESS = "0x958CeCe61a1764E048e010BC5CC44Fb641b8073f"
# Simplified ABI for reading
CONTRACT_ABI = json.loads('[{"inputs":[{"internalType":"address","name":"_user","type":"address"}],"name":"getFiles","outputs":[{"components":[{"internalType":"string","name":"cid","type":"string"},{"internalType":"string","name":"fileName","type":"string"},{"internalType":"bytes32","name":"docHash","type":"bytes32"},{"internalType":"bool","name":"isVerified","type":"bool"},{"internalType":"uint256","name":"timestamp","type":"uint256"}],"internalType":"struct FileRegistry.FileData[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"}]')

w3 = Web3(Web3.HTTPProvider(RPC_URL))
contract = w3.eth.contract(address=Web3.to_checksum_address(CONTRACT_ADDRESS), abi=CONTRACT_ABI)

def recover_key_from_blockchain(tx_hash):
    """Scans a transaction's input data to find the hidden AES key."""
    try:
        print(f"🔍 Searching Blockchain for key in TX: {tx_hash}...")
        tx = w3.eth.get_transaction(tx_hash)
        input_data = tx['input'] # This is the hex data of the TX
        
        # Convert hex to readable text
        readable_text = Web3.to_text(hexstr=input_data)
        
        if "|KEY:" in readable_text:
            key = readable_text.split("|KEY:")[1]
            print(f"🔑 Key recovered successfully!")
            return key
        return None
    except Exception as e:
        print(f"❌ Key recovery failed: {e}")
        return None

def download_and_decrypt(cid, key_str, output_filename):
    """Downloads from IPFS and decrypts locally"""
    gateway_url = f"https://gateway.pinata.cloud/ipfs/{cid}"
    print(f"📡 Downloading encrypted file from: {gateway_url}")
    
    response = requests.get(gateway_url)
    if response.status_code == 200:
        encrypted_data = response.content
        f = Fernet(key_str.encode())
        try:
            decrypted_data = f.decrypt(encrypted_data)
            with open(output_filename, "wb") as file:
                file.write(decrypted_data)
            print(f"✅ Success! File decrypted and saved as: {output_filename}")
        except Exception as e:
            print(f"❌ Decryption failed: {e}")
    else:
        print(f"❌ IPFS Download failed (Status: {response.status_code})")

if __name__ == "__main__":
    user_wallet = "0x3760EeaaE0FF273c611C9E9127e234b6e98ABE9C"
    
    # IMPORTANT: Paste the TX Hash from your successful API response here
    last_tx_hash = input("📑 Paste the 'blockchain_tx' hash from your API response: ")
    
    # 1. Get records from Blockchain to get the CID
    records = contract.functions.getFiles(Web3.to_checksum_address(user_wallet)).call()
    
    if records:
        latest_doc = records[-1] 
        cid = latest_doc[0]
        filename = latest_doc[1]
        
        # 2. AUTO-RECOVER KEY
        recovered_key = recover_key_from_blockchain(last_tx_hash)
        
        if recovered_key:
            # 3. Download and Unlock
            download_and_decrypt(cid, recovered_key, f"RECOVERED_{filename}")
        else:
            print("🛑 Could not find a key in that transaction.")
    else:
        print("No documents found for this wallet.")