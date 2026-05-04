const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const {
    getSettings,
    updateSettings,
    registerPrinter,
    simpleLogin
} = require('../controllers/setupController');

// Custom middleware for setup admin that doesn't use DB
const setupAdminAuth = (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            // Just check if it has the isAdmin flag we set in simpleLogin
            if (decoded.isAdmin) {
                req.user = { _id: decoded.id, isAdmin: true };
                return next();
            }
        } catch (error) {
            console.error(error);
        }
    }

    // Fallback to existing auth for real DB admins
    // Note: We'll just throw 401 if simple auth fails here for simplicity
    res.status(401);
    throw new Error('Not authorized as an admin');
};

router.get('/header-visibility', getSettings);
router.post('/header-visibility', setupAdminAuth, updateSettings);
router.post('/register', registerPrinter);
router.post('/login-simple', simpleLogin);

module.exports = router;
