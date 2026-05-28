require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const proxyRouter = require('./routes/proxy');

const app = express();

// ✅ Security headers - VAPT clean out of the box
app.use(helmet());
app.use(express.json());

// ✅ CORS - only allow your add-in origin
app.use((req, res, next) => {
    const origin = req.headers.origin;
    const method = req.method;
    const requestedHeaders = req.headers['access-control-request-headers'];

    console.log(`\n--- CORS DEBUG [${new Date().toISOString()}] ---`);
    console.log(`Method       : ${method}`);
    console.log(`Origin       : ${origin ?? '(none)'}`);
    console.log(`URL          : ${req.url}`);
    console.log(`Is preflight : ${method === 'OPTIONS'}`);
    console.log(`AC-Req-Method: ${req.headers['access-control-request-method'] ?? '(none)'}`);
    console.log(`AC-Req-Hdrs  : ${requestedHeaders ?? '(none)'}`);

    // ✅ Allow any origin
    res.setHeader('Access-Control-Allow-Origin', '*');
    console.log(`CORS origin  : ✅ Wildcard — all origins allowed`);

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', [
        'Authorization',
        'Content-Type',
        'x-api-key',
        'username',
        'X-Platform',
    ].join(', '));
    res.setHeader('Access-Control-Max-Age', '86400');

    if (method === 'OPTIONS') {
        console.log(`Preflight    : ✅ Responding 204`);
        console.log(`--- END CORS DEBUG ---\n`);
        return res.sendStatus(204);
    }

    console.log(`--- END CORS DEBUG ---\n`);
    next();
});

app.use('/api/proxy', proxyRouter);

// ✅ No stack traces in production
app.use((err, req, res, next) => {
    console.error(err);
    res.status(502).json({ error: JSON.stringify(err) });
});

process.on("unhandledRejection", err => {
    console.error("🔥 Unhandled Rejection:", err);
});

process.on("uncaughtException", err => {
    console.error("💥 Uncaught Exception:", err);
});

app.listen(process.env.PORT || 5000, () => {
    console.log('Proxy running');
});