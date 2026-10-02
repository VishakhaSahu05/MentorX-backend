/**
 * Call recording lifecycle.
 *
 * The database is the source of truth for recording state. A partial unique
 * index on { channelName, activeLock } in models/callRecording.js guarantees
 * that a channel can only ever hold ONE in-flight recording, which is what makes
 * two participants pressing Record at the same moment safe.
 */

const mongoose = require("mongoose");
const CallRecording = require("../models/callRecording");
const User = require("../models/user");
const agora = require("../services/agoraCloudRecording");
const { sendRecordingEmail } = require("../services/emailService");
const {
  presignRecordingUrl,
  headRecordingObject,
  DEFAULT_EXPIRY_SECONDS,
} = require("../utils/presignS3");

// MongoDB duplicate-key error
const DUPLICATE_KEY = 11000;

/**
 * Channel name for a pair of users.
 * Must match the frontend exactly (VideoCall.jsx builds the Agora channel the
 * same way) and getCallRoomId in utils/socket.js.
 */
const buildChannelName = (userIdA, userIdB) =>
  [String(userIdA), String(userIdB)].sort().join("_");

/**
 * S3 prefix for a recording. Agora joins prefix segments with "/" and rejects
 * dots, so the channel name (which contains only hex ids and "_") is safe.
 */
const buildFileNamePrefix = (channelName) => [
  "recordings",
  channelName,
  String(Date.now()),
];

const displayName = (user) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "your contact";

/** Shape a recording for the API, never leaking raw S3 keys. */
const toPublicJSON = (rec) => ({
  _id: rec._id,
  channelName: rec.channelName,
  status: rec.status,
  initiator: rec.initiator,
  consentFrom: rec.consentFrom,
  participants: rec.participants,
  startedAt: rec.startedAt,
  stoppedAt: rec.stoppedAt,
  readyAt: rec.readyAt,
  durationSec: rec.durationSec,
  fileSize: rec.fileSize,
  hasFile: Boolean(rec.s3Key),
  emailedTo: rec.emailedTo,
  failureReason: rec.failureReason,
  createdAt: rec.createdAt,
});

/** Release the single active slot for a channel and move to a terminal state. */
const releaseActiveLock = async (recordingId, update) =>
  CallRecording.findByIdAndUpdate(
    recordingId,
    { ...update, $unset: { activeLock: "" } },
    { new: true },
  );

const isParticipant = (rec, userId) =>
  rec.participants.some((p) => String(p) === String(userId));

/* ------------------------------------------------------------------ *
 * POST /recording/request
 * Participant presses Record. Creates the pending session (losing the
 * race is fine and reported as a conflict) and asks the peer for consent.
 * ------------------------------------------------------------------ */
const requestRecording = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId || !mongoose.isValidObjectId(targetUserId)) {
      return res.status(400).json({ error: "A valid targetUserId is required" });
    }
    if (String(targetUserId) === String(req.user._id)) {
      return res.status(400).json({ error: "You cannot record a call with yourself" });
    }

    const target = await User.findById(targetUserId).select(
      "firstName lastName emailId profilePic",
    );
    if (!target) {
      return res.status(404).json({ error: "Other participant not found" });
    }

    const channelName = buildChannelName(req.user._id, targetUserId);

    let recording;
    try {
      recording = await CallRecording.create({
        channelName,
        participants: [req.user._id, target._id],
        initiator: req.user._id,
        consentFrom: target._id,
        status: "pending",
        activeLock: "active",
      });
    } catch (err) {
      if (err?.code === DUPLICATE_KEY) {
        // Someone already holds the active slot for this channel. This is the
        // simultaneous-press case: report the existing session instead of
        // creating a second one.
        const existing = await CallRecording.findOne({
          channelName,
          activeLock: { $exists: true },
        });
        return res.status(409).json({
          error: "A recording session is already in progress for this call",
          recording: existing ? toPublicJSON(existing) : undefined,
        });
      }
      throw err;
    }

    // Ask the other participant for consent over the existing socket channel.
    const io = req.app.get("io");
    const emitToUser = req.app.get("emitToUser");
    if (io && emitToUser) {
      emitToUser(target._id, "recording:consent-request", {
        recordingId: String(recording._id),
        from: {
          _id: String(req.user._id),
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          profilePic: req.user.profilePic,
        },
      });
    }

    return res.status(201).json({
      recording: toPublicJSON(recording),
      message: "Consent requested from the other participant",
    });
  } catch (err) {
    console.error("[recording] request error:", err);
    return res.status(500).json({ error: "Failed to request recording" });
  }
};

/* ------------------------------------------------------------------ *
 * POST /recording/:id/consent   { accept: true|false }
 * Only the participant whose consent was requested may answer.
 * On accept we drive Agora acquire -> start.
 * ------------------------------------------------------------------ */
const respondToConsent = async (req, res) => {
  const { id } = req.params;
  const accept = req.body?.accept === true;

  try {
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid recording id" });
    }

    const recording = await CallRecording.findById(id);
    if (!recording) {
      return res.status(404).json({ error: "Recording session not found" });
    }
    if (String(recording.consentFrom) !== String(req.user._id)) {
      return res
        .status(403)
        .json({ error: "You are not the participant being asked for consent" });
    }
    if (recording.status !== "pending") {
      return res
        .status(409)
        .json({ error: `Recording is already ${recording.status}` });
    }

    const emitToUser = req.app.get("emitToUser");
    const notifyBoth = (event, payload) => {
      if (!emitToUser) return;
      recording.participants.forEach((p) => emitToUser(p, event, payload));
    };

    // ---------------- declined ----------------
    if (!accept) {
      const updated = await releaseActiveLock(recording._id, {
        status: "declined",
      });
      notifyBoth("recording:declined", {
        recordingId: String(recording._id),
        by: String(req.user._id),
      });
      return res.json({
        recording: toPublicJSON(updated),
        message: "Recording declined",
      });
    }

    // ---------------- accepted: start Agora ----------------
    const recorderUid = agora.buildRecorderUid();
    const fileNamePrefix = buildFileNamePrefix(recording.channelName);

    try {
      const resourceId = await agora.acquire({
        channelName: recording.channelName,
        recorderUid,
      });

      const sid = await agora.start({
        channelName: recording.channelName,
        recorderUid,
        resourceId,
        fileNamePrefix,
      });

      recording.resourceId = resourceId;
      recording.sid = sid;
      recording.recorderUid = recorderUid;
      recording.status = "recording";
      recording.startedAt = new Date();
      await recording.save();
    } catch (err) {
      console.error("[recording] Agora start failed:", err.message, err.body || "");
      const failed = await releaseActiveLock(recording._id, {
        status: "failed",
        failureReason: err.message?.slice(0, 500),
      });
      notifyBoth("recording:failed", {
        recordingId: String(recording._id),
        reason: "Could not start cloud recording",
      });
      return res.status(502).json({
        error: "Could not start cloud recording",
        detail: err.message,
        recording: toPublicJSON(failed),
      });
    }

    // Both participants must know recording is live.
    notifyBoth("recording:started", {
      recordingId: String(recording._id),
      startedAt: recording.startedAt,
      initiator: String(recording.initiator),
    });

    return res.json({
      recording: toPublicJSON(recording),
      message: "Recording started",
    });
  } catch (err) {
    console.error("[recording] consent error:", err);
    return res.status(500).json({ error: "Failed to process consent" });
  }
};

/* ------------------------------------------------------------------ *
 * Shared stop + finalize path.
 * Used by the explicit Stop button, by call-end, and by socket disconnect,
 * so a recording is never orphaned.
 * ------------------------------------------------------------------ */
const finalizeRecording = async (recording, { emitToUser, reason } = {}) => {
  const notifyBoth = (event, payload) => {
    if (!emitToUser) return;
    recording.participants.forEach((p) => emitToUser(p, event, payload));
  };

  // Claim the stop so two concurrent stops cannot both call Agora.
  const claimed = await CallRecording.findOneAndUpdate(
    { _id: recording._id, status: "recording" },
    { status: "stopping", stoppedAt: new Date() },
    { new: true },
  );
  if (!claimed) {
    // Already being stopped/finalized by another path.
    return CallRecording.findById(recording._id);
  }

  notifyBoth("recording:stopping", {
    recordingId: String(claimed._id),
    reason: reason || "stopped",
  });

  let stopResponse;
  try {
    stopResponse = await agora.stop({
      channelName: claimed.channelName,
      recorderUid: claimed.recorderUid,
      resourceId: claimed.resourceId,
      sid: claimed.sid,
    });
  } catch (err) {
    // Agora reports "already gone" in a few ways once the recorder has left the
    // channel on its own (maxIdleTime elapsed because everyone hung up, or the
    // resource expired). None of those mean the recording failed, so treat them
    // as a normal finish and fall through to collecting the files.
    const reason = err?.body?.reason || "";
    const alreadyGone =
      err?.status === 404 ||
      err?.body?.code === 2 ||
      /not.*exist|no.*such|already.*stop|expire/i.test(reason);

    if (!alreadyGone) {
      const detail = err?.message || String(err);
      console.error("[recording] Agora stop failed:", detail, err?.body || "");
      const failed = await releaseActiveLock(claimed._id, {
        status: "failed",
        failureReason: String(detail).slice(0, 500),
      });
      notifyBoth("recording:failed", {
        recordingId: String(claimed._id),
        reason: "Could not stop cloud recording",
      });
      return failed;
    }
  }

  const serverResponse = stopResponse?.serverResponse;
  let keys = agora.extractFileKeys(serverResponse);

  // If stop didn't report files yet, ask query once.
  if (keys.length === 0) {
    try {
      const q = await agora.query({
        resourceId: claimed.resourceId,
        sid: claimed.sid,
      });
      keys = agora.extractFileKeys(q?.serverResponse);
    } catch (err) {
      console.warn("[recording] query after stop failed:", err.message);
    }
  }

  const primaryKey = agora.pickPrimaryKey(keys);

  const durationSec = claimed.startedAt
    ? Math.max(
        1,
        Math.round((Date.now() - new Date(claimed.startedAt).getTime()) / 1000),
      )
    : undefined;

  if (!primaryKey) {
    // Agora uploads asynchronously; leave it in `processing` (still holding the
    // lock) so the status endpoint can resolve it later rather than lying.
    const processing = await CallRecording.findByIdAndUpdate(
      claimed._id,
      { status: "processing", s3Keys: keys, durationSec },
      { new: true },
    );
    notifyBoth("recording:processing", {
      recordingId: String(claimed._id),
    });
    return processing;
  }

  const ready = await releaseActiveLock(claimed._id, {
    status: "ready",
    s3Keys: keys,
    s3Key: primaryKey,
    readyAt: new Date(),
    durationSec,
  });

  notifyBoth("recording:ready", { recordingId: String(ready._id) });

  // Email both participants automatically, best-effort.
  deliverRecordingEmails(ready._id).catch((err) =>
    console.error("[recording] email dispatch failed:", err.message),
  );

  return ready;
};

/**
 * Send the secure link to both participants. Failure is recorded on the
 * document but never breaks the recording flow.
 */
const deliverRecordingEmails = async (recordingId) => {
  const recording = await CallRecording.findById(recordingId).populate(
    "participants",
    "firstName lastName emailId",
  );
  if (!recording || recording.status !== "ready" || !recording.s3Key) return;
  if (recording.emailedTo?.length) return; // already delivered

  const sentTo = [];
  const errors = [];

  for (const person of recording.participants) {
    if (!person?.emailId) continue;

    const other = recording.participants.find(
      (p) => String(p._id) !== String(person._id),
    );

    // A fresh signed URL per recipient, so expiry starts at send time.
    const downloadUrl = await presignRecordingUrl(recording.s3Key, {
      expiresIn: DEFAULT_EXPIRY_SECONDS,
      downloadName: `mentorx-call-${new Date(
        recording.startedAt || Date.now(),
      )
        .toISOString()
        .slice(0, 10)}.mp4`,
    });

    const result = await sendRecordingEmail({
      to: person.emailId,
      recipientName: person.firstName || "there",
      otherName: displayName(other),
      startedAt: recording.startedAt,
      durationSec: recording.durationSec,
      downloadUrl,
      expirySeconds: DEFAULT_EXPIRY_SECONDS,
    });

    if (result.sent) sentTo.push(person.emailId);
    else errors.push(`${person.emailId}: ${result.error}`);
  }

  await CallRecording.findByIdAndUpdate(recordingId, {
    emailedTo: sentTo,
    ...(errors.length ? { emailError: errors.join(" | ").slice(0, 500) } : {}),
  });
};

/* ------------------------------------------------------------------ *
 * POST /recording/:id/stop
 * Either participant may stop an active recording.
 * ------------------------------------------------------------------ */
const stopRecording = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid recording id" });
    }

    const recording = await CallRecording.findById(id);
    if (!recording) {
      return res.status(404).json({ error: "Recording session not found" });
    }
    if (!isParticipant(recording, req.user._id)) {
      return res
        .status(403)
        .json({ error: "You are not a participant of this recording" });
    }
    if (recording.status === "pending") {
      // Initiator cancelling before consent arrives.
      const cancelled = await releaseActiveLock(recording._id, {
        status: "declined",
        failureReason: "Cancelled before consent",
      });
      const emitToUser = req.app.get("emitToUser");
      recording.participants.forEach((p) =>
        emitToUser?.(p, "recording:declined", {
          recordingId: String(recording._id),
          by: String(req.user._id),
        }),
      );
      return res.json({ recording: toPublicJSON(cancelled) });
    }
    if (recording.status !== "recording") {
      return res
        .status(409)
        .json({ error: `Recording is ${recording.status}, not active` });
    }

    const updated = await finalizeRecording(recording, {
      emitToUser: req.app.get("emitToUser"),
      reason: "stopped by participant",
    });

    return res.json({ recording: toPublicJSON(updated) });
  } catch (err) {
    console.error("[recording] stop error:", err);
    return res.status(500).json({ error: "Failed to stop recording" });
  }
};

/* ------------------------------------------------------------------ *
 * GET /recording/active?targetUserId=...
 * Lets a client joining/rejoining a call learn the true recording state.
 * ------------------------------------------------------------------ */
const getActiveRecording = async (req, res) => {
  try {
    const { targetUserId } = req.query;
    if (!targetUserId || !mongoose.isValidObjectId(targetUserId)) {
      return res.status(400).json({ error: "A valid targetUserId is required" });
    }

    const channelName = buildChannelName(req.user._id, targetUserId);
    const recording = await CallRecording.findOne({
      channelName,
      activeLock: { $exists: true },
    }).populate("initiator", "firstName lastName profilePic");

    if (!recording) {
      return res.json({ recording: null });
    }

    // Include who asked, so a client that mounted after the consent-request
    // socket event was emitted can still render the consent prompt properly.
    const initiatorUser = recording.initiator?._id
      ? {
          _id: String(recording.initiator._id),
          firstName: recording.initiator.firstName,
          lastName: recording.initiator.lastName,
          profilePic: recording.initiator.profilePic,
        }
      : null;

    return res.json({
      recording: {
        ...toPublicJSON(recording),
        initiator: initiatorUser ? initiatorUser._id : recording.initiator,
        initiatorUser,
      },
    });
  } catch (err) {
    console.error("[recording] active lookup error:", err);
    return res.status(500).json({ error: "Failed to look up recording" });
  }
};

/* ------------------------------------------------------------------ *
 * GET /recording/:id
 * Status, and a chance to resolve a `processing` recording whose file has
 * since landed in S3.
 * ------------------------------------------------------------------ */
const getRecording = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid recording id" });
    }

    let recording = await CallRecording.findById(id);
    if (!recording) {
      return res.status(404).json({ error: "Recording not found" });
    }
    if (!isParticipant(recording, req.user._id)) {
      return res.status(403).json({ error: "Not your recording" });
    }

    if (recording.status === "processing") {
      recording = await tryResolveProcessing(recording, req.app.get("emitToUser"));
    }

    return res.json({ recording: toPublicJSON(recording) });
  } catch (err) {
    console.error("[recording] get error:", err);
    return res.status(500).json({ error: "Failed to load recording" });
  }
};

/** Ask Agora again for the file list of a still-processing recording. */
const tryResolveProcessing = async (recording, emitToUser) => {
  try {
    const q = await agora.query({
      resourceId: recording.resourceId,
      sid: recording.sid,
    });
    const keys = agora.extractFileKeys(q?.serverResponse);
    const primaryKey = agora.pickPrimaryKey(keys);
    if (!primaryKey) return recording;

    const ready = await releaseActiveLock(recording._id, {
      status: "ready",
      s3Keys: keys,
      s3Key: primaryKey,
      readyAt: new Date(),
    });

    recording.participants.forEach((p) =>
      emitToUser?.(p, "recording:ready", { recordingId: String(ready._id) }),
    );

    deliverRecordingEmails(ready._id).catch((err) =>
      console.error("[recording] email dispatch failed:", err.message),
    );

    return ready;
  } catch (err) {
    console.warn("[recording] resolve processing failed:", err.message);
    return recording;
  }
};

/* ------------------------------------------------------------------ *
 * GET /recordings  — this user's recordings
 * ------------------------------------------------------------------ */
const listRecordings = async (req, res) => {
  try {
    const recordings = await CallRecording.find({
      participants: req.user._id,
      status: { $in: ["ready", "processing", "recording", "failed"] },
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("participants", "firstName lastName profilePic");

    return res.json({
      recordings: recordings.map((r) => ({
        ...toPublicJSON(r),
        participants: r.participants,
      })),
    });
  } catch (err) {
    console.error("[recording] list error:", err);
    return res.status(500).json({ error: "Failed to list recordings" });
  }
};

/* ------------------------------------------------------------------ *
 * GET /recording/:id/download — issue a short-lived signed URL
 * ------------------------------------------------------------------ */
const getDownloadUrl = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid recording id" });
    }

    const recording = await CallRecording.findById(id);
    if (!recording) {
      return res.status(404).json({ error: "Recording not found" });
    }
    if (!isParticipant(recording, req.user._id)) {
      return res.status(403).json({ error: "Not your recording" });
    }
    if (recording.status !== "ready" || !recording.s3Key) {
      return res
        .status(409)
        .json({ error: `Recording is not ready yet (${recording.status})` });
    }

    const meta = await headRecordingObject(recording.s3Key);
    if (!meta) {
      return res
        .status(409)
        .json({ error: "Recording file is not available in storage yet" });
    }
    if (meta.size && meta.size !== recording.fileSize) {
      await CallRecording.findByIdAndUpdate(recording._id, {
        fileSize: meta.size,
      });
    }

    const url = await presignRecordingUrl(recording.s3Key, {
      expiresIn: DEFAULT_EXPIRY_SECONDS,
      downloadName: `mentorx-call-${new Date(recording.startedAt || Date.now())
        .toISOString()
        .slice(0, 10)}.mp4`,
    });

    return res.json({
      url,
      expiresInSeconds: DEFAULT_EXPIRY_SECONDS,
      fileSize: meta.size,
    });
  } catch (err) {
    console.error("[recording] download error:", err);
    return res.status(500).json({ error: "Failed to create download link" });
  }
};

/* ------------------------------------------------------------------ *
 * Called from socket disconnect / call-end so a recording started by a
 * participant who vanished still gets finalized.
 * ------------------------------------------------------------------ */
const finalizeActiveForChannel = async (channelName, { emitToUser, reason }) => {
  const active = await CallRecording.findOne({
    channelName,
    status: "recording",
  });
  if (!active) return null;
  return finalizeRecording(active, { emitToUser, reason });
};

module.exports = {
  requestRecording,
  respondToConsent,
  stopRecording,
  getActiveRecording,
  getRecording,
  listRecordings,
  getDownloadUrl,
  finalizeActiveForChannel,
  deliverRecordingEmails,
  buildChannelName,
};
