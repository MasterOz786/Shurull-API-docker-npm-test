const express = require("express");
const router = express.Router();


const { uploadTemplate, getAllTemplates, deleteAllTemplates } = require("../controller/templates.controller");

router.post("/upload", uploadTemplate);
router.get("/getAll", getAllTemplates);
router.delete("/deleteAll", deleteAllTemplates);

module.exports = (mongodb, gridfs) => {
    return router;
};
