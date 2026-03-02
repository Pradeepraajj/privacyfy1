import React from 'react';
import { X, User, Wallet, FileText, Landmark, LogOut, ShieldCheck, Mail, Phone, ExternalLink } from 'lucide-react';

const ProfileSection = ({ isOpen, onClose, profile, walletAddress }) => {
  // Stats calculation
  const stats = JSON.parse(localStorage.getItem(walletAddress) || "[]");
  const govtDocs = stats.filter(f => f.isVerified).length;
  const personalDocs = stats.filter(f => !f.isVerified).length;

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
            <h2 className="text-xl font-bold text-white">Identity Profile</h2>
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Avatar & Basic Info */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-20 h-20 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/30 mb-4 relative">
              <User className="w-10 h-10 text-cyan-500" />
              {govtDocs > 0 && (
                <div className="absolute -bottom-2 -right-2 bg-black p-1 rounded-full">
                  <ShieldCheck className="text-green-500 w-6 h-6" />
                </div>
              )}
            </div>
            <h3 className="text-lg font-bold text-white">
              {profile?.display_name || profile?.name || "Anonymous User"}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 px-3 py-1 bg-white/5 rounded-full">
              <Wallet className="w-3 h-3 text-gray-500" />
              <p className="text-[10px] text-gray-400 font-mono truncate max-w-[120px]">
                {walletAddress}
              </p>
            </div>
          </div>

          {/* Detailed Profile Info (NEW) */}
          <div className="space-y-3 mb-8">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Contact Details</p>
            
            <div className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/5 rounded-lg">
                  <Mail className="w-4 h-4 text-cyan-500/70" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-gray-500 uppercase leading-none mb-1">Email</p>
                  <p className="text-sm text-gray-200 truncate">{profile?.email || "Not linked"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/5 rounded-lg">
                  <Phone className="w-4 h-4 text-cyan-500/70" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-gray-500 uppercase leading-none mb-1">Phone</p>
                  <p className="text-sm text-gray-200 truncate">{profile?.phone || "Not linked"}</p>
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
                <p className="text-[10px] text-gray-500 uppercase">Govt IDs</p>
              </div>
              <div className="p-4 bg-white/5 rounded-xl border border-white/5 text-center group hover:border-white/20 transition-colors">
                <FileText className="w-4 h-4 text-gray-400 mx-auto mb-2" />
                <p className="text-xl font-bold text-white">{personalDocs}</p>
                <p className="text-[10px] text-gray-500 uppercase">Personal</p>
              </div>
            </div>
          </div>

          {/* Connection Status & Logout */}
          <div className="mt-auto space-y-4">
            <div className="flex items-center gap-3 p-3 bg-green-500/5 border border-green-500/10 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-green-500 font-medium font-mono">Blockchain Active</span>
            </div>

            <button 
              onClick={() => { 
                // Clear any session storage if needed
                localStorage.removeItem('wallet_session');
                window.location.reload(); 
              }}
              className="w-full flex items-center justify-center gap-2 p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-colors font-bold text-sm group"
            >
              <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> 
              Log Out
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProfileSection;