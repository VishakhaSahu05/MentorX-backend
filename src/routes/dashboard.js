const express = require("express");
const dashboardRouter = express.Router();

const {userAuth} = require("../middleware/auth");
const { getDashboard, getFeaturedMentors } = require("../controllers/dashboardController");

// Public: a few real mentors for the landing page (no login required)
dashboardRouter.get("/mentors/featured", getFeaturedMentors);

// Own mentor dashboard
dashboardRouter.get("/mentor", userAuth, getDashboard);

// Mentor dashboard by userId
dashboardRouter.get("/mentor/:userId", userAuth, getDashboard);

module.exports = dashboardRouter;
