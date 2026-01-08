const express = require("express");
const eventRouter = express.Router();
const { userAuth } = require("../middleware/auth");
const mentorEvent = require("../models/mentorEvent");

eventRouter.get("/calendar/event", userAuth, async (req, res) => {
  try {
    if (req.user.role !== "mentor") {
      return res.status(403).json({ message: "Only mentors allowed" });
    }
    const events = await mentorEvent
      .find({
        mentorId: req.user._id,
      })
      .sort({ startAt: 1 });

    res.json(events);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
eventRouter.post("/calendar/event", userAuth, async (req, res) => {
  try {
    if (req.user.role !== "mentor") {
      return res.status(403).json({ message: "Only mentors can add events" });
    }
    const { title, note, startAt, endAt } = req.body;
    if (!title || !startAt || !endAt) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const event = await mentorEvent.create({
      mentorId: req.user._id,
      title,
      note,
      startAt,
      endAt,
    });
    res.json(event);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

const mongoose = require("mongoose");

eventRouter.delete("/calendar/event/:id", userAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid event id" });
    }

    await mentorEvent.findOneAndDelete({
      _id: req.params.id,
      mentorId: req.user._id,
    });

    res.json({ message: "Event deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = eventRouter;
