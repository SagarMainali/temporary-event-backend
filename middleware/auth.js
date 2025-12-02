const { verifyToken } = require('../utils/utils');
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

    // Check if the user exists in the database
    const user = await User.findById(result.payload?.id);
    if (!user) {
      const error = new Error("User doesn't exist!");
      error.statusCode = 404;
      throw error;
    }

    // attach user id on req.user obj 
    req.user = result.payload;

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



module.exports = {
  authenticate
};
