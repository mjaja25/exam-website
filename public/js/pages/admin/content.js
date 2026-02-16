import { adminApi } from '../../api/admin.js';
import { ui } from '../../utils/ui.js';

export class ContentManager {
    constructor() {
        // Pagination state
        this.passagesPage = 1;
        this.passagesTotalPages = 1;
        this.lettersPage = 1;
        this.lettersTotalPages = 1;
        this.excelPage = 1;
        this.excelTotalPages = 1;

        // Search timeouts
        this.passagesSearchTimeout = null;
        this.lettersSearchTimeout = null;
        this.excelSearchTimeout = null;

        this.bindEvents();
        this.loadContent();
    }

    bindEvents() {
        // Passages form
        const passageForm = document.getElementById('add-passage-form');
        if (passageForm) passageForm.addEventListener('submit', (e) => this.handlePassageSubmit(e));

        // Passages search & filter
        const passageSearch = document.getElementById('passage-search');
        if (passageSearch) {
            passageSearch.addEventListener('input', () => {
                clearTimeout(this.passagesSearchTimeout);
                this.passagesSearchTimeout = setTimeout(() => this.loadPassages(1), 500);
            });
        }

        const passageFilter = document.getElementById('passage-filter-difficulty');
        if (passageFilter) passageFilter.addEventListener('change', () => this.loadPassages(1));

        // Passages pagination
        const passagesPrev = document.getElementById('passages-prev-btn');
        const passagesNext = document.getElementById('passages-next-btn');
        if (passagesPrev) passagesPrev.onclick = () => this.loadPassages(this.passagesPage - 1);
        if (passagesNext) passagesNext.onclick = () => this.loadPassages(this.passagesPage + 1);

        // Letters form
        const letterForm = document.getElementById('add-question-form');
        if (letterForm) letterForm.addEventListener('submit', (e) => this.handleLetterSubmit(e));

        // Letters search & filter
        const letterSearch = document.getElementById('letter-search');
        if (letterSearch) {
            letterSearch.addEventListener('input', () => {
                clearTimeout(this.lettersSearchTimeout);
                this.lettersSearchTimeout = setTimeout(() => this.loadLetterQuestions(1), 500);
            });
        }

        const letterFilter = document.getElementById('letter-filter-category');
        if (letterFilter) letterFilter.addEventListener('change', () => this.loadLetterQuestions(1));

        // Letters pagination
        const lettersPrev = document.getElementById('letters-prev-btn');
        const lettersNext = document.getElementById('letters-next-btn');
        if (lettersPrev) lettersPrev.onclick = () => this.loadLetterQuestions(this.lettersPage - 1);
        if (lettersNext) lettersNext.onclick = () => this.loadLetterQuestions(this.lettersPage + 1);

        // Excel form
        const excelForm = document.getElementById('add-excel-form');
        if (excelForm) excelForm.addEventListener('submit', (e) => this.handleExcelSubmit(e));

        // Excel search
        const excelSearch = document.getElementById('excel-search');
        if (excelSearch) {
            excelSearch.addEventListener('input', () => {
                clearTimeout(this.excelSearchTimeout);
                this.excelSearchTimeout = setTimeout(() => this.loadExcelQuestions(1), 500);
            });
        }

        // Excel pagination
        const excelPrev = document.getElementById('excel-prev-btn');
        const excelNext = document.getElementById('excel-next-btn');
        if (excelPrev) excelPrev.onclick = () => this.loadExcelQuestions(this.excelPage - 1);
        if (excelNext) excelNext.onclick = () => this.loadExcelQuestions(this.excelPage + 1);
    }

    loadContent() {
        this.loadPassages(1);
        this.loadLetterQuestions(1);
        this.loadExcelQuestions(1);
    }

    // ========== PASSAGES ==========
    async loadPassages(page = 1) {
        const list = document.getElementById('passages-list');
        if (!list) return;

        this.passagesPage = page;
        const search = document.getElementById('passage-search')?.value || '';
        const difficulty = document.getElementById('passage-filter-difficulty')?.value || '';

        try {
            const data = await adminApi.getPassages({
                page,
                limit: 1,
                search: search || undefined,
                difficulty: difficulty || undefined
            });
            
            this.passagesTotalPages = data.pages;
            this.renderPassages(data.passages);
            this.updatePassagesPagination();
        } catch (err) {
            console.error('Load passages error:', err);
            list.innerHTML = '<p class="loading">Failed to load passages</p>';
        }
    }

    renderPassages(passages) {
        const list = document.getElementById('passages-list');
        if (!list) return;

        if (!passages || passages.length === 0) {
            list.innerHTML = '<p class="loading">No passages found.</p>';
            return;
        }

        list.innerHTML = passages.map(p => `
            <div class="content-item" data-id="${p._id}">
                <div class="content-item-text">${p.content}</div>
                <div class="content-item-actions">
                    <span class="badge-mcq">${p.difficulty}</span>
                    <button class="btn-delete-content" data-type="passage" data-id="${p._id}">Delete</button>
                </div>
            </div>
        `).join('');

        // Bind delete events
        list.querySelectorAll('.btn-delete-content').forEach(btn => {
            btn.onclick = async (e) => {
                const type = btn.dataset.type;
                const id = btn.dataset.id;
                if (confirm('Are you sure you want to delete this?')) {
                    try {
                        if (type === 'passage') await adminApi.deletePassage(id);
                        else if (type === 'letter') await adminApi.deleteLetterQuestion(id);
                        else if (type === 'excel') await adminApi.deleteExcelQuestion(id);
                        ui.showToast('Deleted successfully', 'success');
                        // Reload current page
                        if (type === 'passage') this.loadPassages(this.passagesPage);
                        else if (type === 'letter') this.loadLetterQuestions(this.lettersPage);
                        else if (type === 'excel') this.loadExcelQuestions(this.excelPage);
                    } catch (err) {
                        ui.showToast('Failed to delete', 'error');
                    }
                }
            };
        });
    }

    updatePassagesPagination() {
        const prev = document.getElementById('passages-prev-btn');
        const next = document.getElementById('passages-next-btn');
        const info = document.getElementById('passages-page-info');

        if (info) info.innerText = `Page ${this.passagesPage} of ${this.passagesTotalPages || 1}`;
        if (prev) prev.disabled = this.passagesPage <= 1;
        if (next) next.disabled = this.passagesPage >= this.passagesTotalPages;
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
            this.loadPassages(1);
        } catch (err) { ui.showToast(err.message, 'error'); }
    }

    // ========== LETTER QUESTIONS ==========
    async loadLetterQuestions(page = 1) {
        const list = document.getElementById('letters-list');
        if (!list) return;

        this.lettersPage = page;
        const search = document.getElementById('letter-search')?.value || '';
        const category = document.getElementById('letter-filter-category')?.value || '';

        try {
            const data = await adminApi.getLetterQuestions({
                page,
                limit: 5,
                search: search || undefined,
                category: category || undefined
            });
            
            this.lettersTotalPages = data.pages;
            this.renderLetterQuestions(data.questions);
            this.updateLettersPagination();
        } catch (err) {
            console.error('Load letter questions error:', err);
            list.innerHTML = '<p class="loading">Failed to load questions</p>';
        }
    }

    renderLetterQuestions(questions) {
        const list = document.getElementById('letters-list');
        if (!list) return;

        if (!questions || questions.length === 0) {
            list.innerHTML = '<p class="loading">No questions found.</p>';
            return;
        }

        list.innerHTML = questions.map(q => `
            <div class="content-item" data-id="${q._id}">
                <div class="content-item-text">${q.questionText}</div>
                <div class="content-item-actions">
                    <span class="badge-mcq">${q.category}</span>
                    <button class="btn-delete-content" data-type="letter" data-id="${q._id}">Delete</button>
                </div>
            </div>
        `).join('');

        // Bind delete events
        list.querySelectorAll('.btn-delete-content').forEach(btn => {
            btn.onclick = async (e) => {
                const type = btn.dataset.type;
                const id = btn.dataset.id;
                if (confirm('Are you sure you want to delete this?')) {
                    try {
                        if (type === 'passage') await adminApi.deletePassage(id);
                        else if (type === 'letter') await adminApi.deleteLetterQuestion(id);
                        else if (type === 'excel') await adminApi.deleteExcelQuestion(id);
                        ui.showToast('Deleted successfully', 'success');
                        if (type === 'passage') this.loadPassages(this.passagesPage);
                        else if (type === 'letter') this.loadLetterQuestions(this.lettersPage);
                        else if (type === 'excel') this.loadExcelQuestions(this.excelPage);
                    } catch (err) {
                        ui.showToast('Failed to delete', 'error');
                    }
                }
            };
        });
    }

    updateLettersPagination() {
        const prev = document.getElementById('letters-prev-btn');
        const next = document.getElementById('letters-next-btn');
        const info = document.getElementById('letters-page-info');

        if (info) info.innerText = `Page ${this.lettersPage} of ${this.lettersTotalPages || 1}`;
        if (prev) prev.disabled = this.lettersPage <= 1;
        if (next) next.disabled = this.lettersPage >= this.lettersTotalPages;
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
            this.loadLetterQuestions(1);
        } catch (err) { ui.showToast(err.message, 'error'); }
    }

    // ========== EXCEL QUESTIONS ==========
    async loadExcelQuestions(page = 1) {
        const list = document.getElementById('excel-list');
        if (!list) return;

        this.excelPage = page;
        const search = document.getElementById('excel-search')?.value || '';

        try {
            const data = await adminApi.getExcelQuestions({
                page,
                limit: 4,
                search: search || undefined
            });
            
            this.excelTotalPages = data.pages;
            this.renderExcelQuestions(data.questions);
            this.updateExcelPagination();
        } catch (err) {
            console.error('Load excel questions error:', err);
            list.innerHTML = '<p class="loading">Failed to load questions</p>';
        }
    }

    renderExcelQuestions(questions) {
        const list = document.getElementById('excel-list');
        if (!list) return;

        if (!questions || questions.length === 0) {
            list.innerHTML = '<p class="loading">No questions found.</p>';
            return;
        }

        list.innerHTML = questions.map(q => `
            <div class="content-item" data-id="${q._id}">
                <div class="content-item-text">${q.questionName}</div>
                <div class="content-item-actions">
                    <button class="btn-delete-content" data-type="excel" data-id="${q._id}">Delete</button>
                </div>
            </div>
        `).join('');

        // Bind delete events
        list.querySelectorAll('.btn-delete-content').forEach(btn => {
            btn.onclick = async (e) => {
                const type = btn.dataset.type;
                const id = btn.dataset.id;
                if (confirm('Are you sure you want to delete this?')) {
                    try {
                        if (type === 'passage') await adminApi.deletePassage(id);
                        else if (type === 'letter') await adminApi.deleteLetterQuestion(id);
                        else if (type === 'excel') await adminApi.deleteExcelQuestion(id);
                        ui.showToast('Deleted successfully', 'success');
                        if (type === 'passage') this.loadPassages(this.passagesPage);
                        else if (type === 'letter') this.loadLetterQuestions(this.lettersPage);
                        else if (type === 'excel') this.loadExcelQuestions(this.excelPage);
                    } catch (err) {
                        ui.showToast('Failed to delete', 'error');
                    }
                }
            };
        });
    }

    updateExcelPagination() {
        const prev = document.getElementById('excel-prev-btn');
        const next = document.getElementById('excel-next-btn');
        const info = document.getElementById('excel-page-info');

        if (info) info.innerText = `Page ${this.excelPage} of ${this.excelTotalPages || 1}`;
        if (prev) prev.disabled = this.excelPage <= 1;
        if (next) next.disabled = this.excelPage >= this.excelTotalPages;
    }

    async handleExcelSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);

        try {
            await adminApi.createExcelQuestion(formData);
            ui.showToast('Excel Question added!', 'success');
            e.target.reset();
            this.loadExcelQuestions(1);
        } catch (err) { ui.showToast(err.message, 'error'); }
    }
}
