import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import CryptoJS from 'crypto-js';
import axios from 'axios';
import { saveFileToBlockchain } from "../utils/blockchain"; // Import the blockchain helper

const Upload = () => {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const { walletAddress, isConnected } = useAuth();

  const onDrop = (acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setFileName(acceptedFiles[0].name);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  // --- ENCRYPT & UPLOAD ---
  const handleUpload = async () => {
    if (!file) {
      alert("Please select a file first!");
      return;
    }
    if (!isConnected) {
      alert("Please connect your wallet first!");
      return;
    }

    const encryptionSecret = process.env.REACT_APP_ENCRYPTION_SECRET;
    if (!encryptionSecret) {
      alert("Encryption secret is not configured. Cannot upload.");
      return;
    }

    setIsUploading(true);

    const reader = new FileReader();
    
    // Define what happens when the file is read
    reader.onload = async (event) => {
      try {
        const fileData = event.target.result;

        // 1. AES Encryption
        console.log("Starting encryption...");
        const encrypted = CryptoJS.AES.encrypt(fileData, encryptionSecret).toString();
        const encryptedFile = new Blob([encrypted], { type: 'text/plain' });

        // 2. Prepare FormData for Pinata
        const formData = new FormData();
        formData.append('file', encryptedFile, `${fileName}.encrypted`);

        const metadata = JSON.stringify({
          name: fileName,
          keyvalues: { owner: walletAddress }
        });
        formData.append('pinataMetadata', metadata);

        const options = JSON.stringify({ cidVersion: 0 });
        formData.append('pinataOptions', options);

        // 3. Upload to Pinata
        console.log("Uploading to Pinata...");
        const res = await axios.post(
          "https://api.pinata.cloud/pinning/pinFileToIPFS",
          formData,
          {
            maxBodyLength: "Infinity",
            headers: {
              'Content-Type': `multipart/form-data; boundary=${formData._boundary}`,
              pinata_api_key: process.env.REACT_APP_PINATA_API_KEY,
              pinata_secret_api_key: process.env.REACT_APP_PINATA_SECRET_API_KEY,
            },
          }
        );

        const cid = res.data.IpfsHash;
        console.log("File uploaded to Pinata with CID:", cid);

        // 4. Save to Blockchain (The Missing Link)
        try {
            alert("Please confirm the transaction in MetaMask to save to Blockchain.");
            await saveFileToBlockchain(cid, fileName); 
            console.log("Saved to Blockchain successfully!");
        } catch (blockchainError) {
            console.error("Blockchain save failed:", blockchainError);
            alert("File uploaded to IPFS, but Blockchain transaction failed. Check console.");
            // We do NOT return here, we still save to local storage so user doesn't lose the file
        }

        // 5. Save metadata to localStorage (Backup)
        const existingFiles = JSON.parse(localStorage.getItem(walletAddress) || '[]');
        const newFileEntry = {
          filename: fileName,
          cid: cid,
          upload_date: new Date().toISOString(),
        };
        existingFiles.push(newFileEntry);
        localStorage.setItem(walletAddress, JSON.stringify(existingFiles));

        alert(`Success! File encrypted, uploaded to IPFS, and recorded on Blockchain.\nCID: ${cid}`);

      } catch (error) {
        console.error("Upload failed:", error.response ? error.response.data : error);
        alert("Upload failed. Check console for details.");
      } finally {
        setIsUploading(false);
        setFile(null);
        setFileName('');
      }
    };

    // Trigger the file read
    reader.readAsDataURL(file);
  };

  // --- DECRYPT & DOWNLOAD ---
  const handleDecrypt = async (cid, filename) => {
    try {
      const encryptionSecret = process.env.REACT_APP_ENCRYPTION_SECRET;

      // Fetch encrypted file from Pinata gateway
      const response = await axios.get(`https://gateway.pinata.cloud/ipfs/${cid}`);
      const encryptedText = response.data;

      // Decrypt
      const bytes = CryptoJS.AES.decrypt(encryptedText, encryptionSecret);
      const original = bytes.toString(CryptoJS.enc.Utf8);

      if (!original) {
          throw new Error("Decryption failed. Wrong secret key or corrupted file.");
      }

      // Download as file
      const blob = new Blob([original], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.replace('.encrypted', '');
      a.click();
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error("Decryption failed:", err);
      alert("Decryption failed. Check console for details.");
    }
  };

  // Load previously uploaded files from localStorage
  const uploadedFiles = JSON.parse(localStorage.getItem(walletAddress) || '[]');

  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-20" id="upload">
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7 }}
        className="w-full max-w-3xl p-8 space-y-6 bg-gray-800 bg-opacity-50 rounded-2xl shadow-2xl border border-gray-700"
      >
        <h2 className="text-4xl font-bold text-center text-white">Upload Your Documents</h2>
        <p className="text-center text-gray-400">Files are encrypted in your browser before they are sent.</p>

        {/* Drag & Drop Zone */}
        <div
          {...getRootProps()}
          className={`flex flex-col items-center justify-center w-full h-64 border-2 ${isDragActive ? 'border-glow-cyan' : 'border-gray-600'} border-dashed rounded-lg cursor-pointer bg-gray-900 hover:bg-gray-800 transition duration-300`}
        >
          <input {...getInputProps()} />
          <svg className="w-10 h-10 mb-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2" />
          </svg>
          {isDragActive ? (
            <p className="text-gray-300">Drop the files here ...</p>
          ) : (
            <p className="text-sm text-gray-400"><span className="font-semibold">Click to upload</span> or drag and drop</p>
          )}
        </div>

        {/* File Name */}
        {fileName && (
          <div className="text-center text-gray-300">
            Selected: <span className="font-semibold text-glow-cyan">{fileName}</span>
          </div>
        )}

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={!file || isUploading || !isConnected}
          className="w-full py-3 px-4 bg-primary-blue text-white font-semibold rounded-lg shadow-md hover:bg-glow-cyan focus:outline-none disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-300"
        >
          {isUploading ? 'Uploading...' : 'Encrypt & Upload'}
        </button>

        {/* Uploaded Files Table */}
        {uploadedFiles.length > 0 && (
          <div className="mt-10">
            <h3 className="text-xl font-semibold text-white mb-4">Your Uploaded Files</h3>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-gray-300 border-b border-gray-700">
                  <th className="p-2">Filename</th>
                  <th className="p-2">CID</th>
                  <th className="p-2">Date</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {uploadedFiles.map((f, i) => (
                  <tr key={i} className="text-gray-400 border-b border-gray-700">
                    <td className="p-2">{f.filename}</td>
                    <td className="p-2 text-blue-400">
                      <a href={`https://gateway.pinata.cloud/ipfs/${f.cid}`} target="_blank" rel="noreferrer">
                        {f.cid.substring(0, 10)}...
                      </a>
                    </td>
                    <td className="p-2">{new Date(f.upload_date).toLocaleDateString()}</td>
                    <td className="p-2">
                      <button
                        onClick={() => handleDecrypt(f.cid, f.filename)}
                        className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-sm"
                      >
                        Decrypt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Upload;