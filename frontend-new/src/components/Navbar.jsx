import React from 'react';
import { ShieldCheck, Wallet, Search, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';

const Navbar = ({ onProfileClick }) => { // Accept the prop here
  const { isConnected, walletAddress, connectWallet } = useAuth();

  return (
    <motion.nav 
      initial={{ y: -100 }} animate={{ y: 0 }}
      className="fixed top-0 w-full h-20 bg-black/30 backdrop-blur-lg border-b border-white/10 z-50 px-8 flex justify-between items-center shadow-lg shadow-cyan-500/5"
    >
      <div className="flex items-center gap-3">
        <div className="bg-gray-900 p-2 rounded-xl border border-white/10 shadow-[0_0_15px_rgba(6,182,212,0.5)]">
          <ShieldCheck className="text-cyan-400 w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-wider">
          Privacy<span className="text-cyan-400">Fy</span>
        </h1>
      </div>

      {isConnected && (
        <div className="hidden md:flex items-center bg-gray-900/50 px-4 py-2.5 rounded-xl border border-white/10 w-96 transition-all">
          <Search className="w-4 h-4 text-gray-400 mr-3" />
          <input type="text" placeholder="Search secure files..." className="bg-transparent outline-none text-sm w-full text-gray-200" />
        </div>
      )}

      <div>
        {isConnected ? (
          <div className="flex items-center gap-4 pl-6 border-l border-white/10">
             <div className="text-right hidden sm:block">
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Connected</p>
                <p className="text-sm font-bold text-cyan-400 font-mono">
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </p>
             </div>
             {/* 🖱️ CLICKABLE AVATAR: Triggers Sidebar */}
             <button 
                onClick={onProfileClick}
                className="h-10 w-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-[0_0_10px_rgba(6,182,212,0.6)] border border-white/20 hover:scale-110 transition-transform cursor-pointer"
             >
                {walletAddress.slice(2, 4).toUpperCase()}
             </button>
          </div>
        ) : (
          <button onClick={connectWallet} className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-6 py-2.5 rounded-xl font-bold">
            <Wallet className="w-4 h-4" /> Connect Wallet
          </button>
        )}
      </div>
    </motion.nav>
  );
};

export default Navbar;