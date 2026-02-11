import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-scroll';

const Hero = () => {
  const titleVariants = {
    hidden: { opacity: 0, y: -50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } },
  };

  const subtitleVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, delay: 0.4, ease: "easeOut" } },
  };

  return (
    <div className="h-screen flex items-center justify-center text-center overflow-hidden relative">
      {/* Optional: Animated background particles/stars would go here */}
      <div className="z-10">
        <motion.h1
          variants={titleVariants}
          initial="hidden"
          animate="visible"
          className="text-6xl md:text-8xl font-extrabold text-white"
          style={{ textShadow: '0 0 20px rgba(0, 194, 255, 0.7)' }}
        >
          PrivacyFy
        </motion.h1>
        <motion.p
          variants={subtitleVariants}
          initial="hidden"
          animate="visible"
          className="text-xl md:text-2xl text-gray-300 mt-4 max-w-2xl mx-auto"
        >
          Your Decentralized Digital Vault. Secure, Private, Unstoppable.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          <Link to="upload" smooth={true} duration={500} offset={-70}>
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: "0px 0px 15px rgba(0, 194, 255, 0.8)" }}
              whileTap={{ scale: 0.95 }}
              className="mt-10 bg-primary-blue text-white font-bold py-4 px-10 rounded-xl text-lg transition duration-300"
            >
              Get Started
            </motion.button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
};

export default Hero;
