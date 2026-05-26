import express from "express";
import cors from "cors";
import { webcrypto } from "crypto";
import { performance } from "perf_hooks";

const crypto = webcrypto;
const app = express();

/* --------------------------------------------------
   ✅ CORS
-------------------------------------------------- */
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['username', 'X-Platform', 'Accept', 'Content-Type'],
    preflightContinue: false,      // ← let cors() handle OPTIONS itself
    optionsSuccessStatus: 204      // ← IE11 chokes on 200 for OPTIONS
}));

// Then still add the explicit preflight as a hard fallback
app.options('/event-handler-classic', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'username, X-Platform, Accept, Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.sendStatus(204);
});

/* --------------------------------------------------
   Body parser
-------------------------------------------------- */
app.use(express.json({ limit: "10mb" }));

// Main mediator endpoint
app.get('/event-handler-classic', async (req, res) => {
    try {

        // Client will decrypt with handleAesDecrypt()
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('X-Response-Encrypted', 'true');
        res.status(200).send({ key: "success" });

        console.log('[Mediator] Encrypted response forwarded');

    } catch (error) {
        console.error('[Mediator] Error:', error.message);

        if (error.code === 'ECONNABORTED') {
            res.status(504).json({ error: 'Gateway timeout' });
        } else if (error.code === 'ENOTFOUND') {
            res.status(502).json({ error: 'Cannot reach CardByte API' });
        } else {
            res.status(500).json({ error: 'Internal server error', message: error.message });
        }
    }
});

/* --------------------------------------------------
   Express Error Handler (MUST BE LAST)
-------------------------------------------------- */
app.use((err, req, res, next) => {
    res.status(500).json({
        success: false,
        message: err?.message || "Internal Server Error",
    });
});

/* --------------------------------------------------
   Node Crash Guards (K8s SAFE)
-------------------------------------------------- */
process.on("unhandledRejection", err => {
    console.error("🔥 Unhandled Rejection:", err);
});

process.on("uncaughtException", err => {
    console.error("💥 Uncaught Exception:", err);
});

/* --------------------------------------------------
   Server
-------------------------------------------------- */
app.listen(4000, () => {
    console.log("🚀 Konva renderer running on port 4000");
});