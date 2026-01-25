document.addEventListener('DOMContentLoaded', () => {
    const resultsBody = document.getElementById('results-tbody');
    const token = localStorage.getItem('token');

    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';

    // --- EXISTING: Fetch & Display Results ---
    async function fetchResults() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/results`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const results = await response.json();
            displayResults(results);
        } catch (error) {
            resultsBody.innerHTML = `<tr><td colspan="5">Error loading results.</td></tr>`;
        }
    }

    function displayResults(results) {
        if (results.length === 0) {
            resultsBody.innerHTML = `<tr><td colspan="5">No submissions yet.</td></tr>`;
            return;
        }

        resultsBody.innerHTML = '';
        results.forEach(result => {
            const row = document.createElement('tr');
            const user = result.user ? result.user.username : 'Unknown';
            const submittedDate = new Date(result.submittedAt).toLocaleString();
            let details = '';
            let submission = '';

            // Updated to handle both patterns
            const patternLabel = result.testPattern === 'new_pattern' ? '(10+5)' : '';

            switch (result.testType) {
                case 'Typing':
                    details = `Score: ${result.score}/20 ${patternLabel}`;
                    submission = `WPM: ${result.wpm}, Acc: ${result.accuracy}%`;
                    break;
                case 'Letter':
                    details = `AI Score: ${result.score}/10`;
                    submission = `<button onclick="alert('Feedback: ${result.feedback.replace(/'/g, "\\'")}')">View Feedback</button>`;
                    break;
                case 'Excel':
                    // Check if it's MCQ or Practical
                    if (result.mcqScore !== undefined) {
                        details = `MCQ Score: ${result.mcqScore}/20`;
                        submission = `Completed MCQ Set`;
                    } else {
                        details = result.score ? `Score: ${result.score}/20` : 'AI Grading...';
                        submission = `<a href="${result.filePath}" role="button" class="contrast" download>Download</a>`;
                    }
                    break;
            }

            row.innerHTML = `
                <td>${user}</td>
                <td>${result.testType} ${patternLabel}</td>
                <td>${details}</td>
                <td>${submittedDate}</td>
                <td>${submission}</td>
            `;
            resultsBody.appendChild(row);
        });
    }

    // --- EXISTING: Original Form Handlers ---
    // (Passage, Letter Question, Excel Practical logic remains identical to yours)
    const addPassageForm = document.getElementById('add-passage-form');
    addPassageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const content = document.getElementById('passage-content').value;
        const difficulty = document.getElementById('difficulty').value;
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/passages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ content, difficulty })
            });
            if (res.ok) { alert('Passage added!'); addPassageForm.reset(); }
        } catch (err) { alert('Error!'); }
    });

    const addQuestionForm = document.getElementById('add-question-form');
    addQuestionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const questionText = document.getElementById('question-text').value;
        const category = document.getElementById('question-category').value;
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/letter-questions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ questionText, category })
            });
            if (res.ok) { alert('Question added!'); addQuestionForm.reset(); }
        } catch (err) { alert('Error!'); }
    });

    const addExcelForm = document.getElementById('add-excel-form');
    addExcelForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(addExcelForm);
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/excel-questions`, {
                method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData
            });
            if (res.ok) { alert('Excel practical added!'); addExcelForm.reset(); }
        } catch (err) { alert('Error!'); }
    });

    // --- NEW: Excel MCQ Management Logic ---

    // 1. Add Single MCQ
    const addMcqForm = document.getElementById('add-mcq-form');
    addMcqForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            questionText: document.getElementById('mcq-text').value,
            options: [
                document.getElementById('mcq-opt-0').value,
                document.getElementById('mcq-opt-1').value,
                document.getElementById('mcq-opt-2').value,
                document.getElementById('mcq-opt-3').value
            ],
            correctAnswerIndex: parseInt(document.getElementById('mcq-correct').value),
            category: document.getElementById('mcq-category').value
        };

        const res = await fetch(`${API_BASE_URL}/api/admin/mcq-questions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert('MCQ saved to bank!');
            addMcqForm.reset();
            fetchMcqBank(); // Refresh the curation list
        }
    });

    // 2. Load Curation Bank
    async function fetchMcqBank() {
        const bank = document.getElementById('mcq-selection-bank');
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/mcq-questions`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const questions = await res.json();
            bank.innerHTML = questions.map(q => `
                <div class="q-item">
                    <input type="checkbox" class="mcq-chk" value="${q._id}" onchange="updateAdminCounter()">
                    <div>
                        <span class="badge-mcq">${q.category}</span>
                        <span>${q.questionText}</span>
                    </div>
                </div>
            `).join('');
        } catch (err) { bank.innerText = 'Error loading bank.'; }
    }

    // 3. Counter & Set Saving
    window.updateAdminCounter = () => {
        const count = document.querySelectorAll('.mcq-chk:checked').length;
        const counter = document.getElementById('mcq-counter');
        counter.innerText = `Selected: ${count}/10`;
        counter.style.background = count === 10 ? '#10b981' : (count > 10 ? '#ef4444' : '#3b82f6');
    };

    document.getElementById('create-set-btn').onclick = async () => {
        const selected = Array.from(document.querySelectorAll('.mcq-chk:checked')).map(c => c.value);
        const setName = document.getElementById('mcq-set-name').value;

        if (selected.length !== 10) return alert('Select exactly 10 questions.');
        if (!setName) return alert('Enter a set name.');

        const res = await fetch(`${API_BASE_URL}/api/admin/mcq-sets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ setName, questions: selected })
        });

        if (res.ok) { alert('Official Mock Set Created!'); location.reload(); }
    };

    const bulkMcqForm = document.getElementById('bulk-mcq-form');
    bulkMcqForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('csv-file');
        const formData = new FormData();
        formData.append('csvFile', fileInput.files[0]);

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/bulk-mcqs`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            const data = await response.json();
            if (response.ok) {
                alert(`Successfully uploaded ${data.count} questions!`);
                bulkMcqForm.reset();
                fetchMcqBank(); // Refresh your curation list
            } else {
                alert(`Error: ${data.message}`);
            }
        } catch (error) {
            alert('Network error during bulk upload.');
        }
    });

    // Initial Load
    fetchResults();
    fetchMcqBank();
});