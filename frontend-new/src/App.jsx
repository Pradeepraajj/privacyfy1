import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { supabase } from './utils/supabaseClient'; // Make sure this file exists
import Navbar from './components/Navbar';
import Hero from './components/Hero'; 
import Dashboard from './components/Dashboard';
import ProfileSection from './components/ProfileSection';
import OnboardingModal from './components/OnboardingModal'; // 🆕 Import New Modal
import HowItWorks from './components/HowItWorks';
import Footer from './components/Footer';
import useAntiTracker from './hooks/useAntiTracker';

const AppContent = () => {
  const { isConnected, walletAddress } = useAuth();
  const [isProfileOpen, setProfileOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  // 1. Check if user exists in Supabase when wallet connects
  useEffect(() => {
    const fetchProfile = async () => {
      if (isConnected && walletAddress) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('wallet_address', walletAddress)
          .single();

        if (error && error.code === 'PGRST116') {
          // No profile found in Supabase
          setShowOnboarding(true);
        } else if (data) {
          setUserProfile(data);
          setShowOnboarding(false);
        }
      }
    };

    fetchProfile();
  }, [isConnected, walletAddress]);

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col">
      <Navbar onProfileClick={() => setProfileOpen(true)} />
      
      {/* Show Onboarding if wallet is connected but no profile exists */}
      {showOnboarding && (
        <OnboardingModal 
          walletAddress={walletAddress} 
          onComplete={(newProfile) => {
            setUserProfile(newProfile);
            setShowOnboarding(false);
          }} 
        />
      )}

      <ProfileSection 
        isOpen={isProfileOpen} 
        onClose={() => setProfileOpen(false)} 
        profile={userProfile} // 🆕 Pass Supabase data instead of localStorage
        walletAddress={walletAddress}
      />

      <main className="flex-grow pt-24"> 
        {isConnected ? <Dashboard profile={userProfile} /> : <Hero />}
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