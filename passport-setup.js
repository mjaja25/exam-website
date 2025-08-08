const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('./models/User'); // We'll create this model file shortly

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/api/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const googleId = profile.id;
      const email = profile.emails[0].value;

      // Step 1: Check if a user already exists with this Google ID.
      let user = await User.findOne({ googleId: googleId });
      if (user) {
        return done(null, user); // User found, log them in.
      }

      // Step 2: If not, check if a user exists with the same email address.
      user = await User.findOne({ email: email });
      if (user) {
        // This user registered with email/password before. Link their Google ID.
        user.googleId = googleId;
        await user.save();
        return done(null, user); // Log them in.
      }

      // Step 3: If no user is found by Google ID or email, create a new one.
      const newUser = new User({
          googleId: profile.id,
          email: profile.emails[0].value,
          username: profile.displayName, // Fetch username from Google profile
          isVerified: true
      });
      await newUser.save();
      return done(null, newUser);

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