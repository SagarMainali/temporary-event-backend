const mongoose = require("mongoose");
const Event = require("../models/eventModel.js");
const Template = require("../models/templateModel.js");
const Website = require("../models/websiteModel.js");
const sendEmail = require("../helpers/sendEmail");
const { uploadToCloudinary, deleteFromCloudinary } = require("../helpers/cloudinary.js");
const _ = require("lodash");

// clone website from template(your first website)
const cloneWebsiteFromTemplate = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const userId = req.user.id;
        const { eventId, templateId } = req.body;

        if (!eventId) {
            const error = new Error('EventId is missing');
            error.statusCode = 400;
            throw error;
        }

        if (!templateId) {
            const error = new Error('TemplateId is missing');
            error.statusCode = 400;
            throw error;
        }

        // fetch the event
        const event = await Event.findById(eventId).session(session);

        // additional checks to confirm the event actually exist in the database(just in case)
        if (!event) {
            const error = new Error('Event not found');
            error.statusCode = 404;
            throw error;
        }

        // if the event website has already been made
        if (event.website) {
            const error = new Error('Website already exists for this event');
            error.statusCode = 403;
            throw error;
        }

        // afterwards check if this event actually belongs to the logged in user
        if (event.organizer.toString() !== userId) {
            const error = new Error("This event doesn't belong to you");
            error.statusCode = 403;
            throw error;
        }

        // verify template existense in db with the templateId coming from client-side
        const template = await Template.findById(templateId).session(session);
        if (!template) {
            const error = new Error("Template not found");
            error.statusCode = 404;
            throw error;
        }

        // clone the actual template as event website temporarily
        const website = await Website.create([{
            belongsToThisEvent: event._id,
            baseTemplate: template._id,
            sections: template.sections.map(s => ({
                sectionName: s.sectionName,
                content: s.content
            }))
        }], { session });

        // store the cloned template id in the actual event document
        event.website = website[0]._id;
        await event.save({ session });

        await session.commitTransaction();

        res.status(201).json(
            {
                success: true,
                message: "You have selected the template. Now you can proceed to its customization.",
                data: {
                    websiteId: website[0]._id
                }
            }
        );
    } catch (error) {
        await session.abortTransaction();
        console.error(error);

        const statusCode = error.statusCode || 500;
        const message = error.message || "Internal server error";
        res.status(statusCode).json(
            {
                success: false,
                message
            }
        );
    } finally {
        session.endSession();
    }
};

// get cloned website for display/edit(authenticated user)
const getWebsite = async (req, res) => {
    const { websiteId } = req.params;

    try {
        const website = await Website.findById(websiteId)
            .populate({
                path: "belongsToThisEvent",
                select: "eventName organizer email",
            })
            .populate({
                path: "baseTemplate",
                select: "templateName",
            });

        if (!website) {
            const error = new Error("Website not found");
            error.statusCode = 404;
            throw error;
        }

        res.status(200).json(
            {
                success: true,
                message: "Successfully fetched website",
                data: website
            }
        );
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

// get section of particular website
const getSection = async (req, res) => {
    const { websiteId, sectionId } = req.params;

    try {
        const website = await Website.findById(websiteId)
            .populate({
                path: "belongsToThisEvent",
                select: "organizer",
            });

        if (!website) {
            const error = new Error("Website not found");
            error.statusCode = 404;
            throw error;
        }

        const section = website.sections.find(sec => sec._id.toString() === sectionId);
        if (!section) {
            const error = new Error("Section doesn't exist in the website");
            error.statusCode = 404;
            throw error;
        }

        return res.status(200).json(
            {
                success: true,
                message: "Successfully fetched section",
                data: section
            }
        );
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
}

// edit the cloned website(your main website)
const updateSection = async (req, res) => {
    const { websiteId, sectionId } = req.params;
    const userId = req.user.id;
    const content = req.body;
    const images = req.files;

    try {
        // find website and populate its event + organizer
        const website = await Website.findById(websiteId)
            .populate({
                path: "belongsToThisEvent",
                select: "organizer",
            });

        if (!website) {
            const error = new Error("Website not found");
            error.statusCode = 404;
            throw error;
        }

        // ensure current user is the event organizer
        if (website.belongsToThisEvent.organizer.toString() !== userId) {
            const error = new Error("Not authorized to edit this website");
            error.statusCode = 403;
            throw error;
        }

        // verify section existence
        const section = website.sections.find(sec => sec._id.toString() === sectionId);
        if (!section) {
            const error = new Error("Section doesn't exist in the website");
            error.statusCode = 404;
            throw error;
        }

        console.log("content:", content);

        const parsedContent = {};

        // for contents other than text
        for (const key in content) {
            if (key !== "imagesToRemove") _.set(parsedContent, key, content[key]);
        }

        // if images exist, merge them too
        if (images && images.length > 0) {
            for (const image of images) {
                const result = await uploadToCloudinary(image.buffer, "website_section_images");
                _.set(parsedContent, image.fieldname, [result.secure_url]);
            }
        }

        // send this in req.body to delete image
        // {
        //     "imagesToRemove": {
        //         "galleryImages": ["url1", "url2"],
        //         "bannerImages": ["url3"],
        //         features[0].icon[0]: ["url1"],
        //     }
        // }

        // delete images from cloudinary and url from corresponding prop as well
        if (content.imagesToRemove) {
            const imagesToRemove = JSON.parse(content.imagesToRemove);

            for (const key in imagesToRemove) {
                const urlsToDelete = imagesToRemove[key];

                // remove from cloudinary
                await deleteFromCloudinary(urlsToDelete);

                const existing = _.get(section.content, key, []);
                const updated = existing.filter((url) => !urlsToDelete.includes(url));

                console.log("updateddddddddd", updated)

                _.set(section.content, key, updated);
            }
        }

        console.log("🚀 ~ updateSection ~ parsedContent(after):", parsedContent)

        // deep merge with existing content
        _.merge(section.content, parsedContent);
        section.markModified("content");

        await website.save();

        return res.status(200).json(
            {
                success: true,
                message: "Successfully updated section",
                data: section
            }
        );
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

// update whole website section content
const saveWebsite = async (req, res) => {
    const { websiteId } = req.params;
    const { sections } = req.body;

    console.log("🚀 ~ saveWebsite ~ sections:", sections);

    if (!Array.isArray(sections)) {
        return res.status(400).json({
            success: false,
            message: "Sections must be an array",
        });
    }

    try {
        const website = await Website.findById(websiteId);
        if (!website) {
            const error = new Error("Website not found");
            error.statusCode = 404;
            throw error;
        }

        // Loop through incoming sections and update the content that matches with the incoming sectionName to sectionName in database
        sections.forEach((incoming) => {
            if (
                incoming &&
                typeof incoming.sectionName === "string" &&
                incoming.content !== undefined
            ) {
                // Find the matching section in the existing document
                const existingSection = website.sections.find(
                    (s) => s.sectionName === incoming.sectionName
                );

                if (existingSection) {
                    // Only update the content field
                    existingSection.content = incoming.content;
                }
            }
        });

        await website.save();

        res.status(200).json({
            success: true,
            message: "Website updated successfully",
            data: website,
        });
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
}

// publish website - create subdomain and make app accessible through link
const publishWebsite = async (req, res) => {
    const { websiteId } = req.params;
    const { subdomain } = req.body;
    const userId = req.user.id;

    try {
        // validate subdomain
        const subdomainRegex = /^[a-z0-9-]{2,25}$/i;
        if (!subdomain || !subdomainRegex.test(subdomain)) {
            const error = new Error("Invaid subdomain format");
            error.statusCode = 400;
            throw error;
        }

        // check if website with requested subdomain name already exists
        const existing = await Website.findOne({ subdomain });
        if (existing) {
            const error = new Error("Subdomain already taken");
            error.statusCode = 409;
            throw error;
        }

        const website = await Website.findById(websiteId).populate({
            path: "belongsToThisEvent",
            select: "organizer",
        });

        if (!website) {
            const error = new Error("Website not found");
            error.statusCode = 404;
            throw error;
        }

        if (website.published || website.subdomain || website.url || website.publishedOn) {
            const error = new Error("Website already published");
            error.statusCode = 400;
            throw error;
        }

        // check website ownership
        if (website.belongsToThisEvent.organizer.toString() !== userId.toString()) {
            const error = new Error("Unauthorized");
            error.statusCode = 403;
            throw error;
        }

        website.published = true;
        website.subdomain = subdomain;

        const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
        website.url = `${protocol}://${subdomain}.${process.env.DOMAIN_NAME}`
        website.publishedOn = new Date()

        await website.save();

        return res.status(200).json(
            {
                success: true,
                message: "Website published successfully",
                data: website
            }
        );
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
}

const unpublishWebsite = async (req, res) => {
    const { websiteId } = req.params;

    try {
        const website = await Website.findById(websiteId);
        if (!website) {
            const error = new Error("Website not found");
            error.statusCode = 404;
            throw error;
        }

        if (!website.published || !website.subdomain || !website.url || !website.publishedOn) {
            const error = new Error("Website is not published yet");
            error.statusCode = 400;
            throw error;
        }

        website.published = false;
        website.url = null;
        website.subdomain = null;
        website.publishedOn = null;

        await website.save();

        return res.status(200).json(
            {
                success: true,
                message: "Website unpublished"
            }
        )

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

}

// get website for visitor
const getPublicWebsite = async (req, res) => {
    const { subdomain } = req.params;

    try {
        const website = await Website.findOne({ subdomain, published: true })
            .populate({
                path: "belongsToThisEvent",
                select: "eventName description date time location email",
            })

        if (!website) {
            const error = new Error("Website not found");
            error.statusCode = 404;
            throw error;
        }

        res.status(200).json(
            {
                success: true,
                message: "Successfully fetched website",
                data: website
            });
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

// get all publised websites of a particular organizer
const getPublishedWebsites = async (req, res) => {
    const userId = req.user.id;

    try {
        const events = await Event.find({ organizer: userId })
            .populate({
                path: 'website',
                match: {
                    published: true,
                    url: { $ne: null },
                    subdomain: { $ne: null }
                },
                populate: {
                    path: 'baseTemplate',
                    select: 'templateName'
                }
            });

        if (!events) {
            const error = new Error("You don't even have any events created yet to have website.");
            error.statusCode = 404;
            throw error;
        }

        const publishedWebsites = events.map(({ eventName, website }) => (
            {
                eventName,
                website
            }
        )).filter(event => event.website);

        res.status(200).json(
            {
                success: true,
                message: "Successfully fetched published websites",
                data: publishedWebsites
            });
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
}

// delete website for visitor
const deleteWebsite = async (req, res) => {
    const userId = req.user.id;
    const { websiteId } = req.params;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const website = await Website.findById(websiteId)
            .populate({
                path: "belongsToThisEvent",
                select: "organizer",
            })
            .session(session);

        if (!website) {
            const error = new Error("Website not found");
            error.statusCode = 404;
            throw error;
        }

        // ensure current user is the event organizer
        if (website.belongsToThisEvent.organizer.toString() !== userId) {
            const error = new Error("Not authorized to delete this website");
            error.statusCode = 403;
            throw error;
        }

        // delete the website
        await Website.findByIdAndDelete(websiteId).session(session);

        // clear website reference from event
        await Event.findByIdAndUpdate(
            website.belongsToThisEvent._id,
            { $unset: { website: "" } },
            { new: true }
        ).session(session);

        await session.commitTransaction();

        res.status(200).json(
            {
                success: true,
                message: "Successfully deleted website"
            });
    } catch (error) {
        await session.abortTransaction();

        console.error(error);

        const statusCode = error.statusCode || 500;
        const message = error.message || "Internal server error";
        res.status(statusCode).json(
            {
                success: false,
                message
            }
        );
    } finally {
        session.endSession();
    }
};

// send email to organizer from website viewer
const sendEmailToOrganizer = async (req, res) => {
    const formData = req.body;

    try {
        if (!formData.viewerEmail) {
            const error = new Error("Please provide your email address");
            error.statusCode = 400;
            throw error;
        }

        // for developer only while testing
        if (!formData.organizerEmail) {
            const error = new Error("Please include organizer email address in the request body");
            error.statusCode = 400;
            throw error;
        }

        await sendEmail(formData);

        res.status(200).json(
            {
                success: true,
                message: "Email sent successfully",
            });
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
}

module.exports = {
    cloneWebsiteFromTemplate,
    getWebsite,
    getSection,
    saveWebsite,
    updateSection,
    getPublicWebsite,
    deleteWebsite,
    publishWebsite,
    unpublishWebsite,
    getPublishedWebsites,
    sendEmailToOrganizer
}
