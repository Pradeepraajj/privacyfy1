import React, { createContext, useState, useContext, useEffect } from 'react';
import { ethers } from 'ethers';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [walletAddress, setWalletAddress] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  // 1. Check for Session on Load
  useEffect(() => {
    // Only auto-connect if we have a FLAG in sessionStorage
    const isSessionActive = sessionStorage.getItem("walletConnected");
    
    if (isSessionActive === "true") {
      checkIfWalletIsConnected();
    }

    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
    }
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      }
    };
  }, []);

  const checkIfWalletIsConnected = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          const web3Provider = new ethers.BrowserProvider(window.ethereum);
          const newSigner = await web3Provider.getSigner();
          setProvider(web3Provider);
          setSigner(newSigner);
          setWalletAddress(accounts[0]);
          setIsConnected(true);
          // Ensure session is set (in case this was a refresh)
          sessionStorage.setItem("walletConnected", "true");
        }
      } catch (error) {
        console.error("Connection check failed", error);
      }
    }
  };

  const handleAccountsChanged = (accounts) => {
    if (accounts.length > 0) {
      setWalletAddress(accounts[0]);
      setIsConnected(true);
      sessionStorage.setItem("walletConnected", "true");
      window.location.reload(); 
    } else {
      disconnectWallet();
    }
  };

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const web3Provider = new ethers.BrowserProvider(window.ethereum);
        // Force the popup to show
        const accounts = await web3Provider.send('eth_requestAccounts', []);
        
        if (accounts.length > 0) {
          const newSigner = await web3Provider.getSigner();
          setProvider(web3Provider);
          setSigner(newSigner);
          setWalletAddress(accounts[0]);
          setIsConnected(true);
          
          // SET THE FLAG: "User has manually logged in this session"
          sessionStorage.setItem("walletConnected", "true");
        }
      } catch (error) {
        console.error("Error connecting:", error);
      }
    } else {
      alert("Please install MetaMask!");
    }
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
    setProvider(null);
    setSigner(null);
    setIsConnected(false);
    
    // REMOVE THE FLAG: Next time they load, they must click Connect
    sessionStorage.removeItem("walletConnected");
  };

  const value = {
    walletAddress,
    provider,
    signer,
    isConnected,
    connectWallet,
    disconnectWallet,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);