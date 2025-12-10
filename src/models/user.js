const mongoose = require("mongoose");
const validator = require("validator");


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
      validate(value){
        if(!validator.isStrongPassword(value)){
            throw new Error("Enter a Strong Password: " + value)
        }
      }
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

module.exports = mongoose.model("User", userSchema);
