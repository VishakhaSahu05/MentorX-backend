/**
 * Agora Cloud Recording REST client.
 *
 * Composite ("mix") mode is used so a single output file contains BOTH
 * participants' video and BOTH participants' audio. Agora's recording service
 * joins the channel as an extra (invisible) user, subscribes to every stream,
 * mixes them server-side and uploads the result straight to our S3 bucket.
 * The browsers are never responsible for producing the file.
 *
 * Docs: https://docs.agora.io/en/api-reference/api-ref/cloud-recording/start
 */

const { RtcTokenBuilder, RtcRole } = require("agora-token");

const AGORA_BASE = "https://api.sd-rtn.com/v1/apps";
const MODE = "mix"; // composite recording

// storageConfig.vendor -- 1 = Amazon S3
const VENDOR_AWS_S3 = 1;

/**
 * Agora expects the S3 region as a NUMERIC enum, not the AWS region string.
 * Source: AgoraIO/Agora-RESTful-Service cloud-recording reference.
 */
const S3_REGION_MAP = {
  "us-east-1": 0,
  "us-east-2": 1,
  "us-west-1": 2,
  "us-west-2": 3,
  "eu-west-1": 4,
  "eu-west-2": 5,
  "eu-west-3": 6,
  "eu-central-1": 7,
  "ap-southeast-1": 8,
  "ap-southeast-2": 9,
  "ap-northeast-1": 10,
  "ap-northeast-2": 11,
  "sa-east-1": 12,
  "ca-central-1": 13,
  "ap-south-1": 14,
  "cn-north-1": 15,
  "cn-northwest-1": 16,
  "us-gov-west-1": 17,
};

class AgoraRecordingError extends Error {
  constructor(message, { status, body, stage } = {}) {
    super(message);
    this.name = "AgoraRecordingError";
    this.status = status;
    this.body = body;
    this.stage = stage;
  }
}

const requireEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new AgoraRecordingError(
      `Missing required environment variable ${name}`,
      { stage: "config" },
    );
  }
  return value;
};

const getRegionCode = () => {
  const region = requireEnv("AWS_REGION");
  const code = S3_REGION_MAP[region];
  if (code === undefined) {
    throw new AgoraRecordingError(
      `AWS_REGION "${region}" has no Agora storage region mapping`,
      { stage: "config" },
    );
  }
  return code;
};

const authHeader = () => {
  // Cloud Recording REST uses the Customer ID / Customer Secret pair from the
  // Agora console -- NOT the App ID / App Certificate used for RTC tokens.
  const key = requireEnv("AGORA_CUSTOMER_ID");
  const secret = requireEnv("AGORA_CUSTOMER_SECRET");
  return "Basic " + Buffer.from(`${key}:${secret}`).toString("base64");
};

const agoraFetch = async (path, body, stage) => {
  const appId = requireEnv("AGORA_APP_ID");
  const url = `${AGORA_BASE}/${appId}/cloud_recording${path}`;

  // Build the auth header OUTSIDE the try below: a missing credential is a
  // configuration fault and must keep stage "config" rather than being
  // reported as a network failure.
  const authorization = authHeader();

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      // Agora is normally fast; don't let a hung call wedge a request forever.
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    throw new AgoraRecordingError(
      `Agora ${stage} request failed: ${err.message}`,
      { stage },
    );
  }

  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }

  if (!res.ok) {
    throw new AgoraRecordingError(
      `Agora ${stage} returned ${res.status}: ${
        parsed?.reason || parsed?.message || text || "unknown error"
      }`,
      { status: res.status, body: parsed, stage },
    );
  }

  return parsed;
};

/**
 * The recorder joins the channel as its own user. Its UID must be stable for a
 * given recording and must not collide with the participants' UIDs.
 *
 * Participant UIDs are (parseInt(_id.slice(-8),16) % 100000) + 1  -> 1..100000
 * and screen-share uses +100000                                  -> up to 200000
 * so the recorder lives well above that range.
 */
const buildRecorderUid = () =>
  String(900000 + Math.floor(Math.random() * 99999));

/**
 * The recorder needs its own RTC token when the App Certificate is enabled.
 */
const buildRecorderToken = (channelName, recorderUid) => {
  const appId = requireEnv("AGORA_APP_ID");
  const appCertificate = process.env.AGORA_APP_CERTIFICATE;
  if (!appCertificate) return null; // certificate disabled -> token not required

  const expire = Math.floor(Date.now() / 1000) + 24 * 3600;
  return RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    Number(recorderUid),
    RtcRole.PUBLISHER,
    expire,
    expire,
  );
};

const buildStorageConfig = (fileNamePrefix) => ({
  vendor: VENDOR_AWS_S3,
  region: getRegionCode(),
  bucket: requireEnv("AWS_BUCKET_NAME"),
  accessKey: requireEnv("AWS_ACCESS_KEY_ID"),
  secretKey: requireEnv("AWS_SECRET_ACCESS_KEY"),
  // Agora joins these with "/" -- no leading/trailing slashes, no dots allowed.
  fileNamePrefix,
});

/**
 * Composite recording layout + output settings.
 * mixedVideoLayout 1 = "best fit": tiles every participant evenly, so both
 * faces appear in the output without us hard-coding positions.
 */
const buildRecordingConfig = (channelName, recorderToken) => ({
  token: recorderToken || undefined,
  recordingConfig: {
    channelType: 0, // 0 = communication profile (matches createClient mode "rtc")
    streamTypes: 2, // 2 = audio AND video
    videoStreamType: 0, // high-quality stream
    maxIdleTime: 30, // stop if channel empty for 30s (guards orphaned recordings)
    subscribeAudioUids: ["#allstream#"],
    subscribeVideoUids: ["#allstream#"],
    transcodingConfig: {
      width: 1280,
      height: 720,
      fps: 15,
      bitrate: 2000,
      mixedVideoLayout: 1, // best fit -- both participants tiled
      backgroundColor: "#1C1E21", // matches the call UI background
    },
  },
  recordingFileConfig: {
    // mp4 so the emailed link points at something universally playable
    avFileType: ["hls", "mp4"],
  },
});

/**
 * Step 1 -- reserve a recording resource.
 * The returned resourceId is only valid for ~5 minutes, so start() must follow
 * promptly. We therefore never cache it.
 */
const acquire = async ({ channelName, recorderUid }) => {
  // startParameter is deliberately NOT sent here.
  //
  // When acquire carries a startParameter, Agora hashes it and requires the
  // subsequent start request to hash identically. Our payload embeds a freshly
  // minted RTC token (and the token encodes a timestamp), so the two requests
  // could never hash the same and start failed with "request_hash mismatch!".
  // Omitting it is supported and lets start define the configuration.
  const data = await agoraFetch(
    "/acquire",
    {
      cname: channelName,
      uid: String(recorderUid),
      clientRequest: {
        scene: 0, // real-time recording
        resourceExpiredHour: 24,
      },
    },
    "acquire",
  );

  if (!data.resourceId) {
    throw new AgoraRecordingError("Agora acquire returned no resourceId", {
      body: data,
      stage: "acquire",
    });
  }
  return data.resourceId;
};

/** Step 2 -- join the channel and begin recording. */
const start = async ({
  channelName,
  recorderUid,
  resourceId,
  fileNamePrefix,
}) => {
  const recorderToken = buildRecorderToken(channelName, recorderUid);

  const data = await agoraFetch(
    `/resourceid/${resourceId}/mode/${MODE}/start`,
    {
      cname: channelName,
      uid: String(recorderUid),
      clientRequest: {
        ...buildRecordingConfig(channelName, recorderToken),
        storageConfig: buildStorageConfig(fileNamePrefix),
      },
    },
    "start",
  );

  if (!data.sid) {
    throw new AgoraRecordingError("Agora start returned no sid", {
      body: data,
      stage: "start",
    });
  }
  return data.sid;
};

/** Step 3 -- leave the channel, finalize and upload. */
const stop = async ({ channelName, recorderUid, resourceId, sid }) =>
  agoraFetch(
    `/resourceid/${resourceId}/sid/${sid}/mode/${MODE}/stop`,
    {
      cname: channelName,
      uid: String(recorderUid),
      // false => Agora waits for upload so the response carries the fileList
      clientRequest: { async_stop: false },
    },
    "stop",
  );

/** Poll recording state (used to resolve files if stop didn't report them). */
const query = async ({ resourceId, sid }) => {
  const appId = requireEnv("AGORA_APP_ID");
  const url = `${AGORA_BASE}/${appId}/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/${MODE}/query`;

  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: authHeader() },
    signal: AbortSignal.timeout(20000),
  });

  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }

  if (!res.ok) {
    throw new AgoraRecordingError(
      `Agora query returned ${res.status}: ${parsed?.reason || text}`,
      { status: res.status, body: parsed, stage: "query" },
    );
  }
  return parsed;
};

/**
 * Pull the S3 object keys out of a stop/query response.
 * fileList can be a plain M3U8 string (fileListMode "string") or an array of
 * descriptors (fileListMode "json"), so both shapes are handled.
 */
const extractFileKeys = (serverResponse) => {
  if (!serverResponse) return [];
  const { fileList, fileListMode } = serverResponse;

  if (!fileList) return [];
  if (fileListMode === "string" || typeof fileList === "string") {
    return String(fileList)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (Array.isArray(fileList)) {
    return fileList.map((f) => f?.fileName).filter(Boolean);
  }
  return [];
};

/** Prefer the mp4 for playback/download; fall back to whatever exists. */
const pickPrimaryKey = (keys) =>
  keys.find((k) => k.toLowerCase().endsWith(".mp4")) || keys[0] || null;

module.exports = {
  acquire,
  start,
  stop,
  query,
  buildRecorderUid,
  extractFileKeys,
  pickPrimaryKey,
  AgoraRecordingError,
  MODE,
  S3_REGION_MAP,
};
