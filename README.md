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
- created the my-post API for mentor
- created the post delete API


# Important:
- Data is fetched directly from DB or shared service functions
- No API-to-API calls

- built the mentor Event model fir auto delete when the event gets over
- built the APIs of mentor event - post / get / delete


# Real Time chat using WebSocket (Socket.io)

---

## Video Call Recording (Agora Cloud Recording)

Server-side recording of video calls. Agora Cloud Recording runs in **composite ("mix")
mode**, so one output file contains **both participants' video and both participants'
audio**. The browsers never produce the file — closing a tab cannot corrupt a recording.

Recording is **user-initiated and consent-gated**: it never starts automatically when a
call begins.

### Lifecycle

```
A presses Record
  → POST /recording/request          creates a `pending` session, asks B over socket
B accepts
  → POST /recording/:id/consent      Agora acquire → start, status `recording`
Stop (button, call end, or disconnect)
  → Agora stop                       status `stopping` → `processing`
File lands in private S3
  → status `ready`                   secure expiring link emailed to both participants
```

### Files

| File | Role |
|---|---|
| `src/models/callRecording.js` | Recording document + the uniqueness index |
| `src/services/agoraCloudRecording.js` | Agora REST client (acquire/start/stop/query) |
| `src/controllers/recordingController.js` | Lifecycle, authorization, finalize, email |
| `src/routes/recording.js` | REST routes (all behind `userAuth`) |
| `src/services/emailService.js` | SMTP delivery of the recording link |
| `src/utils/presignS3.js` | Short-lived presigned GET URLs |

### API

All routes require a logged-in user, and additionally verify that the user is a
participant of the call in question.

| Method | Route | Purpose |
|---|---|---|
| POST | `/recording/request` | Press Record; asks the other participant for consent |
| POST | `/recording/:id/consent` | `{ accept: true\|false }` — starts or cancels |
| POST | `/recording/:id/stop` | Stop an active recording (either participant) |
| GET | `/recording/active?targetUserId=` | True recording state for a call |
| GET | `/recording/:id` | Status (also resolves a `processing` recording) |
| GET | `/recordings` | The current user's recordings |
| GET | `/recording/:id/download` | Short-lived presigned download URL |

Socket events emitted to both participants: `recording:consent-request`,
`recording:started`, `recording:declined`, `recording:stopping`,
`recording:processing`, `recording:ready`, `recording:failed`.

### One call → one recording

A partial unique index guarantees this at the database level rather than in
application logic:

```js
{ channelName: 1, activeLock: 1 }  // unique, partialFilterExpression: activeLock exists
```

While a recording is `pending`/`recording`/`stopping`/`processing` it holds
`activeLock`. Reaching a terminal state (`ready`/`declined`/`failed`) unsets it, which
frees the slot for a later recording while keeping the history. So if both participants
press Record simultaneously, one insert succeeds and the other fails with a duplicate-key
error, which the controller turns into `409` plus the winning session. Stopping uses an
atomic `findOneAndUpdate` on `status: "recording"`, so two concurrent stops cannot both
call Agora.

### Orphaned recordings

A recording is finalized from three places, so it survives the initiator vanishing:

1. The explicit Stop button.
2. `video-call:end` — the call ended without pressing Stop.
3. Socket `disconnect` — the participant dropped (closed laptop, lost network).

Agora's own `maxIdleTime: 30` is a final backstop: it stops recording if the channel
goes empty. The DB is updated by our own handlers so state never drifts.

### Privacy

- Recordings stay **private in S3**. Nothing is ever made public-read.
- Download is always a presigned URL that expires in ~24h.
- Emails carry a **link, never an attachment** — a 720p recording is far larger than the
  ~25MB attachment ceiling mail providers enforce, and an attachment would bypass access
  control.

### Configuration

See `.env.example`. Beyond the existing AWS/Agora values, recording needs:

```
AGORA_CUSTOMER_ID=        # RESTful API "Customer ID" from the Agora console
AGORA_CUSTOMER_SECRET=    # RESTful API "Customer Secret"
SMTP_HOST=  SMTP_PORT=  SMTP_USER=  SMTP_PASS=  SMTP_FROM=
```

Two things that are easy to get wrong:

- Cloud Recording authenticates with the **Customer ID / Customer Secret** pair, *not*
  the App ID / App Certificate used to mint RTC tokens.
- Agora wants the S3 region as a **numeric enum**, not the AWS region string
  (`ap-south-1` → `14`). The mapping lives in `agoraCloudRecording.js`.

Cloud Recording must also be enabled for the project in the Agora console.
If SMTP is not configured the recording still completes; the email step is skipped and
the reason is stored on the recording document.

### Security fix included

`GET /api/agora-token` previously required **no authentication** and would mint a
publisher token for any `channelName` supplied in the query string, letting anyone join
any call. It now requires a session and verifies the caller is one of the participants
encoded in the channel name.
