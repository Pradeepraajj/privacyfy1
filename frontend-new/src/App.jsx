import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Hero from './components/Hero'; 
import Dashboard from './components/Dashboard';
import HowItWorks from './components/HowItWorks'; // Ensure this is imported
import Footer from './components/Footer';

const AppContent = () => {
  const { isConnected } = useAuth();

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-cyan-500 selection:text-black flex flex-col">
      <Navbar />
      
      <main className="flex-grow pt-24"> 
        {/* 1. Main View Switcher */}
        {isConnected ? (
          <Dashboard />
        ) : (
          <Hero />
        )}

        {/* 2. "How It Works" Section - NOW VISIBLE ALWAYS */}
        {/* We add a margin-top (mt-20) to separate it from the dashboard/hero content */}
        <div className="mt-20">
          <HowItWorks />
        </div>
      </main>

      <Footer />
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;