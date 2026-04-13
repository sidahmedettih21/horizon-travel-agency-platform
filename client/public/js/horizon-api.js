(function() {
  const API_BASE = 'http://localhost:3000';
  const AGENCY_ID = 1;

  async function apiCall(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    const res = await fetch(`${API_BASE}${endpoint}`, {
      credentials: 'include',
      headers,
      ...options
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `API error ${res.status}`);
    }
    return res.json();
  }

  window.HorizonAPI = {
    getContent: (type) => apiCall(`/api/content/${AGENCY_ID}/${type}`),
    submitBooking: (data) => apiCall('/api/v1/bookings', { method: 'POST', body: JSON.stringify(data) }),
    login: (email, password) => apiCall('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    logout: () => apiCall('/api/v1/auth/logout', { method: 'POST' }),
    getMe: () => apiCall('/api/v1/auth/me'),
    adminGetContent: (type) => apiCall(`/api/content/admin/${type}`),
    adminCreateContent: (type, data) => apiCall(`/api/content/admin/${type}`, { method: 'POST', body: JSON.stringify(data) }),
    adminUpdateContent: (type, uuid, data) => apiCall(`/api/content/admin/${type}/${uuid}`, { method: 'PUT', body: JSON.stringify(data) }),
    adminDeleteContent: (type, uuid) => apiCall(`/api/content/admin/${type}/${uuid}`, { method: 'DELETE' }),
    getClients: () => apiCall('/api/v1/clients'),
    createClient: (data) => apiCall('/api/v1/clients', { method: 'POST', body: JSON.stringify(data) }),
    getTransactions: () => apiCall('/api/v1/transactions'),
    createTransaction: (data) => apiCall('/api/v1/transactions', { method: 'POST', body: JSON.stringify(data) })
  };
})();