const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const { errorHandler, notFound } = require('./middleware/errorMiddleware');

dotenv.config();
connectDB();

const app = express();
// Middleware

app.use(cors())
app.use(express.json());

// Ensure DB is connected for serverless environments (Vercel)
app.use(async (req, res, next) => {
    await connectDB();
    next();
});

app.use('/uploads', express.static('uploads'));

// Routes
app.get('/', (req, res) => {
    res.send('Hello from backend!');
});
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/contact', require('./routes/contactRoutes'));
app.use('/api/chats', require('./routes/chatRoutes'));
app.use('/api/shipping', require('./routes/shippingRoutes'));
app.use('/api/admin', require('./routes/setupRoutes'));

// Config routes
app.get('/api/config/clover', (req, res) => {
    res.json(process.env.CLOVER_PUBLIC_KEY);
});



// Error Handler
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
