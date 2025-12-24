- Created Repository
- Intialized the Repository
- Installed express
- Created a server
- Listen to port 3000

- Installed nodemon 
- Installed Mongoose library
- Connected Application to the Database /MentorX
- Installed dotenv
- Created a userSchema and userModel

- API - signUp , Feed , delete , edit
- Data Sanitization - Added API level validation in singup and update API
- Installed validator
- Used Validator func for password , emails , photoUrl for security of database
- validated the data in signup API
- Installed bcrypt package
- password hasing completed using bcrypt.hash & save user with encrypted password
- Created login API
- validated the email and password while logging

- installed cookie-parser
- just send the dummy cookie to user (verification)
- created GET/profile API and check if I recieve the cookie back
- Installed JsonWebToken
- In login API , after email and password validation , created a JWT token and it back to user inside    
  cookies
- read the cookies inside the profile APi and found the logged in user

- UserAuth middleware
- Add userAuth middleware to all the APIs 
- Set the expiry in jwt token/cookies
- Created list of All APis which I can think of in MentorX
- Grouped multiple routers with respective routers
- Refactored code using express routers


- Created POST/logout API
- Created PATCH/profile/edit
- Created PATCH/profile/password //forgot password API


- Created Connection request Schema
- Created Connection Request API
- proper validation and testing completed
- created request/review/accpeted,rejected API
- created GET user/requests/recieved //for mentor
- created GET user/connection //for both mentor and student

- Recovery Successfull
- created a block Schema
- created a block/unblock API for Mentor
- modified the request/sent API ( block student will not be allowed to sent req again to same mentor)

- Created account and Installed S3 
- Configured S3 in backend
- Upload API created


# Core Flow

- Mentors create posts with media (image/video)
- Media is uploaded to AWS S3
- The returned media URL is saved along with post data in MongoDB
- Students can view mentor posts via a feed.
- Mentors can view their own posts in their dashboard.

# Student Feed

- Students can view all mentor posts.
- Posts are displayed in latest-first order.
- Each post includes:
- Mentor name
- Mentor profile picture
- Media (image/video)
- Caption
- Students can click on a mentor to view their full profile.


- completed the Feed API
- mentor profile API