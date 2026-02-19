import { ethers } from "ethers";
import FileRegistryABI from "../abis/FileRegistry.json";

// 🟢 YOUR DEPLOYED ADDRESS (From your terminal)
// Change this line in your blockchain.js!
const contractAddress = "0x69564A68058F541357F310B0FA26Fb9b6cF5Abd5";

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