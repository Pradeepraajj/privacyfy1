import { CONTRACT_ADDRESS, ABI } from "../contractConfig";
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import CryptoJS from 'crypto-js';
import axios from 'axios';
import { 
  FileText, Download, Trash2, Plus, Search, Loader2, 
  ShieldAlert, Landmark, FileUser, Filter, ExternalLink 
} from 'lucide-react'; // Added ExternalLink for blockchain explorer
import toast from 'react-hot-toast'; 
import UploadModal from './UploadModal'; 
import { ethers } from 'ethers'; // Added ethers

const Dashboard = () => {
  const { walletAddress, isConnected } = useAuth();
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterType, setFilterType] = useState('all'); 
  const [searchTerm, setSearchTerm] = useState('');
  const [isUploadOpen, setUploadOpen] = useState(false);

  // ... (convertWordArrayToUint8Array logic remains the same)

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

  // NEW: Helper to open Etherscan
  const viewOnBlockchain = (txHash) => {
    window.open(`https://sepolia.etherscan.io/tx/${txHash}`, '_blank');
  };
  // Fix for line 170
  const handleDownload = async (cid, fileName) => {
    toast.success(`Downloading ${fileName}...`);
    // Opens the file from IPFS in a new tab
    window.open(`https://gateway.pinata.cloud/ipfs/${cid}`, '_blank');
  };

  // Fix for line 176
  const handleRemoveFile = (cid) => {
    const updatedFiles = files.filter(f => f.cid !== cid);
    localStorage.setItem(walletAddress, JSON.stringify(updatedFiles));
    setFiles(updatedFiles);
    toast.success("File removed from local view.");
  };
  // ... (handleDownload and handleRemoveFile remain the same)

  const filteredFiles = files.filter(file => {
    const matchesSearch = file.fileName && file.fileName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' 
      ? true 
      : filterType === 'govt' 
        ? (file.docType === 'govt') 
        : (file.docType === 'personal' || !file.docType); 
    
    return matchesSearch && matchesType;
  });

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center px-4">
        <ShieldAlert className="w-16 h-16 text-gray-600 mb-4" />
        <h2 className="text-2xl font-bold text-gray-300">Wallet Not Connected</h2>
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
                    {type === 'govt' ? 'Govt IDs' : type}
                  </button>
                ))}
             </div>

             <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                <input 
                  type="text" placeholder="Search..." 
                  value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#111] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-gray-200 focus:outline-none focus:border-cyan-500/50"
                />
             </div>

             <button 
               onClick={() => setUploadOpen(true)}
               className="bg-cyan-500 hover:bg-cyan-400 text-black px-5 py-2.5 rounded-xl font-bold shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap"
             >
               <Plus className="w-5 h-5" /> Upload New
             </button>
          </div>
        </div>

        {/* GRID VIEW */}
        {isLoading ? (
           <div className="flex justify-center py-20">
             <Loader2 className="w-10 h-10 text-cyan-500 animate-spin" />
           </div>
        ) : filteredFiles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <AnimatePresence>
              {filteredFiles.map((file, index) => (
                <motion.div
                  key={file.cid + index}
                  className="group bg-[#111] rounded-2xl p-5 border border-white/5 hover:border-cyan-500/30 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="h-32 bg-black/40 rounded-xl mb-4 flex items-center justify-center group-hover:bg-cyan-500/10 transition-colors relative overflow-hidden">
                      {file.docType === 'govt' ? (
                        <Landmark className="w-12 h-12 text-cyan-500/70 group-hover:text-cyan-400 transition-colors" />
                      ) : (
                        <FileUser className="w-12 h-12 text-gray-600 group-hover:text-cyan-400 transition-colors" />
                      )}
                      
                      {/* NEW: Blockchain Badge */}
                      {file.txHash && (
                        <button 
                          onClick={() => viewOnBlockchain(file.txHash)}
                          className="absolute top-2 right-2 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded text-[10px] text-green-400 font-bold uppercase tracking-wider flex items-center gap-1 hover:bg-green-500/20"
                        >
                          Secured <ExternalLink className="w-2 h-2" />
                        </button>
                      )}
                    </div>

                    <h3 className="font-bold text-gray-200 truncate">{file.fileName}</h3>
                    <p className="text-xs text-gray-500 mt-1 flex justify-between">
                      {new Date(file.date).toLocaleDateString()}
                      <span className="capitalize text-gray-600">{file.docType || 'Personal'}</span>
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-5">
                     <button
                       onClick={() => handleDownload(file.cid, file.fileName)}
                       className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg text-xs font-semibold"
                     >
                       <Download className="w-3 h-3" /> Download
                     </button>
                     <button
                       onClick={() => handleRemoveFile(file.cid)}
                       className="flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 py-2 rounded-lg text-xs font-semibold border border-red-500/10"
                     >
                       <Trash2 className="w-3 h-3" /> Remove
                     </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 border border-dashed border-white/10 rounded-3xl bg-white/5">
            <div className="bg-white/5 p-6 rounded-full mb-6 ring-1 ring-white/10">
              <Filter className="w-12 h-12 text-gray-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-300">No Documents Found</h3>
            <p className="text-gray-500 mt-2 mb-6">
              {filterType === 'all' ? "Your vault is empty." : `No ${filterType} documents found.`}
            </p>
            <button onClick={() => setUploadOpen(true)} className="text-cyan-400 hover:text-cyan-300 text-sm font-semibold underline underline-offset-4">
              Upload New File
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