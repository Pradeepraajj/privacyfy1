import { ethers } from "ethers";
import FileRegistryABI from "../abis/FileRegistry.json";

// 🟢 YOUR DEPLOYED ADDRESS (From your terminal)
const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; 

export const getContract = async () => {
  if (window.ethereum) {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return new ethers.Contract(contractAddress, FileRegistryABI.abi, signer);
  } else {
    throw new Error("MetaMask not found!");
  }
};

export const saveFileToBlockchain = async (cid, fileName) => {
    try {
        const contract = await getContract();
        console.log(`Saving to blockchain: ${fileName} (${cid})`);
        
        // Call the smart contract function
        const tx = await contract.addFile(cid, fileName);
        
        // Wait for the transaction to be confirmed
        await tx.wait();
        console.log("Transaction Confirmed:", tx.hash);
        return tx.hash;
    } catch (error) {
        console.error("Blockchain Error:", error);
        throw error;
    }
};