const Settings = require('../models/Settings');

// Get current settings (or create default if not exists)
exports.getSettings = async (req, res) => {
    try {
        let settings = await Settings.findOne({ key: 'global_exam_config' });
        
        if (!settings) {
            settings = new Settings();
            await settings.save();
        }
        
        res.json(settings);
    } catch (error) {
        console.error("Get Settings Error:", error);
        res.status(500).json({ message: "Failed to fetch settings." });
    }
};

// Get public config for users
exports.getPublicConfig = async (req, res) => {
    try {
        let settings = await Settings.findOne({ key: 'global_exam_config' });
        if (!settings) settings = new Settings();

        res.json({
            typing: settings.typing,
            excelMcqDuration: settings.exam.excelMcqTimerSeconds
        });
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch config" });
    }
};

// Update settings
exports.updateSettings = async (req, res) => {
    try {
        const { typing, exam } = req.body;
        
        const settings = await Settings.findOneAndUpdate(
            { key: 'global_exam_config' },
            { 
                $set: {
                    typing: typing,
                    exam: exam
                }
            },
            { new: true, upsert: true }
        );
        
        res.json({ message: "Settings updated successfully", settings });
    } catch (error) {
        console.error("Update Settings Error:", error);
        res.status(500).json({ message: "Failed to update settings." });
    }
};
