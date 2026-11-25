const mongoose = require("mongoose");

const submissionSchema = new mongoose.Schema(
    {
        // user reference: to whom these visitors belong to        
        organizer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        visitorEmail: { type: String, required: true },
        organizerEmail: { type: String, required: true },
        firstname: String,
        lastname: String,
        phone: String,
        description: String,
        emailStatus: {
            type: String,
            enum: ["pending", "sent", "failed"],
            default: "pending"
        },
        emailError: String, // Optional: stores why it failed
        subdomain: { type: String, required: true },
        createdAt: { type: Date, default: Date.now }
    }
);

submissionSchema.index({ organizer: 1, createdAt: -1 });

module.exports = mongoose.model("Submission", submissionSchema);
