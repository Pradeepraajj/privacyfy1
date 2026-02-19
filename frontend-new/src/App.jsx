import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Hero from './components/Hero'; 
import Dashboard from './components/Dashboard';
import HowItWorks from './components/HowItWorks';
import Footer from './components/Footer';

// 1. Import the new Anti-Tracker Shield
import useAntiTracker from './hooks/useAntiTracker';

const AppContent = () => {
  const { isConnected } = useAuth();

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-cyan-500 selection:text-black flex flex-col">
      <Navbar />
      
      <main className="flex-grow pt-24"> 
        {/* Main View Switcher */}
        {isConnected ? (
          <Dashboard />
        ) : (
          <Hero />
        )}

        {/* "How It Works" Section - VISIBLE ALWAYS */}
        <div className="mt-20">
          <HowItWorks />
        </div>
      </main>

      <Footer />
    </div>
  );
};

function App() {
  // 🛡️ Activate the anti-fingerprinting shield on global app load
  useAntiTracker();

  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;