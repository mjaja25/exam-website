document.addEventListener('DOMContentLoaded', () => {
    const resultsBody = document.getElementById('results-tbody');
    const token = localStorage.getItem('token');

    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE_URL = isLocal ? 'http://localhost:3000' : '';

    // --- State Management ---
    let currentPage = 1;
    let totalPages = 1;
    const itemsPerPage = 20; // Adjusted for better view
    const selectedQuestionIds = new Set();
    const knownQuestionsMap = new Map(); // Cache to store question details for Preview

    // --- EXISTING: Fetch & Display Results ---
    async function fetchResults() {
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/results`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const results = await res.json();
            displayResults(results);
        } catch (e) {
            console.error("Fetch results failed", e);
        }
    }

    function displayResults(results) {
        resultsBody.innerHTML = '';
        if (!results || !Array.isArray(results)) return;

        results.forEach(r => {
            const user = r.user ? r.user.username || r.user.email : 'Unknown';
            const type = r.testPattern === 'standard' ? 'Standard Pattern' : 'New Pattern';
            const time = new Date(r.submittedAt).toLocaleString();

            let scoreDetails = '';
            if (r.testPattern === 'standard') {
                scoreDetails = `
                    Total: ${r.totalScore || '—'}/50<br>
                    Typing: ${r.typingScore || '—'}<br>
                    Letter: ${r.letterScore || '—'}<br>
                    Excel: ${r.excelScore || '—'}
                `;
            } else {
                scoreDetails = `
                    Total: ${r.totalScore || '—'}/50<br>
                    Typing: ${r.typingScore || '—'}<br>
                    MCQ: ${r.mcqScore || '—'}
                `;
            }

            let downloadLink = '';
            if (r.excelFilePath) {
                downloadLink = `<a href="${r.excelFilePath}" target="_blank" class="btn-link">Download Excel</a>`;
            } else if (r.letterContent) {
                downloadLink = `<button class="btn-link" onclick="alert('${r.letterContent.substring(0, 100).replace(/'/g, "\\'")}...')">View Letter Snippet</button>`;
            } else {
                downloadLink = '—';
            }

            resultsBody.innerHTML += `
                <tr>
                    <td>${user}</td>
                    <td>${type}</td>
                    <td>${scoreDetails}</td>
                    <td>${time}</td>
                    <td>${downloadLink}</td>
                </tr>
            `;
        });
    }

    // --- FORM HANDLERS (Passage & Letter) ---
    const addPassageForm = document.getElementById('add-passage-form');
    addPassageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/passages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    content: document.getElementById('passage-content').value,
                    difficulty: document.getElementById('difficulty').value
                })
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
            if (res.ok) { alert('Letter question added!'); addQuestionForm.reset(); }
        } catch (err) { alert('Error!'); }
    });

    // --- NEW: Excel MCQ Management Logic ---

    // 1. Add Single MCQ (FormData for Image Support)
    const addMcqForm = document.getElementById('add-mcq-form');
    addMcqForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData();
        formData.append('questionText', document.getElementById('mcq-text').value);
        formData.append('options[0]', document.getElementById('mcq-opt-0').value);
        formData.append('options[1]', document.getElementById('mcq-opt-1').value);
        formData.append('options[2]', document.getElementById('mcq-opt-2').value);
        formData.append('options[3]', document.getElementById('mcq-opt-3').value);
        formData.append('correctAnswerIndex', document.getElementById('mcq-correct').value);
        formData.append('category', document.getElementById('mcq-category').value);
        formData.append('difficulty', document.getElementById('mcq-difficulty').value);
        formData.append('correctExplanation', document.getElementById('mcq-explanation').value);

        const imageFile = document.getElementById('mcq-image').files[0];
        if (imageFile) {
            formData.append('image', imageFile);
        }

        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/mcq-questions`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData // Content-Type header auto-set for FormData
            });

            if (res.ok) {
                alert('MCQ saved to bank!');
                addMcqForm.reset();
                fetchMcqBank(1);
            } else {
                const d = await res.json();
                alert('Error: ' + d.message);
            }
        } catch (err) {
            alert('Network error saving MCQ.');
        }
    });

    // 2. Load MCQ Bank (Server-Side Pagination & Filtering)
    async function fetchMcqBank(page = 1) {
        currentPage = page;

        // Build Query String
        const searchTerm = (document.getElementById('bank-search').value || '').trim();
        const filterCat = document.getElementById('bank-filter-category').value;
        const filterDiff = document.getElementById('bank-filter-difficulty').value;

        const params = new URLSearchParams({
            page: currentPage,
            limit: itemsPerPage
        });
        if (searchTerm) params.append('search', searchTerm);
        if (filterCat) params.append('category', filterCat);
        if (filterDiff) params.append('difficulty', filterDiff);

        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/mcq-questions?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            // Cache questions for preview
            data.questions.forEach(q => knownQuestionsMap.set(q._id, q));

            totalPages = data.pages;
            renderCategoryCounts(data.questions); // Note: This only counts current page now, ideally we'd get stats separately
            renderBank(data.questions);
            renderPaginationControls();
        } catch (err) {
            console.error("Fetch MCQs failed", err);
        }
    }

    function renderCategoryCounts(questions) {
        // Simple counts for current page view
        const countsEl = document.getElementById('category-counts');
        if (!questions) return;
        const counts = {};
        questions.forEach(q => {
            counts[q.category] = (counts[q.category] || 0) + 1;
        });
        countsEl.innerHTML = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, count]) => `<span class="cat-count"><strong>${count}</strong> ${cat}</span>`)
            .join('') + `<span class="cat-count" style="background:#dbeafe;"><strong>${questions.length}</strong> on page</span>`;
    }

    function renderBank(questions) {
        const bank = document.getElementById('mcq-selection-bank');
        if (questions.length === 0) {
            bank.innerHTML = `<p style="color:#999; text-align:center; padding:1rem;">No questions match your filters.</p>`;
            return;
        }

        bank.innerHTML = questions.map(q => `
            <div class="q-item">
                <input type="checkbox" value="${q._id}" onchange="updateAdminCounter(this)" ${selectedQuestionIds.has(q._id) ? 'checked' : ''}>
                <div style="flex:1;">
                    <span class="badge-mcq">${q.category} · ${q.difficulty || 'Medium'}</span>
                    <div>${q.questionText}</div>
                    ${q.imageUrl ? `<img src="${q.imageUrl}" style="max-height:50px; margin-top:5px; border-radius:4px;">` : ''}
                    ${q.correctExplanation ? `<div style="font-size:0.75rem;color:#64748b;margin-top:4px;">💡 ${q.correctExplanation}</div>` : ''}
                </div>
                <div class="q-actions">
                    <button class="btn-edit" onclick="openEditModal('${q._id}')">✏️ Edit</button>
                    <button class="btn-del" onclick="deleteMCQ('${q._id}')">🗑️</button>
                </div>
            </div>
        `).join('');
    }

    function renderPaginationControls() {
        const prevBtn = document.getElementById('prev-page-btn');
        const nextBtn = document.getElementById('next-page-btn');
        const info = document.getElementById('page-info');

        info.innerText = `Page ${currentPage} of ${totalPages || 1}`;

        prevBtn.disabled = currentPage <= 1;
        nextBtn.disabled = currentPage >= totalPages;

        prevBtn.onclick = () => fetchMcqBank(currentPage - 1);
        nextBtn.onclick = () => fetchMcqBank(currentPage + 1);
    }

    // Attach filter listeners (Debounce search slightly)
    let searchTimeout;
    document.getElementById('bank-search').addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => fetchMcqBank(1), 500);
    });
    document.getElementById('bank-filter-category').addEventListener('change', () => fetchMcqBank(1));
    document.getElementById('bank-filter-difficulty').addEventListener('change', () => fetchMcqBank(1));

    // 3. Counter & Set Saving
    window.updateAdminCounter = (checkbox) => {
        if (checkbox) {
            if (checkbox.checked) selectedQuestionIds.add(checkbox.value);
            else selectedQuestionIds.delete(checkbox.value);
        }
        document.getElementById('mcq-counter').innerText = `Selected: ${selectedQuestionIds.size}/10`;
    };

    document.getElementById('create-set-btn').onclick = async () => {
        const setName = document.getElementById('mcq-set-name').value.trim();
        if (!setName) return alert('Enter a set name.');
        if (selectedQuestionIds.size !== 10) return alert('Please select exactly 10 questions.');

        const res = await fetch(`${API_BASE_URL}/api/admin/mcq-sets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ setName, questions: Array.from(selectedQuestionIds) })
        });

        const data = await res.json();
        if (res.ok) {
            alert('Set created!');
            document.getElementById('mcq-set-name').value = '';
            selectedQuestionIds.clear();
            document.getElementById('mcq-counter').innerText = 'Selected: 0/10';
            fetchMcqBank(currentPage); // Refresh checkmarks
            fetchSets();
        } else {
            alert(`Error: ${data.message}`);
        }
    };

    // --- PREVIEW MODAL LOGIC ---
    document.getElementById('preview-set-btn').onclick = () => {
        const content = document.getElementById('preview-content');
        if (selectedQuestionIds.size === 0) {
            return alert("No questions selected to preview.");
        }

        const items = [];
        let missingCount = 0;

        selectedQuestionIds.forEach(id => {
            const q = knownQuestionsMap.get(id);
            if (q) items.push(q);
            else missingCount++;
        });

        content.innerHTML = items.map((q, i) => `
            <div style="border-bottom:1px solid #ddd; padding:10px 0;">
                <div style="font-weight:bold; margin-bottom:5px;">${i + 1}. ${q.questionText}</div>
                ${q.imageUrl ? `<img src="${q.imageUrl}" style="max-height:80px; display:block; margin-bottom:5px;">` : ''}
                <div style="font-size:0.85rem; color:#666;">
                    ${q.category} | ${q.difficulty} <br>
                    Correct: ${String.fromCharCode(65 + q.correctAnswerIndex)}
                </div>
            </div>
        `).join('');

        if (missingCount > 0) {
            content.innerHTML += `<div style="margin-top:10px; color:#f59e0b; font-size:0.8rem;">
                + ${missingCount} questions selected from other pages (details not loaded in memory).
            </div>`;
        }

        document.getElementById('preview-modal').classList.add('active');
    };

    window.closePreviewModal = () => {
        document.getElementById('preview-modal').classList.remove('active');
    };

    // 4. Delete MCQ
    window.deleteMCQ = async (id) => {
        if (!confirm('Are you sure? It will be removed from any sets.')) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/mcq-questions/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                alert('Question deleted.');
                fetchMcqBank(currentPage);
                fetchSets();
            } else {
                const data = await res.json();
                alert(`Error: ${data.message}`);
            }
        } catch (err) { alert('Network error deleting question.'); }
    };

    // 5. Edit MCQ — Modal (FormData Update)
    window.openEditModal = (id) => {
        const q = knownQuestionsMap.get(id); // Use Cache
        if (!q) return;

        document.getElementById('edit-id').value = q._id;
        document.getElementById('edit-text').value = q.questionText;
        document.getElementById('edit-opt-0').value = q.options[0] || '';
        document.getElementById('edit-opt-1').value = q.options[1] || '';
        document.getElementById('edit-opt-2').value = q.options[2] || '';
        document.getElementById('edit-opt-3').value = q.options[3] || '';
        document.getElementById('edit-correct').value = q.correctAnswerIndex;
        document.getElementById('edit-category').value = q.category;
        document.getElementById('edit-difficulty').value = q.difficulty || 'Medium';
        document.getElementById('edit-explanation').value = q.correctExplanation || '';
        // Clear file input
        document.getElementById('edit-image').value = '';

        document.getElementById('edit-modal').classList.add('active');
    };

    window.closeEditModal = () => {
        document.getElementById('edit-modal').classList.remove('active');
    };

    window.saveEditMCQ = async () => {
        const id = document.getElementById('edit-id').value;
        const formData = new FormData();

        formData.append('questionText', document.getElementById('edit-text').value);
        formData.append('options[0]', document.getElementById('edit-opt-0').value);
        formData.append('options[1]', document.getElementById('edit-opt-1').value);
        formData.append('options[2]', document.getElementById('edit-opt-2').value);
        formData.append('options[3]', document.getElementById('edit-opt-3').value);
        formData.append('correctAnswerIndex', document.getElementById('edit-correct').value);
        formData.append('category', document.getElementById('edit-category').value);
        formData.append('difficulty', document.getElementById('edit-difficulty').value);
        formData.append('correctExplanation', document.getElementById('edit-explanation').value);

        const imageFile = document.getElementById('edit-image').files[0];
        if (imageFile) {
            formData.append('image', imageFile);
        }

        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/mcq-questions/${id}`, {
                method: 'PUT', // Route must support FormData (multer)
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (res.ok) {
                alert('Question updated!');
                closeEditModal();
                fetchMcqBank(currentPage);
            } else {
                const data = await res.json();
                alert(`Error: ${data.message}`);
            }
        } catch (err) { alert('Network error.'); }
    };

    // 6. Set Management
    async function fetchSets() {
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/mcq-sets`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const sets = await res.json();
            renderSets(sets);
        } catch (err) {
            document.getElementById('sets-list').innerHTML = '<p style="color:red;">Failed to load sets.</p>';
        }
    }

    function renderSets(sets) {
        const container = document.getElementById('sets-list');
        if (sets.length === 0) {
            container.innerHTML = '<p style="color:#999;">No sets created yet.</p>';
            return;
        }
        container.innerHTML = sets.map(s => `
            <div class="set-item">
                <span class="set-name">${s.setName}</span>
                <span class="set-meta">${s.questions.length} Qs</span>
                <span class="${s.isActive ? 'badge-active' : 'badge-inactive'}">${s.isActive ? 'Active' : 'Inactive'}</span>
                <div class="set-actions">
                    <button onclick="toggleSet('${s._id}')" style="color:${s.isActive ? '#f59e0b' : '#10b981'};">${s.isActive ? '⏸ Deactivate' : '▶ Activate'}</button>
                    <button onclick="deleteSet('${s._id}')" style="color:#ef4444;">🗑️ Delete</button>
                </div>
            </div>
        `).join('');
    }

    window.toggleSet = async (id) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/mcq-sets/${id}/toggle`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) fetchSets();
        } catch (err) { alert('Error toggling set.'); }
    };

    window.deleteSet = async (id) => {
        if (!confirm('Delete this entire set? This cannot be undone.')) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/mcq-sets/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                alert('Set deleted.');
                fetchSets();
            }
        } catch (err) { alert('Error deleting set.'); }
    };

    // 7. Bulk CSV Upload
    const bulkMcqForm = document.getElementById('bulk-mcq-form');
    bulkMcqForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('csv-file');
        const formData = new FormData();
        formData.append('csvFile', fileInput.files[0]);

        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/bulk-mcqs`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                alert(`Success! ${data.count} questions uploaded.`);
                bulkMcqForm.reset();
                fetchMcqBank(1);
            } else {
                alert(`Error: ${data.message}`);
            }
        } catch (error) {
            alert('Network error during bulk upload.');
        }
    });

    // ==============================
    // 8. USER MANAGEMENT
    // ==============================
    let usersPage = 1;
    let usersTotalPages = 1;

    async function fetchUsers(page = 1) {
        usersPage = page;
        const search = (document.getElementById('user-search').value || '').trim();
        const roleFilter = document.getElementById('user-role-filter').value;

        const params = new URLSearchParams({ page: usersPage, limit: 15 });
        if (search) params.append('search', search);
        if (roleFilter) params.append('role', roleFilter);

        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/users?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            usersTotalPages = data.pages;
            renderUsers(data.users);
            renderUsersPagination();
        } catch (err) {
            console.error('Fetch users failed', err);
        }
    }

    function renderUsers(users) {
        const tbody = document.getElementById('users-tbody');
        if (!users || users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#999;">No users found.</td></tr>';
            return;
        }

        tbody.innerHTML = users.map(u => {
            const roleBadge = u.role === 'admin'
                ? '<span style="background:#fef3c7; color:#92400e; padding:2px 8px; border-radius:10px; font-size:0.7rem; font-weight:600;">Admin</span>'
                : '<span style="background:#e0e7ff; color:#3730a3; padding:2px 8px; border-radius:10px; font-size:0.7rem; font-weight:600;">User</span>';
            const verifiedBadge = u.isVerified
                ? '<span style="color:#10b981; font-weight:600;">Yes</span>'
                : '<span style="color:#ef4444; font-weight:600;">No</span>';
            const authType = u.googleId ? 'Google' : 'Email';

            return `
                <tr>
                    <td>${u.username}</td>
                    <td>${u.email}</td>
                    <td>${roleBadge}</td>
                    <td>${verifiedBadge}</td>
                    <td>${authType}</td>
                    <td>
                        <div style="display:flex; gap:4px; flex-wrap:wrap;">
                            <button onclick="toggleUserRole('${u._id}', '${u.role}')" style="padding:3px 8px; border:1px solid #93c5fd; border-radius:4px; cursor:pointer; font-size:0.7rem; background:white; color:#3b82f6;">
                                ${u.role === 'admin' ? 'Demote' : 'Promote'}
                            </button>
                            <button onclick="openResetPwModal('${u._id}', '${u.username}')" style="padding:3px 8px; border:1px solid #fbbf24; border-radius:4px; cursor:pointer; font-size:0.7rem; background:white; color:#d97706;">
                                Reset PW
                            </button>
                            <button onclick="deleteUser('${u._id}', '${u.username}')" style="padding:3px 8px; border:1px solid #fca5a5; border-radius:4px; cursor:pointer; font-size:0.7rem; background:white; color:#ef4444;">
                                Delete
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function renderUsersPagination() {
        const prev = document.getElementById('users-prev-btn');
        const next = document.getElementById('users-next-btn');
        const info = document.getElementById('users-page-info');

        info.innerText = `Page ${usersPage} of ${usersTotalPages || 1}`;
        prev.disabled = usersPage <= 1;
        next.disabled = usersPage >= usersTotalPages;
        prev.onclick = () => fetchUsers(usersPage - 1);
        next.onclick = () => fetchUsers(usersPage + 1);
    }

    // Search & filter listeners
    let userSearchTimeout;
    document.getElementById('user-search').addEventListener('input', () => {
        clearTimeout(userSearchTimeout);
        userSearchTimeout = setTimeout(() => fetchUsers(1), 500);
    });
    document.getElementById('user-role-filter').addEventListener('change', () => fetchUsers(1));

    // Toggle Role
    window.toggleUserRole = async (id, currentRole) => {
        const newRole = currentRole === 'admin' ? 'user' : 'admin';
        const action = newRole === 'admin' ? 'promote to Admin' : 'demote to User';
        if (!confirm(`Are you sure you want to ${action} this user?`)) return;

        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/users/${id}/role`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ role: newRole })
            });
            const data = await res.json();
            if (res.ok) {
                alert(data.message);
                fetchUsers(usersPage);
            } else {
                alert('Error: ' + data.message);
            }
        } catch (err) { alert('Network error.'); }
    };

    // Delete User
    window.deleteUser = async (id, username) => {
        if (!confirm(`Delete user "${username}" and ALL their test data? This cannot be undone.`)) return;

        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/users/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                alert(data.message);
                fetchUsers(usersPage);
            } else {
                alert('Error: ' + data.message);
            }
        } catch (err) { alert('Network error.'); }
    };

    // Reset Password Modal
    window.openResetPwModal = (id, username) => {
        document.getElementById('reset-pw-user-id').value = id;
        document.getElementById('reset-pw-user-info').textContent = `Set a new password for: ${username}`;
        document.getElementById('reset-pw-value').value = '';
        document.getElementById('reset-pw-modal').classList.add('active');
    };

    document.getElementById('save-reset-pw-btn').onclick = async () => {
        const id = document.getElementById('reset-pw-user-id').value;
        const newPassword = document.getElementById('reset-pw-value').value;
        if (!newPassword || newPassword.length < 6) return alert('Password must be at least 6 characters.');

        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/users/${id}/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ newPassword })
            });
            const data = await res.json();
            if (res.ok) {
                alert(data.message);
                document.getElementById('reset-pw-modal').classList.remove('active');
            } else {
                alert('Error: ' + data.message);
            }
        } catch (err) { alert('Network error.'); }
    };

    // Add User Modal
    document.getElementById('add-user-btn').onclick = () => {
        document.getElementById('new-user-username').value = '';
        document.getElementById('new-user-email').value = '';
        document.getElementById('new-user-password').value = '';
        document.getElementById('new-user-role').value = 'user';
        document.getElementById('add-user-modal').classList.add('active');
    };

    document.getElementById('save-new-user-btn').onclick = async () => {
        const username = document.getElementById('new-user-username').value.trim();
        const email = document.getElementById('new-user-email').value.trim();
        const password = document.getElementById('new-user-password').value;
        const role = document.getElementById('new-user-role').value;

        if (!username || !email || !password) return alert('All fields are required.');
        if (password.length < 6) return alert('Password must be at least 6 characters.');

        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ username, email, password, role })
            });
            const data = await res.json();
            if (res.ok) {
                alert(data.message);
                document.getElementById('add-user-modal').classList.remove('active');
                fetchUsers(1);
            } else {
                alert('Error: ' + data.message);
            }
        } catch (err) { alert('Network error.'); }
    };

    // Initial Load
    fetchResults();
    fetchUsers(1);
    fetchMcqBank(1);
    fetchSets();
});
