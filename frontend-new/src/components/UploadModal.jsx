import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UploadCloud, Loader2, CheckCircle2, ShieldAlert, FileUser, Landmark, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import CryptoJS from 'crypto-js';
import axios from 'axios';
import { saveFileToBlockchain } from "../utils/blockchain"; 

const UploadModal = ({ isOpen, onClose, onUploadSuccess }) => {
  const { isConnected, walletAddress } = useAuth();
  
  const [uploadType, setUploadType] = useState(null); // 'personal' | 'govt'
  const [step, setStep] = useState('idle'); 
  const [statusMsg, setStatusMsg] = useState('');

  const resetModal = () => {
    setUploadType(null);
    setStep('idle');
    setStatusMsg('');
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) handleUploadProcess(file);
  }, [uploadType]); 

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: false });

  const handleUploadProcess = async (file) => {
    if (!isConnected) {
      alert("Please connect your wallet first!");
      return;
    }

    let verificationSignature = "Unverified"; // Default for personal docs

    try {
      // --- BRANCHING LOGIC START ---
      
      if (uploadType === 'govt') {
        // PATH A: GOVERNMENT DOCUMENT (Real AI Verification)
        setStep('scanning');
        setStatusMsg("🦁 AI Scanning for Lion Emblem...");
        
        // 1. Prepare file for Backend
        const formData = new FormData();
        formData.append('file', file);

        // 2. CALL THE BACKEND (Port 5000)
        try {
            const response = await axios.post('http://localhost:5000/verify-document', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            console.log("🦁 AI Response:", response.data);

            // 3. CHECK VERDICT
            if (!response.data.valid) {
                throw new Error("Verification Failed: " + response.data.message);
            }

            // 4. CAPTURE THE SIGNATURE (The "Seal of Authenticity")
            verificationSignature = response.data.signature || "Verified-No-Sig";
            
            setStatusMsg("✅ Verified: " + response.data.message);
            await new Promise(r => setTimeout(r, 1000)); // Brief pause to show success

        } catch (backendError) {
            console.error("Backend Error:", backendError);
            throw new Error(backendError.response?.data?.message || "AI Server Connection Failed");
        }
      } 
      
      // PATH B: PERSONAL DOCUMENT (Skip Scanning, keep signature as "Unverified")

      // --- COMMON PATH: ENCRYPTION ---
      setStep('encrypting');
      setStatusMsg("🔒 Encrypting file with AES-256...");
      
      const reader = new FileReader();
      reader.readAsArrayBuffer(file);
      
      reader.onload = async () => {
        const fileBuffer = reader.result;
        const wordArray = CryptoJS.lib.WordArray.create(fileBuffer);
        const secretKey = process.env.REACT_APP_ENCRYPTION_SECRET;
        
        if (!secretKey) throw new Error("Encryption key missing in .env");
        
        const encrypted = CryptoJS.AES.encrypt(wordArray, secretKey).toString();

        // --- COMMON PATH: IPFS UPLOAD ---
        setStep('uploading');
        setStatusMsg("☁️ Pinning to IPFS...");
        
        const blob = new Blob([encrypted], { type: 'text/plain' });
        const formData = new FormData();
        formData.append('file', blob, `${file.name}.encrypted`);
        
        // Add Metadata including the Signature!
        const metadata = JSON.stringify({
          name: file.name,
          keyvalues: { 
            owner: walletAddress,
            type: uploadType,
            verification_seal: verificationSignature // <--- STORED ON BLOCKCHAIN NETWORK
          }
        });
        formData.append('pinataMetadata', metadata);
        formData.append('pinataOptions', JSON.stringify({ cidVersion: 0 }));

        const pinataRes = await axios.post("https://api.pinata.cloud/pinning/pinFileToIPFS", formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'pinata_api_key': process.env.REACT_APP_PINATA_API_KEY,
            'pinata_secret_api_key': process.env.REACT_APP_PINATA_SECRET_API_KEY,
          }
        });

        const ipfsHash = pinataRes.data.IpfsHash;

        // --- COMMON PATH: BLOCKCHAIN TRANSACTION ---
        setStep('signing');
        setStatusMsg("📝 Waiting for Wallet Signature...");

        await saveFileToBlockchain(ipfsHash, file.name);

        // --- DONE ---
        setStep('success');
        setStatusMsg("✅ Securely Stored!");
        
        // Update Local Storage
        const existingFiles = JSON.parse(localStorage.getItem(walletAddress)) || [];
        const newFileEntry = {
            cid: ipfsHash,
            fileName: file.name,
            date: new Date().toISOString(),
            isVerified: uploadType === 'govt', 
            docType: uploadType,
            signature: verificationSignature // Save locally too
        };
        localStorage.setItem(walletAddress, JSON.stringify([...existingFiles, newFileEntry]));

        setTimeout(() => {
          onUploadSuccess(); 
          handleClose(); 
        }, 1500);
      };

    } catch (error) {
      console.error(error);
      setStep('idle');
      alert("❌ Upload Failed: " + (error.message || "Unknown error"));
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
      >
        <motion.div 
          initial={{ scale: 0.95 }} animate={{ scale: 1 }}
          className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden relative flex flex-col min-h-[400px]"
        >
          {/* Close Button */}
          <button onClick={handleClose} className="absolute top-4 right-4 text-gray-500 hover:text-white z-10">
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="p-6 border-b border-white/10 flex items-center gap-3">
             {/* Back Button */}
             {uploadType && step === 'idle' && (
               <button onClick={resetModal} className="text-gray-400 hover:text-white transition-colors">
                 <ArrowLeft className="w-5 h-5" />
               </button>
             )}
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <ShieldAlert className="text-cyan-500" /> Secure Upload
            </h2>
          </div>

          {/* Body */}
          <div className="p-8 flex-1 flex flex-col justify-center">
            
            {/* VIEW 1: SELECTION SCREEN */}
            {!uploadType && (
              <div className="grid grid-cols-2 gap-4 h-full">
                {/* Option 1: Personal */}
                <button 
                  onClick={() => setUploadType('personal')}
                  className="group flex flex-col items-center justify-center p-6 rounded-xl border border-white/10 bg-white/5 hover:bg-cyan-500/10 hover:border-cyan-500/50 transition-all duration-300"
                >
                  <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4 group-hover:bg-cyan-500 group-hover:text-black transition-colors">
                    <FileUser className="w-8 h-8 text-gray-300 group-hover:text-black" />
                  </div>
                  <h3 className="text-white font-bold mb-1">Personal Doc</h3>
                  <p className="text-xs text-gray-500 text-center">Photos, Notes, etc.<br/>(No Verification)</p>
                </button>

                {/* Option 2: Govt ID */}
                <button 
                  onClick={() => setUploadType('govt')}
                  className="group flex flex-col items-center justify-center p-6 rounded-xl border border-white/10 bg-white/5 hover:bg-cyan-500/10 hover:border-cyan-500/50 transition-all duration-300"
                >
                  <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4 group-hover:bg-cyan-500 group-hover:text-black transition-colors">
                    <Landmark className="w-8 h-8 text-gray-300 group-hover:text-black" />
                  </div>
                  <h3 className="text-white font-bold mb-1">Government ID</h3>
                  <p className="text-xs text-gray-500 text-center">Aadhaar, PAN, License<br/>(AI Verification)</p>
                </button>
              </div>
            )}

            {/* VIEW 2: DROPZONE */}
            {uploadType && step === 'idle' && (
              <div {...getRootProps()} className={`
                h-full border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all
                ${isDragActive ? 'border-cyan-500 bg-cyan-500/10' : 'border-white/10 hover:border-cyan-500/50 hover:bg-white/5'}
              `}>
                <input {...getInputProps()} />
                <div className="bg-gray-800 p-4 rounded-full mb-4">
                  <UploadCloud className="w-8 h-8 text-cyan-500" />
                </div>
                <p className="text-gray-300 font-medium text-center">
                   Upload <span className="text-cyan-400 capitalize">{uploadType === 'govt' ? 'Government ID' : 'Personal Doc'}</span>
                </p>
                <p className="text-xs text-gray-500 mt-2">PDF, JPG, PNG (Max 10MB)</p>
              </div>
            )}

            {/* VIEW 3: PROCESSING STEPS */}
            {(step === 'scanning' || step === 'encrypting' || step === 'uploading' || step === 'signing') && (
              <div className="text-center py-10">
                <Loader2 className="w-16 h-16 text-cyan-500 animate-spin mx-auto mb-6" />
                <h3 className="text-xl font-bold text-white mb-2">{statusMsg}</h3>
                <p className="text-sm text-gray-400">Please do not close this window.</p>
              </div>
            )}

            {/* VIEW 4: SUCCESS */}
            {step === 'success' && (
              <div className="text-center py-10">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </motion.div>
                <h3 className="text-xl font-bold text-white">Upload Complete</h3>
                <p className="text-sm text-gray-400">Your {uploadType} document is secure.</p>
              </div>
            )}

          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default UploadModal;