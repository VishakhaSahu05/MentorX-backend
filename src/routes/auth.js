const express = require("express");
const authRouter = express.Router();
const { validateSignUpData } = require("../utils/validation");
const User = require("../models/user");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
authRouter.post("/signup", async (req, res) => {
  try {
    validateSignUpData(req);

    const { firstName, lastName, emailId, password, role } = req.body;

    const passwordHash = await bcrypt.hash(password, 10);

    const user = new User({
      firstName,
      lastName,
      emailId,
      password: passwordHash,
      role,
    });

    await user.save();

    const token = await user.getJWT();

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
    });

    res.status(201).json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      emailId: user.emailId,
      role: user.role,
      profilePic: user.profilePic,
    });

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});



authRouter.post("/login", async (req, res) => {
  try {
    const { emailId, password } = req.body;

    const user = await User.findOne({ emailId });
    if (!user) throw new Error("Invalid Credentials");

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) throw new Error("Invalid Credentials");

    // Create JWT token from schema method
    const token = await user.getJWT();

    // Send cookie
    res.cookie("token", token, {
      expires: new Date(Date.now() + 8 * 3600000),
      httpOnly: true,
      sameSite: "lax",
      secure: false,
    });

  res.json(user); 
  } catch (err) {
    res.status(500).send("ERROR: " + err.message);
  }
});

authRouter.post("/logout", async (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: "lax",
    secure: false, // prod me true
    path: "/",
  });
  res.send("Logout Successful!");
});
module.exports = authRouter;
