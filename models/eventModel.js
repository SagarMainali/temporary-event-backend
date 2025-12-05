const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
    {
        // user reference who created the event
        organizer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

        // event details
        eventName: { type: String },
        description: { type: String },
        location: { type: String },
        date: { type: String },
        time: { type: String },
        expectedNumberOfPeople: { type: Number },
        phone: { type: String }, // for viewers
        email: { type: String }, // for viewers
        template: { type: mongoose.Schema.Types.ObjectId, ref: "Template" },
        website: { type: mongoose.Schema.Types.ObjectId, ref: "Website" },
        status: {
            type: String,
            enum: ["upcoming", "completed", "failed"],
            default: "upcoming"
        },
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Event", eventSchema);
