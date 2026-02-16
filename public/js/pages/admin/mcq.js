import { adminApi } from '../../api/admin.js';
import { ui } from '../../utils/ui.js';

export class MCQManager {
    constructor() {
        this.bankPage = 1;
        this.setPage = 1;
        this.totalPages = 1;
        this.setTotalPages = 1;
        this.selectedIds = new Set();
        this.knownQuestions = new Map();
        this.setQuestions = new Map();
    }

    // Initialize MCQ Bank (Section 4)
    initMCQBank() {
        this.bindMCQBankEvents();
        this.fetchMCQs();
    }

    // Initialize Set Creation (Section 5 - Create Directly)
    initSetCreation() {
        this.bindSetCreationEvents();
        this.fetchSetQuestions();
    }

    bindMCQBankEvents() {
        const addForm = document.getElementById('add-mcq-form');
        if (addForm) addForm.addEventListener('submit', (e) => this.createMCQ(e));

        const bulkForm = document.getElementById('bulk-mcq-form');
        if (bulkForm) bulkForm.addEventListener('submit', (e) => this.bulkUpload(e));

        const bulkBtn = document.getElementById('bulk-upload-btn');
        if (bulkBtn) bulkBtn.addEventListener('click', () => this.openBulkModal());

        ['bank-filter-category', 'bank-filter-difficulty'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => this.fetchMCQs(1));
        });

        let searchTimeout;
        const searchInput = document.getElementById('bank-search');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => this.fetchMCQs(1), 500);
            });
        }

        const prev = document.getElementById('prev-page-btn');
        const next = document.getElementById('next-page-btn');
        if (prev) prev.onclick = () => this.fetchMCQs(this.bankPage - 1);
        if (next) next.onclick = () => this.fetchMCQs(this.bankPage + 1);

        const bank = document.getElementById('mcq-selection-bank');
        if (bank) bank.onclick = (e) => this.handleBankAction(e));
    }

    bindSetCreationEvents() {
        const form = document.getElementById('create-set-form');
        if (form) form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.createSet();
        });

        ['set-filter-category', 'set-filter-difficulty'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => this.fetchSetQuestions(1));
        });

        let searchTimeout;
        const searchInput = document.getElementById('set-search');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => this.fetchSetQuestions(1), 500);
            });
        }

        const prev = document.getElementById('set-prev-btn');
        const next = document.getElementById('set-next-btn');
        if (prev) prev.onclick = () => this.fetchSetQuestions(this.setPage - 1);
        if (next) next.onclick = () => this.fetchSetQuestions(this.setPage + 1);

        const previewBtn = document.getElementById('preview-set-btn');
        if (previewBtn) previewBtn.onclick = () => this.showPreview();

        const setBank = document.getElementById('set-question-bank');
        if (setBank) setBank.onclick = (e) => this.handleSetBankAction(e);
    }

    // --- MCQ CRUD ---

    async createMCQ(e) {
        e.preventDefault();
        const formData = new FormData();
        formData.append('questionText', document.getElementById('mcq-text').value);
        [0, 1, 2, 3].forEach(i => formData.append(`options[${i}]`, document.getElementById(`mcq-opt-${i}`).value));
        formData.append('correctAnswerIndex', document.getElementById('mcq-correct').value);
        formData.append('category', document.getElementById('mcq-category').value);
        formData.append('difficulty', document.getElementById('mcq-difficulty').value);
        formData.append('correctExplanation', document.getElementById('mcq-explanation').value);

        const file = document.getElementById('mcq-image').files[0];
        if (file) formData.append('image', file);

        try {
            await adminApi.createMCQ(formData);
            ui.showToast('MCQ Saved', 'success');
            e.target.reset();
            this.fetchMCQs(1);
        } catch (err) { ui.showToast(err.message, 'error'); }
    }

    async fetchMCQs(page = 1) {
        this.bankPage = page;
        const params = {
            page,
            limit: 20,
            search: document.getElementById('bank-search').value,
            category: document.getElementById('bank-filter-category').value,
            difficulty: document.getElementById('bank-filter-difficulty').value
        };

        try {
            const data = await adminApi.getMcKQuestions(params);
            this.totalPages = data.pages;

            data.questions.forEach(q => this.knownQuestions.set(q._id, q));

            this.renderBank(data.questions);
            this.updateBankPagination();
        } catch (err) {
            console.error(err);
        }
    }

    renderBank(questions) {
        const bank = document.getElementById('mcq-selection-bank');
        if (!bank) return;

        if (questions.length === 0) {
            bank.innerHTML = '<p class="loading">No questions found.</p>';
            return;
        }

        bank.innerHTML = questions.map(q => `
            <div class="q-item" data-id="${q._id}">
                <input type="checkbox" value="${q._id}" class="mcq-select" 
                    ${this.selectedIds.has(q._id) ? 'checked' : ''}>
                <div>
                    <span class="badge-mcq">${q.category} · ${q.difficulty}</span>
                    <div style="font-weight:500; margin-top:0.25rem;">${q.questionText}</div>
                </div>
                <div class="q-actions">
                    <button class="btn-edit">Edit</button>
                    <button class="btn-del">Delete</button>
                </div>
            </div>
        `).join('');

        bank.querySelectorAll('.mcq-select').forEach(cb => {
            cb.onchange = (e) => {
                if (e.target.checked) this.selectedIds.add(e.target.value);
                else this.selectedIds.delete(e.target.value);
                this.updateCounter();
            };
        });
    }

    updateBankPagination() {
        const prev = document.getElementById('prev-page-btn');
        const next = document.getElementById('next-page-btn');
        const info = document.getElementById('page-info');

        if (info) info.innerText = `Page ${this.bankPage} of ${this.totalPages || 1}`;
        if (prev) prev.disabled = this.bankPage <= 1;
        if (next) next.disabled = this.bankPage >= this.totalPages;
    }

    async handleBankAction(e) {
        const btn = e.target.closest('button');
        if (!btn) return;
        const div = btn.closest('.q-item');
        const id = div.dataset.id;

        if (btn.classList.contains('btn-edit')) {
            this.openEditModal(id);
        }
        if (btn.classList.contains('btn-del')) {
            if (confirm('Delete this MCQ?')) {
                try {
                    await adminApi.deleteMCQ(id);
                    ui.showToast('MCQ Deleted', 'success');
                    this.fetchMCQs(this.bankPage);
                } catch (err) { ui.showToast(err.message, 'error'); }
            }
        }
    }

    // --- Set Creation (Direct) ---

    async fetchSetQuestions(page = 1) {
        this.setPage = page;
        const params = {
            page,
            limit: 20,
            search: document.getElementById('set-search').value,
            category: document.getElementById('set-filter-category').value,
            difficulty: document.getElementById('set-filter-difficulty').value
        };

        try {
            const data = await adminApi.getMcKQuestions(params);
            this.setTotalPages = data.pages;

            data.questions.forEach(q => this.setQuestions.set(q._id, q));

            this.renderSetBank(data.questions);
            this.updateSetPagination();
            this.updateCategoryCounts(data.questions);
        } catch (err) {
            console.error(err);
        }
    }

    renderSetBank(questions) {
        const bank = document.getElementById('set-question-bank');
        if (!bank) return;

        if (questions.length === 0) {
            bank.innerHTML = '<p class="loading">No questions found.</p>';
            return;
        }

        bank.innerHTML = questions.map(q => `
            <div class="q-item" data-id="${q._id}">
                <input type="checkbox" value="${q._id}" class="set-select" 
                    ${this.selectedIds.has(q._id) ? 'checked' : ''}>
                <div>
                    <span class="badge-mcq">${q.category} · ${q.difficulty}</span>
                    <div style="font-weight:500; margin-top:0.25rem;">${q.questionText}</div>
                </div>
            </div>
        `).join('');

        bank.querySelectorAll('.set-select').forEach(cb => {
            cb.onchange = (e) => {
                if (e.target.checked) this.selectedIds.add(e.target.value);
                else this.selectedIds.delete(e.target.value);
                this.updateCounter();
            };
        });
    }

    updateSetPagination() {
        const prev = document.getElementById('set-prev-btn');
        const next = document.getElementById('set-next-btn');
        const info = document.getElementById('set-page-info');

        if (info) info.innerText = `Page ${this.setPage} of ${this.setTotalPages || 1}`;
        if (prev) prev.disabled = this.setPage <= 1;
        if (next) next.disabled = this.setPage >= this.setTotalPages;
    }

    updateCategoryCounts(questions) {
        const container = document.getElementById('category-counts');
        if (!container) return;

        const counts = {};
        questions.forEach(q => {
            counts[q.category] = (counts[q.category] || 0) + 1;
        });

        container.innerHTML = Object.entries(counts)
            .map(([cat, count]) => `<span class="cat-count">${cat}: ${count}</span>`)
            .join('');
    }

    handleSetBankAction(e) {
        const cb = e.target;
        if (!cb.classList.contains('set-select')) return;

        if (cb.checked) this.selectedIds.add(cb.value);
        else this.selectedIds.delete(cb.value);
        this.updateCounter();
    }

    updateCounter() {
        const counter = document.getElementById('mcq-counter');
        if (counter) counter.textContent = `Questions: ${this.selectedIds.size}/10`;
    }

    // --- Edit Modal ---
    openEditModal(id) {
        const q = this.knownQuestions.get(id);
        if (!q) return;

        document.getElementById('edit-id').value = q._id;
        document.getElementById('edit-text').value = q.questionText;
        q.options.forEach((opt, i) => {
            document.getElementById(`edit-opt-${i}`).value = opt;
        });
        document.getElementById('edit-correct').value = q.correctAnswerIndex;
        document.getElementById('edit-category').value = q.category;
        document.getElementById('edit-difficulty').value = q.difficulty;
        document.getElementById('edit-explanation').value = q.correctExplanation || '';
        document.getElementById('edit-image').value = '';

        document.getElementById('edit-modal').classList.add('active');
    }

    closeEditModal() {
        document.getElementById('edit-modal').classList.remove('active');
    }

    async saveEditMCQ() {
        const id = document.getElementById('edit-id').value;
        const formData = new FormData();
        formData.append('questionText', document.getElementById('edit-text').value);
        [0, 1, 2, 3].forEach(i => formData.append(`options[${i}]`, document.getElementById(`edit-opt-${i}`).value));
        formData.append('correctAnswerIndex', document.getElementById('edit-correct').value);
        formData.append('category', document.getElementById('edit-category').value);
        formData.append('difficulty', document.getElementById('edit-difficulty').value);
        formData.append('correctExplanation', document.getElementById('edit-explanation').value);

        const file = document.getElementById('edit-image').files[0];
        if (file) formData.append('image', file);

        try {
            await adminApi.updateMCQ(id, formData);
            ui.showToast('MCQ Updated', 'success');
            this.closeEditModal();
            this.fetchMCQs(this.bankPage);
        } catch (err) { ui.showToast(err.message, 'error'); }
    }

    // --- Preview Modal ---
    showPreview() {
        if (this.selectedIds.size === 0) return ui.showToast('Select questions first', 'warning');
        
        const container = document.getElementById('preview-content');
        container.innerHTML = Array.from(this.selectedIds).map((id, i) => {
            const q = this.setQuestions.get(id) || this.knownQuestions.get(id);
            if (!q) return '';
            return `
                <div class="preview-q">
                    <strong>${i + 1}. ${q.questionText}</strong>
                    <ul>
                        ${q.options.map((opt, idx) => `
                            <li style="${idx === q.correctAnswerIndex ? 'color: var(--primary); font-weight: bold;' : ''}">
                                ${opt}
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }).join('');

        document.getElementById('preview-modal').classList.add('active');
    }

    closePreviewModal() {
        document.getElementById('preview-modal').classList.remove('active');
    }

    // --- Bulk Upload ---
    openBulkModal() {
        document.getElementById('bulk-upload-modal').classList.add('active');
    }

    closeBulkModal() {
        document.getElementById('bulk-upload-modal').classList.remove('active');
    }

    async bulkUpload(e) {
        e.preventDefault();
        const formData = new FormData();
        formData.append('csvFile', document.getElementById('csv-file').files[0]);

        try {
            const res = await adminApi.bulkUploadMCQs(formData);
            ui.showToast(`Uploaded ${res.count} MCQs`, 'success');
            e.target.reset();
            this.closeBulkModal();
            this.fetchMCQs(1);
        } catch (err) { ui.showToast(err.message, 'error'); }
    }

    // --- Sets ---
    async fetchSets() {
        try {
            const sets = await adminApi.getMCQSets();
            this.renderSets(sets);
        } catch (err) { console.error(err); }
    }

    renderSets(sets) {
        const list = document.getElementById('sets-list');
        if (!list) return;

        if (sets.length === 0) {
            list.innerHTML = '<p class="loading">No sets created yet.</p>';
            return;
        }

        list.innerHTML = sets.map(s => `
            <div class="set-card" data-id="${s._id}">
                <div class="set-card-header">
                    <span class="set-card-name">${s.setName}</span>
                    <span class="set-card-status ${s.isActive ? 'active' : 'inactive'}">
                        ${s.isActive ? 'Active' : 'Inactive'}
                    </span>
                </div>
                <div class="set-card-meta">${s.questions.length} Questions</div>
                <div class="set-card-actions">
                    <button class="btn-secondary btn-toggle">${s.isActive ? 'Deactivate' : 'Activate'}</button>
                    <button class="btn-secondary btn-delete" style="color: var(--danger);">Delete</button>
                </div>
            </div>
        `).join('');

        list.onclick = (e) => this.handleSetAction(e);
    }

    async handleSetAction(e) {
        const btn = e.target.closest('button');
        if (!btn) return;
        const card = btn.closest('.set-card');
        const id = card.dataset.id;

        if (btn.classList.contains('btn-toggle')) {
            await adminApi.toggleMCQSet(id);
            this.fetchSets();
        }
        if (btn.classList.contains('btn-delete')) {
            if (confirm('Delete this set?')) {
                await adminApi.deleteMCQSet(id);
                this.fetchSets();
            }
        }
    }

    async createSet() {
        const name = document.getElementById('mcq-set-name').value;
        if (!name) return ui.showToast('Set name is required', 'warning');
        if (this.selectedIds.size !== 10) return ui.showToast('Select exactly 10 questions', 'warning');

        try {
            await adminApi.createMCQSet({
                setName: name,
                questions: Array.from(this.selectedIds)
            });
            ui.showToast('Set Created', 'success');
            this.selectedIds.clear();
            this.updateCounter();
            document.getElementById('mcq-set-name').value = '';
            this.fetchSets();
            this.fetchSetQuestions(this.setPage);
        } catch (err) { ui.showToast(err.message, 'error'); }
    }
}
