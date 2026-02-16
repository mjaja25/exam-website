import { client } from './client.js';

export const adminApi = {
    // Users
    getUsers: (params) => client.get(`/api/admin/users?${new URLSearchParams(params)}`),
    createUser: (data) => client.post('/api/admin/users', data),
    updateUserRole: (id, role) => client.patch(`/api/admin/users/${id}/role`, { role }),
    resetPassword: (id, newPassword) => client.post(`/api/admin/users/${id}/reset-password`, { newPassword }),
    deleteUser: (id) => client.delete(`/api/admin/users/${id}`),

    // Results
    getResults: () => client.get('/api/admin/results'),

    // Content - Passages
    createPassage: (data) => client.post('/api/admin/passages', data),

    // Content - Letter
    createLetterQuestion: (data) => client.post('/api/admin/letter-questions', data),

    // Content - Excel
    createExcelQuestion: (formData) => client.upload('/api/admin/excel-questions', formData),

    // Content - MCQs
    getMcKQuestions: (params) => client.get(`/api/admin/mcq-questions?${new URLSearchParams(params)}`),
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
