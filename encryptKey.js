const crypto = require('crypto');
const fs = require('fs');
require('dotenv').config();

const algorithm = 'aes-256-cbc';
const key = crypto.randomBytes(32);
const iv = crypto.randomBytes(16); 

function encrypt(text) {
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

const openaiApiKey = process.env.OPENAI_API_KEY;
const encryptedApiKey = encrypt(openaiApiKey);

fs.writeFileSync('.encrypted.env', `ENCRYPTED_API_KEY=${encryptedApiKey}\nKEY=${key.toString('hex')}\nIV=${iv.toString('hex')}\n`);

console.log('API Key encrypted and saved to .encrypted.env');
