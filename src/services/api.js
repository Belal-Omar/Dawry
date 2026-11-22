const BASE_URL = '/api';

async function request(url, options = {}) {
  try {
    const res = await fetch(`${BASE_URL}${url}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.error(`API Error on ${url}:`, err);
    return { success: false, error: err.message };
  }
}

export const api = {
  // Public
  getSpecialties: () => request('/public/specialties'),
  getDoctors: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/public/doctors?${query}`);
  },
  getDoctorProfile: (id) => request(`/public/doctors/${id}`),
  getAvailableSlots: (doctorId, branchId, date) => request(`/public/doctors/${doctorId}/available-slots?branch_id=${branchId}&date=${date}`),
  createBooking: (bookingData) => request('/public/bookings', { method: 'POST', body: JSON.stringify(bookingData) }),
  trackBooking: (code) => request(`/public/bookings/track/${encodeURIComponent(code)}`),
  getMyBookings: (phone) => request(`/public/bookings/my${phone ? `?phone=${encodeURIComponent(phone)}` : ''}`),
  cancelBooking: (code) => request(`/public/bookings/${encodeURIComponent(code)}/cancel`, { method: 'POST' }),

  // Unified Auth & Patient Signup
  login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  signupPatient: (data) => request('/auth/patient/signup', { method: 'POST', body: JSON.stringify(data) }),

  // Doctor Auth
  loginDoctor: (credentials) => request('/auth/doctor/login', { method: 'POST', body: JSON.stringify(credentials) }),
  getDoctorAuthList: () => request('/auth/doctor/list'),

  // Doctor Dashboard
  getDoctorDashboard: (id) => request(`/doctor/${id}/dashboard`),
  getDoctorQueue: (id, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/doctor/${id}/queue${query ? '?' + query : ''}`);
  },
  doctorQueueAction: (id, actionData) => request(`/doctor/${id}/queue/action`, { method: 'POST', body: JSON.stringify(actionData) }),
  getDoctorAppointments: (id, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/doctor/${id}/appointments?${query}`);
  },
  getDoctorSchedule: (id) => request(`/doctor/${id}/schedule`),
  saveDoctorSchedule: (id, schedules) => request(`/doctor/${id}/schedule`, { method: 'POST', body: JSON.stringify({ schedules }) }),
  getDoctorVacations: (id) => request(`/doctor/${id}/vacations`),
  addDoctorVacation: (id, data) => request(`/doctor/${id}/vacations`, { method: 'POST', body: JSON.stringify(data) }),
  deleteDoctorVacation: (id, vacationId) => request(`/doctor/${id}/vacations/${vacationId}`, { method: 'DELETE' }),
  getDoctorPatients: (id, search = '') => request(`/doctor/${id}/patients?search=${encodeURIComponent(search)}`),
  getDoctorAnalytics: (id) => request(`/doctor/${id}/analytics`),
  inviteReceptionist: (doctorId, data) => request(`/doctor/${doctorId}/receptionists`, { method: 'POST', body: JSON.stringify(data) }),
  getDoctorReceptionists: (id) => request(`/doctor/${id}/receptionists`),
  toggleReceptionistStatus: (id, staffId) => request(`/doctor/${id}/receptionists/${staffId}/toggle`, { method: 'POST' }),
  getDoctorBranches: (id) => request(`/doctor/${id}/branches`),
  addDoctorBranch: (id, data) => request(`/doctor/${id}/branches`, { method: 'POST', body: JSON.stringify(data) }),
  updateDoctorSettings: (id, data) => request(`/doctor/${id}/settings`, { method: 'PUT', body: JSON.stringify(data) }),

  // Receptionist Dashboard & Auth
  loginReceptionist: (credentials) => request('/auth/receptionist/login', { method: 'POST', body: JSON.stringify(credentials) }),
  getReceptionistAuthList: () => request('/auth/receptionist/list'),
  getReceptionistDashboard: (id) => request(`/receptionist/${id}/dashboard`),
  getReceptionistQueue: (id, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/receptionist/${id}/queue${query ? '?' + query : ''}`);
  },
  receptionistQueueAction: (id, actionData) => request(`/receptionist/${id}/queue/action`, { method: 'POST', body: JSON.stringify(actionData) }),
  getReceptionistAppointments: (id, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/receptionist/${id}/appointments?${query}`);
  },
  receptionistAppointmentAction: (id, apptId, actionData) => request(`/receptionist/${id}/appointments/${apptId}/action`, { method: 'POST', body: JSON.stringify(actionData) }),
  registerWalkin: (recId, data) => request(`/receptionist/${recId}/walkin`, { method: 'POST', body: JSON.stringify(data) }),
  receptionistCheckin: (recId, codeOrPhone) => request(`/receptionist/${recId}/checkin`, { method: 'POST', body: JSON.stringify({ code_or_phone: codeOrPhone }) }),
  searchReceptionistPatients: (recId, query) => request(`/receptionist/${recId}/patients/search?query=${encodeURIComponent(query)}`),
  getReceptionistNotifications: (recId) => request(`/receptionist/${recId}/notifications`),
  updateReceptionistProfile: (recId, data) => request(`/receptionist/${recId}/profile`, { method: 'PUT', body: JSON.stringify(data) }),

  // Super Admin Dashboard
  getAdminOverview: () => request('/admin/overview'),
  uploadImage: (image) => request('/upload', { method: 'POST', body: JSON.stringify({ image }) }),
  getAdminDoctors: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/admin/doctors?${query}`);
  },
  addDoctorWizard: (data) => request('/admin/doctors/wizard', { method: 'POST', body: JSON.stringify(data) }),
  getDoctorFullProfile: (id) => request(`/admin/doctors/${id}/full-profile`),
  updateDoctorAdmin: (id, data) => request(`/admin/doctors/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  toggleDoctorBooking: (id) => request(`/admin/doctors/${id}/booking-toggle`, { method: 'POST' }),
  suspendDoctor: (id, reason) => request(`/admin/doctors/${id}/suspend`, { method: 'POST', body: JSON.stringify({ reason }) }),
  reactivateDoctor: (id) => request(`/admin/doctors/${id}/reactivate`, { method: 'POST' }),
  deleteDoctor: (id) => request(`/admin/doctors/${id}`, { method: 'DELETE' }),
  resetDoctorPassword: (id) => request(`/admin/doctors/${id}/reset-password`, { method: 'POST' }),

  // Branch Management
  getAdminBranches: () => request('/admin/branches'),
  addAdminBranch: (data) => request('/admin/branches', { method: 'POST', body: JSON.stringify(data) }),
  toggleBranchBooking: (branchId) => request(`/admin/branches/${branchId}/booking-toggle`, { method: 'POST' }),
  deleteAdminBranch: (branchId) => request(`/admin/branches/${branchId}`, { method: 'DELETE' }),

  // Receptionists & Staff Management
  getAdminStaff: () => request('/admin/receptionists'),
  addAdminStaff: (data) => request('/admin/receptionists', { method: 'POST', body: JSON.stringify(data) }),
  updateAdminStaff: (recId, data) => request(`/admin/receptionists/${recId}`, { method: 'PUT', body: JSON.stringify(data) }),
  toggleAdminStaff: (recId) => request(`/admin/receptionists/${recId}/toggle`, { method: 'POST' }),
  deleteAdminStaff: (recId) => request(`/admin/receptionists/${recId}`, { method: 'DELETE' }),

  // Patient Booking Control Center
  getBookingControl: () => request('/admin/bookings/control'),
  toggleGlobalBooking: () => request('/admin/bookings/global-toggle', { method: 'POST' }),

  // Subscriptions & Plans
  getAdminSubscriptions: () => request('/admin/subscriptions'),
  assignDoctorSubscription: (data) => request('/admin/subscriptions/assign', { method: 'POST', body: JSON.stringify(data) }),
  recordPayment: (data) => request('/admin/payments/record', { method: 'POST', body: JSON.stringify(data) }),

  // Specialties & Platform
  getAdminSpecialties: () => request('/admin/specialties'),
  addSpecialty: (data) => request('/admin/specialties', { method: 'POST', body: JSON.stringify(data) }),
  updateSpecialty: (id, data) => request(`/admin/specialties/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getAuditLogs: () => request('/admin/audit-logs'),
  getNotifications: () => request('/admin/notifications')
};
