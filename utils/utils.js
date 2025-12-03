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
    } catch (error) {
        console.log("🚀 ~ generateToken ~ error:", error)
        return null
    }
};

const verifyToken = (token, secret) => {
    try {
        const decoded = jwt.verify(token, secret);
        return { statusCode: 200, valid: true, payload: decoded };
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return { statusCode: 401, valid: false, errorMessage: 'Token has expired' };
        }
        if (error.name === 'JsonWebTokenError') {
            return { statusCode: 401, valid: false, errorMessage: 'Invalid token' };
        }
        return { statusCode: 500, valid: false, errorMessage: 'Token verification failed' };
    }
};

const generateHashedPassword = async (password) => {
    try {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        return hashedPassword;
    } catch (error) {
        console.log("🚀 ~ hashedPassword ~ error:", error)
        return null
    }
};

const comparePassword = async (password, hashedPassword) => {
    try {
        const match = await bcrypt.compare(password, hashedPassword);
        return match;
    } catch (error) {
        console.log("🚀 ~ comparePassword ~ error:", error)
        return false
    }
};

// throw error to catch block
const throwError = (statusCode, errorMessage) => {
    const error = new Error(errorMessage);
    error.statusCode = statusCode;
    throw error;
}

// return error response
const handleErrorResponse = (res, error) => {
    console.log("🚀 ~ handleErrorResponse ~ error:", error)

    const statusCode = error.statusCode || 500;
    const message = error.message || "Internal server error";

    res.status(statusCode).json({
        success: false,
        message
    });
};

// return success response
const handleSuccessResponse = (res, statusCode, message, data = null) => {
    const response = {
        success: true,
        message
    }

    if (data) {
        response.data = data;
    }

    res.status(statusCode).json(response);
};

module.exports = {
    generateHashedPassword,
    comparePassword,
    generateToken,
    verifyToken,
    throwError,
    handleErrorResponse,
    handleSuccessResponse
};