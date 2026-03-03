import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UploadCloud, Loader2, CheckCircle2, ShieldAlert, FileUser, Landmark, ArrowLeft, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { saveFileToBlockchain } from "../utils/blockchain"; 

const UploadModal = ({ isOpen, onClose, onUploadSuccess }) => {
  const { isConnected, walletAddress } = useAuth();
  const [uploadType, setUploadType] = useState(null); 
  const [step, setStep] = useState('idle'); 
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState(null);

  const resetModal = () => {
    setUploadType(null);
    setStep('idle');
    setStatusMsg('');
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

    setError(null);
    let finalLabel = uploadType === 'personal' ? 'Personal' : 'Govt ID';
    let extractedProfile = null; 
    let documentHash = null;

    try {
      // --- PHASE 1: AI SCANNING & STAGING ---
      setStep('scanning');
      setStatusMsg("🦁 AI Validating Document...");
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('user_wallet', walletAddress);

      // Call Phase 1 Backend: AI Verification
      const verifyRes = await axios.post('http://localhost:8000/verify-document', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (!verifyRes.data.valid) {
        throw new Error(verifyRes.data.details?.flags?.[0] || "AI verification failed.");
      }

      // Capture metadata returned from backend staging
      documentHash = verifyRes.data.doc_hash;
      finalLabel = verifyRes.data.details?.document_type || finalLabel;
      extractedProfile = verifyRes.data.details?.extracted_data;
      
      setStatusMsg(`✅ Verified ${finalLabel}. Waiting for Signature...`);
      await new Promise(r => setTimeout(r, 1000));

      // --- PHASE 2: BLOCKCHAIN ANCHORING ---
      // This step triggers MetaMask. If the user cancels here, Step 3 never runs.
      setStep('signing');
      setStatusMsg(`📝 Sign to Anchor ${finalLabel}...`);
      
      const txHash = await saveFileToBlockchain(documentHash, file.name);

      // --- PHASE 3: FINALIZE & PIN TO IPFS ---
      // Only called after transaction success to avoid Pinata storage waste
      setStep('uploading');
      setStatusMsg("☁️ Finalizing Storage & Encryption...");

      const finalizeData = new FormData();
      finalizeData.append('doc_hash', documentHash);
      finalizeData.append('tx_hash', txHash);

      const finalizeRes = await axios.post('http://localhost:8000/finalize-upload', finalizeData);

      if (!finalizeRes.data.success) {
        throw new Error("Failed to finalize IPFS pinning.");
      }

      const ipfsHash = finalizeRes.data.ipfs_cid;
      const encryptionKey = finalizeRes.data.encryption_key;

      // --- PHASE 4: UPDATING LOCAL STATES ---
      setStep('success');
      setStatusMsg(`🎉 ${finalLabel} Secured!`);
      
      // Update local profile if AI extracted name (Self-sovereign Identity)
      if (extractedProfile && extractedProfile.full_name) {
        const profileEntry = {
          name: extractedProfile.full_name,
          isVerified: true,
          lastUpdated: new Date().toISOString(),
          wallet: walletAddress
        };
        localStorage.setItem(`profile_${walletAddress}`, JSON.stringify(profileEntry));
      }

      // Record entry for the Vault UI
      const newFileEntry = {
        cid: ipfsHash,
        txHash: txHash,
        fileName: file.name,
        date: new Date().toISOString(),
        docType: finalLabel,
        isVerified: uploadType === 'govt',
        encryption_key: encryptionKey, // Stored for client-side decryption later
        details: extractedProfile ? { 
          confidence_score: 100,
          flags: ["AI_VERIFIED", "ANCHORED_AFTER_TX", "ENCRYPTED"] 
        } : null
      };

      const existingFiles = JSON.parse(localStorage.getItem(walletAddress)) || [];
      localStorage.setItem(walletAddress, JSON.stringify([...existingFiles, newFileEntry]));

      // Close modal and refresh dashboard after success
      setTimeout(() => {
        onUploadSuccess(); 
        handleClose(); 
      }, 2000);

    } catch (err) {
      console.error("Upload Process Error:", err);
      setStep('idle');
      
      // Better UX for MetaMask Rejection
      if (err.code === 4001 || err.message?.toLowerCase().includes("user rejected")) {
        setError("Transaction cancelled. IPFS storage was prevented.");
      } else if (err.message?.includes("Network Error")) {
        setError("Backend Connection Failed. Ensure AI Server is running.");
      } else {
        setError(err.message || "An unexpected error occurred.");
      }
    }
  };

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) handleUploadProcess(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadType, isConnected, walletAddress]); 

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
          {/* Header */}
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
              PrivacyFy Vault (Anti-Leak Flow)
            </h2>
          </div>

          <div className="p-8 flex-1 flex flex-col justify-center">
            {/* Error Feedback */}
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

            {/* Step: Selection */}
            {!uploadType && (
              <div className="space-y-4">
                <p className="text-gray-400 text-sm text-center mb-4">Choose document type to begin</p>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => setUploadType('personal')} className="group p-6 rounded-xl border border-white/10 bg-white/5 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all flex flex-col items-center">
                    <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center mb-4 group-hover:bg-cyan-500 transition-all">
                      <FileUser className="w-8 h-8 text-gray-300 group-hover:text-black" />
                    </div>
                    <h3 className="text-white font-bold">Personal</h3>
                    <p className="text-[10px] text-gray-500 mt-1 uppercase text-center">Secure Storage</p>
                  </button>

                  <button onClick={() => setUploadType('govt')} className="group p-6 rounded-xl border border-white/10 bg-white/5 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all flex flex-col items-center">
                    <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center mb-4 group-hover:bg-cyan-500 transition-all">
                      <Landmark className="w-8 h-8 text-gray-300 group-hover:text-black" />
                    </div>
                    <h3 className="text-white font-bold">Govt ID</h3>
                    <p className="text-[10px] text-cyan-500/70 mt-1 uppercase font-bold text-center">AI Verify & Sign</p>
                  </button>
                </div>
              </div>
            )}

            {/* Step: Dropzone */}
            {uploadType && step === 'idle' && (
              <div {...getRootProps()} className="h-56 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all group">
                <input {...getInputProps()} />
                <div className="p-4 bg-white/5 rounded-full mb-4 group-hover:scale-110 transition-transform">
                  <UploadCloud className="w-10 h-10 text-cyan-500" />
                </div>
                <p className="text-gray-300 font-medium">Click or Drag File</p>
                <p className="text-gray-500 text-xs mt-2 italic text-center px-4">
                  {uploadType === 'govt' ? 'JPG, PNG, PDF supported for AI' : 'Any file format supported'}
                </p>
              </div>
            )}

            {/* Step: Processing/Loading */}
            {step !== 'idle' && step !== 'success' && (
              <div className="text-center py-10">
                <Loader2 className="w-20 h-20 text-cyan-500 animate-spin mx-auto mb-6" />
                <h3 className="text-xl font-bold text-white mb-2">{statusMsg}</h3>
                <p className="text-gray-500 text-sm">
                  {step === 'signing' ? 'Check MetaMask to confirm...' : 'Connecting to PrivacyFy Nodes...'}
                </p>
              </div>
            )}

            {/* Step: Success UI */}
            {step === 'success' && (
              <div className="text-center py-10">
                <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-6" />
                <h3 className="text-2xl font-bold text-white mb-2">{statusMsg}</h3>
                <p className="text-gray-400">Data anchored and pinned securely.</p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default UploadModal;