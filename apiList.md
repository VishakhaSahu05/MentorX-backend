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



 Status - ignored , interested , accepted , rejected

