const rateLimit = require('express-rate-limit');

module.exports = rateLimit({
    windowMs: 60 * 1000,       // 1 minute window
    max: 60,                    // 60 requests per minute per IP
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({ error: 'Too many requests' });
    }
});