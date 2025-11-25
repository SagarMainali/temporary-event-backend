const nodemailer = require('nodemailer');

let senderEmailAddress = '';
let transporter;

// Check for environment variables for email and credentials
if (!process.env.OFFICE_EMAIL_ADDRESS || !process.env.OFFICE_EMAIL_PASSWORD || !process.env.SMTP_SERVER) {
    throw new Error('Essential email environment variables are missing. Please set OFFICE_EMAIL_ADDRESS, OFFICE_EMAIL_PASSWORD and SMTP_SERVER.');
} else {
    senderEmailAddress = process.env.OFFICE_EMAIL_ADDRESS;
    
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_SERVER,
        port: 465,
        secure: true,
        auth: {
            user: process.env.OFFICE_EMAIL_ADDRESS,
            pass: process.env.OFFICE_EMAIL_PASSWORD,
        },
    });
}

module.exports = { transporter, senderEmailAddress };
