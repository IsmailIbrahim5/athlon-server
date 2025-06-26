const express = require("express");
const { S3Client, HeadObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const app = express(); 
const port = process.env.PORT || 3000;

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); 
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});
 
const s3 = new S3Client({
region: "eu-central-2", 
  endpoint: "https://s3.eu-central-2.wasabisys.com",
  credentials: {
    accessKeyId: process.env.WASABI_KEY_ID,
    secretAccessKey: process.env.WASABI_APP_KEY,
  },
  forcePathStyle: true,
});

const BUCKET_NAME = process.env.WASABI_BUCKET;

// Route: GET /video-url/:filename
app.get("/video-url/:filename", async (req, res) => {
  const { filename } = req.params;

  if (!filename) {
    return res.status(400).json({ error: "Filename is required" });
  }

  const params = {
    Bucket: BUCKET_NAME,
    Key: filename,
  };

  try {
    await s3.send(new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: filename,
    })); 

    const command = new GetObjectCommand({ 
      Bucket: BUCKET_NAME,
      Key: filename,
      ResponseContentDisposition: "inline",
      ResponseContentType: "video/mp4",
    });

    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 60 * 60 * 3 });

    return res.json({ url: signedUrl });

  } catch (err) {
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
      return res.status(404).json({ error: "File not found" });
    }

    console.error("Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(port, () => {
  console.log(`✅ Server running at port: ${port}`);
});
