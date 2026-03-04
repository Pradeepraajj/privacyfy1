import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
// Removed: Supabase client import as we are ditching the centralized database
import Navbar from './components/Navbar';
import Hero from './components/Hero'; 
import Dashboard from './components/Dashboard';
import ProfileSection from './components/ProfileSection';
// Removed: OnboardingModal as wallet address is the only identity needed
import HowItWorks from './components/HowItWorks';
import Footer from './components/Footer';
import useAntiTracker from './hooks/useAntiTracker';
import { AlertTriangle } from 'lucide-react'; // Added for inline error handling

const AppContent = () => {
  const { isConnected, walletAddress } = useAuth();
  const [isProfileOpen, setProfileOpen] = useState(false);
  // Removed: userProfile state as identity is now derived from walletAddress

  /**
   * REFINED: Profile logic
   * We no longer fetch from Supabase. The ProfileSection will now 
   * internally pull stats from localStorage using the walletAddress.
   */

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col relative">
      {/* 🛠️ NEW: Inline MetaMask Error Handling */}
      {!window.ethereum && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-orange-500/20 border-b border-orange-500/50 p-3 flex items-center justify-center gap-2 text-orange-400 text-sm backdrop-blur-md">
          <AlertTriangle className="w-4 h-4" />
          <span>MetaMask extension not detected. Please install it to anchor documents to the blockchain.</span>
        </div>
      )}

      <Navbar onProfileClick={() => setProfileOpen(true)} />
      
      {/* REMOVED: showOnboarding logic. 
        In a dApp, the user is "onboarded" the moment they connect their wallet.
      */}

      <ProfileSection 
        isOpen={isProfileOpen} 
        onClose={() => setProfileOpen(false)} 
        // Updated: Pass only the walletAddress; ProfileSection handles its own local data
        walletAddress={walletAddress}
      />

      <main className="flex-grow pt-24"> 
        {/* Updated: Dashboard no longer needs a 'profile' prop from a database */}
        {isConnected ? <Dashboard /> : <Hero />}
        <HowItWorks />
      </main>
      <Footer />
    </div>
  );
};

function App() {
  useAntiTracker();
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;