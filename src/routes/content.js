const express = require("express");
const contentRouter = express.Router();
const { userAuth } = require("../middleware/auth");
const { upload } = require("../middleware/upload");
const { createPost } = require("../controllers/postController");

contentRouter.post(
  "/upload",
  userAuth,
  upload.single("media"),
  createPost
);

module.exports = contentRouter;
