const crypto = require('crypto');

// Generate a temporary key pair for signing (In production, load this from .env)
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
});

exports.verifySignature = (data) => {
  try {
    // 1. Convert the JSON object to a String
    const dataString = JSON.stringify(data);

    // 2. Create a Sign object
    const sign = crypto.createSign('SHA256');
    sign.update(dataString);
    sign.end();

    // 3. Generate Signature using the Private Key
    const signature = sign.sign(privateKey, 'hex');
    
    return signature;
  } catch (error) {
    console.error("Signing Error:", error);
    return "SIGNING_FAILED";
  }
};

// Optional: Helper to verify (if needed later)
exports.validateSignature = (data, signature) => {
    const verify = crypto.createVerify('SHA256');
    verify.update(JSON.stringify(data));
    verify.end();
    return verify.verify(publicKey, signature, 'hex');
};