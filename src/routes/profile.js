const express = require("express");
const profileRouter = express.Router();
const User = require("../models/user");
const { userAuth } = require("../middleware/auth");
const { validateEditProfileData } = require("../utils/validation");
const validator = require("validator");   
const bcrypt = require("bcrypt");         

profileRouter.get("/profile/view", userAuth, async (req, res) => {
  try {
    res.send(req.user);
  } catch (err) {
    res.status(400).send("ERROR : " + err.message);
  }
});

profileRouter.patch("/profile/edit", userAuth, async (req, res) => {
  try {
    if (!validateEditProfileData(req)) {
      throw new Error("Invalid Edit Request");
    }

    if (req.body.password) {
      throw new Error("Password cannot be updated through profile edit");
    }

    if (req.body.emailId) {
      req.body.emailId = req.body.emailId.toLowerCase().trim();
    }

    if (req.body.skills) {
      req.body.skills = req.body.skills.map((s) => s.trim());
    }

    const user = req.user;

    Object.keys(req.body).forEach((key) => {
      user[key] = req.body[key];
    });

    await user.save();

    res.json({
      message: `${user.firstName}, Your Profile Updated Successfully`,
      data: user,
    });

  } catch (err) {
    res.status(400).send("ERROR: " + err.message);
  }
});

profileRouter.patch("/profile/password", userAuth, async (req, res) => {
  try {
    const user = req.user;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new Error("Please provide current and new password");
    }

    const isMatch = await user.validatePassword(currentPassword);
    if (!isMatch) {
      throw new Error("Current password is incorrect");
    }

    if (!validator.isStrongPassword(newPassword)) {
      throw new Error("Please enter a strong password");
    }

    if (currentPassword === newPassword) {
      throw new Error("New password cannot be same as current password");
    }

    user.password = newPassword;

    await user.save();

    res.json({
      message: "Password updated successfully",
    });

  } catch (err) {
    res.status(400).send("ERROR: " + err.message);
  }
});


module.exports = profileRouter;
