const multer = require("multer");
const xlsx = require("xlsx");
const Papa = require("papaparse");
const { GridFSBucket } = require("mongodb");
const { ObjectId } = require('mongodb');
const sharp = require("sharp");
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const FileType = require("file-type");
const fontkit = require('@pdf-lib/fontkit');
const fs = require('fs');

//pre defining the font paths (in case of pdf since svg is only used with images and not pdf)
const fontPaths = {
    "Comic Sans MS": "./assets/fonts/COMIC.ttf",
    "Georgia": "./assets/fonts/georgia.ttf",
    "Times New Roman": "./assets/fonts/times.ttf",
    "Courier New": "./assets/fonts/cour.ttf",
    "Brush Script MT": "./assets/fonts/BRUSHSCI.ttf",
    "Arial": "./assets/fonts/ARIAL.ttf",
    "Helvetica": "./assets/fonts/Helvetica.ttf",
    "Verdana": "./assets/fonts/verdana.ttf",
    "Tahoma": "./assets/fonts/tahoma.ttf",
    "Trebuchet MS": "./assets/fonts/trebuc.ttf",
    "Lucida Console": "./assets/fonts/lucon.ttf",
    "Monaco": "./assets/fonts/Monaco.ttf",
    "Consolas": "./assets/fonts/CONSOLA.ttf",
    "DejaVu Sans Mono": "./assets/fonts/DejaVuSansMono.ttf",
    "Lucida Handwriting": "./assets/fonts/LucidaHandwritingStdRg.ttf",
    "Segoe Script": "./assets/fonts/segoesc.ttf",
    "Pacifico": "./assets/fonts/Pacifico.ttf",
    "Impact": "./assets/fonts/impact.ttf",
    "Algerian": "./assets/fonts/algerian.ttf",//-
    "Jokerman": "./assets/fonts/Jokerman-Regular.ttf",
    "Vladimir Script": "./assets/fonts/vladimir-script.ttf", //-


    //will add more CUSTOM fonts
};


const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit for uploads
}).single("file-r");

module.exports = {
    uploadAndGenerateCertificates: async (req, res) => {
        upload(req, res, async (err) => {
            console.log("Uploading and generating certificates...");
            if (err) {
                console.error("Multer Error:", err.message);
                return res.status(400).json({ message: err.message });
            }

            if (!req.file) {
                return res.status(400).json({ message: "No file uploaded" });
            }

            const {
                templateId = 'defaultTemplateId',
                xPos = 100,
                yPos = 20,
                fontColor = rgb(0, 0, 0),
                fontSize = 40,
                fontFamily = 'Vladimir Script',
            } = req.body;
            console.log("Template ID:", templateId);
            let recipients = [];

            const defaultXPos = xPos;
            const defaultYPos = yPos;
            //>> or implement a logic to handle default placement on certificate (centre and a bit down??)

            /*
            Fetch DATA
            Fill DATA
            */

            try {
                console.log("Parsing the file...", req.file);
                console.log("Detected MIME Type:", req.file.mimetype);

                const defaultXPos = 0; // Set default values as required
                const defaultYPos = 0;

                if (req.file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
                    // Excel file (XLSX)
                    const workbook = xlsx.read(req.file.buffer);
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
                    console.log("EXCEL", rows);

                    recipients = rows.map(row => ({
                        name: row[0],
                        xPos: row[1] !== undefined ? row[1] : defaultXPos,
                        yPos: row[2] !== undefined ? row[2] : defaultYPos,
                    }));

                    console.log("Formatted Recipients:", recipients);
                } else if (["text/csv", "application/csv", "text/plain", "application/vnd.ms-excel"].includes(req.file.mimetype)) {
                    // CSV file
                    const csvData = req.file.buffer.toString();
                    console.log("Raw CSV Data:", csvData);

                    const parsedData = Papa.parse(csvData, { header: false }); // No header in CSV file
                    recipients = parsedData.data
                        .filter(row => row[0] !== undefined && row[0] !== '')
                        .map(row => ({
                            name: row[0],
                            xPos: row[1] !== (undefined || "") ? row[1] : defaultXPos,
                            yPos: row[2] !== (undefined || "") ? row[2] : defaultYPos,
                        }));

                    console.log("Parsed CSV Data:", recipients);
                } else {
                    console.log("Error: Unsupported file type");
                    return res.status(400).json({ message: "Unsupported file type" });
                }

                const gfs = req.app.locals.gfs;
                const downloadStream = gfs.openDownloadStream(new ObjectId(templateId));
                let templateBuffer = [];

                downloadStream.on('data', (chunk) => {
                    templateBuffer.push(chunk);
                });

                downloadStream.on('error', (error) => {
                    console.error("Error reading file from GridFS:", error.message);
                    return res.status(500).json({ message: "Server error", error: error.message });
                });

                /*
                Template Engine - Template Handling & Certificate Generation
                */

                downloadStream.on('end', async () => {
                    // Combine collected chunks into a single buffer
                    templateBuffer = Buffer.concat(templateBuffer);
                    const templateFileType = await FileType.fromBuffer(templateBuffer);
                    const isPDF = templateFileType && templateFileType.mime === "application/pdf";
                    const generatedCertificates = [];
                    console.log("Is PDF? ::", isPDF);

                    if (isPDF) {
                        let customFontBytes;
                        if (fontFamily in fontPaths) {
                            customFontBytes = fs.readFileSync(fontPaths[fontFamily]);
                        }

                        const pdfDoc = await PDFDocument.load(templateBuffer);
                        pdfDoc.registerFontkit(fontkit);

                        for (const recipient of recipients) {
                            console.log("mapping: ", recipient);
                            const recipientName = recipient.name || "Default";

                            const pdfDocCopy = await PDFDocument.create();
                            pdfDocCopy.registerFontkit(fontkit);
                            const [copiedPage] = await pdfDocCopy.copyPages(pdfDoc, [0]); // Copy the first page
                            pdfDocCopy.addPage(copiedPage);
                            const pages = pdfDocCopy.getPages();
                            const firstPage = pages[0];

                            //embedding custom fonts (needed only in case of PDF)
                            let fontUse;
                            try {
                                fontUse = await pdfDocCopy.embedFont(customFontBytes);
                                console.log('font embedding successful');
                            } catch (error) {
                                console.error(`Failed to embed font ${fontFamily}:`, error);
                                fontUse = await pdfDocCopy.embedFont(StandardFonts.TimesRoman);
                            }

                            const fontsizeUse = fontSize ? parseFloat(fontSize) : 40;

                            firstPage.drawText(recipientName, {
                                x: parseFloat(recipient.xPos),
                                y: parseFloat(recipient.yPos),
                                size: fontsizeUse,
                                color: fontColor,
                                font: fontUse,
                            });

                            const pdfBytes = await pdfDocCopy.save();
                            const base64String = Buffer.from(pdfBytes).toString('base64');

                            generatedCertificates.push({
                                recipient: recipientName,
                                certificate: base64String,
                            });

                            console.log(`Generated PDF for ${recipientName}: ${base64String.length} bytes`);

                        }
                    }
                    else {
                        // Handling image files png jpg
                        const sharpTemplate = sharp(templateBuffer);
                        const metadata = await sharpTemplate.metadata();
                        const templateWidth = metadata.width;
                        const templateHeight = metadata.height;

                        if (templateBuffer.length === 0) {
                            return res.status(404).json({ message: "Template buffer is invalid or empty" });
                        }
                        if (fontFamily === 'null') {
                            fontFam = "Times New Roman"
                        } else
                            fontFam = fontFamily;

                        for (const recipient of recipients) {
                            const recipientName = recipient.name || "Unnamed";

                            const svgBuffer = Buffer.from(`
                            <svg width="${templateWidth}" height="${templateHeight}">
                                <text x="${recipient.xPos}" y="${recipient.yPos}" font-size="${fontSize}" fill="${fontColor}" font-family="${fontFamily}">${recipientName}</text>
                            </svg>
                        `);

                            try {
                                const certificateBuffer = await sharp(templateBuffer)
                                    .composite([{
                                        input: svgBuffer,
                                        top: 0,
                                        left: 0,
                                    }])
                                    .toBuffer();

                                console.log(`Generated image for ${recipientName}:`, certificateBuffer.toString('base64').substring(0, 100)); // Log first 100 characters
                                generatedCertificates.push({
                                    recipient: recipientName,
                                    certificate: certificateBuffer.toString('base64'), // Conversion to base64
                                });
                            } catch (error) {
                                console.error("Error generating certificate for", recipientName, ":", error.message);
                            }
                        }
                    }

                    return res.status(201).json({
                        message: "Certificates generated successfully",
                        certificates: generatedCertificates,
                    });
                });
            } catch (error) {
                console.error("Error processing file:", error.message);
                return res.status(500).json({ message: "Server error", error: error.message });
            }
        });
    },
};
