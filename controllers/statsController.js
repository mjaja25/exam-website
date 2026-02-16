const TestResult = require('../models/TestResult');

exports.getAllTestsStats = async (req, res) => {
    try {
        const stats = await TestResult.aggregate([
            { $match: { status: 'completed' } },
            {
                $group: {
                    _id: "$testPattern",
                    averageTotal: { $avg: "$totalScore" },
                    topTotal: { $max: "$totalScore" },
                    averageTyping: { $avg: "$typingScore" },
                    topTyping: { $max: "$typingScore" },
                    averageLetter: { $avg: "$letterScore" },
                    topLetter: { $max: "$letterScore" },
                    averageExcel: { $avg: "$excelScore" },
                    topExcel: { $max: "$excelScore" },
                    averageMcq: { $avg: "$mcqScore" },
                    topMcq: { $max: "$mcqScore" },
                    count: { $sum: 1 }
                }
            }
        ]);

        const formattedStats = stats.reduce((acc, item) => {
            acc[item._id || 'unknown'] = {
                total: { average: item.averageTotal, top: item.topTotal },
                typing: { average: item.averageTyping, top: item.topTyping },
                letter: { average: item.averageLetter, top: item.topLetter },
                excel: { average: item.averageExcel, top: item.topExcel },
                mcq: { average: item.averageMcq, top: item.topMcq },
                count: item.count
            };
            return acc;
        }, {});

        res.json(formattedStats);
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching stats.' });
    }
};

exports.getGlobalStats = async (req, res) => {
    try {
        const stats = await TestResult.aggregate([
            { $match: { status: 'completed' } },
            {
                $group: {
                    _id: "$testPattern", // Group by Pattern (standard vs new_pattern)

                    // Averages
                    avgTyping: { $avg: "$typingScore" },
                    avgLetter: { $avg: "$letterScore" },
                    avgExcel: { $avg: "$excelScore" },
                    avgMCQ: { $avg: "$mcqScore" },

                    // Max Scores
                    maxTyping: { $max: "$typingScore" },
                    maxLetter: { $max: "$letterScore" },
                    maxExcel: { $max: "$excelScore" },
                    maxMCQ: { $max: "$mcqScore" }
                }
            }
        ]);

        // Transform into a cleaner object for frontend
        const result = {
            standard: stats.find(s => s._id === 'standard') || {},
            new_pattern: stats.find(s => s._id === 'new_pattern') || {}
        };

        // Fill defaults if missing
        const defaultStats = { avgTyping: 0, avgLetter: 0, avgExcel: 0, avgMCQ: 0, maxTyping: 0, maxLetter: 0, maxExcel: 0, maxMCQ: 0 };
        result.standard = { ...defaultStats, ...result.standard };
        result.new_pattern = { ...defaultStats, ...result.new_pattern };

        res.json(result);

    } catch (error) {
        console.error("Stats Error:", error);
        res.status(500).json({ message: "Failed to fetch stats" });
    }
};
