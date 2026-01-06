const express = require("express");
const dashboardRouter = express.Router();

const {userAuth} = require("../middleware/auth");
const { getDashboard } = require("../controllers/dashboardController");

// Own mentor dashboard
dashboardRouter.get("/mentor", userAuth, getDashboard);

// Mentor dashboard by userId
dashboardRouter.get("/mentor/:userId", userAuth, getDashboard);

module.exports = dashboardRouter;
