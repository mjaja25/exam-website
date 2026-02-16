import { adminApi } from '../../api/admin.js';
import { ui } from '../../utils/ui.js';

export class ContentManager {
    constructor() {
        this.bindEvents();
        this.loadContent();
    }

    bindEvents() {
        const passageForm = document.getElementById('add-passage-form');
        if (passageForm) passageForm.addEventListener('submit', (e) => this.handlePassageSubmit(e));

        const letterForm = document.getElementById('add-question-form');
        if (letterForm) letterForm.addEventListener('submit', (e) => this.handleLetterSubmit(e));

        const excelForm = document.getElementById('add-excel-form');
        if (excelForm) excelForm.addEventListener('submit', (e) => this.handleExcelSubmit(e));
    }

    async loadContent() {
        await Promise.all([
            this.loadPassages(),
            this.loadLetterQuestions(),
            this.loadExcelQuestions()
        ]);
    }

    async loadPassages() {
        const list = document.getElementById('passages-list');
        if (!list) return;

        try {
            const passages = await adminApi.getPassages();
            this.renderPassages(passages);
        } catch (err) {
            list.innerHTML = '<p class="loading">Failed to load passages</p>';
        }
    }

    renderPassages(passages) {
        const list = document.getElementById('passages-list');
        if (!list) return;

        if (!passages || passages.length === 0) {
            list.innerHTML = '<p class="loading">No passages yet. Add one below.</p>';
            return;
        }

        list.innerHTML = passages.map(p => `
            <div class="content-item" data-id="${p._id}">
                <div class="content-item-text">${p.content}</div>
                <div class="content-item-meta">
                    <span class="badge-mcq">${p.difficulty}</span>
                </div>
            </div>
        `).join('');
    }

    async loadLetterQuestions() {
        const list = document.getElementById('letters-list');
        if (!list) return;

        try {
            const questions = await adminApi.getLetterQuestions();
            this.renderLetterQuestions(questions);
        } catch (err) {
            list.innerHTML = '<p class="loading">Failed to load questions</p>';
        }
    }

    renderLetterQuestions(questions) {
        const list = document.getElementById('letters-list');
        if (!list) return;

        if (!questions || questions.length === 0) {
            list.innerHTML = '<p class="loading">No letter questions yet. Add one below.</p>';
            return;
        }

        list.innerHTML = questions.map(q => `
            <div class="content-item" data-id="${q._id}">
                <div class="content-item-text">${q.questionText}</div>
                <div class="content-item-meta">
                    <span class="badge-mcq">${q.category}</span>
                </div>
            </div>
        `).join('');
    }

    async loadExcelQuestions() {
        const list = document.getElementById('excel-list');
        if (!list) return;

        try {
            const questions = await adminApi.getExcelQuestions();
            this.renderExcelQuestions(questions);
        } catch (err) {
            list.innerHTML = '<p class="loading">Failed to load questions</p>';
        }
    }

    renderExcelQuestions(questions) {
        const list = document.getElementById('excel-list');
        if (!list) return;

        if (!questions || questions.length === 0) {
            list.innerHTML = '<p class="loading">No Excel questions yet. Add one below.</p>';
            return;
        }

        list.innerHTML = questions.map(q => `
            <div class="content-item" data-id="${q._id}">
                <div class="content-item-text">${q.questionName}</div>
                <div class="content-item-meta">
                    <span class="badge-mcq">${q.category || 'Practical'}</span>
                </div>
            </div>
        `).join('');
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
            this.loadPassages();
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
            this.loadLetterQuestions();
        } catch (err) { ui.showToast(err.message, 'error'); }
    }

    async handleExcelSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);

        try {
            await adminApi.createExcelQuestion(formData);
            ui.showToast('Excel Question added!', 'success');
            e.target.reset();
            this.loadExcelQuestions();
        } catch (err) { ui.showToast(err.message, 'error'); }
    }
}
