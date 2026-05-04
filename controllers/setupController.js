const asyncHandler = require('express-async-handler');
const SetupSettings = require('../models/SetupSettings');
const PrinterRegistration = require('../models/PrinterRegistration');
const jwt = require('jsonwebtoken');

function triStateOnDefaultTrue(v) {
    if (v === false || v === 'false' || v === 0 || v === '0') return false;
    if (v === true || v === 'true' || v === 1 || v === '1') return true;
    return true;
}

/** Plain JSON with every boolean set (GET/POST never omit keys — fixes client `!== false` defaults). */
function normalizeSetupSettingsDoc(doc) {
    const o = doc && typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
    return {
        _id: o._id,
        showHeader: Boolean(o.showHeader),
        showLogo: Boolean(o.showLogo),
        allowModelSearch: o.allowModelSearch !== false,
        showInstallationFailed: o.showInstallationFailed !== false,
        showCompleteSetup: o.showCompleteSetup !== false,
        allowSelectYourBrandFlow: triStateOnDefaultTrue(o.allowSelectYourBrandFlow),
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
    };
}

const generateToken = (id) => {
    return jwt.sign({ id, isAdmin: true }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// @desc    Simplified Admin Login (Non-DB)
// @route   POST /api/admin/login-simple
// @access  Public
const simpleLogin = asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    if (username === 'admin' && password === 'password123') {
        res.json({
            _id: 'setup-admin-id',
            name: 'Setup Admin',
            isAdmin: true,
            token: generateToken('setup-admin-id'),
        });
    } else {
        res.status(401);
        throw new Error('Invalid setup admin credentials');
    }
});

// @desc    Get setup settings
// @route   GET /api/admin/header-visibility
// @access  Public
const getSettings = asyncHandler(async (req, res) => {
    let settings = await SetupSettings.findOne();
    if (!settings) {
        settings = await SetupSettings.create({
            showHeader: false,
            showLogo: false,
            allowModelSearch: true,
            showInstallationFailed: true,
            showCompleteSetup: true,
            allowSelectYourBrandFlow: true,
        });
    } else if (settings.allowSelectYourBrandFlow == null) {
        settings.allowSelectYourBrandFlow = true;
        await settings.save();
    }
    res.json(normalizeSetupSettingsDoc(settings));
});

// @desc    Update setup settings
// @route   POST /api/admin/header-visibility
// @access  Private/Admin
const updateSettings = asyncHandler(async (req, res) => {
    const { showHeader, showLogo, allowModelSearch, showInstallationFailed, showCompleteSetup, allowSelectYourBrandFlow } = req.body;

    // Debug log incoming values
    console.log('Incoming settings update:', req.body);

    // Ensure only one SetupSettings document exists
    const allSettings = await SetupSettings.find();
    if (allSettings.length > 1) {
        // Remove all but the first
        for (let i = 1; i < allSettings.length; i++) {
            await SetupSettings.findByIdAndDelete(allSettings[i]._id);
        }
    }

    let settings = await SetupSettings.findOne();

    if (settings) {
        if (settings.allowSelectYourBrandFlow == null) {
            settings.allowSelectYourBrandFlow = true;
        }
        settings.showHeader = showHeader !== undefined ? showHeader : settings.showHeader;
        settings.showLogo = showLogo !== undefined ? showLogo : settings.showLogo;
        settings.allowModelSearch = allowModelSearch !== undefined ? allowModelSearch : settings.allowModelSearch;
        settings.showInstallationFailed = showInstallationFailed !== undefined ? showInstallationFailed : settings.showInstallationFailed;
        settings.showCompleteSetup = showCompleteSetup !== undefined ? showCompleteSetup : settings.showCompleteSetup;
        if (allowSelectYourBrandFlow !== undefined) {
            settings.allowSelectYourBrandFlow = triStateOnDefaultTrue(allowSelectYourBrandFlow);
        }

        const updatedSettings = await settings.save();
        console.log('Updated settings in DB:', updatedSettings);
        res.json({ success: true, settings: normalizeSetupSettingsDoc(updatedSettings) });
    } else {
        const newSettings = await SetupSettings.create({
            showHeader: showHeader !== undefined ? showHeader : false,
            showLogo: showLogo !== undefined ? showLogo : false,
            allowModelSearch: allowModelSearch !== undefined ? allowModelSearch : true,
            showInstallationFailed: showInstallationFailed !== undefined ? showInstallationFailed : true,
            showCompleteSetup: showCompleteSetup !== undefined ? showCompleteSetup : true,
            allowSelectYourBrandFlow: allowSelectYourBrandFlow !== undefined ? triStateOnDefaultTrue(allowSelectYourBrandFlow) : true,
        });
        console.log('Created new settings in DB:', newSettings);
        res.json({ success: true, settings: normalizeSetupSettingsDoc(newSettings) });
    }
});

// @desc    Register printer setup
// @route   POST /api/admin/register
// @access  Public
const registerPrinter = asyncHandler(async (req, res) => {
    const { name, email, phone, model, agree } = req.body;

    const registration = await PrinterRegistration.create({
        name,
        email,
        phone,
        model,
        agree
    });

    if (registration) {
        res.status(201).json({
            success: true,
            message: 'Registration successful',
            data: registration
        });
    } else {
        res.status(400);
        throw new Error('Invalid registration data');
    }
});

module.exports = {
    getSettings,
    updateSettings,
    registerPrinter,
    simpleLogin
};