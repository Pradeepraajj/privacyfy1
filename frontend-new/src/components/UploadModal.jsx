import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UploadCloud, Loader2, CheckCircle2, ShieldAlert, FileUser, Landmark, ArrowLeft, AlertCircle } from 'lucide-react';
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
  const [error, setError] = useState(null); // Dedicated error state

  const resetModal = () => {
    setUploadType(null);
    setStep('idle');
    setStatusMsg('');
    setDetectedDocType('');
    setError(null);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const handleUploadProcess = async (file) => {
    if (!isConnected || !walletAddress) {
      setError("Please connect your wallet first!");
      return;
    }

    setError(null); // Clear previous errors
    let verificationSignature = "Unverified";
    let finalLabel = uploadType === 'personal' ? 'Personal' : 'Govt ID';
    let extractedProfile = null; 

    try {
      // --- STEP 1: AI SCANNING (Govt IDs Only) ---
      if (uploadType === 'govt') {
        setStep('scanning');
        setStatusMsg("🦁 AI Analyzing Document...");
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('user_wallet', walletAddress);
        
        // Passing dummy profile data since Supabase is ditched
        formData.append('email', "user@privacyfy.io");
        formData.append('phone', "0000000000");

        try {
          const response = await axios.post('http://localhost:8000/verify-document', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
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
          const errorMsg = err.response?.data?.detail || err.message || "AI Server Error";
          throw new Error(errorMsg);
        }
      } 

      // --- STEP 2: CLIENT-SIDE ENCRYPTION ---
      setStep('encrypting');
      setStatusMsg(`🔒 Encrypting ${finalLabel}...`);
      
      const fileBuffer = await file.arrayBuffer();
      const wordArray = CryptoJS.lib.WordArray.create(fileBuffer);
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
      
      // Potential for Error 4001 (User Rejected) happens here
      const txHash = await saveFileToBlockchain(ipfsHash, file.name);

      // --- STEP 5: UPDATING LOCAL STATES ---
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
          flags: ["AI_VERIFIED", "ELA_PASS", "D-APP_MODE"] 
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
      
      // --- CLEAN ERROR HANDLING ---
      if (error.code === 4001 || error.message?.toLowerCase().includes("user rejected")) {
        setError("Transaction cancelled. Please confirm the request in MetaMask to continue.");
      } else if (error.message?.includes("Network Error")) {
        setError("Backend Connection Failed. Please ensure the AI Server is running.");
      } else {
        setError(error.message || "An unexpected error occurred during upload.");
      }
    }
  };

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) handleUploadProcess(file);
  }, [handleUploadProcess, walletAddress, isConnected]); 

  const { getRootProps, getInputProps } = useDropzone({ 
    onDrop, 
    multiple: false,
    accept: uploadType === 'govt' 
      ? { 
          'image/*': ['.jpeg', '.jpg', '.png'],
          'application/pdf': ['.pdf'] 
        } 
      : undefined 
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
              PrivacyFy Vault (Pure dApp)
            </h2>
          </div>

          <div className="p-8 flex-1 flex flex-col justify-center">
            {/* Inline Error Message */}
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }} 
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-xl flex items-start gap-3 text-red-400 text-sm"
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </motion.div>
            )}

            {!uploadType && (
              <div className="space-y-4">
                <p className="text-gray-400 text-sm text-center mb-4">Select document type to begin upload</p>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => setUploadType('personal')} className="group p-6 rounded-xl border border-white/10 bg-white/5 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all flex flex-col items-center">
                    <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center mb-4 group-hover:bg-cyan-500 transition-all">
                      <FileUser className="w-8 h-8 text-gray-300 group-hover:text-black" />
                    </div>
                    <h3 className="text-white font-bold">Personal</h3>
                    <p className="text-[10px] text-gray-500 mt-1 uppercase">Blockchain Storage</p>
                  </button>

                  <button onClick={() => setUploadType('govt')} className="group p-6 rounded-xl border border-white/10 bg-white/5 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all flex flex-col items-center">
                    <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center mb-4 group-hover:bg-cyan-500 transition-all">
                      <Landmark className="w-8 h-8 text-gray-300 group-hover:text-black" />
                    </div>
                    <h3 className="text-white font-bold">Govt ID</h3>
                    <p className="text-[10px] text-cyan-500/70 mt-1 uppercase font-bold">AI Verify & Anchor</p>
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
                  Supported: {uploadType === 'govt' ? 'JPG, PNG, PDF' : 'Any File'}
                </p>
              </div>
            )}

            {step !== 'idle' && step !== 'success' && (
              <div className="text-center py-10">
                <Loader2 className="w-20 h-20 text-cyan-500 animate-spin mx-auto mb-6" />
                <h3 className="text-xl font-bold text-white mb-2">{statusMsg}</h3>
                <p className="text-gray-500 text-sm">Securing data without databases...</p>
              </div>
            )}

            {step === 'success' && (
              <div className="text-center py-10">
                <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-6" />
                <h3 className="text-2xl font-bold text-white mb-2">{statusMsg}</h3>
                <p className="text-gray-400">Identity updated & anchored on Sepolia.</p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default UploadModal;