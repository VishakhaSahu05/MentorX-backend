const express = require("express");
const recordingRouter = express.Router();

const { userAuth } = require("../middleware/auth");
const {
  requestRecording,
  respondToConsent,
  stopRecording,
  getActiveRecording,
  getRecording,
  listRecordings,
  getDownloadUrl,
} = require("../controllers/recordingController");

// Every recording route requires a logged-in user; the controllers additionally
// verify that the user is a participant of the call in question.

// Press Record -> ask the other participant for consent
recordingRouter.post("/recording/request", userAuth, requestRecording);

// Answer a consent request ({ accept: true|false })
recordingRouter.post("/recording/:id/consent", userAuth, respondToConsent);

// Stop an active recording (either participant)
recordingRouter.post("/recording/:id/stop", userAuth, stopRecording);

// What is the live recording state for my call with :targetUserId?
recordingRouter.get("/recording/active", userAuth, getActiveRecording);

// My recordings
recordingRouter.get("/recordings", userAuth, listRecordings);

// Short-lived signed download URL
recordingRouter.get("/recording/:id/download", userAuth, getDownloadUrl);

// Single recording status (must stay after /recording/active)
recordingRouter.get("/recording/:id", userAuth, getRecording);

module.exports = recordingRouter;
