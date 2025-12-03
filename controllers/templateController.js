const Template = require("../models/templateModel.js");
const { throwError, handleSuccessResponse, handleErrorResponse } = require("../utils/utils.js");

// add new template
const addTemplate = async (req, res) => {
    try {
        const { templateName, description, previewImage, sections } = req.body;

        if (!templateName || !description || !previewImage || !sections) {
            throwError(400, "Required: templateName, description, previewImage & sections")
        }

        const newTemplate = new Template({
            templateName,
            description,
            previewImage,
            sections,
        });

        await newTemplate.save();

        handleSuccessResponse(res, 201, "Successfully added template")
    } catch (error) {
        handleErrorResponse(res, error)
    }
}

// get all templates
const getAllTemplates = async (_, res) => {
    try {
        const templates = await Template.find({})
            .sort({ createdAt: -1 }); // newest first

        handleSuccessResponse(res, 200, "Successfully fetched templates", templates)
    } catch (error) {
        handleErrorResponse(res, error)
    }
}

// get single template
const getTemplate = async (req, res) => {
    const { templateId } = req.params;

    try {
        const template = await Template.findById(templateId);

        if (!template) {
            throwError(404, "Template not found")
        }

        handleSuccessResponse(res, 200, "Successfully fetched tempalte", template)
    } catch (error) {
        handleErrorResponse(res, error)
    }
};

module.exports = { addTemplate, getAllTemplates, getTemplate }
