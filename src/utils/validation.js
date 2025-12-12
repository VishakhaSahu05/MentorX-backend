const validator = require("validator");

const validateSignUpData = (req) => {
  const { firstName, lastName, emailId, password, role } = req.body;

  if (!firstName || !lastName) {
    throw new Error("Name is not valid!");
  }

  if (!validator.isEmail(emailId)) {
    throw new Error("Email is not valid");
  }

  if (!validator.isStrongPassword(password)) {
    throw new Error("Please enter a strong password");
  }

  if (!role || !["student", "mentor"].includes(role)) {
    throw new Error("Invalid role");
  }

  return true;
};

const validateEditProfileData = (req) => {
  const allowedEditFields = [
    "firstName",
    "lastName",
    "emailId",
    "profilePic",
    "about",
    "experience",
    "department",
    "age",
    "gender",
    "skills"
  ];

  const isEditAllowed = Object.keys(req.body).every((field) =>
    allowedEditFields.includes(field)
  );

  if (!isEditAllowed) return false;

  if (req.body.emailId && !validator.isEmail(req.body.emailId)) {
    return false;
  }

  return true;
};

module.exports = {
  validateSignUpData,
  validateEditProfileData,
};
