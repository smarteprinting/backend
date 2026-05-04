const nodemailer = require('nodemailer');

// Create test account with Ethereal Email
let testAccount = null;
let transporter = null;

const createTestAccount = async () => {
    try {
        
        testAccount = await nodemailer.createTestAccount();

        

        // Create transporter with test account
        transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass
            }
        });

        return testAccount;
    } catch (error) {
        console.error('❌ Failed to create Ethereal test account:', error);
        throw error;
    }
};

// Initialize transporter
const initializeTransporter = async () => {
    if (process.env.EMAIL_SERVICE === 'ethereal') {
        // Use Ethereal for testing
        if (!testAccount) {
            testAccount = await createTestAccount();
        }
    } else if (process.env.EMAIL_SERVICE === 'brevo' || (process.env.EMAIL_HOST && process.env.EMAIL_HOST.includes('brevo'))) {
        // High-performance configuration for Brevo (Sendinblue)

        const isSecure = process.env.EMAIL_PORT == 465;

        transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST || 'smtp-relay.brevo.com',
            port: parseInt(process.env.EMAIL_PORT) || 587,
            secure: isSecure, // True for 465, false for 587
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
           // Force IPv4 to avoid Render/Node IPv6 timeouts
            family: 4, 
            // Debug logs
            logger: false, 
            debug: false,
            // Pooling settings: DISABLED for Render stability
            pool: false, 
            // Timeouts - Heavy timeouts to fight networking issues
            connectionTimeout: 30000, 
            greetingTimeout: 30000, 
            socketTimeout: 30000, 
            // TLS Options
            tls: {
                // Do not fail on invalid certs
                rejectUnauthorized: false, 
                // Force TLS v1.2 or higher
                minVersion: 'TLSv1.2'
            }
        });
    } else {
        // Use custom SMTP configuration with connection pooling
        transporter = nodemailer.createTransport({
            pool: true, // Use connection pooling
            maxConnections: 1, // Limit to 1 connection to respecting server limits
            maxMessages: 5, // Recycle connection after 5 messages
            rateDelta: 2000, // Show down rate limit to be safer
            rateLimit: 1,
            // Force IPv4
            family: 4, 
            connectionTimeout: 10000, // 10 seconds timeout for connection
            greetingTimeout: 10000, // 10 seconds timeout for greeting
            socketTimeout: 20000, // 20 seconds timeout for socket
            host: process.env.EMAIL_HOST,
            port: parseInt(process.env.EMAIL_PORT) || 587,
            secure: process.env.EMAIL_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            tls: {
                rejectUnauthorized: false
            }
        });
    }
};

// Initialize on module load
initializeTransporter();

// Generic Send Email Function (Reuses the working transporter)
const sendEmail = async ({ to, subject, html, text, from, replyTo }) => {
    try {
        if (!transporter) {
            await initializeTransporter();
        }

        const mailOptions = {
            from: from || `"Smart ePrinting" <${process.env.EMAIL_FROM || 'no-reply@smarteprinting.com'}>`,
            to: to,
            subject: subject,
            html: html,
            text: text,
            replyTo: replyTo
        };

        const result = await transporter.sendMail(mailOptions);
        return result;

    } catch (error) {
        throw error;
    }
};

// Generate 6-digit OTP
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP email
const sendOTPEmail = async (email, otp, type = 'registration') => {
    try {
        const subject = type === 'registration' ? 'Verify Your Account - Smart ePrinting' : 'Reset Your Password - Smart ePrinting';
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">Smart ePrinting</h1>
                    <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">${type === 'registration' ? 'Account Verification' : 'Password Reset'}</p>
                </div>
                <div style="background: white; padding: 40px 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <h2 style="color: #333; margin-top: 0;">${type === 'registration' ? 'Verify Your Account' : 'Reset Your Password'}</h2>
                    <p style="color: #666; font-size: 16px; line-height: 1.6;">Hello!</p>
                    <p style="color: #666; font-size: 16px; line-height: 1.6;">
                        ${type === 'registration' ? 'Thank you for registering with Smart ePrinting. Your OTP code is:' : 'We received a request to reset your password. Your OTP code is:'}
                    </p>
                    <div style="background-color: #f8f9fa; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
                        <span style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; font-family: 'Courier New', monospace;">${otp}</span>
                    </div>
                    <p style="color: #666; font-size: 14px; margin-bottom: 30px;">
                        This code will expire in <strong>10 minutes</strong>. Please use it to ${type === 'registration' ? 'verify your account' : 'reset your password'}.
                    </p>
                    <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin-top: 20px;">
                        <p style="color: #856404; margin: 0; font-size: 14px;">
                            <strong>Security Notice:</strong> If you didn't request this, please ignore this email. Your account remains secure.
                        </p>
                    </div>
                    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                        <p style="color: #999; font-size: 12px; margin: 0;">
                            This is an automated message from Smart ePrinting. Please do not reply to this email.
                        </p>
                    </div>
                </div>
            </div>
        `;

        // Use the reused function — OTP emails come from no-reply
        return await sendEmail({ to: email, subject, html, from: `"Smart ePrinting" <${process.env.OTP_EMAIL_FROM || 'no-reply@smarteprinting.com'}>` });

    } catch (error) {
        // Allow flow to continue even if email fails
        return { messageId: 'error-fallback', originalError: error };
    }
};;

module.exports = {
    generateOTP,
    sendOTPEmail,
    sendEmail
};