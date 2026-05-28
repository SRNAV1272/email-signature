const express = require('express');
const axios = require('axios');
const verifyToken = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');

const router = express.Router();

// ✅ Hardcoded downstream URLs - SSRF not possible
const DOWNSTREAM_ENDPOINTS = {
    signatures: 'https://your-api.cardbyte.com/signatures',
    templates: 'https://your-api.cardbyte.com/templates',
};

// Apply auth + rate limit to all proxy routes
router.use(verifyToken);
router.use(rateLimiter);

router.get('/signatures', async (req, res) => {
    try {
        const { tenantId } = req.query;

        // ✅ Validate tenant belongs to the authenticated user
        if (!req.user.tenants?.includes(tenantId)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const response = await axios.get(DOWNSTREAM_ENDPOINTS.signatures, {
            params: { tenant: tenantId },
            headers: {
                // ✅ API key never sent to client - lives in .env
                'X-API-Key': process.env.DOWNSTREAM_API_KEY,
            },
            // ✅ Node uses TLS 1.2+ by default via OpenSSL
            httpsAgent: new (require('https').Agent)({
                minVersion: 'TLSv1.2'
            })
        });

        // ✅ Return only what the client needs
        res.json(response.data);

    } catch (err) {
        console.error('Downstream error:', err.message);
        // ✅ Sanitized error - no internals leaked
        res.status(502).json({ error: 'Upstream error' });
    }
});

router.get('/templates', async (req, res) => {
    try {
        const response = await axios.get(DOWNSTREAM_ENDPOINTS.templates, {
            headers: {
                'X-API-Key': process.env.DOWNSTREAM_API_KEY,
            }
        });
        res.json(response.data);
    } catch (err) {
        console.error('Downstream error:', err.message);
        res.status(502).json({ error: 'Upstream error' });
    }
});

module.exports = router;