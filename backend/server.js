require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');

// ✅ UPDATED PATH: Pointing inside 'src/controllers'
// Make sure the file name matches exactly (fileController vs filecontroller)
const fileController = require('./src/controllers/fileController');

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Configure Multer (Memory Storage - keeps file in RAM)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // Limit to 10MB
});

// --- ROUTES ---

// 1. Basic Test
app.get('/', (req, res) => {
    res.send('✅ Backend is Running! Privacyfy Server is Online.');
});

// 2. AI Verification Route (The one Frontend calls)
app.post('/verify-document', upload.single('file'), fileController.verifyGovtId);

// 3. Existing Routes (Optional - Un-comment if you use them)
// app.use('/api/files', require('./src/routes/fileRoutes')); 

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📂 AI Worker ready at /verify-document`);
});