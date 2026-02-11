import React from 'react';
import { motion } from 'framer-motion';

const Footer = () => {
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 1, delay: 0.5 }}
      className="bg-black bg-opacity-30 border-t border-gray-800 py-8"
    >
      <div className="container mx-auto px-6 text-center text-gray-500">
        <h3 className="text-xl font-bold text-white mb-2">
          Privacy<span className="text-glow-cyan">Fy</span>
        </h3>
        <p className="mb-4">Secure, Private, Unstoppable.</p>
        <div className="flex justify-center space-x-6 mb-4">
          {/* Replace with your actual links */}
          <a href="#" className="hover:text-white transition-colors duration-300">GitHub</a>
          <a href="#" className="hover:text-white transition-colors duration-300">Twitter</a>
          <a href="#" className="hover:text-white transition-colors duration-300">Contact</a>
        </div>
        <p className="text-sm">
          &copy; {new Date().getFullYear()} PrivacyFy. All Rights Reserved.
        </p>
      </div>
    </motion.footer>
  );
};

export default Footer;
