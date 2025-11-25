const nodemailer = require('nodemailer');

let senderEmailAddress = '';
let transporter;

// Check for environment variables for email and credentials
if (!process.env.SENDER_EMAIL_ADDRESS || !process.env.BREVO_SMTP_SERVER || !process.env.BREVO_LOGIN || !process.env.BREVO_SMTP_KEY) {
    throw new Error('Essential email environment variables are missing. Please set SENDER_EMAIL_ADDRESS, BREVO_SMTP_SERVER, BREVO_LOGIN and BREVO_SMTP_KEY.');
} else {
    senderEmailAddress = process.env.SENDER_EMAIL_ADDRESS;
    
    transporter = nodemailer.createTransport({
        host: process.env.BREVO_SMTP_SERVER,
        port: 587,
        secure: false, // false for port 587
        auth: {
            user: process.env.BREVO_LOGIN,
            pass: process.env.BREVO_SMTP_KEY,
        },
    });
}

module.exports = { transporter, senderEmailAddress };
