const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const OTP = require('../models/OTP');
const jwt = require('jsonwebtoken');
const { generateOTP, sendOTPEmail } = require('../utils/emailService');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const authUser = asyncHandler(async (req, res) => {
    const { email, password, isAdminLogin } = req.body;
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
        // Check if user is blocked
        if (user.isBlocked) {
            res.status(403);
            throw new Error('Your account has been blocked by admin. Please contact support.');
        }

        // Strict Role Separation
        if (!isAdminLogin && user.isAdmin) {
            res.status(401);
            throw new Error('You are not our user');
        }

        if (isAdminLogin && !user.isAdmin) {
            res.status(401);
            throw new Error('Not authorized as an admin');
        }

        res.json({
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            name: user.name,
            email: user.email,
            isAdmin: user.isAdmin,
            token: generateToken(user._id),
        });
    } else {
        res.status(401);
        throw new Error('Invalid email or password');
    }
});

// @desc    Send OTP for registration
// @route   POST /api/auth/send-registration-otp
// @access  Public
const sendRegistrationOTP = asyncHandler(async (req, res) => {
    const { firstName, lastName, email, password } = req.body;

    const trimmedEmail = email.trim().toLowerCase();

    // Validate input
    if (!firstName || !lastName || !email || !password) {
        res.status(400);
        throw new Error('All fields are required');
    }

    // Check if user already exists
    const userExists = await User.findOne({ email: trimmedEmail });
    if (userExists) {
        res.status(400);
        throw new Error('User already exists');
    }

    // Generate and send OTP
    const otp = generateOTP();

    await sendOTPEmail(trimmedEmail, otp, 'registration');

    // Clean old OTPs
    await OTP.findOneAndDelete({ email: trimmedEmail, type: 'registration' });

    // Create new OTP record with registration data
    await OTP.create({
        email: trimmedEmail,
        otp,
        type: 'registration',
        registrationData: {
            firstName,
            lastName,
            password
        }
    });

    res.json({ message: 'OTP sent to your email' });
});

// @desc    Verify OTP and register user
// @route   POST /api/auth/verify-registration-otp
// @access  Public
const verifyRegistrationOTP = asyncHandler(async (req, res) => {
    const { email, otp } = req.body;

    const trimmedEmail = email.trim().toLowerCase();

    // Verify OTP
    const otpRecord = await OTP.findOne({ 
        email: trimmedEmail, 
        otp, 
        type: 'registration' 
    });

    if (!otpRecord) {
        res.status(400);
        throw new Error('Invalid or expired OTP');
    }

    const { registrationData } = otpRecord;

    // Check if user already exists
    const existingUser = await User.findOne({ email: trimmedEmail });
    if (existingUser) {
        res.status(400);
        throw new Error('User already exists with this email');
    }

    try {
        // Create user
        const user = await User.create({
            firstName: registrationData.firstName,
            lastName: registrationData.lastName,
            name: `${registrationData.firstName} ${registrationData.lastName}`,
            email: trimmedEmail,
            password: registrationData.password,
        });

        // Clean up OTP
        await OTP.deleteOne({ _id: otpRecord._id });

        if (user) {
            // Success response WITHOUT token
            res.status(201).json({
                message: 'Account verified successfully. Please log in.',
                email: user.email
            });
        } else {
            res.status(400);
            throw new Error('Invalid user data');
        }
    } catch (error) {
        res.status(500);
        throw new Error('Failed to create user: ' + error.message);
    }
});

// @desc    Send OTP for password reset
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;

    const trimmedEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: trimmedEmail });
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    // Generate and send OTP
    const otp = generateOTP();

    await sendOTPEmail(trimmedEmail, otp, 'password-reset');

    // Clean old OTPs
    await OTP.findOneAndDelete({ email: trimmedEmail, type: 'reset' });

    // Store OTP in DB
    await OTP.create({
        email: trimmedEmail,
        otp,
        type: 'reset'
    });

    res.json({ message: 'Password reset OTP sent to your email' });
});

// @desc    Verify OTP and reset password
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = asyncHandler(async (req, res) => {
    const { email, otp, newPassword } = req.body;

    const trimmedEmail = email.trim().toLowerCase();

    // Verify OTP
    const otpRecord = await OTP.findOne({ 
        email: trimmedEmail, 
        otp, 
        type: 'reset' 
    });

    if (!otpRecord) {
        res.status(400);
        throw new Error('Invalid or expired OTP');
    }

    // Update password
    const user = await User.findOne({ email: trimmedEmail });
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    user.password = newPassword;
    await user.save();

    // Clean up OTP
    await OTP.deleteOne({ _id: otpRecord._id });

    res.json({ message: 'Password reset successfully' });
});

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (user) {
        res.json({
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            name: user.name,
            email: user.email,
            isAdmin: user.isAdmin,
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateUserProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (user) {
        user.firstName = req.body.firstName || user.firstName;
        user.lastName = req.body.lastName || user.lastName;
        user.name = `${user.firstName} ${user.lastName}`;
        user.email = req.body.email || user.email;

        if (req.body.password) {
            user.password = req.body.password;
        }

        const updatedUser = await user.save();

        res.json({
            _id: updatedUser._id,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            name: updatedUser.name,
            email: updatedUser.email,
            isAdmin: updatedUser.isAdmin,
            token: generateToken(updatedUser._id),
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

// @desc    Get all users
// @route   GET /api/auth/users
// @access  Private/Admin
const getUsers = asyncHandler(async (req, res) => {
    const pageSize = Number(req.query.limit) || 20;
    const page = Number(req.query.page) || 1;
    const search = req.query.search || '';

    let query = {};

    if (search) {
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { firstName: { $regex: search, $options: 'i' } },
            { lastName: { $regex: search, $options: 'i' } }
        ];
    }

    // Sort users by creation date if timestamps exist, or _id
    const count = await User.countDocuments(query);
    const users = await User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .limit(pageSize)
        .skip(pageSize * (page - 1));

    res.json({ users, page, pages: Math.ceil(count / pageSize), total: count });
});

// @desc    Delete user
// @route   DELETE /api/auth/users/:id
// @access  Private/Admin
const deleteUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);

        if (user) {
            if (user.isAdmin) {
                return res.status(400).json({ message: 'Cannot delete admin user' });
            }
            await user.deleteOne();
            res.json({ message: 'User removed' });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        next(error);
    }
};

// @desc    Block user
// @route   PUT /api/auth/users/:id/block
// @access  Private/Admin
const blockUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);

        if (user) {
            if (user.isAdmin) {
                return res.status(400).json({ message: 'Cannot block admin user' });
            }
            user.isBlocked = true;
            await user.save();
            res.json({ message: 'User blocked successfully' });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        next(error);
    }
};

// @desc    Unblock user
// @route   PUT /api/auth/users/:id/unblock
// @access  Private/Admin
const unblockUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);

        if (user) {
            user.isBlocked = false;
            await user.save();
            res.json({ message: 'User unblocked successfully' });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        next(error);
    }
};

module.exports = {
    authUser,
    sendRegistrationOTP,
    verifyRegistrationOTP,
    forgotPassword,
    resetPassword,
    getUserProfile,
    updateUserProfile,
    getUsers,
    deleteUser,
    blockUser,
    unblockUser
};
