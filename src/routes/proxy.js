const express = require('express');
const crypto = require('crypto');
const verifyToken = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');
const router = express.Router();

const AES_KEY = Buffer.from(process.env.AES_KEY ?? '', 'base64');
const AES_IV = Buffer.from(process.env.AES_IV ?? '', 'base64');

router.use(verifyToken);
router.use(rateLimiter);

function aesDecrypt(encryptedText, keyBuffer = AES_KEY) {
    if (!encryptedText) return '';
    try {
        const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, AES_IV);
        const decrypted = Buffer.concat([
            decipher.update(Buffer.from(encryptedText, 'base64')),
            decipher.final(),
        ]);
        return decrypted.toString('utf8');
    } catch (err) {
        console.error('AES decrypt failed:', err.message);
        return encryptedText; // graceful fallback
    }
}

function aesEncrypt(plaintext) {
    if (!plaintext?.trim()) return '';
    try {
        const cipher = crypto.createCipheriv('aes-256-cbc', AES_KEY, AES_IV);
        const encrypted = Buffer.concat([
            cipher.update(plaintext, 'utf8'),
            cipher.final(),
        ]);
        return encrypted.toString('base64');
    } catch (err) {
        console.error('AES encrypt failed:', err.message);
        return '';
    }
}

router.get('/signatures', async (req, res) => {
    const { user, xPlatform } = req.query;

    console.log(`\n--- /signatures REQUEST [${new Date().toISOString()}] ---`);
    console.log(`Query params : user="${user}" | xPlatform="${xPlatform}"`);

    try {
        const encryptedMail = aesEncrypt(user);
        console.log(`Encrypted mail : ${encryptedMail || '(empty — aesEncrypt returned nothing)'}`);

        const upstreamUrl = 'https://newqa-enterprise.cardbyte.ai/email-signature/html/outlook/get-active';
        const upstreamHeaders = { username: encryptedMail, 'X-Platform': xPlatform };

        console.log(`Upstream URL     : ${upstreamUrl}`);
        console.log(`Upstream headers : ${JSON.stringify(upstreamHeaders)}`);

        let primaryRes;
        try {
            primaryRes = await fetch(upstreamUrl, { method: 'GET', headers: upstreamHeaders });
        } catch (networkErr) {
            // fetch() itself threw — DNS failure, connection refused, timeout, etc.
            console.error(`[UPSTREAM NETWORK ERROR]`);
            console.error(`  Type    : ${networkErr.name}`);
            console.error(`  Message : ${networkErr.message}`);
            console.error(`  Stack   : ${networkErr.stack}`);
            return res.status(502).json({ error: 'Upstream network error', detail: networkErr.message });
        }

        console.log(`Upstream status  : ${primaryRes.status} ${primaryRes.statusText}`);
        console.log(`Upstream headers : ${JSON.stringify(Object.fromEntries(primaryRes.headers.entries()))}`);

        // Always read body — needed for error logging regardless of status
        const raw = await primaryRes.text();
        // console.log(`Upstream raw body (first 500 chars) : ${raw.slice(0, 500)}`);

        if (!primaryRes.ok) {
            console.error(`[UPSTREAM NON-OK]`);
            console.error(`  Status : ${primaryRes.status} ${primaryRes.statusText}`);
            console.error(`  Body   : ${raw}`);
            return res.status(502).json({
                error: 'Upstream returned non-OK response',
                upstreamStatus: primaryRes.status,
                upstreamBody: raw,
            });
        }

        let decrypted;
        try {
            decrypted = aesDecrypt(raw);
            // console.log(`Decrypted body (first 300 chars) : ${decrypted?.slice(0, 300)}`);
        } catch (decryptErr) {
            console.error(`[DECRYPT ERROR]`);
            console.error(`  Message : ${decryptErr.message}`);
            console.error(`  Raw     : ${raw}`);
            return res.status(502).json({ error: 'Failed to decrypt upstream response' });
        }

        let parsed;
        try {
            parsed = JSON.parse(decrypted);
            console.log(`Parsed JSON keys : ${Object.keys(parsed ?? {}).join(', ') || '(empty object)'}`);
        } catch (parseErr) {
            console.error(`[JSON PARSE ERROR]`);
            console.error(`  Message   : ${parseErr.message}`);
            console.error(`  Decrypted : ${decrypted}`);
            return res.status(502).json({ error: 'Failed to parse decrypted response as JSON' });
        }

        const html = parsed?.html ?? null;
        console.log(`html field : ${html ? `present (${html.length} chars)` : 'null / missing'}`);
        console.log(`--- END /signatures ---\n`);

        return res.json({ html });

    } catch (err) {
        console.error(`[UNHANDLED ERROR in /signatures]`);
        console.error(`  Name    : ${err.name}`);
        console.error(`  Message : ${err.message}`);
        console.error(`  Stack   : ${err.stack}`);
        return res.status(502).json({ error: 'Upstream error', detail: err.message });
    }
});

module.exports = router;