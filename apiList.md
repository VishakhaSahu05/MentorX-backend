 # MentorX APIs
 authRouter
 - POST/signup
 - POST/login
 - POST/logout

profileRouter
 - GET/profile/view
 - PATCH/profile/edit
 - PATCH/profile/password

ConnectionRequestRouter
 - POST/request/send/interested/:userId
 - POST/request/send/ignored/:userId
 
 - POST/request/review/accepted/:userId
 - POST/request/review/rejected/:userId

UserRouter
 - GET/user/connections
 - GET/user/request/recieved
 - GET/user/feed - gets you the profile of other users on platform
 - POST/user/block/:studentId
 - DELETE/user/unblock/:studentId

 Status - ignored , interested , accepted , rejected

# Mentor Dashboard API
- GET/mentor/:userId -> gets mentor's dashboard on the student's feed
- Backend entry point
- Request hits Dashboard Controller
- User is already authenticated (req.user available)

# Data fetching (inside backend)
- Inside the dashboard API:
- Fetch connections / followers
- Fetch posts
- Fetch ratings
- Fetch any extra info (profile, stats, etc.)

# APIs for Calendar
- POST /mentor/event → event add
- GET /mentor/event → mentor ke events
- DELETE /mentor/event/:id → manual delete (optional)