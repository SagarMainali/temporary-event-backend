const mongoose = require("mongoose");

const websiteSectionSchema = new mongoose.Schema(
    {
        sectionName: { type: String, required: true },
        content: { type: mongoose.Schema.Types.Mixed, required: true },
    }
);

const websiteSchema = new mongoose.Schema(
    {
        type: { type: String, default: "website" },
        belongsToThisEvent: { type: mongoose.Schema.Types.ObjectId, ref: "Event", unique: true },
        baseTemplate: { type: mongoose.Schema.Types.ObjectId, ref: "Template" },
        sections: [websiteSectionSchema],
        subdomain: { type: String, unique: true, sparse: true },
        published: { type: Boolean, default: false },
        url: { type: String, default: null },
        publishedOn: { type: Date, default: null }
    },
    {
        timestamps: true
    }
);

websiteSchema.index({ subdomain: 1, published: 1 }, { partialFilterExpression: { subdomain: { $ne: null } } });

module.exports = mongoose.model("Website", websiteSchema);
