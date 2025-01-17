const express = require("express")
const router = express.Router()

const certificatesController = require("../controller/certificates.controller")

router.get("/generate", certificatesController.fetch)

module.exports = router