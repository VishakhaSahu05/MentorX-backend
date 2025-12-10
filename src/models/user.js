const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
    firstName: {
        type: String,
        required: true
    },

    lastName: {
        type: String,
        required: true
    },

    emailId: {
        type: String,
        required: true,
        unique: true
    },

    password: {
        type: String,
        required: true
    },

    gender: {
        type: String,
        enum: ["male", "female", "other"]
    },

    department: {
        type: String,
        enum: ["CSE", "IT", "ECE", "EE", "ME", "CIVIL", "OTHER"]
    },

    role: {
        type: String,
        enum: ["student", "mentor"],
        required: true
    },

    skills: {
        type: [String]    
    },

    experience: [
        {
            company: String,
            role: String,
            duration: String
        }
    ],

    profilePic: {
        type: String 
    }
}, 
{ timestamps: true } 
);

module.exports = mongoose.model("User", userSchema);
