const { GetObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { s3 } = require("../config/s3");

// Recordings are private. Access is always through a short-lived signed URL so
// the raw S3 object is never publicly reachable.
const DEFAULT_EXPIRY_SECONDS = 24 * 3600; // 24h

/**
 * Build a time-limited download URL for a private recording object.
 * `downloadName` makes the browser save it with a friendly filename.
 */
const presignRecordingUrl = async (
  key,
  { expiresIn = DEFAULT_EXPIRY_SECONDS, downloadName } = {},
) => {
  if (!key) throw new Error("presignRecordingUrl: key is required");

  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
    ...(downloadName
      ? {
          ResponseContentDisposition: `attachment; filename="${downloadName.replace(
            /"/g,
            "",
          )}"`,
        }
      : {}),
  });

  return getSignedUrl(s3, command, { expiresIn });
};

/**
 * Size/existence probe. Returns null when the object is not there yet, because
 * Agora uploads asynchronously and the key may lag behind the stop response.
 */
const headRecordingObject = async (key) => {
  try {
    const out = await s3.send(
      new HeadObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
      }),
    );
    return { size: out.ContentLength, contentType: out.ContentType };
  } catch (err) {
    if (
      err?.$metadata?.httpStatusCode === 404 ||
      err?.name === "NotFound" ||
      err?.name === "NoSuchKey"
    ) {
      return null;
    }
    throw err;
  }
};

module.exports = {
  presignRecordingUrl,
  headRecordingObject,
  DEFAULT_EXPIRY_SECONDS,
};
