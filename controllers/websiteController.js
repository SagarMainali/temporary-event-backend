const mongoose = require("mongoose");
const Event = require("../models/eventModel.js");
const Template = require("../models/templateModel.js");
const Website = require("../models/websiteModel.js");
const Submission = require("../models/submissionModel.js");
const sendEmail = require("../helpers/sendEmail");
const { uploadToCloudinary, deleteFromCloudinary } = require("../helpers/cloudinary.js");
const _ = require("lodash");
const { throwError, handleSuccessResponse, handleErrorResponse } = require("../utils/utils.js");
const { extractSubdomain } = require("../helpers/extractSubdomain.js");

// clone website from template(your first website)
const cloneWebsiteFromTemplate = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const userId = req.user.id;
        const { eventId, templateId } = req.body;

        if (!eventId || !templateId) {
            throwError(400, "Required: eventId & templateId")
        }

        // fetch the event
        const event = await Event.findById(eventId)
            .select("organizer website")
            .session(session);

        // additional checks to confirm the event actually exist in the database(just in case)
        if (!event) {
            throwError(404, "Event not found")
        }

        // if the event website has already been made
        if (event.website) {
            throwError(409, "Website already exists for this event")
        }

        // afterwards check if this event actually belongs to the logged in user
        if (event.organizer.toString() !== userId) {
            throwError(403, "Unauthorized to add website to this event")
        }

        // verify template existense in db with the templateId coming from client-side
        const template = await Template.findById(templateId)
            .select("sections")
            .session(session)
            .lean();

        if (!template) {
            throwError(404, "Template not found")
        }

        // clone the actual template as event website temporarily
        const [website] = await Website.create(
            [
                {
                    belongsToThisEvent: event._id,
                    baseTemplate: template._id,
                    sections: template.sections.map(s => ({
                        sectionName: s.sectionName,
                        content: structuredClone(s.content), // Deep clone so nested Mixed objects aren't shared in memory
                    }))
                }
            ], { session });

        // store the cloned template id in the actual event document
        event.website = website._id;
        await event.save({ session });

        await session.commitTransaction();

        handleSuccessResponse(res, 201, "Successfully cloned website from template", { websiteId: website._id })
    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }

        handleErrorResponse(res, error)
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
            })
            .lean();

        if (!website) {
            throwError(404, "Website not found")
        }

        handleSuccessResponse(res, 200, "Successfully fetched website", website)
    } catch (error) {
        handleErrorResponse(res, error)
    }
};

// get section of particular website
const getSection = async (req, res) => {
    const { websiteId, sectionId } = req.params;

    try {
        const website = await Website.findById(websiteId)
            .select("sections belongsToThisEvent")
            .populate({
                path: "belongsToThisEvent",
                select: "organizer",
            })
            .lean();

        if (!website) {
            throwError(404, "Website not found")
        }

        const section = website.sections.find(sec => sec._id.toString() === sectionId);
        if (!section) {
            throwError(404, "Section not found")
        }

        handleSuccessResponse(res, 200, "Successfully fetched section", section)
    } catch (error) {
        handleErrorResponse(res, error)
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
            .select("sections belongsToThisEvent")
            .populate({
                path: "belongsToThisEvent",
                select: "organizer",
            });

        if (!website) {
            throwError(404, "Website not found")
        }

        // ensure current user is the event organizer
        if (website.belongsToThisEvent.organizer.toString() !== userId) {
            throwError(403, "Unauthorized to edit this website")
        }

        // verify section existence
        const section = website.sections.find(sec => sec._id.toString() === sectionId);
        if (!section) {
            throwError(404, "Section not found")
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

        handleSuccessResponse(res, 200, "Successfully updated section", section)
    } catch (error) {
        handleErrorResponse(res, error)
    }
};

// update whole website section content
const saveWebsite = async (req, res) => {
    const { websiteId } = req.params;
    const { sections } = req.body;

    try {
        if (!sections) {
            throwError(400, "Required: sections")
        }

        console.log("🚀 ~ saveWebsite ~ sections:", sections);

        if (!Array.isArray(sections)) {
            throwError(400, "Section must be an array")
        }

        const website = await Website.findById(websiteId).select("sections");
        if (!website) {
            throwError(404, "Website not found")
        }

        const imagesToDelete = [];

        // Loop through incoming sections and update the content that matches with the incoming sectionName to sectionName in database
        // also add images to delete to the list
        sections.forEach((incomingSection) => {
            if (incomingSection && incomingSection.content !== undefined) {
                // Find the matching section in the existing document
                const existingSection = website.sections.find(
                    (s) => s.sectionName === incomingSection.sectionName
                );

                if (existingSection) {
                    // update the content field
                    existingSection.content = incomingSection.content;

                    // add images to delete to the list
                    if (incomingSection.imagesToDelete && incomingSection.imagesToDelete.length > 0) {
                        imagesToDelete.push(...incomingSection.imagesToDelete);
                    }
                }
            }
        });

        await website.save();

        // intentionally deleting without waiting for faster response
        if (imagesToDelete.length > 0) {
            deleteFromCloudinary(imagesToDelete);
        }

        handleSuccessResponse(res, 200, "Successfully updated website", website)
    } catch (error) {
        handleErrorResponse(res, error)
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
            throwError(400, "Invalid format: subdomain")
        }

        // check if website with requested subdomain name already exists
        const existing = await Website.exists({ subdomain });
        if (existing) {
            throwError(409, "Subdomain unavailable")
        }

        const website = await Website.findById(websiteId)
            .select("belongsToThisEvent published subdomain url publishedOn") // Skip loading heavy sections
            .populate({
                path: "belongsToThisEvent",
                select: "organizer",
            });

        if (!website) {
            throwError(404, "Website not found")
        }

        // check website ownership
        if (website.belongsToThisEvent.organizer.toString() !== userId.toString()) {
            throwError(403, "Unauthorized to publish this website")
        }

        if (website.published || website.subdomain || website.url || website.publishedOn) {
            throwError(409, "Website already published")
        }

        website.published = true;
        website.subdomain = subdomain;

        const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
        website.url = `${protocol}://${subdomain}.${process.env.DOMAIN_NAME}`
        website.publishedOn = new Date()

        await website.save();

        handleSuccessResponse(res, 200, "Successfully published website", {
            url: website.url,
        })
    } catch (error) {
        handleErrorResponse(res, error)
    }
}

const unpublishWebsite = async (req, res) => {
    const { websiteId } = req.params;

    try {
        const website = await Website.findById(websiteId).select(
            "published subdomain url publishedOn"
        );

        if (!website) {
            throwError(404, "Website not found")
        }

        if (!website.published || !website.subdomain || !website.url || !website.publishedOn) {
            throwError(400, "Website not published yet")
        }

        website.published = false;
        website.url = null;
        website.subdomain = null;
        website.publishedOn = null;

        await website.save();

        handleSuccessResponse(res, 200, "Successfully unpublished website")
    } catch (error) {
        handleErrorResponse(res, error)
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
            .lean();

        if (!website) {
            throwError(404, "Website not found")
        }

        handleSuccessResponse(res, 200, "Successfully fetched website", website)
    } catch (error) {
        handleErrorResponse(res, error)
    }
};

// get all publised websites of a particular organizer
const getPublishedWebsites = async (req, res) => {
    const userId = req.user.id;

    try {
        const events = await Event.find({ organizer: userId })
            .select("eventName website")
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
            })
            .lean();

        if (!events.length) {
            throwError(404, "Events don't even exist to fetch published websites")
        }

        const publishedWebsites = events.map(({ eventName, website }) => (
            {
                eventName,
                website
            }
        )).filter(event => event.website);

        handleSuccessResponse(res, 200, "Successfully fetched published websites", publishedWebsites)
    } catch (error) {
        handleErrorResponse(res, error)
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
            .select("belongsToThisEvent")
            .populate({
                path: "belongsToThisEvent",
                select: "organizer",
            })
            .session(session)
            .lean();

        if (!website) {
            throwError(404, "Website not found")
        }

        // ensure current user is the event organizer
        if (website.belongsToThisEvent.organizer.toString() !== userId) {
            throwError(403, "Unauthorized to delete this website")
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

        handleSuccessResponse(res, 200, "Successfully deleted website")
    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }

        handleErrorResponse(res, error)
    } finally {
        session.endSession();
    }
};

// save formdata and send email(form filler)
const handleFormSubmission = async (req, res) => {
    const { firstname, lastname, phone, description, visitorEmail, organizerEmail } = req.body;

    try {
        const subdomain = extractSubdomain(req);
        if (!subdomain) {
            throwError(403, "Invalid or unauthorized request origin");
        }

        if (!visitorEmail) {
            throwError(400, "Required: visitorEmail");
        }

        if (!organizerEmail) {
            throwError(400, "Required: organizerEmail");
        }

        // Identify the organizer from the subdomain to link this visitor data to their account
        const website = await Website.findOne({ subdomain, published: true })
            .select("belongsToThisEvent") // Skips loading heavy sections data
            .populate({
                path: "belongsToThisEvent",
                select: "organizer -_id",
            })
            .lean();

        const userId = website?.belongsToThisEvent?.organizer;

        // website exist but user not found
        if (!userId) {
            throwError(404, "Website or organizer doesn't exist");
        }

        // Attach the verified subdomain to the payload
        const submissionPayload = {
            firstname,
            lastname,
            phone,
            description,
            visitorEmail,
            organizerEmail,
            subdomain,
        };

        // 1. Save form data immediately with default "pending" status
        const savedSubmission = await Submission.create({
            ...submissionPayload,
            organizer: userId
        });

        // 2. Attempt to send the email in an isolated try/catch
        try {
            await sendEmail(submissionPayload);

            // Update status to "sent"
            savedSubmission.emailStatus = "sent";
            await savedSubmission.save();

            handleSuccessResponse(res, 200, "Form data saved and email sent");
        } catch (emailErr) {
            // Update status to "failed" and log the error message
            savedSubmission.emailStatus = "failed";
            // savedSubmission.emailError = emailErr.message;
            await savedSubmission.save();

            // Decide how you want to respond to the frontend:
            // Option A: Throw an error so the user knows the email failed
            // throwError(500, "Form data saved, but failed to send email");

            // Option B: Return 200/207 if saving the form is the primary goal
            handleSuccessResponse(res, 200, "Form saved, email failed");
        }

    } catch (error) {
        handleErrorResponse(res, error);
    }
};

const getSubmissions = async (_, res) => {
    try {
        const userId = req.user.id;

        // Fetch all submissions, sorted by newest first
        const submissions = await Submission.find({ organizer: userId }).sort({ createdAt: -1 }).lean();
        handleSuccessResponse(res, 200, "Fetched submissions", submissions);
    } catch (error) {
        handleErrorResponse(res, error);
    }
};

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
    handleFormSubmission,
    getSubmissions
}
