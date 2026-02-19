// In models/ExcelQuestion.js
const mongoose = require('mongoose');

const excelQuestionSchema = new mongoose.Schema({
    questionName: { type: String, required: true },
    questionFilePath: { type: String, required: true }, // Path to the blank question file
    solutionFilePath: { type: String, required: true }, // Path to the correct solution file
    hints: [{ type: String }], // Progressive hints shown one at a time (-1 pt each)
    solutionSteps: [{ type: String }] // Step-by-step walkthrough shown after submission
});

module.exports = mongoose.model('ExcelQuestion', excelQuestionSchema);