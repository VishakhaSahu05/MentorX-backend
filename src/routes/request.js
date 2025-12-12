const express = require("express");
const { userAuth } = require("../middleware/auth");
const requestRouter = express.Router();
const User = require("../models/user");

requestRouter.post("/sendConnectionRequest" , userAuth , async(req , res)=>{
    const user = req.user;
    console.log("Sending a Connection Request");
    res.send(user.firstName + "sent the connection request");
});




module.exports = requestRouter;