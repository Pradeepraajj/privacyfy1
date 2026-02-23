import React from 'react';
import { X, User, Wallet, FileText, Landmark, LogOut, ShieldCheck } from 'lucide-react';

const ProfileSection = ({ isOpen, onClose, profile, walletAddress }) => {
  // Stats calculation
  const stats = JSON.parse(localStorage.getItem(walletAddress) || "[]");
  const govtDocs = stats.filter(f => f.isVerified).length;
  const personalDocs = stats.filter(f => !f.isVerified).length;

  return (
    <>
      {/* Dark Overlay */}
      {isOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />}
      
      {/* Sidebar Panel */}
      <div className={`fixed top-0 right-0 h-full w-80 bg-[#0a0a0a] border-l border-white/10 z-[60] transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-6 flex flex-col h-full">
          
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-bold text-white">Identity Profile</h2>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg"><X className="w-5 h-5" /></button>
          </div>

          {/* User Info */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-20 h-20 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/30 mb-4 relative">
              <User className="w-10 h-10 text-cyan-500" />
              {profile?.isVerified && <ShieldCheck className="absolute -bottom-2 -right-2 text-green-500 bg-black rounded-full w-6 h-6" />}
            </div>
            <h3 className="text-lg font-bold text-white">{profile?.name || "Pending Verification"}</h3>
            <p className="text-xs text-gray-500 font-mono mt-1 break-all px-4">{walletAddress}</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 mb-8">
            <div className="p-4 bg-white/5 rounded-xl border border-white/5 text-center">
              <Landmark className="w-4 h-4 text-cyan-500 mx-auto mb-2" />
              <p className="text-xl font-bold text-white">{govtDocs}</p>
              <p className="text-[10px] text-gray-500 uppercase">Govt IDs</p>
            </div>
            <div className="p-4 bg-white/5 rounded-xl border border-white/5 text-center">
              <FileText className="w-4 h-4 text-gray-400 mx-auto mb-2" />
              <p className="text-xl font-bold text-white">{personalDocs}</p>
              <p className="text-[10px] text-gray-500 uppercase">Personal</p>
            </div>
          </div>

          {/* Connection Status */}
          <div className="mt-auto space-y-4">
            <div className="flex items-center gap-3 p-3 bg-green-500/5 border border-green-500/10 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-green-500 font-medium font-mono">MetaMask Connected</span>
            </div>

            <button 
              onClick={() => { window.location.reload(); /* Basic Logout for now */ }}
              className="w-full flex items-center justify-center gap-2 p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-colors font-bold text-sm"
            >
              <LogOut className="w-4 h-4" /> Log Out
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProfileSection;