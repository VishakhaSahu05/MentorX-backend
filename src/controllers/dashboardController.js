const User = require("../models/user");
const Post = require("../models/post");
const Connection = require("../models/connectionRequest");

const getDashboard = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const loggedInUserId = req.user._id;
    const dashboardUserId = req.params.userId || loggedInUserId;

    const isOwner =
      loggedInUserId.toString() === dashboardUserId.toString();

    const rating = 4.6;

    const [user, posts, followersCount] = await Promise.all([
      User.findById(dashboardUserId),
      Post.find({ mentor: dashboardUserId }).sort({ createdAt: -1 }),
      Connection.countDocuments({
        toUserId: dashboardUserId,
        status: "accepted",
      }),
    ]);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      view: isOwner ? "OWNER" : "PUBLIC",
      profile: {
        firstName: user.firstName,
        lastName: user.lastName,
        skills: user.skills,
        profilePic: user.profilePic,
        department: user.department,
      },
      stats: {
        followersCount,
        rating,
      },
      posts,
    });
  } catch (err) {
    console.error("DASHBOARD ERROR ", err);
    return res.status(500).json({
      error: "Failed to load dashboard",
    });
  }
};

const FEATURED_LIMIT = 6;
const DEFAULT_PROFILE_PIC = User.schema.path("profilePic").defaultValue;

/**
 * Public list of mentors for the landing page. Only fields a visitor may see:
 * no email, age, gender or anything private. Mentors with fuller profiles
 * (own photo, skills, about) are shown first.
 */
const getFeaturedMentors = async (req, res) => {
  try {
    const mentors = await User.find({ role: "mentor" })
      .select("firstName lastName profilePic department skills about")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const completeness = (m) =>
      (m.profilePic && m.profilePic !== DEFAULT_PROFILE_PIC ? 2 : 0) +
      (m.skills?.length ? 1 : 0) +
      (m.about ? 1 : 0);

    const featured = mentors
      .map((m, i) => ({ m, i, score: completeness(m) }))
      .sort((a, b) => b.score - a.score || a.i - b.i)
      .slice(0, FEATURED_LIMIT)
      .map(({ m }) => ({
        _id: m._id,
        firstName: m.firstName?.trim(),
        lastName: m.lastName?.trim(),
        profilePic:
          m.profilePic && m.profilePic !== DEFAULT_PROFILE_PIC
            ? m.profilePic
            : null,
        department: m.department,
        skills: (m.skills || []).slice(0, 4),
        about: m.about ? m.about.slice(0, 140) : "",
      }));

    return res.json({ mentors: featured });
  } catch (err) {
    console.error("FEATURED MENTORS ERROR ", err);
    return res.status(500).json({ error: "Failed to load mentors" });
  }
};

module.exports = { getDashboard, getFeaturedMentors };
