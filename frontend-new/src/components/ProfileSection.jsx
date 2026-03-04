import React, { useState } from 'react';
import { 
  X, User, Wallet, FileText, Landmark, LogOut, 
  ShieldCheck, RefreshCw, History, ExternalLink, Globe, DatabaseZap
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, ABI } from "../contractConfig";

const ProfileSection = ({ isOpen, onClose, walletAddress }) => {
  const [isSyncing, setIsSyncing] = useState(false);

  // Stats calculation directly from local vault
  const stats = JSON.parse(localStorage.getItem(walletAddress) || "[]");
  const govtDocs = stats.filter(f => f.isVerified).length;
  const personalDocs = stats.filter(f => !f.isVerified).length;

  /**
   * NEW: syncVaultFromBlockchain
   * Replaces redundant "Contact Info" with decentralized data recovery
   */
  const syncVaultFromBlockchain = async () => {
    if (!window.ethereum) return toast.error("MetaMask not found!");
    
    setIsSyncing(true);
    const syncToast = toast.loading("Syncing with Sepolia...");

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

      const onChainFiles = await contract.getFiles(walletAddress);

      const formatted = onChainFiles.map(f => ({
        cid: f.cid,
        fileName: f.fileName,
        date: new Date(Number(f.timestamp) * 1000).toISOString(),
        isVerified: f.isVerified,
        docHash: f.docHash,
        docType: f.isVerified ? 'govt' : 'personal',
        txHash: "Blockchain Sync"
      }));

      localStorage.setItem(walletAddress, JSON.stringify(formatted));
      toast.dismiss(syncToast);
      toast.success("Vault Recovered from Chain!");
      
      // Reload to reflect changes in Dashboard
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error("Sync Error:", error);
      toast.dismiss(syncToast);
      toast.error("Sync failed.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      {/* Dark Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity" 
          onClick={onClose} 
        />
      )}
      
      {/* Sidebar Panel */}
      <div className={`fixed top-0 right-0 h-full w-80 bg-[#0a0a0a] border-l border-white/10 z-[60] transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-6 flex flex-col h-full">
          
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-bold text-white">Identity Hub</h2>
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Wallet Identity Section */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/10 flex items-center justify-center border border-cyan-500/30 mb-4 relative overflow-hidden">
              <User className="w-10 h-10 text-cyan-500" />
              {govtDocs > 0 && (
                <div className="absolute -bottom-2 -right-2 bg-black p-1 rounded-full">
                  <ShieldCheck className="text-green-500 w-6 h-6" />
                </div>
              )}
            </div>
            <h3 className="text-lg font-bold text-white font-mono">
              {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "Not Connected"}
            </h3>
            <div className="flex items-center gap-1.5 mt-2 px-3 py-1 bg-cyan-500/5 border border-cyan-500/10 rounded-full">
              <Globe className="w-3 h-3 text-cyan-500" />
              <p className="text-[10px] text-cyan-500 font-bold uppercase tracking-widest">
                Sepolia Testnet
              </p>
            </div>
          </div>

          {/* Decentralized Controls (NEW) */}
          <div className="space-y-3 mb-8">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Data Management</p>
            
            <div className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-3">
              <button 
                onClick={syncVaultFromBlockchain}
                disabled={isSyncing}
                className="w-full flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg transition-colors group"
              >
                <div className="p-2 bg-cyan-500/10 rounded-lg group-hover:bg-cyan-500/20 transition-colors">
                  <RefreshCw className={`w-4 h-4 text-cyan-500 ${isSyncing ? 'animate-spin' : ''}`} />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-gray-200">Sync from Chain</p>
                  <p className="text-[10px] text-gray-500">Restore your local vault</p>
                </div>
              </button>

              <div className="flex items-center gap-3 p-2">
                <div className="p-2 bg-white/5 rounded-lg">
                  <DatabaseZap className="w-4 h-4 text-gray-500" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-gray-400">IPFS Protocol</p>
                  <p className="text-[10px] text-gray-600">Encrypted Content Pinned</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="space-y-3 mb-8">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Vault Analytics</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-white/5 rounded-xl border border-white/5 text-center group hover:border-cyan-500/30 transition-colors">
                <Landmark className="w-4 h-4 text-cyan-500 mx-auto mb-2" />
                <p className="text-xl font-bold text-white">{govtDocs}</p>
                <p className="text-[10px] text-gray-500 uppercase">Verified IDs</p>
              </div>
              <div className="p-4 bg-white/5 rounded-xl border border-white/5 text-center group hover:border-white/20 transition-colors">
                <FileText className="w-4 h-4 text-gray-400 mx-auto mb-2" />
                <p className="text-xl font-bold text-white">{personalDocs}</p>
                <p className="text-[10px] text-gray-500 uppercase">Secure Files</p>
              </div>
            </div>
          </div>

          {/* Connection Status & Logout */}
          <div className="mt-auto space-y-4">
            <div className="flex items-center gap-3 p-3 bg-green-500/5 border border-green-500/10 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-green-500 font-medium font-mono uppercase tracking-tight">Node: Verified Access</span>
            </div>

            <button 
              onClick={() => { 
                localStorage.removeItem('wallet_session');
                window.location.reload(); 
              }}
              className="w-full flex items-center justify-center gap-2 p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-colors font-bold text-sm group"
            >
              <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> 
              Disconnect Session
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProfileSection;