const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const mongoose = require('mongoose');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const passportLocalMongoose = require('passport-local-mongoose');
const session = require('express-session');
const connectMongo = require('connect-mongo');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Create a User model
const UserSchema = new mongoose.Schema({});
UserSchema.plugin(passportLocalMongoose, { usernameField: 'username' });
const User = mongoose.model('User', UserSchema);

// Connect to MongoDB
mongoose.connect('mongodb://localhost/survey_portal', { useNewUrlParser: true, useUnifiedTopology: true });

// Set up session store using connect-mongo
const MongoStore = connectMongo.create({
  mongoUrl: 'mongodb://localhost/survey_portal',
  mongooseConnection: mongoose.connection,
  // additional options if needed
});

// Use express-session middleware
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  store: MongoStore,
}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Set up passport for user authentication
app.use(passport.initialize());
app.use(passport.session());

// Serialize and deserialize user for session management
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Passport Local Strategy
passport.use(new LocalStrategy(User.authenticate()));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, '../public')));

// Route to the registration page
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/register.html'));
});

// Handle user registration
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.register(new User({ username }), password);
    passport.authenticate('local')(req, res, () => {
      res.redirect('/dashboard'); // Redirect to the dashboard after registration
    });
  } catch (error) {
    console.error(error);
    res.redirect('/register'); // Redirect back to the registration page on error
  }
});

// Route to the login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

// Handle user login
app.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Internal Server Error');
    }
    if (!user) {
      // Authentication failed
      return res.redirect('/login');
    }
    req.logIn(user, (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Internal Server Error');
      }
      return res.redirect('/dashboard');
    });
  })(req, res, next);

});

app.get('/', (req, res) => {
  res.send('Welcome to the Survey Portal!');
});

// Route to the dashboard page
app.get('/dashboard', isAuthenticated, async (req, res) => {
  try {
    // Make a request to the survey supply sandbox API
    const response = await axios.get('https://surveysupplysandbox.zamplia.com/api/v1/Surveys/GetAllocatedSurveys', {
      headers: {
        'ZAMP-KEY': 'txtTr1kFQJCFjsZ9BvyHUoc5WThDzyyW', // Staging Key
        'accept': 'application/json',
      },
    });

    // Extract survey data from the response
    const surveyData = response.data.result.data;

    // Render the dashboard template with survey data
    res.render('dashboard', { username: req.user.username, surveys: surveyData });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Middleware to check if the user is authenticated
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

app.set('view engine', 'ejs'); // Set EJS as the view engine

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
