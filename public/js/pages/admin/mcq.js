import { adminApi } from '../../api/admin.js';
import { ui } from '../../utils/ui.js';

export class MCQManager {
    constructor() {
        this.page = 1;
        this.totalPages = 1;
        this.selectedIds = new Set();
        this.knownQuestions = new Map();

        this.bindEvents();
    }

    bindEvents() {
        // Add MCQ Form
        const addForm = document.getElementById('add-mcq-form');
        if (addForm) addForm.addEventListener('submit', (e) => this.createMCQ(e));

        // Bulk Upload
        const bulkForm = document.getElementById('bulk-mcq-form');
        if (bulkForm) bulkForm.addEventListener('submit', (e) => this.bulkUpload(e));

        // Filter Change
        ['bank-filter-category', 'bank-filter-difficulty'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => this.fetchMCQs(1));
        });

        // Search
        let searchTimeout;
        const searchInput = document.getElementById('bank-search');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => this.fetchMCQs(1), 500);
            });
        }

        // Pagination
        const prev = document.getElementById('prev-page-btn');
        const next = document.getElementById('next-page-btn');
        if (prev) prev.onclick = () => this.fetchMCQs(this.page - 1);
        if (next) next.onclick = () => this.fetchMCQs(this.page + 1);

        // Set Creation
        const createSetBtn = document.getElementById('create-set-btn');
        if (createSetBtn) createSetBtn.onclick = () => this.createSet();

        // Preview
        const previewBtn = document.getElementById('preview-set-btn');
        if (previewBtn) previewBtn.onclick = () => this.showPreview();

        // Sets List Actions (Delegate)
        const setList = document.getElementById('sets-list');
        if (setList) setList.onclick = (e) => this.handleSetAction(e);
    }

    // --- MCQ CRUD ---

    async createMCQ(e) {
        e.preventDefault();
        const formData = new FormData();
        // Manually append options array as FormData doesn't handle arrays natively well in all backends without loop
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
        this.page = page;
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

            // Cache for preview/edit
            data.questions.forEach(q => this.knownQuestions.set(q._id, q));

            this.renderBank(data.questions);
            this.updatePagination();
        } catch (err) {
            console.error(err);
        }
    }

    renderBank(questions) {
        const bank = document.getElementById('mcq-selection-bank');
        if (!bank) return;

        if (questions.length === 0) {
            bank.innerHTML = '<p class="text-center text-gray-500 p-4">No questions found.</p>';
            return;
        }

        bank.innerHTML = questions.map(q => `
            <div class="q-item">
                <input type="checkbox" value="${q._id}" class="mcq-select" 
                    ${this.selectedIds.has(q._id) ? 'checked' : ''}>
                <div style="flex:1; margin-left: 10px;">
                    <span class="badge-mcq">${q.category} · ${q.difficulty}</span>
                    <div>${q.questionText}</div>
                </div>
                <!-- Add edit/delete buttons later if needed, kept simple for selection -->
            </div>
        `).join('');

        // Re-bind checkboxes interactively
        bank.querySelectorAll('.mcq-select').forEach(cb => {
            cb.onchange = (e) => {
                if (e.target.checked) this.selectedIds.add(e.target.value);
                else this.selectedIds.delete(e.target.value);
                this.updateCounter();
            };
        });
    }

    updateCounter() {
        const counter = document.getElementById('mcq-counter');
        if (counter) counter.innerText = `Selected: ${this.selectedIds.size}/10`;
    }

    updatePagination() {
        const prev = document.getElementById('prev-page-btn');
        const next = document.getElementById('next-page-btn');
        const info = document.getElementById('page-info');

        if (info) info.innerText = `Page ${this.page} of ${this.totalPages || 1}`;
        if (prev) prev.disabled = this.page <= 1;
        if (next) next.disabled = this.page >= this.totalPages;
    }

    // --- Bulk Upload ---
    async bulkUpload(e) {
        e.preventDefault();
        const formData = new FormData();
        formData.append('csvFile', document.getElementById('csv-file').files[0]);

        try {
            const res = await adminApi.bulkUploadMCQs(formData);
            ui.showToast(`Uploaded ${res.count} MCQs`, 'success');
            e.target.reset();
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

        list.innerHTML = sets.length ? sets.map(s => `
            <div class="set-item" data-id="${s._id}">
                <span class="set-name">${s.setName}</span>
                <span class="set-meta">${s.questions.length} Qs</span>
                <div class="set-actions">
                    <button class="btn-toggle text-${s.isActive ? 'yellow' : 'green'}-600">
                        ${s.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button class="btn-delete text-red-600">Delete</button>
                </div>
            </div>
        `).join('') : '<p>No sets.</p>';
    }

    async handleSetAction(e) {
        const btn = e.target.closest('button');
        if (!btn) return;
        const div = btn.closest('.set-item');
        const id = div.dataset.id;

        if (btn.classList.contains('btn-toggle')) {
            await adminApi.toggleMCQSet(id);
            this.fetchSets();
        }
        if (btn.classList.contains('btn-delete')) {
            if (confirm('Delete set?')) {
                await adminApi.deleteMCQSet(id);
                this.fetchSets();
            }
        }
    }

    async createSet() {
        const name = document.getElementById('mcq-set-name').value;
        if (!name) return ui.showToast('Name required', 'warning');
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
            this.fetchMCQs(this.page); // clear checks
        } catch (err) { ui.showToast(err.message, 'error'); }
    }
}
