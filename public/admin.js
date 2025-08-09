document.addEventListener('DOMContentLoaded', () => {
    const resultsBody = document.getElementById('results-tbody');
    const token = localStorage.getItem('token');

    // --- Dynamic URL Configuration ---
    // This makes the code work on both localhost and your live server
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';
    // --- End of Configuration ---

    // Fetch all results from the admin route
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

    // Display results in the table
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

            switch (result.testType) {
                case 'Typing':
                    details = `WPM: ${result.wpm}, Accuracy: ${result.accuracy}%`;
                    submission = 'N/A';
                    break;
                case 'Letter':
                    details = `AI Score: ${result.score}/10`;
                    submission = `<button onclick="alert('Feedback: ${result.feedback.replace(/'/g, "\\'")}\\n\\nContent:\\n${result.content.replace(/'/g, "\\'").replace(/\n/g, "\\n")}')">View Details</button>`;
                    break;
                case 'Excel':
                    details = result.score ? `Score: ${result.score}/10` : `<input type="number" class="score-input" placeholder="0-10" min="0" max="10">`;
                    submission = `
                        <a href="${API_BASE_URL}/${result.filePath}" target="_blank" download>Download</a>
                        ${!result.score ? `<button class="save-score-btn" data-id="${result._id}">Save</button>` : ''}
                    `;
                    break;
            }

            row.innerHTML = `
                <td>${user}</td>
                <td>${result.testType}</td>
                <td>${details}</td>
                <td>${submittedDate}</td>
                <td>${submission}</td>
            `;
            resultsBody.appendChild(row);
        });
    }

    // Event Listener for Saving Scores
    resultsBody.addEventListener('click', async (event) => {
        if (event.target.classList.contains('save-score-btn')) {
            const button = event.target;
            const resultId = button.dataset.id;
            const scoreInput = button.closest('tr').querySelector('.score-input');
            const score = scoreInput.value;

            if (score === '' || score < 0 || score > 10) {
                alert('Please enter a valid score between 0 and 10.');
                return;
            }
            
            try {
                const response = await fetch(`${API_BASE_URL}/api/admin/grade`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ resultId, score })
                });

                if (response.ok) {
                    alert('Score saved successfully!');
                    fetchResults(); // Refresh the table
                } else {
                    alert('Failed to save score.');
                }
            } catch (error) {
                alert('An error occurred.');
            }
        }
    });

    // --- NEW: Logic for the 'Add Passage' form ---
    const addPassageForm = document.getElementById('add-passage-form');

    addPassageForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const content = document.getElementById('passage-content').value;
        const difficulty = document.getElementById('difficulty').value;
        const token = localStorage.getItem('token');

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/passages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ content, difficulty })
            });

            const data = await response.json();

            if (response.ok) {
                alert('Passage added successfully!');
                addPassageForm.reset(); // Clear the form
            } else {
                alert(`Error: ${data.message}`);
            }
        } catch (error) {
            alert('A network error occurred.');
        }
    });
    // --- End of new logic ---

    // --- NEW: Logic for the 'Add Letter Question' form ---
    const addQuestionForm = document.getElementById('add-question-form');

    addQuestionForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const questionText = document.getElementById('question-text').value;
        const category = document.getElementById('question-category').value;
        const token = localStorage.getItem('token');

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/letter-questions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ questionText, category })
            });

            const data = await response.json();

            if (response.ok) {
                alert('Letter question added successfully!');
                addQuestionForm.reset(); // Clear the form
            } else {
                alert(`Error: ${data.message}`);
            }
        } catch (error) {
            alert('A network error occurred.');
        }
    });
    // --- End of new logic ---

    // --- Add Excel Files ---
    const addExcelForm = document.getElementById('add-excel-form');

    addExcelForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const token = localStorage.getItem('token');
        
        // FormData is required for sending files
        const formData = new FormData(addExcelForm);

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/excel-questions`, {
                method: 'POST',
                headers: {
                    // For multipart/form-data, we don't set Content-Type. The browser does it.
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await response.json();
            if (response.ok) {
                alert('Excel question added successfully!');
                addExcelForm.reset();
            } else {
                alert(`Error: ${data.message}`);
            }
        } catch (error) {
            alert('A network error occurred.');
        }
    });
    // --- End of Add Excel Files ---

    fetchResults();
});