const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');
const Product = require('../models/Product');
const Order = require('../models/Order');
const multer = require('multer');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const XLSX = require('xlsx');

// Cloudinary Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});
const storage = multer.memoryStorage();

function checkFileType(file, cb) {
    const filetypes = /jpg|jpeg|png|webp/i;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true);
    } else {
        cb('Images only (jpg, jpeg, png, webp)!');
    }
}

const uploadExcel = multer({
    storage: multer.memoryStorage(),
    fileFilter: function (req, file, cb) {
        const filetypes = /xlsx|xls/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb('Excel files only!');
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

const upload = multer({
    storage,
    fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Helper function to upload to Cloudinary
const uploadToCloudinary = async (buffer, filename) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: 'products',
                public_id: `${Date.now()}-${filename}`,
                resource_type: 'image',
                transformation: [
                    { width: 800, height: 800, crop: 'limit' },
                    { quality: 'auto' }
                ]
            },
            (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result.secure_url);
                }
            }
        );
        uploadStream.end(buffer);
    });
};

// @desc    Fetch all products
// @route   GET /api/products
// @access  Public
const getProducts = asyncHandler(async (req, res) => {
    const categoryName = req.query.category;
    const search = req.query.search;
    const brand = req.query.brand;
    const sort = req.query.sort;
    // Structured attribute filters
    const technology = req.query.technology;
    const usageCategory = req.query.usageCategory;
    const allInOneType = req.query.allInOneType;
    const wireless = req.query.wireless;
    const mainFunction = req.query.mainFunction;

    let query = {};
    
    if (categoryName && categoryName !== 'undefined' && categoryName !== 'null') {
        const Category = require('../models/Category');
        const category = await Category.findOne({ name: { $regex: new RegExp(`^${categoryName}$`, 'i') } });
        if (category) {
            query.category = category._id;
        } else {
            // Category provided but not found -> return empty set
            return res.json({ products: [], page: 1, pages: 0, total: 0 });
        }
    }

    if (search) {
        query.$or = [
            { title: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
            { shortDetails: { $regex: search, $options: 'i' } },
            { shortSpecification: { $regex: search, $options: 'i' } },
            { overview: { $regex: search, $options: 'i' } },
            { technicalSpecification: { $regex: search, $options: 'i' } },
            { brand: { $regex: search, $options: 'i' } },
            { color: { $regex: search, $options: 'i' } },
            { width: { $regex: search, $options: 'i' } },
            { height: { $regex: search, $options: 'i' } },
            { depth: { $regex: search, $options: 'i' } },
            { screenSize: { $regex: search, $options: 'i' } }
        ];
    }

    // Structured attribute filters
    if (technology) {
        query.technology = technology;
    }
    if (usageCategory) {
        // usageCategory can be comma-separated
        const values = Array.isArray(usageCategory) ? usageCategory : usageCategory.split(',');
        query.usageCategory = { $in: values };
    }
    if (allInOneType) {
        query.allInOneType = allInOneType;
    }
    if (wireless) {
        query.wireless = wireless;
    }
    if (mainFunction) {
        // mainFunction can be comma-separated
        const values = Array.isArray(mainFunction) ? mainFunction : mainFunction.split(',');
        query.mainFunction = { $in: values };
    }

    if (brand && brand !== 'undefined' && brand !== 'null') {
        query.brand = { $regex: brand, $options: 'i' };
    }

    let sortOption = {};
    if (sort === 'lowToHigh') {
        sortOption.price = 1;
    } else if (sort === 'highToLow') {
        sortOption.price = -1;
    }

    const pageSize = Number(req.query.limit) || 20;
    const page = Number(req.query.page) || 1;

    const count = await Product.countDocuments(query);
    const products = await Product.find(query)
        .populate('category', 'name')
        .sort(sortOption)
        .limit(pageSize)
        .skip(pageSize * (page - 1));

    res.json({ products, page, pages: Math.ceil(count / pageSize), total: count });
});

// @desc    Fetch single product
// @route   GET /api/products/:id
// @access  Public
const getProductById = asyncHandler(async (req, res) => {
    let product;
    
    const idOrSlug = req.params.id;

    if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
        product = await Product.findById(idOrSlug).populate('category', 'name');
    } else {
        // 1. Search by exact slug
        product = await Product.findOne({ slug: idOrSlug }).populate('category', 'name');

        // 2. Fallback: Search by title (fuzzy/regex)
        if (!product) {
            // Convert slug back to a potential title pattern (dashes to spaces, etc.)
            const titlePattern = idOrSlug.replace(/-/g, ' ');
            product = await Product.findOne({
                title: { $regex: new RegExp(`^${titlePattern}$`, 'i') }
            }).populate('category', 'name');
        }

        // 3. Last Resort Fallback: Match any product where title contains most of the slug
        // (helpful if "-admin" was appended or minor differences exist)
        if (!product) {
            const parts = idOrSlug.split('-');
            const firstFewParts = parts.slice(0, Math.min(parts.length, 3)).join(' ');
            if (firstFewParts.length > 5) {
                product = await Product.findOne({
                    title: { $regex: new RegExp(firstFewParts, 'i') }
                }).populate('category', 'name');
            }
        }
    }

    if (product) {
        res.json(product);
    } else {
        res.status(404);
        throw new Error('Product not found');
    }
});

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
const createProduct = asyncHandler(async (req, res) => {
    try {
        let imageUrls = [];
        if (req.files && req.files.length > 0) {
            // Upload images to Cloudinary
            const uploadPromises = req.files.map(file =>
                uploadToCloudinary(file.buffer, file.originalname)
            );
            imageUrls = await Promise.all(uploadPromises);
        } else if (req.body.images) {
            imageUrls = typeof req.body.images === 'string' ? JSON.parse(req.body.images) : req.body.images;
        }

        const {
            title, brand, category, price, oldPrice, countInStock, description,
            shortDetails, shortSpecification, overview, technicalSpecification,
            color, width, height, depth, screenSize, reviews,
            technology, usageCategory, allInOneType, wireless, mainFunction
        } = req.body;

        // Parse all array fields from form-data
        const parseArrayField = (field) => {
            if (!field) return [];
            if (Array.isArray(field)) return field;
            if (typeof field === 'string') {
                try {
                    // Try JSON parse first
                    return JSON.parse(field);
                } catch {
                    // Fallback: comma-separated
                    return field.split(',').map(v => v.trim()).filter(Boolean);
                }
            }
            return [];
        };

        if (!title || !price || !category) {
            res.status(400);
            throw new Error('Please provide title, price, and category');
        }

        if (!req.user) {
            res.status(401);
            throw new Error('Not authorized, user not found');
        }

        let parsedReviews = [];
        if (reviews) {
            parsedReviews = typeof reviews === 'string' ? JSON.parse(reviews) : reviews;
        }

        const slug = title.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, "-");

        const product = new Product({
            user: req.user._id,
            title,
            slug,
            brand: brand || 'Generic',
            category,
            price: Number(price) || 0,
            oldPrice: oldPrice ? Number(oldPrice) : 0,
            countInStock: Number(countInStock) || 0,
            description: description || '',
            shortDetails,
            shortSpecification,
            overview,
            technicalSpecification,
            images: imageUrls,
            color, width, height, depth, screenSize,
            reviews: parsedReviews,
            numReviews: parsedReviews.length,
            rating: parsedReviews.length > 0
                ? parsedReviews.reduce((acc, item) => item.rating + acc, 0) / parsedReviews.length
                : 0,
            technology: parseArrayField(technology),
            usageCategory: parseArrayField(usageCategory),
            allInOneType: parseArrayField(allInOneType),
            wireless,
            mainFunction: parseArrayField(mainFunction)
        });

        const createdProduct = await product.save();
        res.status(201).json(createdProduct);
    } catch (error) {
        res.status(res.statusCode === 200 ? 500 : res.statusCode);
        throw error;
    }
});

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
const updateProduct = asyncHandler(async (req, res) => {
    const {
        title, brand, category, price, oldPrice, countInStock, description,
        shortDetails, shortSpecification, overview, technicalSpecification,
        color, width, height, depth, screenSize, reviews,
        technology, usageCategory, allInOneType, wireless, mainFunction
    } = req.body;

    // Parse all array fields from form-data
    const parseArrayField = (field) => {
        if (!field) return [];
        if (Array.isArray(field)) return field;
        if (typeof field === 'string') {
            try {
                // Try JSON parse first
                return JSON.parse(field);
            } catch {
                // Fallback: comma-separated
                return field.split(',').map(v => v.trim()).filter(Boolean);
            }
        }
        return [];
    };

    const product = await Product.findById(req.params.id);

    if (product) {
        product.title = title || product.title;
        product.slug = title ? title.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, "-") : product.slug;
        product.brand = brand || product.brand;
        product.category = category || product.category;
        product.price = price || product.price;
        product.oldPrice = oldPrice ?? product.oldPrice;
        product.countInStock = countInStock ?? product.countInStock;
        product.description = description || product.description;
        product.shortDetails = shortDetails ?? product.shortDetails;
        product.shortSpecification = shortSpecification ?? product.shortSpecification;
        product.overview = overview ?? product.overview;
        product.technicalSpecification = technicalSpecification ?? product.technicalSpecification;
        product.color = color ?? product.color;
        product.width = width ?? product.width;
        product.height = height ?? product.height;
        product.depth = depth ?? product.depth;
        product.screenSize = screenSize ?? product.screenSize;
        product.technology = technology ? parseArrayField(technology) : product.technology;
        product.usageCategory = usageCategory ? parseArrayField(usageCategory) : product.usageCategory;
        product.allInOneType = allInOneType ? parseArrayField(allInOneType) : product.allInOneType;
        product.wireless = wireless ?? product.wireless;
        product.mainFunction = mainFunction ? parseArrayField(mainFunction) : product.mainFunction;

        // Image Update Logic
        let currentImages = [];
        if (req.body.existingImages) {
            currentImages = typeof req.body.existingImages === 'string' ? JSON.parse(req.body.existingImages) : req.body.existingImages;
        } else if (req.body.images) {
            // Fallback for backward compatibility or direct API usage
            currentImages = typeof req.body.images === 'string' ? JSON.parse(req.body.images) : req.body.images;
        } else {
            currentImages = product.images;
        }

        if (req.files && req.files.length > 0) {
            // Upload new images to Cloudinary
            const uploadPromises = req.files.map(file =>
                uploadToCloudinary(file.buffer, file.originalname)
            );
            const newImageUrls = await Promise.all(uploadPromises);
            product.images = [...currentImages, ...newImageUrls];
        } else {
            product.images = currentImages;
        }

        // Reviews Update Logic (Admin can add multiple reviews)
        if (reviews) {
            const parsedReviews = typeof reviews === 'string' ? JSON.parse(reviews) : reviews;
            product.reviews = parsedReviews;
            product.numReviews = parsedReviews.length;
            product.rating = parsedReviews.length > 0 
                ? parsedReviews.reduce((acc, item) => item.rating + acc, 0) / parsedReviews.length 
                : 0;
        }

        const updatedProduct = await product.save();
        res.json(updatedProduct);
    } else {
        res.status(404);
        throw new Error('Product not found');
    }
});

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
const deleteProduct = asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);

    if (product) {
        await product.deleteOne();
        res.json({ message: 'Product removed' });
    } else {
        res.status(404);
        throw new Error('Product not found');
    }
});

// @desc    Bulk upload products from Excel
// @route   POST /api/products/bulk-upload
// @access  Private/Admin
const bulkUploadProducts = asyncHandler(async (req, res) => {
    if (!req.file) {
        res.status(400);
        throw new Error('No file uploaded');
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    const Category = require('../models/Category');
    const products = [];
    const errors = [];

    for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        try {
            const categoryName = row.category || row.Category;
            let category = null;
            if (categoryName) {
                category = await Category.findOne({ name: { $regex: new RegExp(`^${categoryName}$`, 'i') } });
            }

            if (!category) {
                errors.push(`Row ${i + 2}: Category "${categoryName}" not found`);
                continue;
            }

            const productData = {
                user: req.user._id,
                brand: row.brand || row.Brand || '',
                title: row.title || row.Title || row.name || row.Name || '',
                category: category._id,
                description: row.description || row.Description || '',
                price: parseFloat(row.price || row.Price || 0),
                oldPrice: parseFloat(row.oldPrice || row['Old Price'] || 0),
                countInStock: parseInt(row.countInStock || row['Count In Stock'] || row.stock || row.Stock || 0),
                shortDetails: row.shortDetails || row['Short Details'] || '',
                shortSpecification: row.shortSpecification || row['Short Specification'] || '',
                overview: row.overview || row.Overview || '',
                technicalSpecification: row.technicalSpecification || row['Technical Specification'] || '',
                color: row.color || row.Color || '',
                width: row.width || row.Width || '',
                height: row.height || row.Height || '',
                depth: row.depth || row.Depth || '',
                screenSize: row.screenSize || row['Screen Size'] || '',
                images: []
            };

            // Generate slug
            const slug = (productData.title || `product-${Date.now()}-${i}`).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
            productData.slug = slug;

            const product = new Product(productData);
            products.push(product);
        } catch (error) {
            errors.push(`Row ${i + 2}: ${error.message}`);
        }
    }

    if (products.length > 0) {
        await Product.insertMany(products);
    }

    res.json({
        message: `Successfully uploaded ${products.length} products`,
        errors: errors.length > 0 ? errors : undefined
    });
});

// @desc    Get search suggestions
// @route   GET /api/products/search/suggestions
// @access  Public
const getSearchSuggestions = asyncHandler(async (req, res) => {
    const query = req.query.q;
    if (!query || query.length < 2) {
        return res.json([]);
    }

    const suggestions = await Product.find({
        $or: [
            { title: { $regex: `^${query}`, $options: 'i' } },
            { brand: { $regex: `^${query}`, $options: 'i' } },
            { color: { $regex: `^${query}`, $options: 'i' } }
        ]
    }).select('title brand color images slug price').limit(10);

    res.json(suggestions);
});

// @desc    Create new review
// @route   POST /api/products/:id/reviews
// @access  Private
const createProductReview = asyncHandler(async (req, res) => {
    const { rating, comment } = req.body;
    const product = await Product.findById(req.params.id);

    if (product) {
        // Check if user has purchased the product and it is delivered
        // Admins can always review
        if (!req.user.isAdmin) {
             const order = await Order.findOne({
                user: req.user._id,
                'orderItems.product': req.params.id,
                isDelivered: true
            });

            if (!order) {
                res.status(400);
                throw new Error('You can only review products you have purchased and received.');
            }
        }

        const alreadyReviewed = product.reviews.find(
            (r) => r.user.toString() === req.user._id.toString()
        );

        if (alreadyReviewed) {
            res.status(400);
            throw new Error('You have already reviewed this product');
        }

        const review = {
            name: req.user.name,
            rating: Number(rating),
            comment,
            user: req.user._id,
        };

        product.reviews.push(review);
        product.numReviews = product.reviews.length;
        product.rating = product.reviews.reduce((acc, item) => item.rating + acc, 0) / product.reviews.length;

        await product.save();
        res.status(201).json({ message: 'Review added' });
    } else {
        res.status(404);
        throw new Error('Product not found');
    }
});

// @desc    Update product review
// @route   PUT /api/products/:id/reviews
// @access  Private
const updateProductReview = asyncHandler(async (req, res) => {
    const { rating, comment } = req.body;
    const product = await Product.findById(req.params.id);

    if (product) {
        const reviewIndex = product.reviews.findIndex(
            (r) => r.user.toString() === req.user._id.toString()
        );

        if (reviewIndex !== -1) {
            product.reviews[reviewIndex].rating = Number(rating);
            product.reviews[reviewIndex].comment = comment;
            product.reviews[reviewIndex].name = req.user.name; // update name if changed

            product.rating =
                product.reviews.reduce((acc, item) => item.rating + acc, 0) /
                product.reviews.length;

            await product.save();
            res.json({ message: 'Review updated' });
        } else {
            res.status(404);
            throw new Error('Review not found');
        }
    } else {
        res.status(404);
        throw new Error('Product not found');
    }
});

// @desc    Delete product review
// @route   DELETE /api/products/:id/reviews
// @access  Private
const deleteProductReview = asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);

    if (product) {
        const reviewIndex = product.reviews.findIndex(
            (r) => r.user.toString() === req.user._id.toString()
        );

        if (reviewIndex !== -1) {
            product.reviews.splice(reviewIndex, 1);

            product.numReviews = product.reviews.length;
            
            if (product.reviews.length > 0) {
                product.rating =
                    product.reviews.reduce((acc, item) => item.rating + acc, 0) /
                    product.reviews.length;
            } else {
                product.rating = 0;
            }

            await product.save();
            res.json({ message: 'Review deleted' });
        } else {
            res.status(404);
            throw new Error('Review not found');
        }
    } else {
        res.status(404);
        throw new Error('Product not found');
    }
});

module.exports = {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    createProductReview,
    updateProductReview,
    deleteProductReview,
    upload,
    uploadExcel,
    getSearchSuggestions,
    bulkUploadProducts
};
