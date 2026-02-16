import { adminApi } from '../../api/admin.js';
import { ui } from '../../utils/ui.js';

export class ContentManager {
    constructor() {
        this.bindEvents();
    }

    bindEvents() {
        // Passages
        const passageForm = document.getElementById('add-passage-form');
        if (passageForm) passageForm.addEventListener('submit', (e) => this.handlePassageSubmit(e));

        // Letter Questions
        const letterForm = document.getElementById('add-question-form');
        if (letterForm) letterForm.addEventListener('submit', (e) => this.handleLetterSubmit(e));

        // Excel Questions
        const excelForm = document.getElementById('add-excel-form');
        if (excelForm) excelForm.addEventListener('submit', (e) => this.handleExcelSubmit(e));
    }

    async handlePassageSubmit(e) {
        e.preventDefault();
        try {
            await adminApi.createPassage({
                content: document.getElementById('passage-content').value,
                difficulty: document.getElementById('difficulty').value
            });
            ui.showToast('Passage added!', 'success');
            e.target.reset();
        } catch (err) { ui.showToast(err.message, 'error'); }
    }

    async handleLetterSubmit(e) {
        e.preventDefault();
        try {
            await adminApi.createLetterQuestion({
                questionText: document.getElementById('question-text').value,
                category: document.getElementById('question-category').value
            });
            ui.showToast('Letter Question added!', 'success');
            e.target.reset();
        } catch (err) { ui.showToast(err.message, 'error'); }
    }

    async handleExcelSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);

        try {
            await adminApi.createExcelQuestion(formData);
            ui.showToast('Excel Question added!', 'success');
            e.target.reset();
        } catch (err) { ui.showToast(err.message, 'error'); }
    }
}
