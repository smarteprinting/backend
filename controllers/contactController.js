const asyncHandler = require('express-async-handler');
const { sendEmail } = require('../utils/emailService');

// @desc    Send contact email
// @route   POST /api/contact
// @access  Public
const sendContactEmail = asyncHandler(async (req, res) => {
    const { type } = req.body;

    let subject, html, text, fromName, replyToEmail;


    if (type === 'return-exchange') {
        const { 
            fullName, 
            email, 
            phone, 
            orderNumber, 
            orderDate, 
            deliveryDate, 
            productName, 
            reason, 
            itemCondition, 
            resolution, 
            additionalDetails 
        } = req.body;

        if (!fullName || !email || !orderNumber) {
            res.status(400);
            throw new Error('Please fill in all required fields');
        }

        fromName = fullName;
        replyToEmail = email;
        subject = `Return/Exchange Request: Order #${orderNumber} from ${fullName}`;
        text = `
Return/Exchange Request

Customer Information:
Name: ${fullName}
Email: ${email}
Phone: ${phone || 'N/A'}

Order Information:
Order Number: ${orderNumber}
Order Date: ${orderDate}
Delivery Date: ${deliveryDate}

Product Details:
Product Name: ${productName || 'N/A'}
Reason: ${reason || 'N/A'}
Item Condition: ${itemCondition || 'N/A'}

Resolution Requested: ${resolution || 'N/A'}

Additional Details:
${additionalDetails || 'N/A'}
            `;
        html = `
<h3>New Return/Exchange Request</h3>

<h4>Customer Information</h4>
<p><strong>Name:</strong> ${fullName}</p>
<p><strong>Email:</strong> ${email}</p>
<p><strong>Phone:</strong> ${phone || 'N/A'}</p>

<h4>Order Information</h4>
<p><strong>Order Number:</strong> ${orderNumber}</p>
<p><strong>Order Date:</strong> ${orderDate}</p>
<p><strong>Delivery Date:</strong> ${deliveryDate}</p>

<h4>Product Details</h4>
<p><strong>Product Name:</strong> ${productName || 'N/A'}</p>
<p><strong>Reason:</strong> ${reason || 'N/A'}</p>
<p><strong>Item Condition:</strong> ${itemCondition || 'N/A'}</p>

<h4>Resolution Requested</h4>
<p><strong>${resolution || 'N/A'}</strong></p>

<h4>Additional Details</h4>
<p>${(additionalDetails || 'N/A').replace(/\n/g, '<br>')}</p>
            `;

    } else {
        // Default Contact Form
        const { name, email, orderNumber, subject: reqSubject, message } = req.body;

        if (!name || !email || !reqSubject || !message) {
            res.status(400);
            throw new Error('Please fill in all required fields');
        }

        fromName = name;
        replyToEmail = email;
        subject = `Contact Form: ${reqSubject} from ${name}`;
        text = `
Name: ${name}
Email: ${email}
Order Number: ${orderNumber || 'N/A'}
Subject: ${reqSubject}

Message:
${message}
            `;
        html = `
<h3>New Contact Form Submission</h3>
<p><strong>Name:</strong> ${name}</p>
<p><strong>Email:</strong> ${email}</p>
<p><strong>Order Number:</strong> ${orderNumber || 'N/A'}</p>
<p><strong>Subject:</strong> ${reqSubject}</p>
<p><strong>Message:</strong></p>
<p>${message.replace(/\n/g, '<br>')}</p>
            `;
    }

    // Send email using shared service
    try {
        await sendEmail({
             to: process.env.CONTACT_RECEIVER_EMAIL || 'admin@smarteprinting.com', // Fallback for safety
             subject,
             html,
             text,
             from: `"${fromName}" <${process.env.EMAIL_FROM || 'no-reply@smarteprinting.com'}>`,
             replyTo: replyToEmail
        });
        res.status(200).json({ message: 'Email sent successfully' });
    } catch (error) {
        res.status(500);
        throw new Error('Failed to send email. Please try again later.');
    }
});

module.exports = { sendContactEmail };
