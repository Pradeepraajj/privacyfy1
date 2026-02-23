import { CONTRACT_ADDRESS, ABI } from "../contractConfig";
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import CryptoJS from 'crypto-js';
import axios from 'axios';
import { 
  FileText, Download, Trash2, Plus, Search, Loader2, 
  ShieldAlert, Landmark, FileUser, Filter, ExternalLink, ShieldCheck, AlertTriangle
} from 'lucide-react'; 
import toast from 'react-hot-toast'; 
import UploadModal from './UploadModal'; 
import { ethers } from 'ethers';

const Dashboard = () => {
  const { walletAddress, isConnected } = useAuth();
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterType, setFilterType] = useState('all'); 
  const [searchTerm, setSearchTerm] = useState('');
  const [isUploadOpen, setUploadOpen] = useState(false);

  const fetchFiles = useCallback(() => {
    if (isConnected && walletAddress) {
      setIsLoading(true);
      try {
        const localFiles = localStorage.getItem(walletAddress);
        if (localFiles) {
          setFiles(JSON.parse(localFiles));
        } else {
          setFiles([]);
        }
      } catch (error) {
        console.error("Error reading files:", error);
        setFiles([]);
      } finally {
        setIsLoading(false);
      }
    }
  }, [isConnected, walletAddress]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const viewOnBlockchain = (txHash) => {
    window.open(`https://sepolia.etherscan.io/tx/${txHash}`, '_blank');
  };

  /**
   * UPDATED: handleDownload with Decryption Logic
   * This replaces the simple window.open which showed encrypted data.
   */
  const handleDownload = async (cid, fileName) => {
    const loadingToast = toast.loading(`Decrypting ${fileName}...`);
    
    try {
      // 1. Fetch the encrypted content from IPFS
      // Using axios to get the raw text data stored in the CID
      const response = await axios.get(`https://gateway.pinata.cloud/ipfs/${cid}`);
      const encryptedData = response.data;

      // 2. Get Secret Key from Environment
      const secretKey = process.env.REACT_APP_ENCRYPTION_SECRET;
      if (!secretKey) {
        throw new Error("Decryption key missing in .env file");
      }

      // 3. Decrypt the data
      const bytes = CryptoJS.AES.decrypt(encryptedData, secretKey);
      
      // 4. Convert to WordArray then to typed array for Blob creation
      // We use latin1 to preserve the binary structure of images/PDFs
      const decryptedStr = bytes.toString(CryptoJS.enc.Latin1);
      
      if (!decryptedStr) {
        throw new Error("Invalid key or corrupted data.");
      }

      // Convert the decrypted string to an ArrayBuffer
      const n = decryptedStr.length;
      const u8arr = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        u8arr[i] = decryptedStr.charCodeAt(i);
      }

      // 5. Create a Blob and URL
      // We try to guess the type based on extension or default to image
      const extension = fileName.split('.').pop().toLowerCase();
      let mimeType = 'image/png';
      if (extension === 'pdf') mimeType = 'application/pdf';
      if (extension === 'jpg' || extension === 'jpeg') mimeType = 'image/jpeg';

      const blob = new Blob([u8arr], { type: mimeType });
      const fileURL = URL.createObjectURL(blob);

      // 6. Success: Open the decrypted file
      toast.dismiss(loadingToast);
      toast.success("Decryption Successful!");
      window.open(fileURL, '_blank');

      // Cleanup URL after a minute to save memory
      setTimeout(() => URL.revokeObjectURL(fileURL), 60000);

    } catch (error) {
      console.error("Decryption Error:", error);
      toast.dismiss(loadingToast);
      toast.error("Decryption failed. Check console for details.");
    }
  };

  const handleRemoveFile = (cid) => {
    const updatedFiles = files.filter(f => f.cid !== cid);
    localStorage.setItem(walletAddress, JSON.stringify(updatedFiles));
    setFiles(updatedFiles);
    toast.success("File removed from local view.");
  };

  const filteredFiles = files.filter(file => {
    const matchesSearch = file.fileName && file.fileName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' 
      ? true 
      : filterType === 'govt' 
        ? (file.isVerified === true) 
        : (file.docType === 'personal' || !file.docType); 
    
    return matchesSearch && matchesType;
  });

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center px-4">
        <ShieldAlert className="w-16 h-16 text-gray-600 mb-4" />
        <h2 className="text-2xl font-bold text-gray-300">Wallet Not Connected</h2>
        <p className="text-gray-500 mt-2">Please connect MetaMask to access your secure vault.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans pt-24 pb-20 px-6">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER & FILTERS */}
        <div className="flex flex-col xl:flex-row justify-between items-end mb-8 border-b border-white/10 pb-6 gap-6">
          <div>
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">
              My Vault
            </h1>
            <p className="text-gray-400 mt-2 font-light flex items-center gap-2">
              {files.length} Documents Stored 
              <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
              <span className="text-cyan-500">
                {files.filter(f => f.txHash).length} Blockchain Secured
              </span>
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-4 w-full xl:w-auto">
             <div className="flex bg-[#111] p-1 rounded-xl border border-white/10">
                {['all', 'govt', 'personal'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                      filterType === type 
                      ? 'bg-gray-800 text-white shadow-md' 
                      : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {type === 'govt' ? 'Verified IDs' : type}
                  </button>
                ))}
             </div>

             <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                <input 
                  type="text" placeholder="Search files..." 
                  value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#111] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-gray-200 focus:outline-none focus:border-cyan-500/50"
                />
             </div>

             <button 
               onClick={() => setUploadOpen(true)}
               className="bg-cyan-500 hover:bg-cyan-400 text-black px-5 py-2.5 rounded-xl font-bold shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all active:scale-95 flex items-center gap-2"
             >
               <Plus className="w-5 h-5" /> Upload
             </button>
          </div>
        </div>

        {/* GRID VIEW */}
        {isLoading ? (
           <div className="flex justify-center py-20">
             <Loader2 className="w-10 h-10 text-cyan-500 animate-spin" />
           </div>
        ) : filteredFiles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filteredFiles.map((file, index) => (
                <motion.div
                  key={file.cid + index}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group bg-[#111] rounded-2xl p-6 border border-white/5 hover:border-cyan-500/30 transition-all flex flex-col"
                >
                  <div className="relative h-40 bg-black/40 rounded-xl mb-4 flex items-center justify-center group-hover:bg-cyan-500/5 transition-colors overflow-hidden border border-white/5">
                    {file.isVerified ? (
                      <Landmark className="w-14 h-14 text-cyan-500/50 group-hover:text-cyan-400 transition-all duration-500 group-hover:scale-110" />
                    ) : (
                      <FileUser className="w-14 h-14 text-gray-700 group-hover:text-gray-500 transition-all duration-500 group-hover:scale-110" />
                    )}
                    
                    {file.txHash && (
                      <button 
                        onClick={() => viewOnBlockchain(file.txHash)}
                        className="absolute top-3 right-3 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 rounded-lg text-[10px] text-cyan-400 font-bold uppercase flex items-center gap-1.5 hover:bg-cyan-500/20 transition-colors"
                      >
                        Secured <ExternalLink className="w-3 h-3" />
                      </button>
                    )}

                    {file.isVerified && (
                      <div className="absolute top-3 left-3 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-lg text-[10px] text-green-400 font-bold flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> AI VERIFIED
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <h3 className="font-bold text-gray-200 truncate text-lg">{file.fileName}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-gray-500 font-mono">
                        {new Date(file.date).toLocaleDateString()}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/5 text-cyan-500 font-bold uppercase tracking-tight">
                        {file.docType || 'Personal'}
                      </span>
                    </div>

                    {/* AI FORENSIC LOGS */}
                    {file.details && (
                      <div className="mt-4 p-3 bg-black/60 rounded-xl border border-white/5 space-y-2">
                        <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-widest text-gray-500">
                          <span>Forensic Report</span>
                          <span className={file.isVerified ? 'text-cyan-500' : 'text-red-500'}>
                            Confidence: {file.details.confidence_score}%
                          </span>
                        </div>
                        <div className="space-y-1">
                          {file.details.flags?.slice(0, 2).map((flag, i) => (
                            <div key={i} className="flex items-center gap-2 text-[10px] text-gray-400 italic">
                              <div className="w-1 h-1 rounded-full bg-cyan-800" />
                              {flag.replace('FORENSICS:', '').replace('YOLO:', '')}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-6">
                     <button
                       onClick={() => handleDownload(file.cid, file.fileName)}
                       className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white py-2.5 rounded-xl text-xs font-bold border border-white/5 transition-colors"
                     >
                       <Download className="w-4 h-4" /> View
                     </button>
                     <button
                       onClick={() => handleRemoveFile(file.cid)}
                       className="flex items-center justify-center gap-2 bg-red-500/5 hover:bg-red-500/10 text-red-500/70 py-2.5 rounded-xl text-xs font-bold border border-red-500/10 transition-colors"
                     >
                       <Trash2 className="w-4 h-4" /> Delete
                     </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 border border-dashed border-white/10 rounded-3xl bg-[#0a0a0a]">
            <Filter className="w-16 h-16 text-gray-800 mb-4" />
            <h3 className="text-xl font-bold text-gray-500">No Documents Found</h3>
            <button 
              onClick={() => setUploadOpen(true)} 
              className="mt-4 text-cyan-500 hover:text-cyan-400 font-bold flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add your first document
            </button>
          </div>
        )}
      </div>

      <UploadModal 
        isOpen={isUploadOpen} 
        onClose={() => setUploadOpen(false)}
        onUploadSuccess={() => { fetchFiles(); setUploadOpen(false); }}
      />
    </div>
  );
};

export default Dashboard;