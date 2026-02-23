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
  const [uploadType, setUploadType] = useState(null); 
  const [step, setStep] = useState('idle'); 
  const [statusMsg, setStatusMsg] = useState('');
  const [detectedDocType, setDetectedDocType] = useState('');

  const resetModal = () => {
    setUploadType(null);
    setStep('idle');
    setStatusMsg('');
    setDetectedDocType('');
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const handleUploadProcess = async (file) => {
    if (!isConnected || !walletAddress) {
      alert("Please connect your wallet first!");
      return;
    }

    let verificationSignature = "Unverified";
    let finalLabel = uploadType === 'personal' ? 'Personal' : 'Govt ID';
    let extractedProfile = null; 

    try {
      // --- STEP 1: AI SCANNING (Govt IDs) ---
      if (uploadType === 'govt') {
        setStep('scanning');
        setStatusMsg("🦁 AI Analyzing Document...");
        
        const formData = new FormData();
        formData.append('file', file);
        // FIX: Adding the wallet address so FastAPI doesn't return 400
        formData.append('user_wallet', walletAddress);

        try {
          // Pointing to port 8000 where FastAPI runs
          const response = await axios.post('http://localhost:8000/verify-document', formData, {
            params: { user_wallet: walletAddress } // Alternative way to pass query params
          });
          
          if (!response.data.valid) {
            throw new Error(response.data.details?.flags?.[0] || "Verification failed forensic check.");
          }

          verificationSignature = response.data.signature || "Verified-Seal";
          finalLabel = response.data.details?.document_type || "Govt ID"; 
          extractedProfile = response.data.details?.extracted_data; 
          setDetectedDocType(finalLabel); 
          
          setStatusMsg(`✅ AI Verified: ${finalLabel}`);
          await new Promise(r => setTimeout(r, 1200));
        } catch (err) {
          console.error("AI Server Error:", err);
          const errorMsg = err.response?.data?.detail || err.message || "AI Server Offline";
          throw new Error(errorMsg);
        }
      } 

      // --- STEP 2: CLIENT-SIDE ENCRYPTION ---
      setStep('encrypting');
      setStatusMsg(`🔒 Encrypting ${finalLabel}...`);
      
      const fileBuffer = await file.arrayBuffer();
      const wordArray = CryptoJS.lib.WordArray.create(fileBuffer);
      
      // Use your secret from .env (Create React App uses REACT_APP_ prefix)
      const secretKey = process.env.REACT_APP_ENCRYPTION_SECRET || "default-secret-key-123";
      const encrypted = CryptoJS.AES.encrypt(wordArray, secretKey).toString();

      // --- STEP 3: IPFS UPLOAD (PINATA) ---
      setStep('uploading');
      setStatusMsg("☁️ Pinning to IPFS...");
      
      const blob = new Blob([encrypted], { type: 'text/plain' });
      const pinataData = new FormData();
      pinataData.append('file', blob, `${file.name}.encrypted`);
      
      const metadata = JSON.stringify({
        name: file.name,
        keyvalues: { 
          owner: walletAddress, 
          docType: finalLabel, 
          sig: verificationSignature,
          userName: extractedProfile?.full_name || "N/A"
        }
      });
      pinataData.append('pinataMetadata', metadata);

      // Ensure your .env has REACT_APP_PINATA_API_KEY and REACT_APP_PINATA_SECRET_API_KEY
      const pinataRes = await axios.post("https://api.pinata.cloud/pinning/pinFileToIPFS", pinataData, {
        headers: {
          'Content-Type': `multipart/form-data; boundary=${pinataData._boundary}`,
          'pinata_api_key': process.env.REACT_APP_PINATA_API_KEY,
          'pinata_secret_api_key': process.env.REACT_APP_PINATA_SECRET_API_KEY,
        }
      });

      const ipfsHash = pinataRes.data.IpfsHash;

      // --- STEP 4: BLOCKCHAIN ANCHORING ---
      setStep('signing');
      setStatusMsg(`📝 Signing ${finalLabel} on Sepolia...`);
      // This calls your smart contract via ethers.js
      const txHash = await saveFileToBlockchain(ipfsHash, file.name);

      // --- STEP 5: UPDATING LOCAL STATES & PROFILE ---
      setStep('success');
      setStatusMsg(`🎉 ${finalLabel} Secured!`);
      
      if (extractedProfile && extractedProfile.full_name) {
        const profileEntry = {
          name: extractedProfile.full_name,
          isVerified: true,
          lastUpdated: new Date().toISOString(),
          wallet: walletAddress
        };
        localStorage.setItem(`profile_${walletAddress}`, JSON.stringify(profileEntry));
      }

      const newFileEntry = {
        cid: ipfsHash,
        txHash: txHash,
        fileName: file.name,
        date: new Date().toISOString(),
        docType: finalLabel,
        isVerified: uploadType === 'govt',
        details: extractedProfile ? { 
          confidence_score: 100,
          flags: ["AI_VERIFIED", "ELA_PASS"] 
        } : null
      };

      const existingFiles = JSON.parse(localStorage.getItem(walletAddress)) || [];
      localStorage.setItem(walletAddress, JSON.stringify([...existingFiles, newFileEntry]));

      setTimeout(() => {
        onUploadSuccess(); 
        handleClose(); 
      }, 2000);

    } catch (error) {
      console.error("Upload Process Error:", error);
      setStep('idle');
      alert("❌ Error: " + error.message);
    }
  };

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) handleUploadProcess(file);
  }, [handleUploadProcess, walletAddress, isConnected]); 

  const { getRootProps, getInputProps } = useDropzone({ 
    onDrop, 
    multiple: false,
    accept: uploadType === 'govt' ? { 'image/*': ['.jpeg', '.jpg', '.png'] } : undefined 
  });

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
      >
        <motion.div 
          initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} 
          className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden relative min-h-[420px] flex flex-col"
        >
          <button onClick={handleClose} className="absolute top-4 right-4 text-gray-500 hover:text-white z-10 p-2 rounded-full hover:bg-white/5 transition-colors">
            <X className="w-5 h-5" />
          </button>

          <div className="p-6 border-b border-white/10 flex items-center gap-3">
            {uploadType && step === 'idle' && (
              <button onClick={resetModal} className="text-gray-400 hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <ShieldAlert className="text-cyan-500 w-5 h-5" /> 
              PrivacyFy Vault
            </h2>
          </div>

          <div className="p-8 flex-1 flex flex-col justify-center">
            {!uploadType && (
              <div className="space-y-4">
                <p className="text-gray-400 text-sm text-center mb-4">Select document type to begin secure upload</p>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => setUploadType('personal')} className="group p-6 rounded-xl border border-white/10 bg-white/5 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all flex flex-col items-center">
                    <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center mb-4 group-hover:bg-cyan-500 group-hover:rotate-3 transition-all duration-300">
                      <FileUser className="w-8 h-8 text-gray-300 group-hover:text-black" />
                    </div>
                    <h3 className="text-white font-bold">Personal</h3>
                    <p className="text-[10px] text-gray-500 mt-1 uppercase">Simple Encryption</p>
                  </button>

                  <button onClick={() => setUploadType('govt')} className="group p-6 rounded-xl border border-white/10 bg-white/5 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all flex flex-col items-center">
                    <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center mb-4 group-hover:bg-cyan-500 group-hover:-rotate-3 transition-all duration-300">
                      <Landmark className="w-8 h-8 text-gray-300 group-hover:text-black" />
                    </div>
                    <h3 className="text-white font-bold">Govt ID</h3>
                    <p className="text-[10px] text-cyan-500/70 mt-1 uppercase font-bold">AI Verification</p>
                  </button>
                </div>
              </div>
            )}

            {uploadType && step === 'idle' && (
              <div {...getRootProps()} className="h-56 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all group">
                <input {...getInputProps()} />
                <div className="p-4 bg-white/5 rounded-full mb-4 group-hover:scale-110 transition-transform">
                  <UploadCloud className="w-10 h-10 text-cyan-500" />
                </div>
                <p className="text-gray-300 font-medium">Click or Drag File</p>
                <p className="text-gray-500 text-xs mt-2 italic">
                  Supported: {uploadType === 'govt' ? 'JPG, PNG (Aadhaar/PAN)' : 'Any File'}
                </p>
              </div>
            )}

            {step !== 'idle' && step !== 'success' && (
              <div className="text-center py-10">
                <div className="relative w-20 h-20 mx-auto mb-6">
                  <Loader2 className="w-20 h-20 text-cyan-500 animate-spin absolute inset-0" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 bg-cyan-500/10 rounded-full animate-pulse" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{statusMsg}</h3>
                <p className="text-gray-500 text-sm animate-pulse">This usually takes a few seconds...</p>
              </div>
            )}

            {step === 'success' && (
              <div className="text-center py-10">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/30">
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">{statusMsg}</h3>
                <p className="text-gray-400">
                  Your identity has been updated and the file is secured on-chain.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default UploadModal;