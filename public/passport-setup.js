const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('./models/User'); // We'll create this model file shortly

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/api/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    // This function is called when a user successfully authenticates with Google
    try {
      // Check if a user with this Google ID already exists
      let user = await User.findOne({ googleId: profile.id });

      if (user) {
        // If user exists, continue
        return done(null, user);
      } else {
        // If not, create a new user in your database
        const newUser = new User({
          googleId: profile.id,
          email: profile.emails[0].value,
          // You can add other fields like 'name' from the profile object
        });
        await newUser.save();
        return done(null, newUser);
      }
    } catch (error) {
      return done(error, false);
    }
  }
));

// These functions are used by Passport to manage the user's session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, false);
  }
});