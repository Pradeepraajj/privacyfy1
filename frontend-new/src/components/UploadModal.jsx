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

  // --- Logic Fix ---
  const handleUploadProcess = async (file) => {
    if (!isConnected) {
      alert("Please connect your wallet first!");
      return;
    }

    let verificationSignature = "Unverified";
    let finalLabel = uploadType === 'personal' ? 'Personal' : 'Govt ID';

    try {
      if (uploadType === 'govt') {
        setStep('scanning');
        setStatusMsg("🦁 AI Analyzing Document...");
        
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await axios.post('http://localhost:5000/verify-document', formData);
            if (!response.data.valid) throw new Error(response.data.message || "Verification Failed");

            verificationSignature = response.data.signature || "Verified-Seal";
            finalLabel = response.data.document_type; 
            setDetectedDocType(finalLabel); // State is now updated
            
            setStatusMsg(`✅ AI Verified: ${finalLabel}`);
            await new Promise(r => setTimeout(r, 1200));
        } catch (err) {
            throw new Error(err.response?.data?.message || err.message || "AI Server Offline");
        }
      } 

      setStep('encrypting');
      setStatusMsg(`🔒 Encrypting ${finalLabel}...`);
      
      const fileBuffer = await file.arrayBuffer();
      const wordArray = CryptoJS.lib.WordArray.create(fileBuffer);
      const secretKey = process.env.REACT_APP_ENCRYPTION_SECRET;
      if (!secretKey) throw new Error("Encryption key missing in .env");
      const encrypted = CryptoJS.AES.encrypt(wordArray, secretKey).toString();

      setStep('uploading');
      setStatusMsg("☁️ Pinning to IPFS...");
      
      const blob = new Blob([encrypted], { type: 'text/plain' });
      const pinataData = new FormData();
      pinataData.append('file', blob, `${file.name}.encrypted`);
      
      const metadata = JSON.stringify({
        name: file.name,
        keyvalues: { owner: walletAddress, docType: finalLabel, sig: verificationSignature }
      });
      pinataData.append('pinataMetadata', metadata);

      const pinataRes = await axios.post("https://api.pinata.cloud/pinning/pinFileToIPFS", pinataData, {
        headers: {
          'pinata_api_key': process.env.REACT_APP_PINATA_API_KEY,
          'pinata_secret_api_key': process.env.REACT_APP_PINATA_SECRET_API_KEY,
        }
      });

      const ipfsHash = pinataRes.data.IpfsHash;

      setStep('signing');
      setStatusMsg(`📝 Signing ${finalLabel} on Sepolia...`);
      const txHash = await saveFileToBlockchain(ipfsHash, file.name);

      setStep('success');
      setStatusMsg(`🎉 ${finalLabel} Secured!`);
      
      const newFileEntry = {
          cid: ipfsHash,
          txHash: txHash,
          fileName: file.name,
          date: new Date().toISOString(),
          docType: finalLabel,
          isVerified: uploadType === 'govt'
      };

      const existingFiles = JSON.parse(localStorage.getItem(walletAddress)) || [];
      localStorage.setItem(walletAddress, JSON.stringify([...existingFiles, newFileEntry]));

      setTimeout(() => {
        onUploadSuccess(); 
        handleClose(); 
      }, 2000);

    } catch (error) {
      console.error(error);
      setStep('idle');
      alert("❌ Error: " + error.message);
    }
  };

  // --- Dependency Fix ---
  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) handleUploadProcess(file);
  }, [handleUploadProcess]); 

  const { getRootProps, getInputProps } = useDropzone({ onDrop, multiple: false });

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden relative min-h-[400px] flex flex-col">
          
          <button onClick={handleClose} className="absolute top-4 right-4 text-gray-500 hover:text-white z-10"><X className="w-5 h-5" /></button>

          <div className="p-6 border-b border-white/10 flex items-center gap-3">
            {uploadType && step === 'idle' && (
              <button onClick={resetModal} className="text-gray-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></button>
            )}
            <h2 className="text-xl font-bold text-white flex items-center gap-2"><ShieldAlert className="text-cyan-500" /> PrivacyFy Vault</h2>
          </div>

          <div className="p-8 flex-1 flex flex-col justify-center">
            {!uploadType && (
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setUploadType('personal')} className="group p-6 rounded-xl border border-white/10 bg-white/5 hover:border-cyan-500/50 transition-all flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4 group-hover:bg-cyan-500 transition-colors"><FileUser className="w-8 h-8 text-gray-300 group-hover:text-black" /></div>
                  <h3 className="text-white font-bold">Personal</h3>
                </button>
                <button onClick={() => setUploadType('govt')} className="group p-6 rounded-xl border border-white/10 bg-white/5 hover:border-cyan-500/50 transition-all flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4 group-hover:bg-cyan-500 transition-colors"><Landmark className="w-8 h-8 text-gray-300 group-hover:text-black" /></div>
                  <h3 className="text-white font-bold">Govt ID</h3>
                </button>
              </div>
            )}

            {uploadType && step === 'idle' && (
              <div {...getRootProps()} className="h-48 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-cyan-500/50 transition-colors">
                <input {...getInputProps()} />
                <UploadCloud className="w-10 h-10 text-cyan-500 mb-2" />
                <p className="text-gray-300">Drop your {uploadType === 'govt' ? 'Aadhaar or PAN' : 'personal file'} here</p>
              </div>
            )}

            {step !== 'idle' && step !== 'success' && (
              <div className="text-center">
                <Loader2 className="w-12 h-12 text-cyan-500 animate-spin mx-auto mb-4" />
                <h3 className="text-lg font-bold text-white">{statusMsg}</h3>
              </div>
            )}

            {step === 'success' && (
              <div className="text-center">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-white">{statusMsg}</h3>
                {/* Visual Fix: Using detectedDocType */}
                <p className="text-gray-400 mt-2">Verified as {detectedDocType || "Document"}.</p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default UploadModal;