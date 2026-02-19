const pinataSDK = require('@pinata/sdk');
const { Readable } = require('stream');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
require('dotenv').config();

// ✅ IMPORT SERVICE
// Ensure opensslService.js is updated to the Synchronous version
const { verifySignature } = require('../services/opensslService');

// Initialize Pinata SDK
const pinata = new pinataSDK(process.env.PINATA_API_KEY, process.env.PINATA_SECRET_API_KEY);

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// --- 1. IPFS UPLOAD CONTROLLER ---
exports.uploadFile = async (req, res) => {
  const { walletAddress, fileName } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: "No file was uploaded." });
  }
  if (!walletAddress || !fileName) {
    return res.status(400).json({ error: "Missing wallet address or file name." });
  }

  const stream = Readable.from(req.file.buffer);
  const options = {
    pinataMetadata: {
      name: fileName,
      keyvalues: { owner: walletAddress },
    },
  };

  try {
    const result = await pinata.pinFileToIPFS(stream, options);
    const { IpfsHash } = result;
    
    // Optional: Save to DB if you have a 'files' table
    // const newFile = await pool.query(
    //   "INSERT INTO files (filename, cid, owner_wallet) VALUES ($1, $2, $3) RETURNING *",
    //   [fileName, IpfsHash, walletAddress]
    // );
    
    console.log('File uploaded successfully to IPFS:', IpfsHash);
    res.status(201).json({ message: "File uploaded successfully!", cid: IpfsHash });
  } catch (error) {
    console.error("Error during file upload:", error);
    res.status(500).json({ error: "Failed to upload file to IPFS." });
  }
};

// --- 2. GET FILES CONTROLLER ---
exports.getFilesByOwner = async (req, res) => {
  try {
    const ownerWallet = req.params.owner;
    const { rows } = await pool.query(
      "SELECT * FROM files WHERE owner_wallet = $1 ORDER BY upload_date DESC",
      [ownerWallet]
    );
    res.status(200).json({ files: rows });
  } catch (error) {
    console.error("Error fetching files:", error);
    res.status(500).json({ error: "Failed to retrieve files from database." });
  }
};

// --- 3. AI GOVERNMENT ID VERIFICATION (The "Brain") ---
exports.verifyGovtId = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No document uploaded for verification." });
  }

  // Use a temp folder for processing
  const tempDir = path.join(__dirname, '../../temp_uploads');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const tempFilePath = path.join(tempDir, `scan-${Date.now()}.jpg`);

  try {
    // Write buffer to disk so Python can read it
    fs.writeFileSync(tempFilePath, req.file.buffer);

    // Point to the 'doc_validator' engine
    const pythonScriptPath = path.join(__dirname, '../../doc_validator/main.py');
    
    // Debug: Check if script exists
    if (!fs.existsSync(pythonScriptPath)) {
         console.error("CRITICAL: Python script not found at:", pythonScriptPath);
         return res.status(500).json({ error: "Server AI Configuration Error" });
    }

    // Pass wallet address as the second argument
    // Use 'python' or 'python3' depending on your system alias
    const pythonProcess = spawn('python', [
        pythonScriptPath, 
        tempFilePath, 
        req.body.walletAddress || "0xUnknown"
    ]);

    let dataString = '';
    let errorString = '';

    pythonProcess.stdout.on('data', (data) => {
      dataString += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorString += data.toString();
    });

    pythonProcess.on('close', (code) => {
      // Cleanup: Delete the temp file (Privacy!)
      try {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      } catch (cleanupErr) {
        console.error("Warning: Could not delete temp file:", cleanupErr);
      }

      if (code !== 0) {
        console.error("Python Script Error:", errorString);
        return res.status(500).json({ valid: false, message: "AI Analysis failed to run." });
      }

      try {
        // --- 🧠 SMART PARSING LOGIC ---
        // The output contains logs, YOLO download bars, and one valid JSON line.
        // We split by newlines and look for the JSON object from the bottom up.
        
        const lines = dataString.trim().split('\n');
        let jsonResult = null;

        // Iterate backwards because the JSON is usually the last thing printed
        for (let i = lines.length - 1; i >= 0; i--) {
            try {
                // Try to parse the line
                const potentialJson = JSON.parse(lines[i]);
                
                // Check if it has our expected fields
                if (potentialJson.status) { 
                    jsonResult = potentialJson;
                    break; // Found it! Stop searching.
                }
            } catch (e) {
                // Not JSON, skip this line
                continue;
            }
        }

        if (!jsonResult) {
            throw new Error("No valid JSON found in Python output. Raw output: " + dataString);
        }

        console.log("🦁 AI Verdict:", jsonResult);
        // -----------------------------

        // --- SIGNING LOGIC ---
        if (jsonResult.status === "LIKELY_AUTHENTIC" || jsonResult.status === "NEEDS_REVIEW") {
            const payload = {
                valid: true,
                docType: jsonResult.document_type,
                timestamp: Date.now(),
                risk: jsonResult.risk_level
            };

            // ✅ Synchronous Call (No 'await')
            // This works because we updated opensslService.js to be synchronous
            const signature = verifySignature ? verifySignature(payload) : "DEV_SIGNATURE"; 
            
            console.log("🔐 Generated Signature:", signature);

            res.status(200).json({
                valid: true,
                message: jsonResult.status === "LIKELY_AUTHENTIC" ? "Verification Successful" : "Verified (Review Needed)",
                ...jsonResult,
                signature: signature
            });
        } else {
            // REJECTED
            res.status(200).json({
                valid: false,
                message: "Verification Failed: " + (jsonResult.flags[0] || "Unknown Risk"),
                ...jsonResult
            });
        }
        // ---------------------

      } catch (parseError) {
        console.error("JSON Parse Error:", parseError);
        console.error("Raw Output was:", dataString);
        res.status(500).json({ valid: false, message: "Invalid response from AI engine." });
      }
    });

  } catch (error) {
    // Cleanup on crash
    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    console.error("Verification Controller Error:", error);
    res.status(500).json({ error: "Internal Server Error during verification" });
  }
};