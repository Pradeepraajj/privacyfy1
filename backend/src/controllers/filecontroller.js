const pinataSDK = require('@pinata/sdk');
const { Readable } = require('stream');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
require('dotenv').config();

// ✅ IMPORT SERVICE: Assuming services is inside src/services (siblings)
// If this fails, try: require('../../services/opensslService');
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
    const newFile = await pool.query(
      "INSERT INTO files (filename, cid, owner_wallet) VALUES ($1, $2, $3) RETURNING *",
      [fileName, IpfsHash, walletAddress]
    );
    console.log('File uploaded successfully:', newFile.rows[0]);
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

  // ✅ PATH FIX 1: Go up TWO levels (../../) to reach backend root
  const tempDir = path.join(__dirname, '../../temp_uploads');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const tempFilePath = path.join(tempDir, `scan-${Date.now()}.jpg`);

  try {
    // Write buffer to disk so Python can read it
    fs.writeFileSync(tempFilePath, req.file.buffer);

    // ✅ PATH FIX 2: Go up TWO levels (../../) to reach ai folder
    const pythonScriptPath = path.join(__dirname, '../../ai/verify.py');
    
    // Debug: Check if script exists
    if (!fs.existsSync(pythonScriptPath)) {
         console.error("CRITICAL: Python script not found at:", pythonScriptPath);
         return res.status(500).json({ error: "Server AI Configuration Error" });
    }

    const pythonProcess = spawn('python', [pythonScriptPath, tempFilePath]);

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
        const result = JSON.parse(dataString);
        console.log("🦁 AI Verdict:", result);

        // --- ✅ NEW: OPENSSL SIGNING LOGIC ---
        if (result.valid) {
            const payload = {
                valid: true,
                docType: result.checks.id_pattern_found || "Government ID",
                timestamp: Date.now() // Add timestamp to prevent replay attacks
            };

            // Sign the payload
            const signature = verifySignature(payload); 
            console.log("🔐 Generated Signature:", signature);

            // Send Result + Signature
            res.status(200).json({
                ...result,
                signature: signature
            });
        } else {
            // If invalid, just send the result (no signature)
            res.status(200).json(result);
        }
        // -------------------------------------

      } catch (parseError) {
        console.error("JSON Parse Error:", dataString);
        res.status(500).json({ valid: false, message: "Invalid response from AI engine." });
      }
    });

  } catch (error) {
    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    console.error("Verification Controller Error:", error);
    res.status(500).json({ error: "Internal Server Error during verification" });
  }
};