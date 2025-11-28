const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/userModel");

const authenticate = async (req, res, next) => {
  const errorMessage = "Authentication failed. Invalid token or missing token!";

  try {
    // Get the token from the cookies
    const accessToken = req.cookies.access_token;
    if (!accessToken) {
      const error = new Error(errorMessage);
      error.statusCode = 403;
      throw error;
    }

    // Verify the access token
    const result = verifyToken(accessToken, process.env.JWT_SECRET_ACCESS);
    if (!result?.valid) {
      // If the token is invalid or expired, handle the error (e.g., return 401)
      const error = new Error(result.error);
      error.statusCode = result.status;
      throw error;
    }

    req.user = result.payload; // if verified, the return obj contains payload prop

    // Check if the user exists in the database
    const user = await User.findById(req.user?.id);
    if (!user) {
      const error = new Error("User doesn't exist!");
      error.statusCode = 404;
      throw error;
    }

    // If everything is good, proceed to next middleware/api
    next();
  } catch (error) {
    console.error(error);

    const statusCode = error.statusCode || 500;
    const message = error.message || "Internal server error";
    res.status(statusCode).json(
      {
        success: false,
        message
      }
    );
  }
};

const hashedPassword = async (password) => {
  try {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
  } catch (err) {
    console.log(err);
  }
};

const comparePassword = async (password, hashedPassword) => {
  try {
    const match = await bcrypt.compare(password, hashedPassword);
    return match;
  } catch (err) {
    console.log(err);
  }
};

const generateToken = (id, secret, duration) => {
  try {
    const token = jwt.sign(
      { id },
      secret,
      { expiresIn: duration, }
    );
    return token;
  } catch (err) {
    console.log(err);
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

const admin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res
      .status(403)
      .send({ success: false, message: "Not authorized as an admin" });
  }
};

module.exports = {
  authenticate,
  hashedPassword,
  comparePassword,
  generateToken,
  verifyToken,
  admin,
};
