
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const fs = require("fs");
const { s3 } = require("../config/s3");

async function uploadFileToS3(filePath, key, mimeType) {
  console.log("uploadFileToS3 called");

  const fileStream = fs.createReadStream(filePath);

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
    Body: fileStream,
    ContentType: mimeType,
  });

  await s3.send(command);

  return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

module.exports = uploadFileToS3;
