import React from 'react';
import { Download, Wallet, UploadCloud, ShieldCheck, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

const steps = [
  {
    id: 1,
    title: "Install MetaMask",
    desc: "Add the browser extension to interact with the blockchain.",
    icon: <Download className="w-8 h-8 text-cyan-400" />,
  },
  {
    id: 2,
    title: "Connect Wallet",
    desc: "Login securely using your unique crypto wallet address.",
    icon: <Wallet className="w-8 h-8 text-cyan-400" />,
  },
  {
    id: 3,
    title: "Upload Document",
    desc: "Select your file. It gets encrypted instantly in your browser.",
    icon: <UploadCloud className="w-8 h-8 text-cyan-400" />,
  },
  {
    id: 4,
    title: "Approve & Store",
    desc: "Confirm the transaction to save the record permanently.",
    icon: <ShieldCheck className="w-8 h-8 text-cyan-400" />,
  },
];

const HowItWorks = () => {
  return (
    <section className="py-24 bg-black relative border-t border-white/10">
      {/* Background Glow Effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-full bg-cyan-500/5 blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Getting Started is <span className="text-cyan-400">Simple</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Secure your digital identity in just 4 easy steps. No sign-ups, no passwords—just your wallet.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
          
          {/* Connecting Line (Desktop Only) */}
          <div className="hidden lg:block absolute top-12 left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-cyan-500/0 via-cyan-500/20 to-cyan-500/0 -z-10" />

          {steps.map((step, index) => (
            <motion.div 
              key={step.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="group relative flex flex-col items-center text-center"
            >
              
              {/* Icon Circle */}
              <div className="w-24 h-24 rounded-full bg-[#111] border border-white/10 flex items-center justify-center mb-6 group-hover:border-cyan-500/50 group-hover:shadow-[0_0_30px_rgba(6,182,212,0.2)] transition-all duration-300 relative z-10">
                <div className="absolute inset-0 bg-cyan-500/10 rounded-full scale-0 group-hover:scale-100 transition-transform duration-300" />
                {step.icon}
                
                {/* Step Number Badge */}
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-gray-900 border border-white/10 rounded-full flex items-center justify-center text-sm font-bold text-gray-400 group-hover:text-cyan-400 group-hover:border-cyan-500 transition-colors">
                  {step.id}
                </div>
              </div>

              {/* Text Content */}
              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors">
                {step.title}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed px-2">
                {step.desc}
              </p>

              {/* Arrow for Mobile (Visual Flow) */}
              {index < steps.length - 1 && (
                <ArrowRight className="lg:hidden w-6 h-6 text-gray-700 mt-6 rotate-90" />
              )}
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default HowItWorks;