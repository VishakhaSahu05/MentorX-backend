const mongoose = require("mongoose");
const validator = require("validator");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const userSchema = mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
    },

    lastName: {
      type: String,
    },

    emailId: {
      type: String,
      required: true,
      lowercase: true,
      unique: true,
      trim: true,
      validate(value) {
        if (!validator.isEmail(value)) {
          throw new Error("Invalid Email Address: " + value);
        }
      },
    },

    password: {
      type: String,
      required: true,
      validate(value) {
        if (this.isModified("password")) {   // ✔ important fix
          if (!validator.isStrongPassword(value)) {
            throw new Error("Enter a Strong Password: " + value);
          }
        }
      },
    },

    gender: {
      type: String,
      enum: ["male", "female", "other"],
    },

    department: {
      type: String,
      enum: ["CSE", "IT", "ECE", "EE", "ME", "CIVIL", "OTHER"],
    },

    role: {
      type: String,
      enum: ["student", "mentor"],
      required: true,
    },

    skills: {
      type: [String],
      validate: {
        validator: function (v) {
          return v.length <= 10;
        },
        message: "You can add a maximum of 10 skills.",
      },
    },

    experience: [
      {
        company: String,
        role: String,
        duration: String,
      },
    ],

    profilePic: {
      type: String,
      default:
        "https://cdn.pixabay.com/photo/2023/02/18/11/00/icon-7797704_1280.png",
      validate(value) {
        if (!validator.isURL(value)) {
          throw new Error("Invalid URL: " + value);
        }
      },
    },

    age: {
      type: Number,
      min: 18,
    },

    about: {
      type: String,
    },
  },
  { timestamps: true }
);

// Index fix
userSchema.index({ firstName: 1, lastName: 1 });

// JWT function
userSchema.methods.getJWT = async function () {
  const user = this;
  return jwt.sign(
    { _id: user._id },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
};

// Password validation
userSchema.methods.validatePassword = async function (passwordInputByUser) {
  return await bcrypt.compare(passwordInputByUser, this.password);
};

module.exports = mongoose.model("User", userSchema);
