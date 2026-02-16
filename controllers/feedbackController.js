const Feedback = require('../models/Feedback');

exports.submitFeedback = async (req, res) => {
    try {
        const { feedbackType, message } = req.body;
        const newFeedback = new Feedback({
            user: req.userId,
            feedbackType,
            message
        });
        await newFeedback.save();
        res.status(201).json({ message: 'Feedback submitted successfully. Thank you!' });
    } catch (error) {
        res.status(500).json({ message: 'Server error. Please try again.' });
    }
};
