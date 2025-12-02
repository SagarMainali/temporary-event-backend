const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // creds used during signup/login
    username: { type: String }, // user/organization name
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },

    // for profile update - intended to be used later
    profileImage: { type: String },
    address: { type: String },
    phone: { type: String },
    country: { type: String },

    // array of reference to event specific to particular user
    events: [{ type: mongoose.Schema.Types.ObjectId, ref: "Event" }],
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("User", userSchema);
