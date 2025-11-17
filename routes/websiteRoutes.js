const express = require("express");
const { cloneWebsiteFromTemplate, getWebsite, updateSection, getPublicWebsite, deleteWebsite, publishWebsite, unpublishWebsite, getPublishedWebsites, sendEmailToOrganizer, getSection, saveWebsite } = require("../controllers/websiteController.js");
const { authenticate } = require("../middleware/auth.js");
const upload = require('../middleware/fileUpload.js');

const router = express.Router();

router
    .get("/public/:subdomain", getPublicWebsite)
    .get("/published", authenticate, getPublishedWebsites)
    .get("/section/:websiteId/:sectionId", authenticate, getSection)
    .get("/private/:websiteId", authenticate, getWebsite)
    .post("/create", authenticate, cloneWebsiteFromTemplate)
    .patch("/save/:websiteId", authenticate, saveWebsite)
    .patch("/section/:websiteId/:sectionId", authenticate, upload.any(), updateSection)
    .delete("/:websiteId", authenticate, deleteWebsite)
    .patch("/publish/:websiteId", authenticate, publishWebsite)
    .patch("/unpublish/:websiteId", authenticate, unpublishWebsite)
    .post("/sendEmail", sendEmailToOrganizer)

module.exports = router;
