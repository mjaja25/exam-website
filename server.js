// -------------------
//  SERVER ENTRY POINT
//  Connects to DB and starts listening
// -------------------
const mongoose = require('mongoose');
const app = require('./app');

const PORT = process.env.PORT || 3000;

// -------------------
//  DATABASE CONNECTION
// -------------------
mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,  // fail fast instead of hanging for 30s
    socketTimeoutMS: 10000,
})
    .then(() => console.log('Successfully connected to MongoDB Atlas!'))
    .catch(err => console.error('Error connecting to MongoDB:', err.message));

app.listen(PORT, () => {
    console.log(`Server is successfully running on http://localhost:${PORT}`);
});
