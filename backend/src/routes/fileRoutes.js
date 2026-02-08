const express = require('express');
const multer = require('multer');
// CORRECTED: Added the .js extension to make the import path explicit
const { uploadFile, getFilesByOwner, verifyCertificate } = require('../controllers/filecontroller.js');

const router = express.Router();

// Use multer for memory storage to handle file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Route to handle encrypted file uploads to IPFS
router.post('/upload', upload.single('file'), uploadFile);

// Route to get all files for a specific wallet address
router.get('/files/:owner', getFilesByOwner);

// NEW: Route to handle certificate verification
router.post('/verify-certificate', upload.single('certificate'), verifyCertificate);

module.exports = router;

