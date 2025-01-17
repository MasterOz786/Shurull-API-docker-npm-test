const express = require("express");
const router = express.Router();

const { uploadAndGenerateCertificates } = require("../controller/data.controller");

router.post("/generate", uploadAndGenerateCertificates);

module.exports = (mongodb, gridfs) => {
    return router;
};