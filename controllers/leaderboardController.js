const TestResult = require('../models/TestResult');

// In-memory cache
let leaderboardCache = {
    all: null,
    week: null,
    month: null
};
let lastCacheTime = {
    all: 0,
    week: 0,
    month: 0
};

// Legacy Route (Redirect or Keep for backwards compatibility)
exports.getTopScores = async (req, res) => {
    try {
        const requestedPattern = req.query.pattern || 'standard'; // Default to standard

        const topScores = await TestResult.find({
            testPattern: requestedPattern,
            attemptMode: 'exam', // Robustness: Ignore practice sessions
            status: 'completed'   // Only show finished exams
        })
            .sort({ totalScore: -1 }) // Sort by highest total marks
            .limit(10)
            .populate('user', 'username avatar'); // Get names from the User collection

        res.json(topScores);
    } catch (error) {
        console.error("LEADERBOARD ERROR:", error);
        res.status(500).json({ message: "Error fetching rankings." });
    }
};

exports.getAllLeaderboards = async (req, res) => {
    const timeframe = req.query.timeframe || 'all'; // 'all', 'week', 'month'
    const now = Date.now();

    // 1. Serve from cache if fresh (within 60 seconds)
    if (leaderboardCache[timeframe] && (now - lastCacheTime[timeframe] < 60000)) {
        return res.json(leaderboardCache[timeframe]);
    }

    try {
        const limit = 25; // Increased from 10 to 25
        
        // Date Filtering
        let dateFilter = {};
        if (timeframe === 'week') {
            const lastWeek = new Date();
            lastWeek.setDate(lastWeek.getDate() - 7);
            dateFilter = { submittedAt: { $gte: lastWeek } };
        } else if (timeframe === 'month') {
            const lastMonth = new Date();
            lastMonth.setMonth(lastMonth.getMonth() - 1);
            dateFilter = { submittedAt: { $gte: lastMonth } };
        }

        const baseQuery = { attemptMode: 'exam', status: 'completed', ...dateFilter };

        // Helper function to get best score per user using aggregation
        const getBestPerUser = async (matchQuery, sortField, sortOrder = -1) => {
            return await TestResult.aggregate([
                { $match: matchQuery },
                { $sort: { [sortField]: sortOrder } },
                {
                    $group: {
                        _id: '$user',
                        bestResult: { $first: '$$ROOT' }
                    }
                },
                { $replaceRoot: { newRoot: '$bestResult' } },
                { $limit: limit }
            ]);
        };

        // Populate user data for each category
        const populateUsers = async (results) => {
            const userIds = results.map(r => r.user).filter(Boolean);
            const users = await require('../models/User').find({ _id: { $in: userIds } }).select('username avatar');
            const userMap = new Map(users.map(u => [u._id.toString(), u]));
            
            return results.map(r => ({
                ...r,
                user: userMap.get(r.user?.toString()) || { username: 'Unknown', avatar: null }
            }));
        };

        const [
            std_overall,
            std_typing,
            std_letter,
            std_excel,
            new_overall,
            new_typing,
            new_mcq
        ] = await Promise.all([
            // 1. Standard Pattern - Overall (best totalScore per user)
            getBestPerUser({ ...baseQuery, testPattern: 'standard' }, 'totalScore')
                .then(populateUsers),

            // 2. Standard Pattern - Typing (best wpm per user)
            getBestPerUser({ ...baseQuery, testPattern: 'standard' }, 'wpm')
                .then(populateUsers),

            // 3. Standard Pattern - Letter (best letterScore per user)
            getBestPerUser({ ...baseQuery, testPattern: 'standard' }, 'letterScore')
                .then(populateUsers),

            // 4. Standard Pattern - Excel (best excelScore per user)
            getBestPerUser({ ...baseQuery, testPattern: 'standard' }, 'excelScore')
                .then(populateUsers),

            // 5. New Pattern - Overall (best totalScore per user)
            getBestPerUser({ ...baseQuery, testPattern: 'new_pattern' }, 'totalScore')
                .then(populateUsers),

            // 6. New Pattern - Typing (best typingScore per user)
            getBestPerUser({ ...baseQuery, testPattern: 'new_pattern' }, 'typingScore')
                .then(populateUsers),

            // 7. New Pattern - Excel MCQ (best mcqScore per user)
            getBestPerUser({ ...baseQuery, testPattern: 'new_pattern' }, 'mcqScore')
                .then(populateUsers)
        ]);

        const results = {
            std_overall,
            std_typing,
            std_letter,
            std_excel,
            new_overall,
            new_typing,
            new_mcq
        };
        
        leaderboardCache[timeframe] = results;
        lastCacheTime[timeframe] = now;
        res.json(results);

    } catch (error) {
        console.error("Leaderboard Fetch Error:", error);
        res.status(500).json({ message: "Failed to load rankings." });
    }
};

exports.getMyRank = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const patterns = ['standard', 'new_pattern'];
        const response = {};

        for (const pattern of patterns) {
            // Find user's best score for this pattern
            const userBest = await TestResult.findOne({ 
                user: userId, 
                testPattern: pattern, 
                attemptMode: 'exam', 
                status: 'completed' 
            }).sort({ totalScore: -1 });

            if (!userBest) {
                response[pattern] = null;
                continue;
            }

            // Count users with higher scores
            const betterCount = await TestResult.countDocuments({
                testPattern: pattern,
                attemptMode: 'exam',
                status: 'completed',
                totalScore: { $gt: userBest.totalScore }
            });

            // Count total unique users for this pattern
            const totalUsersList = await TestResult.distinct('user', {
                testPattern: pattern,
                attemptMode: 'exam',
                status: 'completed'
            });
            const totalUsers = totalUsersList.length;

            // Calculate Rank and Percentile
            const rank = betterCount + 1; // 1-based rank
            
            // FIXED: Percentile should show what % you're better than
            // If you're rank 1 out of 100, you're better than 99% (Top 1%)
            // Formula: (rank / totalUsers) * 100 = percentile you're in
            const percentile = totalUsers > 1 
                ? Math.round((rank / totalUsers) * 100) 
                : 1; // If only 1 user, they're in top 1%

            // Trend: Compare latest vs previous
            const latestTwo = await TestResult.find({
                user: userId,
                testPattern: pattern,
                attemptMode: 'exam',
                status: 'completed'
            }).sort({ submittedAt: -1 }).limit(2);

            let trend = null;
            if (latestTwo.length === 2) {
                const latest = latestTwo[0];
                const prev = latestTwo[1];
                trend = {
                    latestScore: latest.totalScore,
                    previousScore: prev.totalScore,
                    delta: latest.totalScore - prev.totalScore,
                    direction: latest.totalScore >= prev.totalScore ? 'up' : 'down'
                };
            }

            response[pattern] = {
                rank,
                totalUsers,
                percentile,
                bestResult: userBest,
                trend
            };
        }

        res.json(response);
    } catch (error) {
        console.error("My Rank Error:", error);
        res.status(500).json({ message: "Failed to fetch rank." });
    }
};

exports.compareResult = async (req, res) => {
    try {
        const targetResultId = req.params.resultId;
        const userId = req.user.id;

        // Fetch the target result (Them)
        const them = await TestResult.findById(targetResultId).populate('user', 'username avatar');
        if (!them) return res.status(404).json({ message: "Result not found" });

        // Fetch current user's BEST result for the same pattern (You)
        const you = await TestResult.findOne({
            user: userId,
            testPattern: them.testPattern,
            attemptMode: 'exam',
            status: 'completed'
        }).sort({ totalScore: -1 });

        if (!you) {
            return res.json({ 
                them, 
                you: null, 
                message: "You haven't completed a test in this pattern yet." 
            });
        }

        // Calculate Gaps
        const gaps = [];
        
        // Helper to push gaps
        const addGap = (label, youVal, themVal, tipGood, tipBad) => {
            const diff = youVal - themVal;
            const isBetter = diff >= 0;
            gaps.push({
                category: label,
                you: youVal,
                them: themVal,
                diff,
                isBetter,
                tip: isBetter ? tipGood : tipBad
            });
        };

        if (them.testPattern === 'standard') {
            addGap('Typing Speed (WPM)', you.wpm || 0, them.wpm || 0, 
                "You're faster! Keep maintaining accuracy.", "Focus on rhythm to boost speed.");
            addGap('Letter Writing', you.letterScore || 0, them.letterScore || 0, 
                "Great formatting skills!", "Check formatting and salutations.");
            addGap('Excel', you.excelScore || 0, them.excelScore || 0, 
                "Excel-lent work!", "Review formulas and cell formatting.");
        } else {
            addGap('Typing Score', you.typingScore || 0, them.typingScore || 0,
                "Strong typing performance!", "Practice touch typing to improve.");
            addGap('Excel MCQ', you.mcqScore || 0, them.mcqScore || 0,
                "Solid theoretical knowledge.", "Review Excel shortcuts and functions.");
        }

        addGap('Total Score', you.totalScore, them.totalScore, 
            "You're ahead overall!", "Keep practicing to close the gap!");

        res.json({ them, you, gaps });

    } catch (error) {
        console.error("Compare Error:", error);
        res.status(500).json({ message: "Comparison failed" });
    }
};