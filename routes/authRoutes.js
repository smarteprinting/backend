const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/authController');
const { protect, admin } = require('../middleware/authMiddleware');

router.post('/login', authUser);
router.post('/send-registration-otp', sendRegistrationOTP);
router.post('/verify-registration-otp', verifyRegistrationOTP);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.route('/profile').get(protect, getUserProfile).put(protect, updateUserProfile);
router.route('/users').get(protect, admin, getUsers);
router.route('/users/:id').delete(protect, admin, deleteUser);
router.route('/users/:id/block').put(protect, admin, blockUser);
router.route('/users/:id/unblock').put(protect, admin, unblockUser);

module.exports = router;
