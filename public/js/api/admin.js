import { client } from './client.js';

function buildQueryParams(params) {
    const filtered = Object.entries(params)
        .filter(([key, value]) => value !== undefined && value !== '' && value !== null)
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
    return new URLSearchParams(filtered).toString();
}

export const adminApi = {
    // Users
    getUsers: (params) => client.get(`/api/admin/users?${buildQueryParams(params)}`),
    createUser: (data) => client.post('/api/admin/users', data),
    updateUserRole: (id, role) => client.patch(`/api/admin/users/${id}/role`, { role }),
    resetPassword: (id, newPassword) => client.post(`/api/admin/users/${id}/reset-password`, { newPassword }),
    deleteUser: (id) => client.delete(`/api/admin/users/${id}`),

    // Results
    getResults: () => client.get('/api/admin/results'),

    // Content - Passages
    getPassages: (params) => client.get(`/api/admin/passages?${buildQueryParams(params)}`),
    createPassage: (data) => client.post('/api/admin/passages', data),
    deletePassage: (id) => client.delete(`/api/admin/passages/${id}`),

    // Content - Letter
    getLetterQuestions: (params) => client.get(`/api/admin/letter-questions?${buildQueryParams(params)}`),
    createLetterQuestion: (data) => client.post('/api/admin/letter-questions', data),
    deleteLetterQuestion: (id) => client.delete(`/api/admin/letter-questions/${id}`),

    // Content - Excel
    getExcelQuestions: (params) => client.get(`/api/admin/excel-questions?${buildQueryParams(params)}`),
    createExcelQuestion: (formData) => client.upload('/api/admin/excel-questions', formData),
    deleteExcelQuestion: (id) => client.delete(`/api/admin/excel-questions/${id}`),

    // Content - MCQs
    getMcKQuestions: (params) => client.get(`/api/admin/mcq-questions?${buildQueryParams(params)}`),
    createMCQ: (formData) => client.upload('/api/admin/mcq-questions', formData),
    updateMCQ: (id, formData) => client.upload(`/api/admin/mcq-questions/${id}`, formData, 'PUT'),
    deleteMCQ: (id) => client.delete(`/api/admin/mcq-questions/${id}`),
    bulkUploadMCQs: (formData) => client.upload('/api/admin/bulk-mcqs', formData),

    // Content - MCQ Sets
    getMCQSets: () => client.get('/api/admin/mcq-sets'),
    createMCQSet: (data) => client.post('/api/admin/mcq-sets', data),
    toggleMCQSet: (id) => client.patch(`/api/admin/mcq-sets/${id}/toggle`),
    deleteMCQSet: (id) => client.delete(`/api/admin/mcq-sets/${id}`),

    // Settings
    getSettings: () => client.get('/api/settings'),
    updateSettings: (data) => client.put('/api/settings', data),
};
