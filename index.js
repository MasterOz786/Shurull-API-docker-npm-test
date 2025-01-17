const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { MongoClient, GridFSBucket } = require("mongodb");

const app = express();

require("dotenv").config();

app.use(express.json());
app.use(cors());
app.use(bodyParser.json());

let mongodb, gridfs; //using gfs to store files (in chunks)
let con_url = process.env.ATLAS_MONGO_URL;
console.log(con_url);
MongoClient.connect(con_url)
    .then(client => {
        console.log("Connected to MongoDB");
        mongodb = client.db("certificate-maker");
        gridfs = new GridFSBucket(mongodb, { bucketName: "templates" });
        app.locals.gfs = gridfs;
        // defining routes (for now commenting data and certificate routers/endpoints)
        const templateRouter = require("./routes/templates.router.js")(mongodb, gridfs);
        const dataRouter = require("./routes/data.router.js")(mongodb, gridfs);
        //const certificateRouter = require("./routes/certificates.router")(mongodb);

        // defining endpoints
        app.use("/api/templates", templateRouter);
        app.use("/api/data-rec", dataRouter);
        //app.use("/api/certificates", certificateRouter);

        //default ROUTE 
        app.get("/", (req, res) => {
            res.send("certificate generator api");
        });
        const PORT = process.env.PORT || 2441;
        app.listen(PORT, () => {
            console.log(`- Server - is running on < port ${PORT} >`);
        });
    })
    .catch(err => {
        console.error("failed to connect to db :(", err);
    });