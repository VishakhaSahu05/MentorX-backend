require("dotenv").config();
const express = require("express");
const connectDB = require("./config/database");
const app = express();
const User = require("./models/user");
const { validateSignUpData } = require("./utils/validation");
const bcrypt = require("bcrypt");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const {userAuth} = require("./middleware/auth");


app.use(express.json());
app.use(cookieParser());

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
      sameSite: "strict"
    });

    res.send("Login Successful");
  } catch (err) {
    res.status(500).send("ERROR: " + err.message);
  }
});

 
app.get("/profile", userAuth , async (req , res)=>{
  try{
    const user = req.user;
    res.send(user);
  }catch(err){
    res.status(400).send("ERROR : " + err.message);
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
