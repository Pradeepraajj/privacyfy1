require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const helmet = require('helmet');
const morgan = require('morgan');
const pool = require('./db');
const fileController = require('./src/controllers/filecontroller');

const app = express();

// 🛑 CHANGED TO 5001 TO AVOID ANY SILENT WINDOWS CONFLICTS
const PORT = 5001;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const upload = multer({
storage: multer.memoryStorage(),
limits: { fileSize: 10 * 1024 * 1024 }
});

app.get('/', (req, res) => {
res.send('✅ Backend is Running securely on Port 5001.');
});

app.get('/health', async (req, res) => {
try {
await pool.query('SELECT NOW()');
res.json({ status: 'OK', db: 'Connected to Supabase Vault' });
} catch (err) {
console.error('Database connection failed:', err);
res.status(500).json({ status: 'ERROR', db: 'Disconnected' });
}
});

app.post('/verify-document', upload.single('file'), fileController.verifyGovtId);

app.use((err, req, res, next) => {
console.error("🔥 Server Error:", err.stack);
res.status(500).json({ status: 'error', message: 'Internal Server Error.' });
});

// --- 🛡️ BULLETPROOF SERVER STARTUP ---
const server = app.listen(PORT, () => {
  console.log(`🚀 Server strictly locked onto http://localhost:${PORT}`);
  console.log(`🛡️  Security Shield (Helmet & Morgan): ACTIVE`);
});

// If the port is blocked, this catches it and screams the error!
server.on('error', (err) => {
  console.error('❌ FATAL SERVER ERROR:', err.message);
});

// If the server closes, this tells us EXACTLY why.
process.on('exit', (code) => {
  console.log(`🛑 Node Process Exited with code: ${code}`);
});
