const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const generateToken = (id, secret, duration) => {
    try {
        const token = jwt.sign(
            { id },
            secret,
            { expiresIn: duration, }
        );
        return token;
    } catch (err) {
        console.log("🚀 ~ generateToken ~ err:", err)
        return null
    }
};

const verifyToken = (token, secret) => {
    try {
        const decoded = jwt.verify(token, secret);
        return { status: 200, valid: true, payload: decoded };
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return { status: 401, valid: false, error: 'Token has expired' };
        }
        if (error.name === 'JsonWebTokenError') {
            return { status: 401, valid: false, error: 'Invalid token' };
        }
        return { status: 500, valid: false, error: 'Token verification failed' };
    }
};

const generateHashedPassword = async (password) => {
    try {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        return hashedPassword;
    } catch (err) {
        console.log("🚀 ~ hashedPassword ~ err:", err)
        return null
    }
};

const comparePassword = async (password, hashedPassword) => {
    try {
        const match = await bcrypt.compare(password, hashedPassword);
        return match;
    } catch (err) {
        console.log("🚀 ~ comparePassword ~ err:", err)
        return false
    }
};

module.exports = {
    generateHashedPassword,
    comparePassword,
    generateToken,
    verifyToken
};