const { verifyToken, handleErrorResponse, throwError } = require('../utils/utils');
const User = require("../models/userModel");

const authenticate = async (req, res, next) => {
  const errorMessage = "Authentication failed. Invalid token or missing token!";

  try {
    // Get the token from the cookies
    const accessToken = req.cookies.access_token;
    if (!accessToken) {
      throwError(401, errorMessage)
    }

    // Verify the access token
    const result = verifyToken(accessToken, process.env.JWT_SECRET_ACCESS);
    if (!result?.valid) {
      // If the token is invalid or expired, handle the error (e.g., return 401)

      throwError(result.statusCode, result.errorMessage)
    }

    // Check if the user exists in the database
    const user = await User.findById(result.payload?.id);
    if (!user) {
      throwError(404, "User not found")
    }

    // attach user id on req.user obj 
    req.user = result.payload;

    // If everything is good, proceed to next middleware/api
    next();
  } catch (error) {
    handleErrorResponse(res, error);
  }
};

module.exports = {
  authenticate
};
