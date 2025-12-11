const jwt = require("jsonwebtoken");
const User = require("../models/user");
const userAuth = async (req , res , next)=>{
   try{//Read the token from the request
   const {token} = req.cookies;
   if(!token){
    return res.status(401).send("Please Login!");
   }
   //Validate the cookie
   const decodedMessage = await jwt.verify(token , process.env.JWT_SECRET);
   const {_id} = decodedMessage;
   const user = await User.findById(_id);
   if(!user){
    throw new Error("Invalid User");
   }
   req.user = user;
   next();
  }
  catch(err){
    res.status(404).send("Error: " + err.message);
  }
   
};
module.exports={
    userAuth,
}