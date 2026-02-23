import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../utils/supabaseClient';
import { User, Mail, ShieldCheck, Loader2 } from 'lucide-react';

const OnboardingModal = ({ walletAddress, onComplete }) => {
  const [formData, setFormData] = useState({ name: '', email: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase
      .from('profiles')
      .insert([
        { 
          wallet_address: walletAddress, 
          display_name: formData.name, 
          email: formData.email,
          is_verified: false 
        }
      ])
      .select()
      .single();

    if (error) {
      alert("Error saving profile: " + error.message);
    } else {
      onComplete(data);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-[#111] border border-cyan-500/30 p-8 rounded-3xl max-w-md w-full shadow-[0_0_50px_rgba(6,182,212,0.2)]">
        
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-cyan-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="text-cyan-400 w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-white">Setup Your Vault</h2>
          <p className="text-gray-400 text-sm mt-2">Link your identity to your wallet</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Full Name</label>
            <div className="relative mt-1">
              <User className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
              <input 
                required 
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white focus:border-cyan-500 outline-none" 
                placeholder="John Doe" 
                onChange={e => setFormData({...formData, name: e.target.value})} 
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Email Address</label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
              <input 
                required 
                type="email" 
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white focus:border-cyan-500 outline-none" 
                placeholder="john@example.com" 
                onChange={e => setFormData({...formData, email: e.target.value})} 
              />
            </div>
          </div>
          <button 
            disabled={loading}
            type="submit" 
            className="w-full py-4 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center"
          >
            {loading ? <Loader2 className="animate-spin mr-2" /> : "Initialize Profile"}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default OnboardingModal;