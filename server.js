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
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Successfully connected to MongoDB Atlas!'))
    .catch(err => console.error('Error connecting to MongoDB:', err));

app.listen(PORT, () => {
    console.log(`Server is successfully running on http://localhost:${PORT}`);
});
