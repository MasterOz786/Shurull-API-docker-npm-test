const multer = require("multer");
const { GridFSBucket } = require("mongodb");
const path = require("path");

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for uploads png jpg or pdf
    fileFilter: (req, file, cb) => {
        const filetypes = /jpg|png|pdf/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        console.log(`Uploaded File: ${file.originalname}`);
        console.log(`MIME Type: ${file.mimetype}`);
        console.log(`Extension: ${path.extname(file.originalname).toLowerCase()}`);
        console.log(`Extension Valid: ${extname}, MIME Type Valid: ${mimetype}`);
        if (mimetype && extname || file.mimetype === 'image/jpeg' || file.mimetype === 'image/pjpeg') {
            return cb(null, true);
        } else {
            return cb(new Error("Only images and PDF files are allowed!"));
        }
    },
}).single("file");

module.exports = {
    uploadTemplate: async (req, res) => {
        console.log("uploading template...");

        const gfs = req.app.locals.gfs;

        upload(req, res, async (err) => {
            if (err) {
                console.error("Multer Error:", err.message);
                return res.status(400).send({ message: err.message });
            }

            if (!req.file) {
                return res.status(400).json({ message: "No file uploaded" });
            }

            try {
                // random file name (date + name)
                const filename = `${Date.now()}-${req.file.originalname}`;
                console.log("Preparing to upload . . .", filename);

                // Checking for existing file in GridFS
                const existingFile = await gfs.find({ filename: filename }).toArray();
                if (existingFile.length > 0) {
                    return res.status(400).json({ message: "File already exists" });
                }

                const uploadStream = gfs.openUploadStream(filename, {
                    contentType: req.file.mimetype,
                });

                uploadStream.on('finish', () => {
                    console.log(`File uploaded successfully: ${filename}`, uploadStream.gridFSFile);
                    return res.status(201).json({
                        message: "File uploaded successfully",
                        fileId: uploadStream.id,
                        fileType: uploadStream.gridFSFile.contentType,
                    });
                });

                uploadStream.on('error', (error) => {
                    console.error('Error writing to GridFS:', error.message);
                    return res.status(500).json({ message: "Failed to upload file", error });
                });
                uploadStream.end(req.file.buffer);
            } catch (uploadError) {
                console.error("Upload error:", uploadError);
                return res.status(500).json({ message: "Server Error", error: uploadError.message });
            }
        });


    },
    getAllTemplates: async (req, res) => {
        console.log("retreiving templatess");

        const gfs = req.app.locals.gfs;

        try {
            const files = await gfs.find().toArray(); //files = all templates
            if (!files || files.length === 0) {
                console.log("No templates found.");
                return res.status(404).json({ message: "No templates found." });
            }

            const templates = files.map(file => ({
                id: file._id,
                filename: file.filename,
                contentType: file.contentType,
                uploadDate: file.uploadDate,
                length: file.length,
            }));

            console.log("templates retrieved successfully...");
            return res.status(200).json(templates);
        } catch (error) {
            console.error("!error retrieving templates!", error.message);
            return res.status(500).json({ message: "Failed to retrieve templates", error: error.message });
        }
    },
    deleteAllTemplates: async (req, res) => {
        console.log("Deleting all templates...");

        const gfs = req.app.locals.gfs;

        try {
            const files = await gfs.find().toArray();

            if (!files || files.length === 0) {
                console.log("No templates found to delete.");
                return res.status(404).json({ message: "No templates found to delete." });
            }

            for (const file of files) {
                await gfs.delete(file._id);
                console.log(`Deleted file: ${file.filename}`);
            }

            console.log("All templates deleted successfully.");
            return res.status(200).json({ message: "All templates deleted successfully." });
        } catch (error) {
            console.error("Error deleting templates:", error.message);
            return res.status(500).json({ message: "Failed to delete templates", error: error.message });
        }
    },

};
