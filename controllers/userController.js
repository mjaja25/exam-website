const User = require('../models/User');
const TestResult = require('../models/TestResult');
const { createDownloadUrl } = require('../utils/helpers');

exports.getDashboard = async (req, res) => {
    try {
        // Find the user making the request
        const user = await User.findById(req.userId);

        // Find the results for that user
        let results = await TestResult.find({ user: req.userId }).sort({ submittedAt: -1 });

        // Modify the excelFilePath for any Excel results before sending
        results = results.map(r => {
            if (r.excelFilePath) {
                r.excelFilePath = createDownloadUrl(r.excelFilePath);
            }
            return r;
        });

        // Send back both the user details and their modified results
        res.json({ user: user, results: results });

    } catch (error) {
        console.error("Dashboard Error:", error);
        res.status(500).json({ message: 'Server error fetching dashboard data.' });
    }
};

exports.getAchievements = async (req, res) => {
    try {
        const userId = req.user.id;
        const results = await TestResult.find({ 
            user: userId, 
            attemptMode: 'exam', 
            status: 'completed' 
        }).sort({ submittedAt: 1 }); // Oldest first for "First Steps" check

        const stats = {
            totalExams: results.length,
            maxWpm: 0,
            maxAccuracy: 0,
            maxMcq: 0,
            maxLetter: 0,
            hasImprovement: false
        };

        // Compute aggregations
        if (results.length > 0) {
            stats.maxWpm = Math.max(...results.map(r => r.wpm || 0));
            stats.maxAccuracy = Math.max(...results.map(r => r.accuracy || 0));
            stats.maxMcq = Math.max(...results.map(r => r.mcqScore || 0));
            stats.maxLetter = Math.max(...results.map(r => r.letterScore || 0));
            
            // Check for simple improvement (current > previous at least once)
            for (let i = 1; i < results.length; i++) {
                if (results[i].totalScore > results[i-1].totalScore + 5) {
                    stats.hasImprovement = true;
                    break;
                }
            }
        }

        // Define Badges
        const allBadges = [
            { id: 'first_steps', name: 'First Steps', icon: '🐣', desc: 'Completed your first exam', condition: stats.totalExams >= 1 },
            { id: 'consistent', name: 'Consistent', icon: '📅', desc: 'Completed 5+ exams', condition: stats.totalExams >= 5 },
            { id: 'veteran', name: 'Veteran', icon: '🎖️', desc: 'Completed 10+ exams', condition: stats.totalExams >= 10 },
            { id: 'speed_demon', name: 'Speed Demon', icon: '⚡', desc: 'Reached 40+ WPM', condition: stats.maxWpm >= 40 },
            { id: 'sharpshooter', name: 'Sharpshooter', icon: '🎯', desc: '95%+ Accuracy in a test', condition: stats.maxAccuracy >= 95 },
            { id: 'perfect_mcq', name: 'Trivia Master', icon: '🧠', desc: 'Scored 20/20 in MCQ', condition: stats.maxMcq >= 20 },
            { id: 'letter_master', name: 'Scribe', icon: '✍️', desc: 'Perfect 10/10 in Letter', condition: stats.maxLetter >= 10 },
            { id: 'rising_star', name: 'Rising Star', icon: '🚀', desc: 'Improved score by 5+ points', condition: stats.hasImprovement }
        ];

        // Filter to earned status
        const response = allBadges.map(b => ({
            ...b,
            earned: b.condition
        }));

        res.json(response);

    } catch (error) {
        console.error("Achievements Error:", error);
        res.status(500).json({ message: "Failed to fetch achievements" });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const { bio, avatarType, defaultAvatarId } = req.body;
        const userId = req.user.id;
        
        const updateData = {};
        if (bio !== undefined) updateData.bio = bio;

        // Handle Avatar Update
        if (req.file) {
            // Custom Upload
            updateData.avatar = req.file.path; // Cloudinary URL
        } else if (avatarType === 'default' && defaultAvatarId) {
            // Default Avatar Selection
            updateData.avatar = `default-${defaultAvatarId}`;
        }

        const user = await User.findByIdAndUpdate(userId, updateData, { new: true });
        
        res.json({ 
            message: "Profile updated successfully", 
            user: { 
                username: user.username, 
                email: user.email, 
                avatar: user.avatar,
                bio: user.bio 
            } 
        });

    } catch (error) {
        console.error("Profile Update Error:", error);
        res.status(500).json({ message: "Failed to update profile" });
    }
};