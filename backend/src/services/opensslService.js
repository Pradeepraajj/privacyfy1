const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

/**
 * Verifies the digital signature of a certificate file using OpenSSL.
 * @param {Buffer} fileBuffer The buffer of the certificate file to verify.
 * @returns {Promise<object>} A promise that resolves with the verification result.
 */
const verifySignature = (fileBuffer) => {
  return new Promise(async (resolve, reject) => {
    const tempDir = os.tmpdir();
    // Create a unique temporary file path to avoid conflicts
    const tempFilePath = path.join(tempDir, `cert_${Date.now()}.pem`);

    try {
      // Write the uploaded file buffer to a temporary file
      await fs.writeFile(tempFilePath, fileBuffer);

      // The OpenSSL command to verify a signed file.
      // It extracts the certificate, gets the public key, and verifies the signature.
      // NOTE: This command assumes a standard format. It may need adjustment
      // for specific certificate types (e.g., PKCS#7, etc.).
      const command = `openssl smime -verify -in ${tempFilePath} -noverify -inform PEM`;

      // Execute the OpenSSL command
      exec(command, (error, stdout, stderr) => {
        if (error) {
          // Command execution failed. This usually means the signature is invalid.
          console.error('OpenSSL stderr:', stderr);
          return resolve({
            isVerified: false,
            status: 'Verification failed',
            details: stderr || 'Invalid signature or malformed file.',
          });
        }

        // If the command executes successfully, the signature is valid.
        resolve({
          isVerified: true,
          status: 'Verification successful',
          details: stdout, // Contains the signed content
        });
      });
    } catch (err) {
      console.error('Error during file verification process:', err);
      reject('An internal error occurred during verification.');
    } finally {
      // Clean up by deleting the temporary file
      try {
        await fs.unlink(tempFilePath);
      } catch (cleanupError) {
        // Log if cleanup fails, but don't reject the promise for this
        console.error('Failed to delete temporary file:', tempFilePath, cleanupError);
      }
    }
  });
};

module.exports = {
  verifySignature,
};
