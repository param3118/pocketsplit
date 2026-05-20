import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use(config => {
  // Try to find group ID from URL if possible, otherwise rely on the global active passkeys
  // For simplicity, we can inject a global active passkey, or pull it by inspecting the request
  // Let's attach the currently active user and group passkey if available
  const user = JSON.parse(localStorage.getItem('pocketsplit_user') || 'null');
  if (user) {
    config.headers['X-User-Id'] = user.id;
  }
  
  // The passkeys are stored in sessionStorage as `passkey_groupId`
  // For generic access, we can loop or if the app maintains the "activeGroupId" in localStorage:
  const activeGroupId = localStorage.getItem('pocketsplit_active_group_id');
  if (activeGroupId) {
    const passkey = sessionStorage.getItem(`passkey_${activeGroupId}`);
    if (passkey) {
      config.headers['X-Group-Passkey'] = passkey;
    }
  }

  return config;
});


// Groups
export const fetchGroups = () => api.get('/groups').then(r => r.data.data);
export const fetchGroup = (id) => api.get(`/groups/${id}`).then(r => r.data.data);
export const createGroup = (data) => api.post('/groups', data).then(r => r.data.data);
export const updateGroup = (id, data) => api.put(`/groups/${id}`, data).then(r => r.data.data);
export const deleteGroup = (id) => api.delete(`/groups/${id}`).then(r => r.data);
export const verifyPasskey = (id) => api.post(`/groups/${id}/verify`).then(r => r.data);

// Members
export const fetchMembers = (groupId) => api.get(`/members/${groupId}`).then(r => r.data.data);
export const addMember = (data) => api.post('/members', data).then(r => r.data.data);
export const removeMember = (groupId, userId) =>
  api.delete(`/members/${groupId}/${userId}`).then(r => r.data);

// Expenses
export const fetchExpenses = (groupId) => api.get(`/expenses/${groupId}`).then(r => r.data.data);
export const fetchExpenseDetail = (id) => api.get(`/expense/detail/${id}`).then(r => r.data.data);
export const createExpense = (data) => api.post('/expenses', data).then(r => r.data.data);
export const updateExpense = (id, data) => api.put(`/expenses/${id}`, data).then(r => r.data.data);
export const deleteExpense = (id) => api.delete(`/expenses/${id}`).then(r => r.data);
export const markSent = (expenseId, userId) =>
  api.post(`/expenses/${expenseId}/mark-sent`, { user_id: userId }).then(r => r.data);
export const markPaid = (expenseId, userId) =>
  api.post(`/expenses/${expenseId}/mark-paid`, { user_id: userId }).then(r => r.data);

// Balances
export const fetchBalances = (groupId) => api.get(`/balances/${groupId}`).then(r => r.data.data);

// Settlements
export const createSettlement = (data) => api.post('/settlements', data).then(r => r.data.data);
export const fetchSettlements = (groupId) => api.get(`/settlements/${groupId}`).then(r => r.data.data);

export default api;