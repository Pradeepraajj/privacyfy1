import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../utils/supabaseClient';
import { User, Mail, ShieldCheck, Loader2, Phone } from 'lucide-react';

const OnboardingModal = ({ walletAddress, onComplete }) => {
  // Added 'phone' to the state
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Upsert ensures that if the user already exists, it updates their info 
      // instead of crashing with a "Duplicate Key" error.
      const { data, error } = await supabase
        .from('profiles')
        .upsert([
          { 
            wallet_address: walletAddress.toLowerCase(), 
            display_name: formData.name, 
            email: formData.email,
            phone: formData.phone, // Sending phone to Supabase
            is_verified: false,
            updated_at: new Date()
          }
        ])
        .select()
        .single();

      if (error) throw error;

      // Notify parent component that onboarding is done
      onComplete(data);
    } catch (error) {
      console.error("Onboarding Error:", error);
      alert("Error saving profile: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }}
        className="bg-[#111] border border-cyan-500/30 p-8 rounded-3xl max-w-md w-full shadow-[0_0_50px_rgba(6,182,212,0.2)]"
      >
        
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-cyan-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="text-cyan-400 w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-white">Setup Your Vault</h2>
          <p className="text-gray-400 text-sm mt-2">Link your identity to your wallet</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* FULL NAME */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Full Name</label>
            <div className="relative mt-1">
              <User className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
              <input 
                required 
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white focus:border-cyan-500 outline-none transition-all" 
                placeholder="John Doe" 
                onChange={e => setFormData({...formData, name: e.target.value})} 
              />
            </div>
          </div>

          {/* EMAIL ADDRESS */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Email Address</label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
              <input 
                required 
                type="email" 
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white focus:border-cyan-500 outline-none transition-all" 
                placeholder="john@example.com" 
                onChange={e => setFormData({...formData, email: e.target.value})} 
              />
            </div>
          </div>

          {/* PHONE NUMBER (New Field) */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Phone Number</label>
            <div className="relative mt-1">
              <Phone className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
              <input 
                required 
                type="tel" 
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white focus:border-cyan-500 outline-none transition-all" 
                placeholder="+91 98765 43210" 
                onChange={e => setFormData({...formData, phone: e.target.value})} 
              />
            </div>
          </div>

          <button 
            disabled={loading}
            type="submit" 
            className="w-full py-4 mt-4 bg-cyan-500 hover:bg-cyan-400 disabled:bg-gray-700 disabled:cursor-not-allowed text-black font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin mr-2" />
                <span>Creating Vault...</span>
              </>
            ) : "Initialize Profile"}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default OnboardingModal;