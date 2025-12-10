require("dotenv").config();
const express = require("express");
const connectDB = require("./config/database");
const app = express();
const User = require("./models/user");
const { validateSignUpData } = require("./utils/validation");
const bcrypt = require("bcrypt");

app.use(express.json());
app.post("/signup", async (req, res) => {
  //validation of data
  try {
    validateSignUpData(req);
    //encryption of password
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
    res.send("User Added Successfully!");
  } catch (err) {
    res.status(400).send("Error saving the user" + err.message);
  }
});

app.post("/login", async (req, res) => {
  try {
    const { emailId, password } = req.body;
    const user = await User.findOne({emailId : emailId});
    if(!user){
        throw new Error("Invalid Credentials");
    }
    const isPasswordValid = await bcrypt.compare(password , user.password);
    if(isPasswordValid){
        res.send("Login Successfull");
    }else{
        throw new Error("Invalid Credentials");
    }
  } catch (err) {
    res.status(500).send("ERROR: " + err.message);
  }
});

//feed API get all the user from the database
app.get("/feed", async (req, res) => {
  try {
    const userId = req.query.userId; // ID of logged-in user

    //  Find the logged-in user
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.role === "student") {
      const mentors = await User.find({
        role: "mentor",
        department: user.department,
      }).select("-password");

      return res.json({
        feedFor: "student",
        department: user.department,
        mentors,
      });
    }
    if (user.role === "mentor") {
      const students = await User.find({
        role: "student",
        department: user.department,
      }).select("-password");

      return res.json({
        feedFor: "mentor",
        department: user.department,
        students,
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.delete("/user", async (req, res) => {
  const userId = req.body.userId;
  try {
    const user = await User.findByIdAndDelete(userId);
    res.send("User Deleted Successfully");
  } catch (err) {
    res.status(400).send("Something went Wrong");
  }
});
//update data of the user
app.patch("/user/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const updates = req.body;

    const ALLOWED_UPDATES = ["profilePic", "gender", "age", "skills", "about"];

    // Allow only certain fields
    const isValid = Object.keys(updates).every((key) =>
      ALLOWED_UPDATES.includes(key)
    );
    if (!isValid) {
      return res.status(400).json({ error: "Update not allowed" });
    }

    // gender check
    if (updates.gender) {
      const allowed = ["male", "female", "other"];
      if (!allowed.includes(updates.gender)) {
        return res.status(400).json({ error: "Invalid gender" });
      }
    }

    //age check
    if (updates.age && updates.age < 18) {
      return res.status(400).json({ error: "Age must be 18 or above" });
    }

    //skills check
    if (updates.skills) {
      if (!Array.isArray(updates.skills)) {
        return res.status(400).json({ error: "Skills must be an array" });
      }

      if (updates.skills.length > 10) {
        return res.status(400).json({ error: "Max 10 skills allowed" });
      }
    }

    // Update user
    const user = await User.findByIdAndUpdate(userId, updates, { new: true });

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ message: "User updated", user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

connectDB()
  .then(() => {
    console.log("Database connection established...");
    app.listen(3000, () => {
      console.log("Server is Successfully listening on port 3000");
    });
  })
  .catch((err) => {
    console.log("Database cannot be connected!!");
  });
