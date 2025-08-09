// In models/ExcelQuestion.js
const mongoose = require('mongoose');

const excelQuestionSchema = new mongoose.Schema({
    questionName: { type: String, required: true },
    questionFilePath: { type: String, required: true }, // Path to the blank question file
    solutionFilePath: { type: String, required: true }, // Path to the correct solution file
});

module.exports = mongoose.model('ExcelQuestion', excelQuestionSchema);