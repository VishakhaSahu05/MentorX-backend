const mongoose = require("mongoose");

/**
 * Call Recording
 *
 * One document per recording session of a video call.
 * `channelName` is the Agora channel, derived from the two user IDs
 * (see getCallRoomId in utils/socket.js and VideoCall.jsx) so it is stable
 * for a given pair of participants.
 *
 * Lifecycle:
 *   pending   -> consent requested, waiting for the other participant
 *   declined  -> other participant said no (terminal)
 *   recording -> Agora Cloud Recording is running
 *   stopping  -> stop sent to Agora, waiting for finalization
 *   processing-> Agora is writing files to S3
 *   ready     -> file is in S3 and downloadable (terminal)
 *   failed    -> something went wrong (terminal)
 */
const STATUSES = [
  "pending",
  "declined",
  "recording",
  "stopping",
  "processing",
  "ready",
  "failed",
];

// A recording in one of these states occupies the "active" slot for a call.
// Used by the partial unique index below to guarantee one-at-a-time.
const ACTIVE_STATUSES = ["pending", "recording", "stopping", "processing"];

const callRecordingSchema = new mongoose.Schema(
  {
    channelName: {
      type: String,
      required: true,
      index: true,
    },

    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],

    // Who pressed Record
    initiator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Who had to consent
    consentFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: STATUSES,
      default: "pending",
      index: true,
    },

    // Set while the recording occupies the single active slot for the channel.
    // Cleared (unset) on any terminal state so a later recording can start.
    // The partial unique index on { channelName, activeLock } is what makes
    // "one active recording per call" safe against concurrent requests.
    //
    // Deliberately NO schema default: a default is re-applied when mongoose
    // hydrates the document returned by findByIdAndUpdate, so a released lock
    // would still look held on the returned object even though the field is
    // really gone from the database. Callers set it explicitly on create.
    activeLock: {
      type: String,
    },

    // ---- Agora Cloud Recording identifiers ----
    resourceId: { type: String },
    sid: { type: String },
    // UID the recording service joins the channel as (must be stable across
    // acquire/start/stop, and must not collide with participant UIDs)
    recorderUid: { type: String },

    // ---- Output ----
    s3Keys: [{ type: String }],
    // Primary playable artifact (the mp4 we email a link to)
    s3Key: { type: String },
    fileSize: { type: Number },
    mimeType: { type: String, default: "video/mp4" },

    startedAt: { type: Date },
    stoppedAt: { type: Date },
    readyAt: { type: Date },
    durationSec: { type: Number },

    // Email delivery
    emailedTo: [{ type: String }],
    emailError: { type: String },

    failureReason: { type: String },
  },
  { timestamps: true }
);

// ONE active recording per channel.
// Partial index: only documents that still hold activeLock are constrained,
// so a channel can have many finished recordings but only one in flight.
callRecordingSchema.index(
  { channelName: 1, activeLock: 1 },
  {
    unique: true,
    partialFilterExpression: { activeLock: { $exists: true } },
  }
);

callRecordingSchema.index({ participants: 1, createdAt: -1 });

callRecordingSchema.statics.ACTIVE_STATUSES = ACTIVE_STATUSES;
callRecordingSchema.statics.STATUSES = STATUSES;

module.exports = mongoose.model("CallRecording", callRecordingSchema);
