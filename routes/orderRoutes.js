const express = require('express');
const router = express.Router();
const {
    addOrderItems,
    createCloverPayment,
    getOrderById,
    updateOrderToPaid,
    updateOrderStatus,
    getMyOrders,
    getOrders,
    checkReviewEligibility
} = require('../controllers/orderController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/').post(protect, addOrderItems).get(protect, admin, getOrders);
router.route('/check-review-eligibility/:productId').get(protect, checkReviewEligibility);
router.route('/clover/pay').post(protect, createCloverPayment);

router.route('/myorders').get(protect, getMyOrders);
router.route('/:id').get(getOrderById);
router.route('/:id/pay').put(protect, updateOrderToPaid);
router.route('/:id/status').put(protect, admin, updateOrderStatus);

module.exports = router;
