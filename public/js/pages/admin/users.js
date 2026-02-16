import { adminApi } from '../../api/admin.js';
import { ui } from '../../utils/ui.js';

export class UserManager {
    constructor() {
        this.page = 1;
        this.totalPages = 1;
        this.searchTimeout = null;
        this.bindEvents();
    }

    bindEvents() {
        // Search & Filter
        const searchInput = document.getElementById('user-search');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(this.searchTimeout);
                this.searchTimeout = setTimeout(() => this.fetchUsers(1), 500);
            });
        }

        const roleFilter = document.getElementById('user-role-filter');
        if (roleFilter) {
            roleFilter.addEventListener('change', () => this.fetchUsers(1));
        }

        // Pagination
        const prevBtn = document.getElementById('users-prev-btn');
        const nextBtn = document.getElementById('users-next-btn');
        if (prevBtn) prevBtn.onclick = () => this.fetchUsers(this.page - 1);
        if (nextBtn) nextBtn.onclick = () => this.fetchUsers(this.page + 1);

        // Add User Modal
        const addUserBtn = document.getElementById('add-user-btn');
        if (addUserBtn) addUserBtn.onclick = () => this.openAddUserModal();

        const saveUserBtn = document.getElementById('save-new-user-btn');
        if (saveUserBtn) saveUserBtn.onclick = () => this.saveNewUser();

        // Reset Password Modal
        const saveResetBtn = document.getElementById('save-reset-pw-btn');
        if (saveResetBtn) saveResetBtn.onclick = () => this.saveResetPassword();
    }

    async fetchUsers(page = 1) {
        this.page = page;
        const search = (document.getElementById('user-search').value || '').trim();
        const role = document.getElementById('user-role-filter').value;

        try {
            const data = await adminApi.getUsers({ page, limit: 15, search, role });
            this.totalPages = data.pages;
            this.renderUsers(data.users);
            this.updatePagination();
        } catch (error) {
            console.error('Fetch users failed', error);
            ui.showToast('Failed to load users', 'error');
        }
    }

    renderUsers(users) {
        const tbody = document.getElementById('users-tbody');
        if (!tbody) return;

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

            // Note: We need to bind click events carefully or use delegation. 
            // For now, attaching IDs to buttons and using a global delegate or re-attaching listeners is better than inline onclicks 
            // BUT given the strict modularity, we will use data attributes and a delegate listener on the table.
            return `
                <tr data-id="${u._id}" data-username="${u.username}" data-role="${u.role}">
                    <td>${u.username}</td>
                    <td>${u.email}</td>
                    <td>${roleBadge}</td>
                    <td>${verifiedBadge}</td>
                    <td>${authType}</td>
                    <td>
                        <div style="display:flex; gap:4px; flex-wrap:wrap;">
                            <button class="btn-role" style="padding:3px 8px; border:1px solid #93c5fd; border-radius:4px; cursor:pointer; font-size:0.7rem; background:white; color:#3b82f6;">
                                ${u.role === 'admin' ? 'Demote' : 'Promote'}
                            </button>
                            <button class="btn-reset" style="padding:3px 8px; border:1px solid #fbbf24; border-radius:4px; cursor:pointer; font-size:0.7rem; background:white; color:#d97706;">
                                Reset PW
                            </button>
                            <button class="btn-delete" style="padding:3px 8px; border:1px solid #fca5a5; border-radius:4px; cursor:pointer; font-size:0.7rem; background:white; color:#ef4444;">
                                Delete
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Delegate events
        tbody.onclick = (e) => this.handleTableClick(e);
    }

    handleTableClick(e) {
        const btn = e.target.closest('button');
        if (!btn) return;
        const tr = btn.closest('tr');
        const { id, username, role } = tr.dataset;

        if (btn.classList.contains('btn-role')) this.toggleUserRole(id, role);
        if (btn.classList.contains('btn-reset')) this.openResetPwModal(id, username);
        if (btn.classList.contains('btn-delete')) this.deleteUser(id, username);
    }

    updatePagination() {
        const prev = document.getElementById('users-prev-btn');
        const next = document.getElementById('users-next-btn');
        const info = document.getElementById('users-page-info');

        if (info) info.innerText = `Page ${this.page} of ${this.totalPages || 1}`;
        if (prev) prev.disabled = this.page <= 1;
        if (next) next.disabled = this.page >= this.totalPages;
    }

    // Actions
    async toggleUserRole(id, currentRole) {
        const newRole = currentRole === 'admin' ? 'user' : 'admin';
        if (!ui.confirm(`Change role to ${newRole}?`)) return;
        try {
            await adminApi.updateUserRole(id, newRole);
            ui.showToast('Role updated', 'success');
            this.fetchUsers(this.page);
        } catch (error) {
            ui.showToast(error.message, 'error');
        }
    }

    async deleteUser(id, username) {
        if (!ui.confirm(`Delete user "${username}"? This cannot be undone.`)) return;
        try {
            await adminApi.deleteUser(id);
            ui.showToast('User deleted', 'success');
            this.fetchUsers(this.page);
        } catch (error) {
            ui.showToast(error.message, 'error');
        }
    }

    // Modals
    openAddUserModal() {
        ui.getElement('new-user-username').value = '';
        ui.getElement('new-user-email').value = '';
        ui.getElement('new-user-password').value = '';
        ui.getElement('new-user-role').value = 'user';
        ui.getElement('add-user-modal').classList.add('active');
    }

    async saveNewUser() {
        const data = {
            username: ui.getElement('new-user-username').value.trim(),
            email: ui.getElement('new-user-email').value.trim(),
            password: ui.getElement('new-user-password').value,
            role: ui.getElement('new-user-role').value
        };

        if (data.password.length < 6) return ui.showToast('Password too short', 'warning');

        try {
            await adminApi.createUser(data);
            ui.showToast('User created', 'success');
            ui.getElement('add-user-modal').classList.remove('active');
            this.fetchUsers(1);
        } catch (error) {
            ui.showToast(error.message, 'error');
        }
    }

    openResetPwModal(id, username) {
        ui.getElement('reset-pw-user-id').value = id;
        ui.getElement('reset-pw-user-info').textContent = `Resetting password for: ${username}`;
        ui.getElement('reset-pw-value').value = '';
        ui.getElement('reset-pw-modal').classList.add('active');
    }

    async saveResetPassword() {
        const id = ui.getElement('reset-pw-user-id').value;
        const newPassword = ui.getElement('reset-pw-value').value;
        if (newPassword.length < 6) return ui.showToast('Password too short', 'warning');

        try {
            await adminApi.resetPassword(id, newPassword);
            ui.showToast('Password reset successful', 'success');
            ui.getElement('reset-pw-modal').classList.remove('active');
        } catch (error) {
            ui.showToast(error.message, 'error');
        }
    }
}
