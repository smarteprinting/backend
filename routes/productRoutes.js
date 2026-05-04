const express = require('express');
const router = express.Router();
const { getProducts, getProductById, createProduct, updateProduct, deleteProduct, createProductReview, updateProductReview, deleteProductReview, upload, uploadExcel, getSearchSuggestions, bulkUploadProducts } = require('../controllers/productController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
    .get(getProducts)
    .post(protect, admin, upload.array('images', 50), createProduct);

router.route('/:id/reviews')
    .post(protect, createProductReview)
    .put(protect, updateProductReview)
    .delete(protect, deleteProductReview);

router.route('/bulk-upload').post(protect, admin, uploadExcel.single('excelFile'), bulkUploadProducts);

router.route('/search/suggestions').get(getSearchSuggestions);

router.route('/:id')
    .get(getProductById)
    .put(protect, admin, upload.array('images', 50), updateProduct)
    .delete(protect, admin, deleteProduct);

module.exports = router;
