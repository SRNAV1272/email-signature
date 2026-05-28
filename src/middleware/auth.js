module.exports = function verifyApiKey(req, res, next) {
    const key = req.headers['x-api-key'];
    // if (!key) return res.status(401).json({ error: 'Unauthorized' });
    // if (key !== process.env.ADDIN_API_KEY) return res.status(401).json({ error: 'Unauthorized' });
    next();
};