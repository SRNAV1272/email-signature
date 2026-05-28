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
    const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',');
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    next();
});

app.use('/api/proxy', proxyRouter);

// ✅ No stack traces in production
app.use((err, req, res, next) => {
    console.error(err);
    res.status(502).json({ error: 'Upstream error' });
});

app.listen(process.env.PORT || 3000, () => {
    console.log('Proxy running');
});