import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import Logo from '../components/Logo';
import Icon, { SpecialtyIcon } from '../components/Icons';
import ThemeToggle from '../components/ThemeToggle';
import Modal from '../components/Modal';

export default function SuperAdminDashboard({ onHome, dark, setDark, showToast }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Navigation tabs:
  // 'overview' | 'doctors' | 'branches' | 'staff' | 'bookings' | 'subscriptions' | 'platform'
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  // Core Data
  const [overview, setOverview] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [branches, setBranches] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [bookingControl, setBookingControl] = useState(null);
  const [subscriptionsData, setSubscriptionsData] = useState(null);
  const [specialties, setSpecialties] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  // Search & Filters
  const [docSearch, setDocSearch] = useState('');
  const [docStatusFilter, setDocStatusFilter] = useState('');
  const [branchSearch, setBranchSearch] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [bookingSearch, setBookingSearch] = useState('');

  const [selectedSpecialtyFilter, setSelectedSpecialtyFilter] = useState('all');

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
    let pass = '';
    for (let i = 0; i < 8; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
  };

  // -----------------------------------------------------------------
  // MODALS STATE
  // -----------------------------------------------------------------
  // 1. Connected Doctor Full Profile Modal (Section 8)
  const [profileModal, setProfileModal] = useState({
    isOpen: false,
    doctorId: null,
    activeSubTab: 'overview', // 'overview' | 'info' | 'branches' | 'staff' | 'bookings' | 'subscription' | 'audit'
    loading: false,
    data: null
  });

  // Profile Modal: Doctor Edit Form
  const [doctorEditForm, setDoctorEditForm] = useState({
    full_name: '',
    title: '',
    specialty_id: '',
    subspecialty: '',
    phone: '',
    email: '',
    password: '',
    showPassword: false,
    bio: '',
    consultation_fee: 400,
    appointment_duration: 20,
    daily_capacity: 30,
    profile_photo: '',
    submitting: false
  });

  // Profile Modal: Inline add staff for this specific doctor
  const [profileAddStaffForm, setProfileAddStaffForm] = useState({
    isOpen: false,
    name: '',
    email: '',
    phone: '',
    password: '',
    branch_id: '',
    submitting: false
  });

  // Profile Modal: Inline add branch for this specific doctor
  const [profileAddBranchForm, setProfileAddBranchForm] = useState({
    isOpen: false,
    clinic_name: '',
    branch_name: '',
    governorate: 'القاهرة',
    city: 'القاهرة',
    address: '',
    phone: '',
    submitting: false
  });

  // Profile Modal: Staff Password Edit State
  const [staffPasswordEdit, setStaffPasswordEdit] = useState({});
  const [staffPasswordVisible, setStaffPasswordVisible] = useState({});

  // 2. Multi-Step Add Doctor Wizard (Section 2)
  const [wizardModal, setWizardModal] = useState({
    isOpen: false,
    step: 1, // 1: Info, 2: Account, 3: Branches, 4: Receptionists, 5: Booking
    submitting: false
  });
  const [wizardForm, setWizardForm] = useState({
    full_name: '',
    title: 'استشاري',
    specialty_id: '',
    subspecialty: '',
    email: '',
    phone: '',
    password: '',
    showPassword: false,
    bio: '',
    consultation_fee: 450,
    appointment_duration: 20,
    daily_capacity: 30,
    profile_photo: '',
    plan_id: 1,
    is_booking_enabled: true,
    branches: [
      { clinic_name: '', branch_name: 'الفرع الرئيسي', governorate: 'القاهرة', city: 'مدينة نصر', address: 'شارع عباس العقاد', phone: '', is_booking_enabled: true }
    ],
    receptionists: [
      { name: '', email: '', phone: '', password: '', showPassword: false, branch_index: 0 }
    ]
  });

  // 3. Edit Doctor Modal
  const [editDocModal, setEditDocModal] = useState({
    isOpen: false,
    doctor: null
  });

  // 4. Suspend Doctor Modal
  const [suspendModal, setSuspendModal] = useState({
    isOpen: false,
    doctor: null,
    reason: 'انتهاء مدة الاشتراك وتأخر السداد'
  });

  // 5. Delete Confirmation Modal
  const [confirmDeleteModal, setConfirmDeleteModal] = useState({
    isOpen: false,
    type: 'doctor', // 'doctor' | 'branch' | 'staff'
    target: null,
    onConfirm: null
  });

  // 6. Add Branch to Doctor Modal
  const [addBranchModal, setAddBranchModal] = useState({
    isOpen: false,
    doctorId: '',
    form: { clinic_name: '', branch_name: '', governorate: 'القاهرة', city: '', address: '', phone: '' }
  });

  // 7. Add Staff Modal
  const [addStaffModal, setAddStaffModal] = useState({
    isOpen: false,
    doctorId: '',
    branchId: '',
    form: { name: '', email: '', phone: '', password: '' }
  });

  // 8. Add Specialty Modal
  const [specialtyModal, setSpecialtyModal] = useState({
    isOpen: false,
    form: { name: '', icon: 'spark', description: '' }
  });

  // 9. Subscription Assign / Extend Modal
  const [subAssignModal, setSubAssignModal] = useState({
    isOpen: false,
    doctor: null,
    planId: 1,
    extendDays: 30
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [overRes, docsRes, branchRes, staffRes, bookRes, subRes, specRes, auditRes] = await Promise.all([
        api.getAdminOverview(),
        api.getAdminDoctors(),
        api.getAdminBranches(),
        api.getAdminStaff(),
        api.getBookingControl(),
        api.getAdminSubscriptions(),
        api.getAdminSpecialties(),
        api.getAuditLogs()
      ]);

      if (overRes.success) setOverview(overRes);
      if (docsRes.success) setDoctors(docsRes.doctors || []);
      if (branchRes.success) setBranches(branchRes.branches || []);
      if (staffRes.success) setStaffList(staffRes.staff || []);
      if (bookRes.success) setBookingControl(bookRes);
      if (subRes.success) setSubscriptionsData(subRes);
      if (specRes.success) setSpecialties(specRes.specialties || []);
      if (auditRes.success) setAuditLogs(auditRes.logs || []);
    } catch (err) {
      console.error('Error loading super admin dashboard:', err);
    }
    setLoading(false);
  };

  // -----------------------------------------------------------------
  // ACTION HANDLERS
  // -----------------------------------------------------------------
  // Global Platform Booking Toggle
  const handleToggleGlobalBooking = async () => {
    const res = await api.toggleGlobalBooking();
    if (res.success) {
      showToast(res.message, 'success');
      loadAll();
    } else {
      showToast(res.message || 'حدث خطأ في تغيير إتاحة الحجز', 'error');
    }
  };

  // Doctor Online Booking Toggle
  const handleToggleDoctorBooking = async (docId) => {
    const res = await api.toggleDoctorBooking(docId);
    if (res.success) {
      showToast(res.message, 'success');
      loadAll();
    } else {
      showToast(res.message || 'فشل تعديل إتاحة الحجز', 'error');
    }
  };

  // Branch Online Booking Toggle (isolated for this branch alone!)
  const handleToggleBranchBooking = async (branchId) => {
    const res = await api.toggleBranchBooking(branchId);
    if (res.success) {
      showToast(res.message, 'success');
      loadAll();
    } else {
      showToast(res.message || 'فشل تعديل إتاحة الحجز للفرع', 'error');
    }
  };

  // Suspend Doctor
  const handleSuspendDoctor = async () => {
    if (!suspendModal.doctor) return;
    const res = await api.suspendDoctor(suspendModal.doctor.id, suspendModal.reason);
    if (res.success) {
      showToast(res.message, 'success');
      setSuspendModal({ isOpen: false, doctor: null, reason: '' });
      loadAll();
    } else {
      showToast(res.message || 'فشل إيقاف الحساب', 'error');
    }
  };

  // Reactivate Doctor
  const handleReactivateDoctor = async (doc) => {
    const res = await api.reactivateDoctor(doc.id);
    if (res.success) {
      showToast(res.message, 'success');
      loadAll();
    } else {
      showToast(res.message || 'فشل تفعيل الحساب', 'error');
    }
  };

  // Permanent Delete Doctor
  const handleDeleteDoctor = async (doc) => {
    const res = await api.deleteDoctor(doc.id);
    if (res.success) {
      showToast(res.message, 'success');
      setConfirmDeleteModal({ isOpen: false, type: 'doctor', target: null });
      loadAll();
    } else {
      showToast(res.message || 'فشل حذف الطبيب', 'error');
    }
  };

  // Reset Doctor Password
  const handleResetPassword = async (doc) => {
    const res = await api.resetDoctorPassword(doc.id);
    if (res.success) {
      showToast(res.message, 'success');
    } else {
      showToast(res.message || 'فشل إرسال الدعوة', 'error');
    }
  };

  // Open Full Connected Doctor Profile
  const handleOpenDoctorProfile = async (docId, initialSubTab = 'info') => {
    setProfileModal(prev => ({ ...prev, isOpen: true, doctorId: docId, activeSubTab: initialSubTab, loading: true, data: null }));
    const res = await api.getDoctorFullProfile(docId);
    if (res.success && res.profile) {
      setProfileModal(prev => ({ ...prev, loading: false, data: res.profile }));
      const d = res.profile.doctor;
      setDoctorEditForm({
        full_name: d.full_name || '',
        title: d.title || '',
        specialty_id: d.specialty_id || '',
        subspecialty: d.subspecialty || '',
        phone: d.phone || '',
        email: d.email || '',
        password: d.password || '123456',
        showPassword: false,
        bio: d.bio || '',
        consultation_fee: d.consultation_fee || 400,
        appointment_duration: d.appointment_duration || 20,
        daily_capacity: d.daily_capacity || 30,
        profile_photo: d.profile_photo || '',
        submitting: false
      });
      const pMap = {};
      res.profile.receptionists?.forEach(r => {
        pMap[r.id] = r.password || '123456';
      });
      setStaffPasswordEdit(pMap);
    } else {
      showToast('تعذر تحميل الملف الكامل للطبيب', 'error');
      setProfileModal(prev => ({ ...prev, loading: false }));
    }
  };

  // Save Doctor Edit Form
  const handleSaveDoctorEdit = async (e) => {
    if (e) e.preventDefault();
    if (!profileModal.doctorId) return;
    setDoctorEditForm(prev => ({ ...prev, submitting: true }));
    const res = await api.updateDoctorAdmin(profileModal.doctorId, {
      full_name: doctorEditForm.full_name,
      title: doctorEditForm.title,
      specialty_id: doctorEditForm.specialty_id,
      subspecialty: doctorEditForm.subspecialty,
      phone: doctorEditForm.phone,
      email: doctorEditForm.email,
      bio: doctorEditForm.bio,
      consultation_fee: Number(doctorEditForm.consultation_fee) || 400,
      appointment_duration: Number(doctorEditForm.appointment_duration) || 20,
      daily_capacity: Number(doctorEditForm.daily_capacity) || 30,
      profile_photo: doctorEditForm.profile_photo,
      password: doctorEditForm.password
    });
    setDoctorEditForm(prev => ({ ...prev, submitting: false }));
    if (res.success) {
      showToast('تم حفظ وتحديث بيانات وحساب الطبيب بنجاح!', 'success');
      handleOpenDoctorProfile(profileModal.doctorId, profileModal.activeSubTab);
      loadAll();
    } else {
      showToast(res.message || 'فشل تحديث بيانات الطبيب', 'error');
    }
  };

  // Upload photo in Add Doctor Wizard
  const handleWizardPhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast('حجم الصورة كبير، يرجى اختيار صورة أقل من 10 ميجابايت', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target.result;
      setWizardForm(prev => ({ ...prev, profile_photo: base64 }));
      try {
        const res = await api.uploadImage(base64);
        if (res.success && res.url) {
          setWizardForm(prev => ({ ...prev, profile_photo: res.url }));
          showToast('تم رفع صورة الطبيب بنجاح', 'success');
        }
      } catch (err) {
        showToast('تم حفظ الصورة بنجاح', 'success');
      }
    };
    reader.readAsDataURL(file);
  };

  // Helper: Copy Doctor Credentials for WhatsApp
  const copyDoctorCredentials = (doc, raw) => {
    const name = doc?.full_name || raw?.full_name || 'الطبيب';
    const email = doc?.email || raw?.email || '';
    const pass = doc?.password || raw?.password || '123456';
    const origin = window.location.origin;
    const text = `مرحباً د. ${name}،\nإليك بيانات دخول مساحة العمل الخاصة بك على منصة دُوري (Dawry):\n\n🌐 رابط مساحة عمل الطبيب: ${origin}/#doctor\n📧 اسم الدخول / البريد: ${email}\n🔑 كلمة المرور: ${pass}\n\nيمكنك من خلالها متابعة طابور العيادة، أرقام الانتظار، واستقبال المرضى لحظياً.`;
    navigator.clipboard.writeText(text);
    showToast(`تم نسخ بيانات دخول د. ${name} جاهزة للإرسال على واتساب 📋`, 'success');
  };

  // Helper: Copy Receptionist Credentials for WhatsApp
  const copyStaffCredentials = (staff, docName) => {
    const origin = window.location.origin;
    const text = `بيانات دخول الاستقبال - منصة دُوري (Dawry):\n\nالموظف: ${staff.name}\nالعيادة: د. ${docName || staff.doctor_name || ''} (${staff.branch_name || 'الفرع'})\n🌐 رابط الدخول: ${origin}/#reception\n📧 البريد: ${staff.email}\n🔑 كلمة المرور: ${staff.password || '123456'}\n\nيمكنك إدارة الطابور، استدعاء المرضى، وتسجيل الزيارات فورياً.`;
    navigator.clipboard.writeText(text);
    showToast(`تم نسخ بيانات دخول موظف الاستقبال ${staff.name} جاهزة للواتساب 📋`, 'success');
  };

  // Helper: Preview Doctor Profile as Public Patient
  const handlePreviewDoctorPublic = (docId) => {
    localStorage.setItem('dawry_view_doctor_id', docId);
    window.location.hash = '';
    window.location.reload();
  };

  // Upload photo in Doctor Profile Edit
  const handleDoctorEditPhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast('حجم الصورة كبير، يرجى اختيار صورة أقل من 10 ميجابايت', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target.result;
      setDoctorEditForm(prev => ({ ...prev, profile_photo: base64 }));
      try {
        const res = await api.uploadImage(base64);
        if (res.success && res.url) {
          setDoctorEditForm(prev => ({ ...prev, profile_photo: res.url }));
          showToast('تم رفع صورة الطبيب بنجاح', 'success');
        }
      } catch (err) {
        showToast('تم حفظ الصورة بنجاح', 'success');
      }
    };
    reader.readAsDataURL(file);
  };

  // Profile Modal: Add Branch directly to this doctor
  const handleProfileAddBranchSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!profileModal.doctorId || !profileAddBranchForm.branch_name) {
      showToast('يرجى كتابة اسم الفرع', 'error');
      return;
    }
    setProfileAddBranchForm(prev => ({ ...prev, submitting: true }));
    const targetDoc = profileModal.data?.doctor;
    const res = await api.addAdminBranch({
      doctor_id: profileModal.doctorId,
      clinic_name: profileAddBranchForm.clinic_name || targetDoc?.clinic_name || `عيادة ${targetDoc?.full_name}`,
      branch_name: profileAddBranchForm.branch_name,
      governorate: profileAddBranchForm.governorate || 'القاهرة',
      city: profileAddBranchForm.city || 'القاهرة',
      address: profileAddBranchForm.address || 'العنوان التفصيلي',
      phone: profileAddBranchForm.phone || targetDoc?.phone || ''
    });
    setProfileAddBranchForm(prev => ({ ...prev, submitting: false }));
    if (res.success) {
      showToast('تمت إضافة الفرع بنجاح لهذا الطبيب!', 'success');
      setProfileAddBranchForm({ isOpen: false, clinic_name: '', branch_name: '', governorate: 'القاهرة', city: 'القاهرة', address: '', phone: '', submitting: false });
      handleOpenDoctorProfile(profileModal.doctorId, 'branches');
      loadAll();
    } else {
      showToast(res.message || 'فشل إضافة الفرع', 'error');
    }
  };

  // Profile Modal: Update Staff Password
  const handleUpdateStaffPassword = async (staff) => {
    const newPass = staffPasswordEdit[staff.id];
    if (!newPass) {
      showToast('يرجى إدخال كلمة المرور', 'error');
      return;
    }
    const res = await api.updateAdminStaff(staff.id, {
      password: newPass
    });
    if (res.success) {
      showToast(`تم تحديث كلمة المرور لحساب ${staff.name} بنجاح!`, 'success');
      handleOpenDoctorProfile(profileModal.doctorId, 'staff');
      loadAll();
    } else {
      showToast(res.message || 'فشل تحديث كلمة المرور', 'error');
    }
  };

  // Toggle Staff Active
  const handleToggleStaff = async (staffId) => {
    const res = await api.toggleAdminStaff(staffId);
    if (res.success) {
      showToast(res.message, 'success');
      loadAll();
    } else {
      showToast(res.message || 'فشل تعديل حالة الموظف', 'error');
    }
  };

  // Delete Staff
  const handleDeleteStaff = async (staffId) => {
    const res = await api.deleteAdminStaff(staffId);
    if (res.success) {
      showToast(res.message, 'success');
      setConfirmDeleteModal({ isOpen: false, type: 'staff', target: null });
      loadAll();
    } else {
      showToast(res.message || 'فشل حذف الموظف', 'error');
    }
  };

  // Delete Branch
  const handleDeleteBranch = async (branchId) => {
    const res = await api.deleteAdminBranch(branchId);
    if (res.success) {
      showToast(res.message, 'success');
      setConfirmDeleteModal({ isOpen: false, type: 'branch', target: null });
      loadAll();
    } else {
      showToast(res.message || 'فشل حذف الفرع', 'error');
    }
  };

  // Add Branch Submit (Branches Tab)
  const handleAddBranchSubmit = async (e) => {
    e.preventDefault();
    const docId = addBranchModal.doctorId || doctors[0]?.id;
    if (!docId || !addBranchModal.form.branch_name) {
      showToast('يرجى تحديد الطبيب واسم الفرع', 'error');
      return;
    }
    const targetDoc = doctors.find(d => String(d.id) === String(docId));
    const res = await api.addAdminBranch({
      doctor_id: Number(docId),
      clinic_name: addBranchModal.form.clinic_name || targetDoc?.clinic_name || `عيادة ${targetDoc?.full_name}`,
      branch_name: addBranchModal.form.branch_name,
      governorate: addBranchModal.form.governorate || 'القاهرة',
      city: addBranchModal.form.city || 'القاهرة',
      address: addBranchModal.form.address || 'العنوان التفصيلي',
      phone: addBranchModal.form.phone || targetDoc?.phone || ''
    });
    if (res.success) {
      showToast(res.message || 'تمت إضافة الفرع بنجاح', 'success');
      setAddBranchModal({ isOpen: false, doctorId: '', form: { clinic_name: '', branch_name: '', governorate: 'القاهرة', city: '', address: '', phone: '' } });
      loadAll();
    } else {
      showToast(res.message || 'فشل إضافة الفرع', 'error');
    }
  };

  // Add Staff Submit (Staff Tab)
  const handleAddStaffSubmit = async (e) => {
    e.preventDefault();
    const docId = addStaffModal.doctorId || doctors[0]?.id;
    const availableBranches = branches.filter(b => String(b.doctor_id) === String(docId));
    const targetBranchId = addStaffModal.branchId || availableBranches[0]?.id || branches[0]?.id;

    if (!docId || !targetBranchId || !addStaffModal.form.name || !addStaffModal.form.email) {
      showToast('يرجى كتابة اسم الموظف وبريده وتحديد الطبيب والفرع', 'error');
      return;
    }

    const res = await api.addAdminStaff({
      doctor_id: Number(docId),
      branch_id: Number(targetBranchId),
      name: addStaffModal.form.name.trim(),
      email: addStaffModal.form.email.trim(),
      phone: addStaffModal.form.phone || '',
      password: addStaffModal.form.password || '123456'
    });
    if (res.success) {
      showToast(res.message || 'تم إنشاء حساب موظف الاستقبال بنجاح', 'success');
      setAddStaffModal({ isOpen: false, doctorId: '', branchId: '', form: { name: '', email: '', phone: '', password: '' } });
      loadAll();
    } else {
      showToast(res.message || 'فشل إضافة موظف الاستقبال', 'error');
    }
  };

  // Add Specialty Submit
  const handleAddSpecialtySubmit = async (e) => {
    e.preventDefault();
    if (!specialtyModal.form.name) return;
    const res = await api.addSpecialty(specialtyModal.form);
    if (res.success) {
      showToast(res.message, 'success');
      setSpecialtyModal({ isOpen: false, form: { name: '', icon: 'spark', description: '' } });
      loadAll();
    } else {
      showToast(res.message || 'فشل إضافة التخصص', 'error');
    }
  };

  // Assign Subscription Submit
  const handleAssignSubSubmit = async (e) => {
    e.preventDefault();
    if (!subAssignModal.doctor) return;
    const res = await api.assignDoctorSubscription({
      doctor_id: subAssignModal.doctor.id,
      plan_id: subAssignModal.planId,
      extend_days: parseInt(subAssignModal.extendDays, 10)
    });
    if (res.success) {
      showToast(res.message, 'success');
      setSubAssignModal({ isOpen: false, doctor: null, planId: 1, extendDays: 30 });
      loadAll();
    } else {
      showToast(res.message || 'فشل تحديث الاشتراك', 'error');
    }
  };

  // Inline add receptionist to doctor from profile modal
  const handleProfileAddStaffSubmit = async (e) => {
    e.preventDefault();
    if (!profileModal.doctorId) return;
    if (!profileAddStaffForm.name || !profileAddStaffForm.email) {
      showToast('الاسم والبريد حقول مطلوبة', 'error');
      return;
    }
    const targetBranchId = profileAddStaffForm.branch_id || profileModal.data?.branches[0]?.id;
    if (!targetBranchId) {
      showToast('يرجى اختيار الفرع', 'error');
      return;
    }

    setProfileAddStaffForm(prev => ({ ...prev, submitting: true }));
    const res = await api.addAdminStaff({
      doctor_id: profileModal.doctorId,
      branch_id: targetBranchId,
      name: profileAddStaffForm.name,
      email: profileAddStaffForm.email,
      phone: profileAddStaffForm.phone,
      password: profileAddStaffForm.password || '123456'
    });
    setProfileAddStaffForm(prev => ({ ...prev, submitting: false }));

    if (res.success) {
      showToast(res.message, 'success');
      setProfileAddStaffForm({ isOpen: false, name: '', email: '', phone: '', password: '', branch_id: '', submitting: false });
      handleOpenDoctorProfile(profileModal.doctorId);
      loadAll();
    } else {
      showToast(res.message || 'فشل إضافة موظف الاستقبال', 'error');
    }
  };

  // Submit Multi-step Wizard
  const handleWizardSubmit = async () => {
    setWizardModal(prev => ({ ...prev, submitting: true }));
    const payload = {
      ...wizardForm,
      specialty_id: wizardForm.specialty_id || (selectedSpecialtyFilter !== 'all' ? selectedSpecialtyFilter : specialties[0]?.id) || 1,
      password: wizardForm.password || '123456',
      branches: wizardForm.branches.map(b => ({
        ...b,
        clinic_name: b.clinic_name || `عيادة ${wizardForm.full_name}`
      })),
      receptionists: wizardForm.receptionists.filter(r => r.name && r.email).map(r => ({
        name: r.name,
        email: r.email,
        phone: r.phone || wizardForm.phone,
        password: r.password || '123456',
        branch_index: r.branch_index || 0
      }))
    };

    const res = await api.addDoctorWizard(payload);
    setWizardModal(prev => ({ ...prev, submitting: false }));

    if (res.success) {
      showToast(res.message, 'success');
      setWizardModal({ isOpen: false, step: 1, submitting: false });
      setWizardForm({
        full_name: '',
        title: 'استشاري',
        specialty_id: '',
        subspecialty: '',
        email: '',
        phone: '',
        password: '',
        showPassword: false,
        bio: '',
        consultation_fee: 450,
        appointment_duration: 20,
        daily_capacity: 30,
        profile_photo: '',
        plan_id: 1,
        is_booking_enabled: true,
        branches: [{ clinic_name: '', branch_name: 'الفرع الرئيسي', governorate: 'القاهرة', city: 'مدينة نصر', address: 'شارع عباس العقاد', phone: '', is_booking_enabled: true }],
        receptionists: [{ name: '', email: '', phone: '', password: '', showPassword: false, branch_index: 0 }]
      });
      loadAll();
    } else {
      showToast(res.message || 'حدث خطأ في إنشاء الطبيب', 'error');
    }
  };

  // Navigation Items
  const navItems = [
    { id: 'overview', label: 'لوحة التحكم', icon: 'grid' },
    { id: 'doctors', label: 'إدارة الأطباء', icon: 'briefcase', badge: doctors.length || null },
    { id: 'branches', label: 'إدارة الفروع', icon: 'mapPin', badge: branches.length || null },
    { id: 'staff', label: 'فريق الاستقبال', icon: 'users', badge: staffList.length || null },
    { id: 'bookings', label: 'إتاحة الحجوزات', icon: 'calendar' },
    { id: 'subscriptions', label: 'الباقات والاشتراكات', icon: 'creditCard' },
    { id: 'platform', label: 'إدارة المنصة والتدقيق', icon: 'shield' }
  ];

  if (loading && !overview) {
    return (
      <div style={{ padding: '80px', textAlign: 'center', color: 'var(--muted)' }} className="rtl">
        جاري تحميل لوحة إدارة المنصة (Super Admin)...
      </div>
    );
  }

  const stats = overview?.stats || {};
  const globalBookingOn = stats.global_booking_enabled !== false;

  // Filtered lists
  const filteredDoctors = doctors.filter(d => {
    if (docStatusFilter === 'active' && d.status !== 'active') return false;
    if (docStatusFilter === 'suspended' && d.status !== 'suspended') return false;
    if (docStatusFilter === 'booking_on' && d.is_booking_enabled !== 1) return false;
    if (docStatusFilter === 'booking_off' && d.is_booking_enabled === 1) return false;
    if (selectedSpecialtyFilter !== 'all') {
      const matchId = String(d.specialty_id) === String(selectedSpecialtyFilter);
      const matchName = d.specialty_name === selectedSpecialtyFilter;
      if (!matchId && !matchName) return false;
    }
    if (docSearch) {
      const q = docSearch.toLowerCase();
      return (
        d.full_name?.toLowerCase().includes(q) ||
        d.email?.toLowerCase().includes(q) ||
        d.phone?.includes(q) ||
        d.clinic_name?.toLowerCase().includes(q) ||
        d.specialty_name?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredBranches = branches.filter(b => {
    if (branchSearch) {
      const q = branchSearch.toLowerCase();
      return b.branch_name?.toLowerCase().includes(q) || b.clinic_name?.toLowerCase().includes(q) || b.doctor_name?.toLowerCase().includes(q) || b.city?.toLowerCase().includes(q);
    }
    return true;
  });

  const filteredStaff = staffList.filter(s => {
    if (staffSearch) {
      const q = staffSearch.toLowerCase();
      return s.name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q) || s.doctor_name?.toLowerCase().includes(q) || s.branch_name?.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="workspace rtl">
      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="overlay"
          style={{ display: 'block' }}
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ------------------------------------------------------------- */}
      {/* SUPER ADMIN SIDEBAR NAVIGATION (FIGMA STYLE) */}
      {/* ------------------------------------------------------------- */}
      <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <Logo onClick={onHome} />
        </div>

        {/* Super Admin Identity Badge */}
        <div style={{ padding: '12px 14px 6px' }}>
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(57, 73, 171, 0.15) 0%, rgba(24, 169, 153, 0.15) 100%)',
              border: '1px solid rgba(57, 73, 171, 0.3)',
              borderRadius: '12px',
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <span
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'var(--primary)',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 900,
                fontSize: '14px'
              }}
            >
              👑
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ fontSize: '12px', display: 'block', color: 'var(--text)' }}>
                إدارة المنصة العليا
              </b>
              <small style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '10px', display: 'block' }}>
                Super Admin Platform Owner
              </small>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav
          style={{
            padding: '8px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
            flex: 1,
            overflowY: 'auto'
          }}
        >
          {navItems.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={isActive ? 'active' : ''}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                style={{
                  width: '100%',
                  minHeight: '40px',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: isActive ? 'var(--primary-soft)' : 'transparent',
                  color: isActive ? 'var(--primary)' : 'var(--muted)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  textAlign: 'right',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon name={item.icon} size={16} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge ? (
                  <span
                    style={{
                      background: 'var(--primary-soft)',
                      color: 'var(--primary)',
                      borderRadius: '12px',
                      padding: '1px 7px',
                      fontSize: '10px',
                      fontWeight: 800
                    }}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer User */}
        <div className="sidebar-user" style={{ borderTop: '1px solid var(--line)', padding: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--primary-soft)', color: 'var(--primary)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '11px' }}>
            مدير
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b style={{ fontSize: '11px', display: 'block', color: 'var(--text)' }}>مالك منصة دُوري</b>
            <small style={{ color: '#16a36a', fontSize: '9px', fontWeight: 600 }}>تحكم كامل ومطلق</small>
          </div>
          <button
            type="button"
            className="text-button"
            onClick={onHome}
            style={{ fontSize: '11px', color: 'var(--muted)', padding: '4px' }}
            title="العودة للموقع العام"
          >
            خروج
          </button>
        </div>
      </aside>

      {/* ------------------------------------------------------------- */}
      {/* WORKSPACE MAIN (TOPBAR + CONTENT) */}
      {/* ------------------------------------------------------------- */}
      <div className="workspace-main">
        {/* TOPBAR */}
        <header className="topbar">
          <div className="topbar-start" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              className="icon-button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="القائمة"
            >
              <Icon name="bars" size={18} />
            </button>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text)' }}>
                {navItems.find(i => i.id === activeTab)?.label}
              </h2>
              <small style={{ color: 'var(--muted)', fontSize: '11px' }}>
                التحكم الإداري الشامل لكافة الأطباء، الفروع، الموظفين، وحجوزات المرضى
              </small>
            </div>
          </div>

          <div className="topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Global Booking Master Toggle Button */}
            <button
              type="button"
              className={`btn small ${globalBookingOn ? 'secondary' : 'danger'}`}
              onClick={handleToggleGlobalBooking}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              title="تفعيل أو تعطيل الحجز الإلكتروني للمنصة ككل"
            >
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: globalBookingOn ? '#16a36a' : '#e05252' }} />
              <span>{globalBookingOn ? 'حجز المنصة: متاح للجميع' : 'حجز المنصة: معطل بالكامل'}</span>
            </button>

            <ThemeToggle dark={dark} setDark={setDark} />
          </div>
        </header>

        {/* DASHBOARD CONTENT BODY */}
        <main className="dashboard-content" style={{ padding: '24px' }}>
          {/* ========================================================= */}
          {/* 1. لوحة التحكم (OVERVIEW DASHBOARD) */}
          {/* ========================================================= */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              {/* Quick Platform Action Bar */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #1e2442 0%, #3949ab 100%)',
                  borderRadius: '16px',
                  padding: '22px 26px',
                  color: '#fff',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px',
                  boxShadow: '0 8px 24px rgba(57, 73, 171, 0.2)'
                }}
              >
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 4px', color: '#fff' }}>
                    منظومة إدارة وتشغيل منصة دُوري (SaaS Platform Master)
                  </h3>
                  <p style={{ margin: 0, fontSize: '12px', opacity: 0.9 }}>
                    التحكم الكامل في الأطباء، الفروع، صلاحيات الاستقبال، تسعير الباقات، ومفاتيح الحجز الذكية
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn white"
                    onClick={() => setActiveTab('doctors')}
                    style={{ fontWeight: 800, fontSize: '13px' }}
                  >
                    إدارة الأطباء والفروع ←
                  </button>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => setActiveTab('platform')}
                    style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', borderColor: 'rgba(255,255,255,0.3)', fontWeight: 700 }}
                  >
                    سجل نشاط المنصة ←
                  </button>
                </div>
              </div>

              {/* Platform Metrics (Prompt Section 1) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: '14px'
                }}
              >
                <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '14px', padding: '16px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>إجمالي الأطباء</span>
                  <b style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text)' }}>{stats.total_doctors || 0}</b>
                  <div style={{ fontSize: '11px', color: '#16a36a', marginTop: '4px' }}>
                    {stats.active_doctors || 0} نشط · {stats.suspended_doctors || 0} موقوف
                  </div>
                </div>

                <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '14px', padding: '16px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>الفروع والعيادات</span>
                  <b style={{ fontSize: '24px', fontWeight: 900, color: 'var(--primary)' }}>{stats.total_clinics || 0}</b>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>موزعة على المحافظات</div>
                </div>

                <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '14px', padding: '16px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>موظفو الاستقبال</span>
                  <b style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text)' }}>{stats.total_receptionists || 0}</b>
                  <div style={{ fontSize: '11px', color: '#16a36a', marginTop: '4px' }}>{stats.active_receptionists || 0} حساب نشط</div>
                </div>

                <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '14px', padding: '16px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>حجوزات المرضى الكلية</span>
                  <b style={{ fontSize: '24px', fontWeight: 900, color: '#16a36a' }}>{stats.total_appointments || 0}</b>
                  <div style={{ fontSize: '11px', color: 'var(--primary)', marginTop: '4px' }}>{stats.today_bookings || 0} حجز اليوم</div>
                </div>

                <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '14px', padding: '16px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>إتاحة الحجز أونلاين</span>
                  <b style={{ fontSize: '24px', fontWeight: 900, color: stats.booking_enabled_doctors > 0 ? '#16a36a' : '#e05252' }}>
                    {stats.booking_enabled_doctors || 0} طبيب
                  </b>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>متاح للحجز المباشر</div>
                </div>

                <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '14px', padding: '16px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>إجمالي الاشتراكات</span>
                  <b style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text)' }}>{stats.total_revenue || 0} ج.م</b>
                  <div style={{ fontSize: '11px', color: '#16a36a', marginTop: '4px' }}>سداد منتظم</div>
                </div>
              </div>

              {/* Subscriptions Expiring Soon & Recent Audit Logs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
                {/* Expiring Subscriptions */}
                <div
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: '16px',
                    padding: '20px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <b style={{ fontSize: '14px' }}>اشتراكات تقترب من الانتهاء (خلال ١٤ يوماً)</b>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setActiveTab('subscriptions')}
                      style={{ fontSize: '11px', color: 'var(--primary)' }}
                    >
                      عرض الكل ←
                    </button>
                  </div>

                  {overview?.upcomingExpirations?.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>
                      جميع اشتراكات الأطباء سارية ومحدثة
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {overview?.upcomingExpirations?.map(sub => (
                        <div
                          key={sub.id}
                          style={{
                            background: 'var(--bg)',
                            border: '1px solid var(--line)',
                            borderRadius: '10px',
                            padding: '10px 14px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div>
                            <b style={{ fontSize: '12px', display: 'block' }}>{sub.doctor_name}</b>
                            <small style={{ color: 'var(--muted)', fontSize: '10px' }}>باقة {sub.plan_name} · ينتهي في {sub.end_date}</small>
                          </div>
                          <button
                            type="button"
                            className="btn primary small"
                            onClick={() => setSubAssignModal({ isOpen: true, doctor: { id: sub.doctor_id, full_name: sub.doctor_name }, planId: sub.plan_id, extendDays: 30 })}
                            style={{ fontSize: '11px', padding: '4px 8px' }}
                          >
                            تمديد ٣٠ يوماً
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Activities Audit */}
                <div
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: '16px',
                    padding: '20px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <b style={{ fontSize: '14px' }}>سجل نشاط المنصة الأخير (Audit Trail)</b>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setActiveTab('platform')}
                      style={{ fontSize: '11px', color: 'var(--primary)' }}
                    >
                      عرض السجل الكامل ←
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {overview?.recentActivities?.slice(0, 5).map(act => (
                      <div
                        key={act.id}
                        style={{
                          fontSize: '12px',
                          borderBottom: '1px solid var(--line)',
                          paddingBottom: '8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <b style={{ color: 'var(--text)' }}>{act.action}</b>
                          <small style={{ color: 'var(--muted)', display: 'block', fontSize: '10px' }}>{act.details}</small>
                        </div>
                        <small style={{ color: 'var(--muted)', fontSize: '10px' }}>
                          {new Date(act.created_at).toLocaleTimeString('ar-EG')}
                        </small>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 2. إدارة الأطباء والتخصصات (DOCTOR & SPECIALTY MANAGEMENT) */}
          {/* ========================================================= */}
          {activeTab === 'doctors' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Header Toolbar */}
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 2px' }}>
                    إدارة حسابات الأطباء والعيادات ({doctors.length})
                  </h3>
                  <small style={{ color: 'var(--muted)' }}>
                    إضافة وتعديل الأطباء، تعيين بيانات الدخول، الفروع، وطاقم الاستقبال مع التحكم بإتاحة الحجز
                  </small>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    value={docSearch}
                    onChange={(e) => setDocSearch(e.target.value)}
                    placeholder="بحث بالاسم أو البريد أو العيادة..."
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--line)',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      fontSize: '12px',
                      minWidth: '220px'
                    }}
                  />

                  <select
                    value={docStatusFilter}
                    onChange={(e) => setDocStatusFilter(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--line)',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      fontSize: '12px'
                    }}
                  >
                    <option value="">جميع الحالات</option>
                    <option value="active">نشط</option>
                    <option value="suspended">موقوف</option>
                  </select>

                  <button
                    type="button"
                    className="btn primary small"
                    onClick={() => {
                      const initialSpec = (selectedSpecialtyFilter !== 'all' ? selectedSpecialtyFilter : specialties[0]?.id) || 1;
                      setWizardForm({
                        full_name: '',
                        title: 'استشاري',
                        specialty_id: initialSpec,
                        subspecialty: '',
                        email: '',
                        phone: '',
                        password: '',
                        showPassword: false,
                        bio: '',
                        consultation_fee: 450,
                        appointment_duration: 20,
                        daily_capacity: 30,
                        profile_photo: '',
                        plan_id: 1,
                        is_booking_enabled: true,
                        branches: [{ clinic_name: '', branch_name: 'الفرع الرئيسي', governorate: 'القاهرة', city: 'مدينة نصر', address: 'شارع عباس العقاد', phone: '', is_booking_enabled: true }],
                        receptionists: [{ name: '', email: '', phone: '', password: '', showPassword: false, branch_index: 0 }]
                      });
                      setWizardModal({ isOpen: true, step: 1, submitting: false });
                    }}
                    style={{ fontWeight: 700 }}
                  >
                    + إضافة طبيب جديد
                  </button>
                </div>
              </div>

              {/* Specialty Category Filter Bar (تصفح الأطباء حسب التخصص) */}
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: '14px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  overflowX: 'auto',
                  whiteSpace: 'nowrap'
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>التخصصات:</span>
                </span>

                <button
                  type="button"
                  onClick={() => setSelectedSpecialtyFilter('all')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: '1px solid',
                    borderColor: selectedSpecialtyFilter === 'all' ? 'var(--primary)' : 'var(--line)',
                    background: selectedSpecialtyFilter === 'all' ? 'var(--primary)' : 'var(--surface-2)',
                    color: selectedSpecialtyFilter === 'all' ? '#fff' : 'var(--text)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  جميع التخصصات ({doctors.length})
                </button>

                {specialties.map(spec => {
                  const docCount = doctors.filter(d => String(d.specialty_id) === String(spec.id) || d.specialty_name === spec.name).length;
                  const isSelected = String(selectedSpecialtyFilter) === String(spec.id);
                  return (
                    <button
                      key={spec.id}
                      type="button"
                      onClick={() => setSelectedSpecialtyFilter(spec.id)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '20px',
                        border: '1px solid',
                        borderColor: isSelected ? 'var(--primary)' : 'var(--line)',
                        background: isSelected ? 'var(--primary)' : 'var(--surface-2)',
                        color: isSelected ? '#fff' : 'var(--text)',
                        fontSize: '12px',
                        fontWeight: isSelected ? 800 : 500,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span>{spec.name}</span>
                      <span
                        style={{
                          background: isSelected ? 'rgba(255,255,255,0.25)' : 'var(--primary-soft)',
                          color: isSelected ? '#fff' : 'var(--primary)',
                          borderRadius: '10px',
                          padding: '1px 6px',
                          fontSize: '10px',
                          fontWeight: 800
                        }}
                      >
                        {docCount}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Doctors Table */}
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: '16px',
                  overflow: 'hidden'
                }}
              >
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--line)', color: 'var(--muted)', fontSize: '12px' }}>
                        <th style={{ padding: '12px 14px' }}>الطبيب والعيادة</th>
                        <th style={{ padding: '12px 14px' }}>التخصص</th>
                        <th style={{ padding: '12px 14px' }}>الفروع</th>
                        <th style={{ padding: '12px 14px' }}>الاستقبال</th>
                        <th style={{ padding: '12px 14px' }}>حالة الحساب</th>
                        <th style={{ padding: '12px 14px' }}>الحجز أونلاين</th>
                        <th style={{ padding: '12px 14px' }}>الباقة</th>
                        <th style={{ padding: '12px 14px', textAlign: 'left' }}>إجراءات الإدارة الكاملة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDoctors.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                            لا توجد حسابات أطباء مطابقة
                          </td>
                        </tr>
                      ) : (
                        filteredDoctors.map(doc => {
                          const isSuspended = doc.status === 'suspended';
                          const isBookingOn = doc.is_booking_enabled === 1 && !isSuspended;

                          return (
                            <tr key={doc.id} style={{ borderBottom: '1px solid var(--line)' }}>
                              <td style={{ padding: '12px 14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <img
                                    src={doc.profile_photo || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=80'}
                                    alt={doc.full_name}
                                    style={{ width: '38px', height: '38px', borderRadius: '10px', objectFit: 'cover' }}
                                  />
                                  <div>
                                    <b style={{ display: 'block', color: 'var(--text)' }}>{doc.full_name}</b>
                                    <small style={{ color: 'var(--muted)', fontSize: '11px' }}>{doc.clinic_name || 'عيادة دوري'}</small>
                                  </div>
                                </div>
                              </td>

                              <td style={{ padding: '12px 14px', color: 'var(--primary)', fontWeight: 600 }}>
                                {doc.specialty_name}
                              </td>

                              <td style={{ padding: '12px 14px' }}>
                                <span className="badge badge-primary">{doc.branches_count || 1} فرع</span>
                              </td>

                              <td style={{ padding: '12px 14px' }}>
                                <span className="badge badge-warning">{doc.receptionists_count || 1} موظف</span>
                              </td>

                              <td style={{ padding: '12px 14px' }}>
                                <span className={`badge ${isSuspended ? 'badge-danger' : 'badge-success'}`}>
                                  {isSuspended ? 'موقوف' : 'نشط'}
                                </span>
                              </td>

                              <td style={{ padding: '12px 14px' }}>
                                <button
                                  type="button"
                                  onClick={() => handleToggleDoctorBooking(doc.id)}
                                  disabled={isSuspended}
                                  className={`btn small ${isBookingOn ? 'secondary' : 'danger'}`}
                                  style={{ fontSize: '10px', padding: '3px 8px' }}
                                  title="تبديل إتاحة حجز المرضى لهذا الطبيب"
                                >
                                  {isSuspended ? 'معطل (موقوف)' : isBookingOn ? '🟢 الحجز متاح' : '🔴 الحجز معطل'}
                                </button>
                              </td>

                              <td style={{ padding: '12px 14px', fontSize: '12px' }}>
                                <b>{doc.plan_name || 'برو'}</b>
                              </td>

                              <td style={{ padding: '12px 14px', textAlign: 'left' }}>
                                <div style={{ display: 'inline-flex', gap: '5px', flexWrap: 'wrap' }}>
                                  {/* Connected Profile Modal Button (Section 8) */}
                                  <button
                                    type="button"
                                    className="btn primary small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenDoctorProfile(doc.id);
                                    }}
                                    style={{ fontSize: '11px', padding: '5px 10px', fontWeight: 800, background: 'var(--primary)', color: '#fff' }}
                                    title="فتح الملف الشامل للطبيب مع الحسابات والباسوردات والفروع"
                                  >
                                    الملف الشامل
                                  </button>

                                  {/* Preview Public Page */}
                                  <button
                                    type="button"
                                    className="btn secondary small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePreviewDoctorPublic(doc.id);
                                    }}
                                    style={{ fontSize: '11px', padding: '4px 8px' }}
                                    title="معاينة صفحة الطبيب بالموقع العام كما يراها المريض"
                                  >
                                    👁️ معاينة
                                  </button>

                                  {/* Quick WhatsApp Credentials Copy */}
                                  <button
                                    type="button"
                                    className="btn secondary small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyDoctorCredentials(doc);
                                    }}
                                    style={{ fontSize: '11px', padding: '4px 8px' }}
                                    title="نسخ بيانات الدخول للطبيب جاهزة لإرسالها على واتساب"
                                  >
                                    📋 نسخ
                                  </button>

                                  {/* Suspend or Reactivate */}
                                  {isSuspended ? (
                                    <button
                                      type="button"
                                      className="btn secondary small"
                                      onClick={() => handleReactivateDoctor(doc)}
                                      style={{ fontSize: '11px', padding: '4px 8px', color: '#16a36a' }}
                                      title="إعادة تفعيل حساب الطبيب واستعادة الخدمات"
                                    >
                                      تفعيل
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="btn secondary small"
                                      onClick={() => setSuspendModal({ isOpen: true, doctor: doc, reason: 'انتهاء الاشتراك أو مراجعة إدارية' })}
                                      style={{ fontSize: '11px', padding: '4px 8px', color: 'var(--danger)' }}
                                      title="تعليق حساب الطبيب"
                                    >
                                      إيقاف
                                    </button>
                                  )}

                                  {/* Reset Password */}
                                  <button
                                    type="button"
                                    className="btn secondary small"
                                    onClick={() => handleResetPassword(doc)}
                                    style={{ fontSize: '11px', padding: '4px 8px' }}
                                    title="إرسال رابط تعيين كلمة المرور"
                                  >
                                    دعوة
                                  </button>

                                  {/* Delete Doctor */}
                                  <button
                                    type="button"
                                    className="btn secondary small"
                                    onClick={() => setConfirmDeleteModal({
                                      isOpen: true,
                                      type: 'doctor',
                                      target: doc,
                                      onConfirm: () => handleDeleteDoctor(doc)
                                    })}
                                    style={{ fontSize: '11px', padding: '4px 8px', color: 'var(--danger)' }}
                                    title="حذف الطبيب نهائياً مع كافة ملحقاته"
                                  >
                                    حذف
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 3. إدارة الفروع (BRANCH MANAGEMENT - SECTION 3) */}
          {/* ========================================================= */}
          {activeTab === 'branches' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 2px' }}>
                    إدارة عيادات وفروع الأطباء ({branches.length})
                  </h3>
                  <small style={{ color: 'var(--muted)' }}>
                    إضافة فروع جديدة، تعيين موظفي الاستقبال، والتحكم المنفصل في إتاحة الحجز لكل فرع دون التأثير على الفروع الأخرى
                  </small>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={branchSearch}
                    onChange={(e) => setBranchSearch(e.target.value)}
                    placeholder="بحث باسم الفرع أو العيادة أو المدينة..."
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--line)',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      fontSize: '12px',
                      minWidth: '220px'
                    }}
                  />

                  <button
                    type="button"
                    className="btn primary small"
                    onClick={() => setAddBranchModal({ isOpen: true, doctorId: doctors[0]?.id || '', form: { clinic_name: '', branch_name: '', governorate: 'القاهرة', city: '', address: '', phone: '' } })}
                    style={{ fontWeight: 700 }}
                  >
                    + إضافة فرع جديد
                  </button>
                </div>
              </div>

              {/* Branches Table */}
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: '16px',
                  overflow: 'hidden'
                }}
              >
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--line)', color: 'var(--muted)', fontSize: '12px' }}>
                        <th style={{ padding: '12px 14px' }}>اسم الفرع والعيادة</th>
                        <th style={{ padding: '12px 14px' }}>الطبيب المالك</th>
                        <th style={{ padding: '12px 14px' }}>المحافظة / المدينة</th>
                        <th style={{ padding: '12px 14px' }}>العنوان والهاتف</th>
                        <th style={{ padding: '12px 14px' }}>طاقم الاستقبال</th>
                        <th style={{ padding: '12px 14px' }}>إتاحة الحجز بالفرع</th>
                        <th style={{ padding: '12px 14px', textAlign: 'left' }}>الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBranches.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                            لا توجد فروع مطابقة
                          </td>
                        </tr>
                      ) : (
                        filteredBranches.map(b => {
                          const isBranchBooking = b.is_booking_enabled === 1;
                          return (
                            <tr key={b.id} style={{ borderBottom: '1px solid var(--line)' }}>
                              <td style={{ padding: '12px 14px' }}>
                                <b style={{ display: 'block', color: 'var(--text)' }}>{b.branch_name}</b>
                                <small style={{ color: 'var(--muted)', fontSize: '11px' }}>{b.clinic_name} {b.is_main === 1 && '(رئيسي)'}</small>
                              </td>

                              <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--primary)' }}>
                                {b.doctor_name}
                              </td>

                              <td style={{ padding: '12px 14px' }}>
                                {b.governorate} · {b.city}
                              </td>

                              <td style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: '12px' }}>
                                <div>{b.address || 'العنوان غير محدد'}</div>
                                <small>{b.phone}</small>
                              </td>

                              <td style={{ padding: '12px 14px' }}>
                                <span className="badge badge-warning">{b.staff_count || 0} موظفين</span>
                              </td>

                              <td style={{ padding: '12px 14px' }}>
                                {/* Isolated Branch Toggle without affecting other branches! */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleBranchBooking(b.id)}
                                  className={`btn small ${isBranchBooking ? 'secondary' : 'danger'}`}
                                  style={{ fontSize: '10px', padding: '3px 8px' }}
                                  title="تبديل إتاحة الحجز لهذا الفرع وحده"
                                >
                                  {isBranchBooking ? '🟢 متاح للحجز' : '🔴 معطل للحجز'}
                                </button>
                              </td>

                              <td style={{ padding: '12px 14px', textAlign: 'left' }}>
                                <button
                                  type="button"
                                  className="btn secondary small"
                                  onClick={() => setConfirmDeleteModal({
                                    isOpen: true,
                                    type: 'branch',
                                    target: b,
                                    onConfirm: () => handleDeleteBranch(b.id)
                                  })}
                                  style={{ fontSize: '11px', color: 'var(--danger)' }}
                                >
                                  حذف
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 4. فريق الاستقبال (RECEPTION & STAFF MANAGEMENT - SECTION 4) */}
          {/* ========================================================= */}
          {activeTab === 'staff' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 2px' }}>
                    إدارة حسابات موظفي الاستقبال ({staffList.length})
                  </h3>
                  <small style={{ color: 'var(--muted)' }}>
                    إنشاء حسابات الاستقبال، التحقق من حدود الباقة لكل طبيب، وتعيين الموظفين للفروع المصرح بها
                  </small>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={staffSearch}
                    onChange={(e) => setStaffSearch(e.target.value)}
                    placeholder="بحث باسم الموظف أو البريد أو العيادة..."
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--line)',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      fontSize: '12px',
                      minWidth: '220px'
                    }}
                  />

                  <button
                    type="button"
                    className="btn primary small"
                    onClick={() => setAddStaffModal({ isOpen: true, doctorId: doctors[0]?.id || '', branchId: branches[0]?.id || '', form: { name: '', email: '', phone: '' } })}
                    style={{ fontWeight: 700 }}
                  >
                    + موظف استقبال جديد
                  </button>
                </div>
              </div>

              {/* Staff Table */}
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: '16px',
                  overflow: 'hidden'
                }}
              >
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--line)', color: 'var(--muted)', fontSize: '12px' }}>
                        <th style={{ padding: '12px 14px' }}>اسم الموظف</th>
                        <th style={{ padding: '12px 14px' }}>البريد الإلكتروني</th>
                        <th style={{ padding: '12px 14px' }}>الهاتف</th>
                        <th style={{ padding: '12px 14px' }}>الطبيب المسؤول</th>
                        <th style={{ padding: '12px 14px' }}>الفرع المسند</th>
                        <th style={{ padding: '12px 14px' }}>حالة الحساب</th>
                        <th style={{ padding: '12px 14px', textAlign: 'left' }}>الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStaff.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                            لا يوجد موظفو استقبال مطابقون
                          </td>
                        </tr>
                      ) : (
                        filteredStaff.map(st => {
                          const isActive = st.status === 'active';
                          return (
                            <tr key={st.id} style={{ borderBottom: '1px solid var(--line)' }}>
                              <td style={{ padding: '12px 14px' }}>
                                <b style={{ display: 'block', color: 'var(--text)' }}>{st.name}</b>
                              </td>

                              <td style={{ padding: '12px 14px', fontFamily: 'monospace' }}>
                                {st.email}
                              </td>

                              <td style={{ padding: '12px 14px', color: 'var(--muted)' }}>
                                {st.phone}
                              </td>

                              <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--primary)' }}>
                                {st.doctor_name}
                              </td>

                              <td style={{ padding: '12px 14px' }}>
                                <span className="badge badge-primary">{st.branch_name}</span>
                              </td>

                              <td style={{ padding: '12px 14px' }}>
                                <span className={`badge ${isActive ? 'badge-success' : 'badge-danger'}`}>
                                  {isActive ? 'نشط' : 'معطل'}
                                </span>
                              </td>

                              <td style={{ padding: '12px 14px', textAlign: 'left' }}>
                                <div style={{ display: 'inline-flex', gap: '6px' }}>
                                  <button
                                    type="button"
                                    className="btn secondary small"
                                    onClick={() => handleToggleStaff(st.id)}
                                    style={{ fontSize: '11px', color: isActive ? 'var(--danger)' : '#16a36a' }}
                                  >
                                    {isActive ? 'تعطيل' : 'تفعيل'}
                                  </button>

                                  <button
                                    type="button"
                                    className="btn secondary small"
                                    onClick={() => setConfirmDeleteModal({
                                      isOpen: true,
                                      type: 'staff',
                                      target: st,
                                      onConfirm: () => handleDeleteStaff(st.id)
                                    })}
                                    style={{ fontSize: '11px', color: 'var(--danger)' }}
                                  >
                                    حذف
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 5. التحكم في إتاحة الحجوزات (PATIENT BOOKING CONTROL - SECTION 5) */}
          {/* ========================================================= */}
          {activeTab === 'bookings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Global Platform Booking Switch Card */}
              <div
                style={{
                  background: 'var(--surface)',
                  border: '2px solid var(--primary)',
                  borderRadius: '16px',
                  padding: '24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>
                      مفتاح الحجز الإلكتروني الشامل للمنصة (Master Booking Switch)
                    </h3>
                    <span className={`badge ${globalBookingOn ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '12px' }}>
                      {globalBookingOn ? '🟢 الحجز متاح للمنصة كاملة' : '🔴 الحجز معطل بالكامل'}
                    </span>
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--muted)' }}>
                    تعطيل الحجز الشامل يوقف إمكانية حجز مواعيد جديدة فوراً للمرضى، مع الحفاظ الكامل على الحجوزات القائمة وسجلات الطابور دون حذف
                  </p>
                </div>

                <button
                  type="button"
                  className={`btn ${globalBookingOn ? 'danger' : 'primary'}`}
                  onClick={handleToggleGlobalBooking}
                  style={{ fontWeight: 800, padding: '12px 20px', fontSize: '14px' }}
                >
                  {globalBookingOn ? 'إيقاف الحجز الشامل للمنصة' : 'تفعيل الحجز الشامل للمنصة'}
                </button>
              </div>

              {/* Doctor Booking Breakdown */}
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: '16px',
                  padding: '20px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div>
                    <b style={{ fontSize: '15px' }}>إتاحة الحجز الإلكتروني لكل طبيب</b>
                    <small style={{ color: 'var(--muted)', display: 'block' }}>
                      يمكنك إيقاف أو تفعيل حجز طبيب محدد دون التأثير على بقية الأطباء
                    </small>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--line)', color: 'var(--muted)', fontSize: '12px' }}>
                        <th style={{ padding: '10px 14px' }}>اسم الطبيب</th>
                        <th style={{ padding: '10px 14px' }}>العيادة</th>
                        <th style={{ padding: '10px 14px' }}>حالة الحساب</th>
                        <th style={{ padding: '10px 14px' }}>حالة الحجز الحالية</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left' }}>التحكم الفوري</th>
                      </tr>
                    </thead>
                    <tbody>
                      {doctors.map(d => {
                        const isSusp = d.status === 'suspended';
                        const isBook = d.is_booking_enabled === 1 && !isSusp;
                        return (
                          <tr key={d.id} style={{ borderBottom: '1px solid var(--line)' }}>
                            <td style={{ padding: '10px 14px', fontWeight: 700 }}>{d.full_name}</td>
                            <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{d.clinic_name}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <span className={`badge ${isSusp ? 'badge-danger' : 'badge-success'}`}>
                                {isSusp ? 'موقوف' : 'نشط'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <span
                                className={`badge ${isSusp
                                    ? 'badge-danger'
                                    : isBook
                                      ? 'badge-success'
                                      : 'badge-warning'
                                  }`}
                              >
                                {isSusp ? 'غير متاح للحجز' : isBook ? 'الحجز متاح' : 'الحجز معطل مؤقتاً'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'left' }}>
                              <button
                                type="button"
                                disabled={isSusp}
                                onClick={() => handleToggleDoctorBooking(d.id)}
                                className={`btn small ${isBook ? 'danger' : 'primary'}`}
                                style={{ fontSize: '11px', padding: '4px 10px', fontWeight: 700 }}
                              >
                                {isBook ? 'تعطيل الحجز للطبيب' : 'تفعيل الحجز للطبيب'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 6. الباقات والاشتراكات (SUBSCRIPTIONS & PLANS - SECTION 6) */}
          {/* ========================================================= */}
          {activeTab === 'subscriptions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              {/* Plans Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                {subscriptionsData?.plans?.map(p => (
                  <div
                    key={p.id}
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--line)',
                      borderRadius: '16px',
                      padding: '20px',
                      boxShadow: 'var(--shadow)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <b style={{ fontSize: '16px', color: 'var(--text)' }}>باقة {p.name}</b>
                      <span className="badge badge-primary">{p.price} ج.م / شهر</span>
                    </div>
                    <ul style={{ paddingRight: '18px', fontSize: '12px', color: 'var(--muted)', margin: '14px 0', lineHeight: 1.8 }}>
                      <li>الحد الأقصى للفروع: <b>{p.max_branches} فروع</b></li>
                      <li>الحد الأقصى لموظفي الاستقبال: <b>{p.max_receptionists} موظفين</b></li>
                      <li>طابور حي ومزامنة فورية كاملة</li>
                    </ul>
                  </div>
                ))}
              </div>

              {/* Doctor Subscriptions Table */}
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: '16px',
                  overflow: 'hidden'
                }}
              >
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
                  <b style={{ fontSize: '15px' }}>سجل اشتراكات الأطباء ومتابعة الحدود</b>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--line)', color: 'var(--muted)', fontSize: '12px' }}>
                        <th style={{ padding: '12px 14px' }}>اسم الطبيب</th>
                        <th style={{ padding: '12px 14px' }}>الباقة الحالية</th>
                        <th style={{ padding: '12px 14px' }}>تاريخ الانتهاء</th>
                        <th style={{ padding: '12px 14px' }}>حدود الفروع</th>
                        <th style={{ padding: '12px 14px' }}>حدود الاستقبال</th>
                        <th style={{ padding: '12px 14px' }}>حالة الاشتراك</th>
                        <th style={{ padding: '12px 14px', textAlign: 'left' }}>الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subscriptionsData?.doctorSubscriptions?.map(ds => {
                        const isExpired = new Date(ds.end_date) < new Date();
                        return (
                          <tr key={ds.id} style={{ borderBottom: '1px solid var(--line)' }}>
                            <td style={{ padding: '12px 14px', fontWeight: 700 }}>{ds.doctor_name}</td>
                            <td style={{ padding: '12px 14px', color: 'var(--primary)', fontWeight: 600 }}>{ds.plan_name}</td>
                            <td style={{ padding: '12px 14px' }}>{ds.end_date}</td>
                            <td style={{ padding: '12px 14px', fontSize: '12px' }}>
                              {ds.current_branches} من {ds.max_branches}
                            </td>
                            <td style={{ padding: '12px 14px', fontSize: '12px' }}>
                              {ds.current_receptionists} من {ds.max_receptionists}
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <span className={`badge ${isExpired ? 'badge-danger' : 'badge-success'}`}>
                                {isExpired ? 'منتهي' : 'ساري'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'left' }}>
                              <button
                                type="button"
                                className="btn primary small"
                                onClick={() => setSubAssignModal({ isOpen: true, doctor: { id: ds.doctor_id, full_name: ds.doctor_name }, planId: ds.plan_id, extendDays: 30 })}
                                style={{ fontSize: '11px', padding: '4px 8px' }}
                              >
                                ترقية / تمديد
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 7. إدارة المنصة والتدقيق (PLATFORM SETTINGS & AUDIT LOGS) */}
          {/* ========================================================= */}
          {activeTab === 'platform' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              {/* Specialties Management */}
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: '16px',
                  padding: '20px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div>
                    <b style={{ fontSize: '15px' }}>التخصصات الطبية بالمنصة ({specialties.length})</b>
                    <small style={{ color: 'var(--muted)', display: 'block' }}>إضافة وتعديل التخصصات الطبية المعروضة للمرضى</small>
                  </div>
                  <button
                    type="button"
                    className="btn primary small"
                    onClick={() => setSpecialtyModal({ isOpen: true, form: { name: '', icon: 'spark', description: '' } })}
                  >
                    + إضافة تخصص جديد
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {specialties.map(spec => (
                    <span
                      key={spec.id}
                      style={{
                        background: 'var(--surface-2)',
                        border: '1px solid var(--line)',
                        borderRadius: '20px',
                        padding: '5px 12px 5px 10px',
                        fontSize: '12px',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '7px'
                      }}
                    >
                      <SpecialtyIcon specialty={spec} size={14} tile={24} radius={8} />
                      <span>{spec.name}</span>
                      <small style={{ color: 'var(--primary)', fontWeight: 700 }}>({spec.doctors_count || 0})</small>
                    </span>
                  ))}
                </div>
              </div>

              {/* Complete Audit Logs */}
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: '16px',
                  overflow: 'hidden'
                }}
              >
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
                  <b style={{ fontSize: '15px' }}>سجل تدقيق الإجراءات الكامل للمنصة (Full Platform Audit Trail)</b>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--line)', color: 'var(--muted)', fontSize: '12px' }}>
                        <th style={{ padding: '10px 14px' }}>الوقت والتاريخ</th>
                        <th style={{ padding: '10px 14px' }}>المستخدم</th>
                        <th style={{ padding: '10px 14px' }}>الدور</th>
                        <th style={{ padding: '10px 14px' }}>الإجراء المنفذ</th>
                        <th style={{ padding: '10px 14px' }}>التفاصيل الإدارية</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map(log => (
                        <tr key={log.id} style={{ borderBottom: '1px solid var(--line)' }}>
                          <td style={{ padding: '10px 14px', color: 'var(--muted)', fontSize: '11px', whiteSpace: 'nowrap' }}>
                            {new Date(log.created_at).toLocaleString('ar-EG')}
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: 600 }}>{log.user_name}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span className="badge badge-primary">{log.user_role}</span>
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text)' }}>{log.action}</td>
                          <td style={{ padding: '10px 14px', color: 'var(--muted)', fontSize: '12px' }}>{log.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ============================================================= */}
      {/* SECTION 8: CONNECTED DOCTOR PROFILE MODAL (7 TABS) */}
      {/* ============================================================= */}
      {profileModal.isOpen && (
        <Modal
          isOpen={true}
          maxWidth="900px"
          title={`الملف الشامل: ${profileModal.data?.doctor?.full_name || 'جاري التحميل...'}`}
          onClose={() => setProfileModal({ isOpen: false, doctorId: null, activeSubTab: 'overview', loading: false, data: null })}
        >
          {profileModal.loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
              جاري تحميل الملف الشامل للطبيب والفروع والموظفين...
            </div>
          ) : profileModal.data ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Doctor Quick Bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', paddingBottom: '14px', borderBottom: '1px solid var(--line)' }}>
                <img
                  src={profileModal.data.doctor.profile_photo || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=100'}
                  alt="doc"
                  style={{ width: '52px', height: '52px', borderRadius: '12px', objectFit: 'cover' }}
                />
                <div style={{ flex: 1 }}>
                  <b style={{ fontSize: '16px', display: 'block' }}>{profileModal.data.doctor.full_name}</b>
                  <span style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '12px' }}>
                    {profileModal.data.doctor.title} · {profileModal.data.doctor.specialty_name}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn secondary small"
                    onClick={() => handlePreviewDoctorPublic(profileModal.doctorId)}
                    style={{ fontSize: '11px', padding: '5px 10px', fontWeight: 700 }}
                    title="معاينة صفحة الطبيب كما يراها المريض بالموقع العام"
                  >
                    👁️ صفحة المريض
                  </button>
                  <button
                    type="button"
                    className="btn secondary small"
                    onClick={() => copyDoctorCredentials(doctorEditForm, profileModal.data?.doctor)}
                    style={{ fontSize: '11px', padding: '5px 10px', fontWeight: 700 }}
                    title="نسخ بيانات الدخول للطبيب للإرسال على واتساب"
                  >
                    📋 نسخ الدخول
                  </button>
                  <span className={`badge ${profileModal.data.doctor.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                    {profileModal.data.doctor.status === 'active' ? 'حساب نشط' : 'حساب موقوف'}
                  </span>
                </div>
              </div>

              {/* Sub-tabs header */}
              <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--line)', paddingBottom: '8px', overflowX: 'auto' }}>
                {[
                  { id: 'info', label: 'البيانات وحساب الدخول' },
                  { id: 'branches', label: `الفروع (${profileModal.data.branches?.length || 0})` },
                  { id: 'staff', label: `الاستقبال وكلمات السر (${profileModal.data.receptionists?.length || 0})` },
                  { id: 'overview', label: 'نظرة عامة' },
                  { id: 'bookings', label: `الحجوزات (${profileModal.data.appointments?.length || 0})` },
                  { id: 'subscription', label: 'الاشتراك والفواتير' },
                  { id: 'audit', label: 'سجل النشاط' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    className={profileModal.activeSubTab === tab.id ? 'btn primary small' : 'btn secondary small'}
                    onClick={() => setProfileModal(prev => ({ ...prev, activeSubTab: tab.id }))}
                    style={{ fontSize: '11px', fontWeight: 700 }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Sub-tab 1: INFO & COMPLETE CREDENTIALS EDITING */}
              {profileModal.activeSubTab === 'info' && (
                <form onSubmit={handleSaveDoctorEdit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                  <div style={{ background: 'var(--surface-2)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <b style={{ color: 'var(--text)', display: 'block' }}>تعديل بيانات وحساب دخول الطبيب</b>
                      <small style={{ color: 'var(--muted)' }}>تعديل كافة بيانات الطبيب وكلمة المرور وحفظها فوراً في النظام</small>
                    </div>
                    <button
                      type="submit"
                      className="btn primary small"
                      disabled={doctorEditForm.submitting}
                      style={{ fontWeight: 800, padding: '6px 20px' }}
                    >
                      {doctorEditForm.submitting ? 'جاري الحفظ...' : '💾 حفظ التعديلات'}
                    </button>
                  </div>

                  {/* Account Credentials */}
                  <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: '12px', padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                      <b style={{ fontSize: '13px', color: 'var(--primary)' }}>
                        🔑 بيانات تسجيل الدخول لمساحة عمل الطبيب (#doctor)
                      </b>
                      <button
                        type="button"
                        className="btn secondary small"
                        onClick={() => copyDoctorCredentials(doctorEditForm, profileModal.data?.doctor)}
                        style={{ fontSize: '11px', padding: '4px 10px', fontWeight: 700 }}
                        title="نسخ رسالة جاهزة للواتساب تحتوي رابط الدخول، البريد، وكلمة المرور"
                      >
                        📋 نسخ بيانات الدخول (واتساب)
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, marginBottom: '4px' }}>البريد الإلكتروني / اسم الدخول *</label>
                        <input
                          type="email"
                          className="form-input"
                          required
                          value={doctorEditForm.email}
                          onChange={(e) => setDoctorEditForm({ ...doctorEditForm, email: e.target.value })}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, marginBottom: '4px' }}>رقم هاتف الدخول والتواصل *</label>
                        <input
                          type="tel"
                          className="form-input"
                          required
                          value={doctorEditForm.phone}
                          onChange={(e) => setDoctorEditForm({ ...doctorEditForm, phone: e.target.value })}
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 700 }}>كلمة المرور الخاصة بالطبيب (Doctor Password)</label>
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => setDoctorEditForm({ ...doctorEditForm, password: generateRandomPassword() })}
                          style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 700 }}
                        >
                          ⚡ توليد كلمة سر عشوائية
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type={doctorEditForm.showPassword ? 'text' : 'password'}
                          className="form-input"
                          value={doctorEditForm.password}
                          onChange={(e) => setDoctorEditForm({ ...doctorEditForm, password: e.target.value })}
                          style={{ width: '100%', letterSpacing: doctorEditForm.showPassword ? 'normal' : '2px' }}
                          placeholder="كلمة مرور دخول الطبيب"
                        />
                        <button
                          type="button"
                          className="btn secondary small"
                          onClick={() => setDoctorEditForm({ ...doctorEditForm, showPassword: !doctorEditForm.showPassword })}
                          style={{ whiteSpace: 'nowrap', fontSize: '11px' }}
                        >
                          {doctorEditForm.showPassword ? 'إخفاء' : 'إظهار'}
                        </button>
                      </div>
                      <small style={{ color: 'var(--muted)', fontSize: '10px', display: 'block', marginTop: '3px' }}>
                        تعديل كلمة المرور هنا ينعكس فوراً على دخول الطبيب إلى مساحة عمله الخاصة
                      </small>
                    </div>
                  </div>

                  {/* Medical Details */}
                  <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: '12px', padding: '14px' }}>
                    <b style={{ fontSize: '13px', color: 'var(--text)', display: 'block', marginBottom: '10px' }}>
                      🩺 البيانات الطبية والعيادة
                    </b>

                    {/* Photo Uploader */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '12px 14px',
                      background: 'var(--surface-2)',
                      borderRadius: '12px',
                      border: '1px dashed var(--line)',
                      marginBottom: '14px'
                    }}>
                      <img
                        src={doctorEditForm.profile_photo || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=200'}
                        alt="Doc"
                        style={{ width: '60px', height: '60px', borderRadius: '14px', objectFit: 'cover', border: '2px solid var(--primary)', flexShrink: 0 }}
                      />
                      <div style={{ flex: 1 }}>
                        <b style={{ fontSize: '12px', display: 'block', marginBottom: '2px' }}>صورة الطبيب الشخصية</b>
                        <small style={{ color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>يمكنك تغيير صورة الطبيب برفع صورة جديدة من جهازك</small>
                        <label
                          htmlFor="edit-doc-photo-input"
                          className="btn primary small"
                          style={{
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '4px 10px'
                          }}
                        >
                          📷 تغيير الصورة من جهازك
                        </label>
                        <input
                          id="edit-doc-photo-input"
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={handleDoctorEditPhotoUpload}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, marginBottom: '4px' }}>اسم الطبيب بالكامل *</label>
                        <input
                          type="text"
                          className="form-input"
                          required
                          value={doctorEditForm.full_name}
                          onChange={(e) => setDoctorEditForm({ ...doctorEditForm, full_name: e.target.value })}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, marginBottom: '4px' }}>اللقب المهني</label>
                        <input
                          type="text"
                          className="form-input"
                          value={doctorEditForm.title}
                          onChange={(e) => setDoctorEditForm({ ...doctorEditForm, title: e.target.value })}
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, marginBottom: '4px' }}>التخصص الطبي *</label>
                        <select
                          className="form-input"
                          value={doctorEditForm.specialty_id}
                          onChange={(e) => setDoctorEditForm({ ...doctorEditForm, specialty_id: e.target.value })}
                          style={{ width: '100%' }}
                        >
                          {specialties.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, marginBottom: '4px' }}>التخصص الدقيق (Subspecialty)</label>
                        <input
                          type="text"
                          className="form-input"
                          value={doctorEditForm.subspecialty}
                          onChange={(e) => setDoctorEditForm({ ...doctorEditForm, subspecialty: e.target.value })}
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, marginBottom: '4px' }}>سعر الكشف (ج.م)</label>
                        <input
                          type="number"
                          className="form-input"
                          value={doctorEditForm.consultation_fee}
                          onChange={(e) => setDoctorEditForm({ ...doctorEditForm, consultation_fee: e.target.value })}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, marginBottom: '4px' }}>مدة الموعد (بالدقائق)</label>
                        <input
                          type="number"
                          className="form-input"
                          value={doctorEditForm.appointment_duration}
                          onChange={(e) => setDoctorEditForm({ ...doctorEditForm, appointment_duration: e.target.value })}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, marginBottom: '4px' }}>القدرة اليومية (مرضى)</label>
                        <input
                          type="number"
                          className="form-input"
                          value={doctorEditForm.daily_capacity}
                          onChange={(e) => setDoctorEditForm({ ...doctorEditForm, daily_capacity: e.target.value })}
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, marginBottom: '4px' }}>النبذة المهنية والمؤهلات</label>
                      <textarea
                        rows={3}
                        className="form-input"
                        value={doctorEditForm.bio}
                        onChange={(e) => setDoctorEditForm({ ...doctorEditForm, bio: e.target.value })}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button
                      type="submit"
                      className="btn primary"
                      disabled={doctorEditForm.submitting}
                      style={{ fontWeight: 800, padding: '8px 24px' }}
                    >
                      {doctorEditForm.submitting ? 'جاري الحفظ...' : '💾 حفظ وتحديث بيانات وحساب الطبيب'}
                    </button>
                  </div>
                </form>
              )}

              {/* Sub-tab 2: BRANCHES (عرض وإضافة فروع لهذا الطبيب) */}
              {profileModal.activeSubTab === 'branches' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-2)', padding: '10px 14px', borderRadius: '10px' }}>
                    <div>
                      <b style={{ fontSize: '13px' }}>فروع وعيادات الطبيب ({profileModal.data.branches?.length || 0})</b>
                      <small style={{ color: 'var(--muted)', display: 'block', fontSize: '11px' }}>
                        إضافة فروع جديدة أو تعطيل الحجز لفرع محدد دون التأثير على باقي الفروع
                      </small>
                    </div>
                    {!profileAddBranchForm.isOpen && (
                      <button
                        type="button"
                        className="btn primary small"
                        onClick={() => setProfileAddBranchForm({
                          isOpen: true,
                          clinic_name: profileModal.data.doctor.clinic_name || `عيادة ${profileModal.data.doctor.full_name}`,
                          branch_name: '',
                          governorate: 'القاهرة',
                          city: 'القاهرة',
                          address: '',
                          phone: profileModal.data.doctor.phone || '',
                          submitting: false
                        })}
                        style={{ fontWeight: 700, fontSize: '11px' }}
                      >
                        + إضافة فرع لهذا الطبيب
                      </button>
                    )}
                  </div>

                  {/* Inline Add Branch Form */}
                  {profileAddBranchForm.isOpen && (
                    <form
                      onSubmit={handleProfileAddBranchSubmit}
                      style={{
                        background: 'var(--bg)',
                        border: '1px solid var(--primary)',
                        borderRadius: '12px',
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <b style={{ fontSize: '12px', color: 'var(--primary)' }}>إضافة فرع جديد لطبيب</b>
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => setProfileAddBranchForm(prev => ({ ...prev, isOpen: false }))}
                          style={{ fontSize: '11px', color: 'var(--muted)' }}
                        >
                          إلغاء ✕
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, marginBottom: '2px' }}>اسم العيادة / المركز *</label>
                          <input
                            type="text"
                            className="form-input"
                            required
                            value={profileAddBranchForm.clinic_name}
                            onChange={(e) => setProfileAddBranchForm({ ...profileAddBranchForm, clinic_name: e.target.value })}
                            style={{ width: '100%', fontSize: '12px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, marginBottom: '2px' }}>اسم الفرع *</label>
                          <input
                            type="text"
                            className="form-input"
                            required
                            placeholder="مثال: فرع الشيخ زايد"
                            value={profileAddBranchForm.branch_name}
                            onChange={(e) => setProfileAddBranchForm({ ...profileAddBranchForm, branch_name: e.target.value })}
                            style={{ width: '100%', fontSize: '12px' }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, marginBottom: '2px' }}>المحافظة</label>
                          <input
                            type="text"
                            className="form-input"
                            value={profileAddBranchForm.governorate}
                            onChange={(e) => setProfileAddBranchForm({ ...profileAddBranchForm, governorate: e.target.value })}
                            style={{ width: '100%', fontSize: '12px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, marginBottom: '2px' }}>المدينة / المنطقة</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="زايد / أكتوبر"
                            value={profileAddBranchForm.city}
                            onChange={(e) => setProfileAddBranchForm({ ...profileAddBranchForm, city: e.target.value })}
                            style={{ width: '100%', fontSize: '12px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, marginBottom: '2px' }}>هاتف الفرع</label>
                          <input
                            type="tel"
                            className="form-input"
                            value={profileAddBranchForm.phone}
                            onChange={(e) => setProfileAddBranchForm({ ...profileAddBranchForm, phone: e.target.value })}
                            style={{ width: '100%', fontSize: '12px' }}
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, marginBottom: '2px' }}>العنوان التفصيلي</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="الشارع، رقم المبنى، الدور"
                          value={profileAddBranchForm.address}
                          onChange={(e) => setProfileAddBranchForm({ ...profileAddBranchForm, address: e.target.value })}
                          style={{ width: '100%', fontSize: '12px' }}
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                        <button
                          type="button"
                          className="btn secondary small"
                          onClick={() => setProfileAddBranchForm(prev => ({ ...prev, isOpen: false }))}
                        >
                          إلغاء
                        </button>
                        <button
                          type="submit"
                          className="btn primary small"
                          disabled={profileAddBranchForm.submitting}
                          style={{ fontWeight: 700 }}
                        >
                          {profileAddBranchForm.submitting ? 'جاري الإضافة...' : 'حفظ وإضافة الفرع'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Branches List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {profileModal.data.branches?.map(b => (
                      <div
                        key={b.id}
                        style={{
                          background: 'var(--bg)',
                          border: '1px solid var(--line)',
                          borderRadius: '10px',
                          padding: '12px 14px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '10px'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <b style={{ fontSize: '13px' }}>{b.branch_name}</b>
                            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>({b.clinic_name})</span>
                            {b.is_main === 1 && <span className="badge badge-primary">الفرع الرئيسي</span>}
                          </div>
                          <small style={{ color: 'var(--muted)', display: 'block', marginTop: '3px', fontSize: '11px' }}>
                            📍 {b.governorate} - {b.city} · {b.address} {b.phone ? `· 📞 ${b.phone}` : ''}
                          </small>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            className={`btn small ${b.is_booking_enabled ? 'secondary' : 'danger'}`}
                            onClick={async () => {
                              const res = await api.toggleBranchBooking(b.id);
                              if (res.success) {
                                showToast(res.message, 'success');
                                handleOpenDoctorProfile(profileModal.doctorId, 'branches');
                                loadAll();
                              }
                            }}
                            style={{ fontSize: '11px', padding: '4px 10px' }}
                          >
                            {b.is_booking_enabled ? '🟢 الحجز متاح بالفرع' : '🔴 الحجز معطل بالفرع'}
                          </button>

                          <button
                            type="button"
                            className="btn secondary small"
                            onClick={() => setConfirmDeleteModal({
                              isOpen: true,
                              type: 'branch',
                              target: b,
                              onConfirm: async () => {
                                const res = await api.deleteAdminBranch(b.id);
                                if (res.success) {
                                  showToast(res.message, 'success');
                                  setConfirmDeleteModal({ isOpen: false, type: 'branch', target: null });
                                  handleOpenDoctorProfile(profileModal.doctorId, 'branches');
                                  loadAll();
                                }
                              }
                            })}
                            style={{ fontSize: '11px', color: 'var(--danger)', padding: '4px 8px' }}
                          >
                            حذف
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sub-tab 3: STAFF (عرض وإدارة كلمات مرور موظفي الاستقبال) */}
              {profileModal.activeSubTab === 'staff' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-2)', padding: '10px 14px', borderRadius: '10px' }}>
                    <div>
                      <b style={{ fontSize: '13px' }}>موظفو الاستقبال المعينون ({profileModal.data.receptionists?.length || 0})</b>
                      <small style={{ color: 'var(--muted)', display: 'block', fontSize: '11px' }}>
                        حسابات موظفي الاستقبال مع كلمات المرور الخاصة بهم وإمكانية التعديل والإضافة المباشرة
                      </small>
                    </div>
                    {!profileAddStaffForm.isOpen && (
                      <button
                        type="button"
                        className="btn primary small"
                        onClick={() => setProfileAddStaffForm({
                          isOpen: true,
                          name: '',
                          email: '',
                          phone: '',
                          password: generateRandomPassword(),
                          branch_id: profileModal.data.branches?.[0]?.id || '',
                          submitting: false
                        })}
                        style={{ fontSize: '11px', fontWeight: 700 }}
                      >
                        + إضافة موظف استقبال لهذا الطبيب
                      </button>
                    )}
                  </div>

                  {/* Inline Form to add staff for this doctor */}
                  {profileAddStaffForm.isOpen && (
                    <form
                      onSubmit={handleProfileAddStaffSubmit}
                      style={{
                        background: 'var(--bg)',
                        border: '1px solid var(--primary)',
                        borderRadius: '12px',
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <b style={{ fontSize: '12px', color: 'var(--primary)' }}>بيانات حساب موظف الاستقبال الجديد</b>
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => setProfileAddStaffForm(prev => ({ ...prev, isOpen: false }))}
                          style={{ fontSize: '11px', color: 'var(--muted)' }}
                        >
                          إلغاء ✕
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, marginBottom: '2px' }}>اسم الموظف *</label>
                          <input
                            type="text"
                            className="form-input"
                            required
                            placeholder="مثال: أحمد سامي"
                            value={profileAddStaffForm.name}
                            onChange={(e) => setProfileAddStaffForm({ ...profileAddStaffForm, name: e.target.value })}
                            style={{ width: '100%', fontSize: '12px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, marginBottom: '2px' }}>البريد الإلكتروني لدخول الاستقبال *</label>
                          <input
                            type="email"
                            className="form-input"
                            required
                            placeholder="rec@dawry.com"
                            value={profileAddStaffForm.email}
                            onChange={(e) => setProfileAddStaffForm({ ...profileAddStaffForm, email: e.target.value })}
                            style={{ width: '100%', fontSize: '12px' }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, marginBottom: '2px' }}>رقم الهاتف</label>
                          <input
                            type="tel"
                            className="form-input"
                            placeholder="010XXXXXXXX"
                            value={profileAddStaffForm.phone}
                            onChange={(e) => setProfileAddStaffForm({ ...profileAddStaffForm, phone: e.target.value })}
                            style={{ width: '100%', fontSize: '12px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, marginBottom: '2px' }}>الفرع المسند إليه *</label>
                          <select
                            className="form-input"
                            required
                            value={profileAddStaffForm.branch_id}
                            onChange={(e) => setProfileAddStaffForm({ ...profileAddStaffForm, branch_id: e.target.value })}
                            style={{ width: '100%', fontSize: '12px' }}
                          >
                            {profileModal.data.branches?.map(b => (
                              <option key={b.id} value={b.id}>{b.branch_name} ({b.clinic_name})</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 700 }}>كلمة المرور لحساب الاستقبال *</label>
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => setProfileAddStaffForm({ ...profileAddStaffForm, password: generateRandomPassword() })}
                            style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: 700 }}
                          >
                            ⚡ توليد كلمة سر
                          </button>
                        </div>
                        <input
                          type="text"
                          className="form-input"
                          required
                          value={profileAddStaffForm.password}
                          onChange={(e) => setProfileAddStaffForm({ ...profileAddStaffForm, password: e.target.value })}
                          placeholder="كلمة مرور دخول الاستقبال"
                          style={{ width: '100%', fontSize: '12px' }}
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                        <button
                          type="button"
                          className="btn secondary small"
                          onClick={() => setProfileAddStaffForm(prev => ({ ...prev, isOpen: false }))}
                        >
                          إلغاء
                        </button>
                        <button
                          type="submit"
                          className="btn primary small"
                          disabled={profileAddStaffForm.submitting}
                          style={{ fontWeight: 700 }}
                        >
                          {profileAddStaffForm.submitting ? 'جاري الإنشاء...' : 'حفظ وإنشاء حساب الاستقبال'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Receptionist Cards with password and controls */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {profileModal.data.receptionists?.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', background: 'var(--bg)', borderRadius: '10px', fontSize: '12px' }}>
                        لا يوجد موظفو استقبال مسجلون لهذا الطبيب حالياً. اضغط على الزر أعلاه لإضافة موظف استقبال.
                      </div>
                    ) : (
                      profileModal.data.receptionists?.map(r => {
                        const isPassVisible = staffPasswordVisible[r.id];
                        return (
                          <div
                            key={r.id}
                            style={{
                              background: 'var(--bg)',
                              border: '1px solid var(--line)',
                              borderRadius: '12px',
                              padding: '14px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '10px'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <b style={{ fontSize: '13px' }}>{r.name}</b>
                                  <span className={`badge ${r.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                                    {r.status === 'active' ? 'نشط' : 'معطل'}
                                  </span>
                                </div>
                                <small style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', marginTop: '2px' }}>
                                  ✉️ {r.email} {r.phone ? `· 📞 ${r.phone}` : ''} · 🏥 الفرع: {r.branch_name || 'الفرع الرئيسي'}
                                </small>
                              </div>

                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <button
                                  type="button"
                                  className="btn secondary small"
                                  onClick={() => copyStaffCredentials(r, profileModal.data?.doctor?.full_name)}
                                  style={{ fontSize: '10px', padding: '3px 8px', fontWeight: 700 }}
                                  title="نسخ بيانات الدخول للموظف لإرسالها على واتساب"
                                >
                                  📋 نسخ الدخول
                                </button>

                                <button
                                  type="button"
                                  className="btn secondary small"
                                  onClick={async () => {
                                    const res = await api.toggleAdminStaff(r.id);
                                    if (res.success) {
                                      showToast(res.message, 'success');
                                      handleOpenDoctorProfile(profileModal.doctorId, 'staff');
                                      loadAll();
                                    }
                                  }}
                                  style={{ fontSize: '10px', padding: '3px 8px' }}
                                >
                                  {r.status === 'active' ? 'تعطيل الحساب' : 'تفعيل الحساب'}
                                </button>

                                <button
                                  type="button"
                                  className="btn secondary small"
                                  onClick={() => setConfirmDeleteModal({
                                    isOpen: true,
                                    type: 'staff',
                                    target: r,
                                    onConfirm: async () => {
                                      const res = await api.deleteAdminStaff(r.id);
                                      if (res.success) {
                                        showToast(res.message, 'success');
                                        setConfirmDeleteModal({ isOpen: false, type: 'staff', target: null });
                                        handleOpenDoctorProfile(profileModal.doctorId, 'staff');
                                        loadAll();
                                      }
                                    }
                                  })}
                                  style={{ fontSize: '10px', color: 'var(--danger)', padding: '3px 8px' }}
                                >
                                  حذف الموظف
                                </button>
                              </div>
                            </div>

                            {/* Password row for this receptionist */}
                            <div style={{ background: 'var(--surface-2)', padding: '8px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '240px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)' }}>🔑 كلمة مرور الاستقبال:</span>
                                <input
                                  type={isPassVisible ? 'text' : 'password'}
                                  className="form-input"
                                  value={staffPasswordEdit[r.id] !== undefined ? staffPasswordEdit[r.id] : (r.password || '123456')}
                                  onChange={(e) => setStaffPasswordEdit({ ...staffPasswordEdit, [r.id]: e.target.value })}
                                  style={{ maxWidth: '160px', padding: '3px 8px', fontSize: '12px', letterSpacing: isPassVisible ? 'normal' : '2px' }}
                                />
                                <button
                                  type="button"
                                  className="text-button"
                                  onClick={() => setStaffPasswordVisible({ ...staffPasswordVisible, [r.id]: !isPassVisible })}
                                  style={{ fontSize: '11px', color: 'var(--primary)' }}
                                >
                                  {isPassVisible ? 'إخفاء' : 'إظهار'}
                                </button>
                              </div>

                              <button
                                type="button"
                                className="btn primary small"
                                onClick={() => handleUpdateStaffPassword(r)}
                                style={{ fontSize: '10px', padding: '4px 10px', fontWeight: 700 }}
                              >
                                💾 حفظ كلمة السر
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Sub-tab Content: Overview */}
              {profileModal.activeSubTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                  <div style={{ background: 'var(--bg)', borderRadius: '12px', padding: '14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                    <div>
                      <small style={{ color: 'var(--muted)', display: 'block' }}>سعر الكشف</small>
                      <b>{profileModal.data.doctor.consultation_fee} ج.م</b>
                    </div>
                    <div>
                      <small style={{ color: 'var(--muted)', display: 'block' }}>مدة الكشف</small>
                      <b>{profileModal.data.doctor.appointment_duration} دقيقة</b>
                    </div>
                    <div>
                      <small style={{ color: 'var(--muted)', display: 'block' }}>الباقة الحالية</small>
                      <b>{profileModal.data.doctor.plan_name || 'برو'}</b>
                    </div>
                    <div>
                      <small style={{ color: 'var(--muted)', display: 'block' }}>الحجز أونلاين</small>
                      <b style={{ color: profileModal.data.doctor.is_booking_enabled ? '#16a36a' : '#e05252' }}>
                        {profileModal.data.doctor.is_booking_enabled ? 'متاح' : 'معطل'}
                      </b>
                    </div>
                  </div>

                  <b style={{ fontSize: '13px' }}>هيكلية العلاقات المتصلة:</b>
                  <div style={{ background: 'var(--surface-2)', padding: '12px', borderRadius: '10px', fontSize: '12px', lineHeight: 1.8 }}>
                    <div>الطبيب: <b>{profileModal.data.doctor.full_name}</b></div>
                    <div>↓ الفروع التابعة ({profileModal.data.branches?.length}): {profileModal.data.branches?.map(b => b.branch_name).join(' ، ')}</div>
                    <div>↓ موظفو الاستقبال المعينون ({profileModal.data.receptionists?.length}): {profileModal.data.receptionists?.map(r => r.name).join(' ، ')}</div>
                  </div>
                </div>
              )}

              {/* Sub-tab: Bookings */}
              {profileModal.activeSubTab === 'bookings' && (
                <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--line)' }}>
                        <th style={{ padding: '8px' }}>المريض</th>
                        <th style={{ padding: '8px' }}>التاريخ والوقت</th>
                        <th style={{ padding: '8px' }}>الفرع</th>
                        <th style={{ padding: '8px' }}>الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profileModal.data.appointments?.map(a => (
                        <tr key={a.id} style={{ borderBottom: '1px solid var(--line)' }}>
                          <td style={{ padding: '8px' }}><b>{a.patient_name}</b> ({a.patient_phone})</td>
                          <td style={{ padding: '8px' }}>{a.appointment_date} · {a.appointment_time}</td>
                          <td style={{ padding: '8px' }}>{a.branch_name}</td>
                          <td style={{ padding: '8px' }}><span className="badge badge-primary">{a.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Sub-tab: Subscription */}
              {profileModal.activeSubTab === 'subscription' && (
                <div style={{ fontSize: '13px' }}>
                  <div style={{ background: 'var(--bg)', padding: '14px', borderRadius: '10px', marginBottom: '14px' }}>
                    <div>الباقة: <b>{profileModal.data.doctor.plan_name}</b> ({profileModal.data.doctor.plan_price} ج.م / شهر)</div>
                    <div>تاريخ الانتهاء: <b>{profileModal.data.doctor.subscription_end_date}</b></div>
                    <div>حالة الاشتراك: <span className="badge badge-success">{profileModal.data.doctor.subscription_status}</span></div>
                  </div>
                  <b style={{ fontSize: '13px' }}>فواتير الدفع السابقة:</b>
                  {profileModal.data.payments?.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: '12px' }}>
                      <span>فاتورة #{p.invoice_number} ({p.payment_method})</span>
                      <b>{p.amount} ج.م</b>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </Modal>
      )}

      {/* ============================================================= */}
      {/* SECTION 2: MULTI-STEP DOCTOR WIZARD MODAL (5 STEPS) */}
      {/* ============================================================= */}
      {wizardModal.isOpen && (
        <Modal
          isOpen={true}
          maxWidth="850px"
          title={`معالج إضافة طبيب وعيادة جديد — الخطوة ${wizardModal.step} من 5`}
          onClose={() => setWizardModal({ isOpen: false, step: 1, submitting: false })}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Step Progress Pills */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', textAlign: 'center', fontSize: '11px', fontWeight: 700 }}>
              {['١. بيانات الطبيب', '٢. حساب الدخول', '٣. الفروع والعيادات', '٤. حسابات الاستقبال', '٥. إعدادات الحجز'].map((label, idx) => {
                const sNum = idx + 1;
                const isCurrent = wizardModal.step === sNum;
                const isDone = wizardModal.step > sNum;
                return (
                  <div
                    key={idx}
                    style={{
                      padding: '8px 4px',
                      borderRadius: '8px',
                      background: isCurrent ? 'var(--primary)' : isDone ? '#16a36a' : 'var(--surface-2)',
                      color: isCurrent || isDone ? '#fff' : 'var(--muted)'
                    }}
                  >
                    {label}
                  </div>
                );
              })}
            </div>

            {/* STEP 1: DOCTOR INFO */}
            {wizardModal.step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Photo Upload Box */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '14px 16px',
                  background: 'var(--surface-2)',
                  borderRadius: '14px',
                  border: '1px dashed var(--line)'
                }}>
                  <div style={{ position: 'relative', width: '74px', height: '74px', flexShrink: 0 }}>
                    <img
                      src={wizardForm.profile_photo || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=200'}
                      alt="Doctor Preview"
                      style={{
                        width: '74px',
                        height: '74px',
                        borderRadius: '16px',
                        objectFit: 'cover',
                        border: '2px solid var(--primary)',
                        background: 'var(--surface)'
                      }}
                    />
                    {wizardForm.profile_photo && (
                      <button
                        type="button"
                        onClick={() => setWizardForm(prev => ({ ...prev, profile_photo: '' }))}
                        style={{
                          position: 'absolute',
                          top: '-6px',
                          left: '-6px',
                          background: 'var(--danger)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '50%',
                          width: '22px',
                          height: '22px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: 800
                        }}
                        title="حذف الصورة والعودة للافتراضية"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, marginBottom: '2px', color: 'var(--text)' }}>
                      صورة الطبيب الشخصية
                    </label>
                    <p style={{ margin: '0 0 8px', fontSize: '11px', color: 'var(--muted)' }}>
                      {wizardForm.profile_photo ? 'تم تحديد صورة الطبيب بنجاح' : 'ارفع صورة شخصية واضحة للطبيب من جهازك'}
                    </p>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <label
                        htmlFor="wizard-doc-photo-input"
                        className="btn primary small"
                        style={{
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '11px',
                          fontWeight: 800,
                          padding: '6px 12px'
                        }}
                      >
                        📷 رفع صورة الطبيب من جهازك
                      </label>
                      <input
                        id="wizard-doc-photo-input"
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleWizardPhotoUpload}
                      />
                      {wizardForm.profile_photo && (
                        <span style={{ fontSize: '11px', color: '#16a36a', fontWeight: 700 }}>
                          ✓ تم تحديد الصورة
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>اسم الطبيب بالكامل *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={wizardForm.full_name}
                    onChange={(e) => setWizardForm({ ...wizardForm, full_name: e.target.value })}
                    placeholder="د. مصطفى محمود"
                    required
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>اللقب المهني</label>
                    <input
                      type="text"
                      className="form-input"
                      value={wizardForm.title}
                      onChange={(e) => setWizardForm({ ...wizardForm, title: e.target.value })}
                      placeholder="استشاري / أخصائي"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>التخصص الطبي *</label>
                    <select
                      className="form-input"
                      value={wizardForm.specialty_id}
                      onChange={(e) => setWizardForm({ ...wizardForm, specialty_id: e.target.value })}
                      style={{ width: '100%' }}
                    >
                      {specialties.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>البريد الإلكتروني *</label>
                    <input
                      type="email"
                      className="form-input"
                      value={wizardForm.email}
                      onChange={(e) => setWizardForm({ ...wizardForm, email: e.target.value })}
                      placeholder="doctor@dawry.com"
                      required
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>رقم الهاتف *</label>
                    <input
                      type="tel"
                      className="form-input"
                      value={wizardForm.phone}
                      onChange={(e) => setWizardForm({ ...wizardForm, phone: e.target.value })}
                      placeholder="010XXXXXXXX"
                      required
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>سعر الكشف (ج.م)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={wizardForm.consultation_fee}
                      onChange={(e) => setWizardForm({ ...wizardForm, consultation_fee: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>باقة الاشتراك</label>
                    <select
                      className="form-input"
                      value={wizardForm.plan_id}
                      onChange={(e) => setWizardForm({ ...wizardForm, plan_id: parseInt(e.target.value, 10) })}
                      style={{ width: '100%' }}
                    >
                      {subscriptionsData?.plans?.map(p => (
                        <option key={p.id} value={p.id}>باقة {p.name} ({p.price} ج.م - حتى {p.max_receptionists} موظفين)</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: DOCTOR LOGIN ACCOUNT CREATION */}
            {wizardModal.step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                <div style={{ background: 'var(--surface-2)', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--line)' }}>
                  <b style={{ color: 'var(--text)', display: 'block', marginBottom: '4px' }}>
                    🔑 إنشاء وتعيين بيانات حساب دخول الطبيب (Doctor Credentials)
                  </b>
                  <p style={{ margin: 0, color: 'var(--muted)', fontSize: '12px', lineHeight: 1.6 }}>
                    حدد بيانات تسجيل الدخول الخاصة بالطبيب هنا مباشرة. سيتمكن الطبيب من استخدامها للدخول لمساحة عمله الخاصة عبر <code>#doctor</code>.
                  </p>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
                    البريد الإلكتروني / اسم الدخول للطبيب *
                  </label>
                  <input
                    type="email"
                    className="form-input"
                    value={wizardForm.email}
                    onChange={(e) => setWizardForm({ ...wizardForm, email: e.target.value })}
                    placeholder="doctor@dawry.com"
                    required
                    style={{ width: '100%' }}
                  />
                  <small style={{ color: 'var(--muted)', fontSize: '11px' }}>يمكن للطبيب تسجيل الدخول بهذا البريد أو برقم هاتفه</small>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
                    رقم هاتف الدخول والتواصل *
                  </label>
                  <input
                    type="tel"
                    className="form-input"
                    value={wizardForm.phone}
                    onChange={(e) => setWizardForm({ ...wizardForm, phone: e.target.value })}
                    placeholder="010XXXXXXXX"
                    required
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700 }}>كلمة المرور لحساب الطبيب *</label>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setWizardForm({ ...wizardForm, password: generateRandomPassword() })}
                      style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 700 }}
                    >
                      ⚡ توليد كلمة سر عشوائية
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type={wizardForm.showPassword ? 'text' : 'password'}
                      className="form-input"
                      value={wizardForm.password}
                      onChange={(e) => setWizardForm({ ...wizardForm, password: e.target.value })}
                      placeholder="أدخل كلمة مرور الطبيب (أو اتركها 123456 افتراضياً)"
                      style={{ width: '100%', letterSpacing: wizardForm.showPassword ? 'normal' : '2px' }}
                    />
                    <button
                      type="button"
                      className="btn secondary small"
                      onClick={() => setWizardForm({ ...wizardForm, showPassword: !wizardForm.showPassword })}
                      style={{ whiteSpace: 'nowrap', fontSize: '11px' }}
                    >
                      {wizardForm.showPassword ? 'إخفاء' : 'إظهار'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: CLINIC AND MULTIPLE BRANCHES */}
            {wizardModal.step === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <b style={{ fontSize: '13px' }}>الفروع التابعة للطبيب ({wizardForm.branches.length}):</b>
                  <button
                    type="button"
                    className="btn secondary small"
                    onClick={() => {
                      setWizardForm({
                        ...wizardForm,
                        branches: [
                          ...wizardForm.branches,
                          { clinic_name: `عيادة ${wizardForm.full_name}`, branch_name: `فرع ${wizardForm.branches.length + 1}`, governorate: 'الجيزة', city: 'الدقي', address: '', phone: wizardForm.phone, is_booking_enabled: true }
                        ]
                      });
                    }}
                  >
                    + إضافة فرع آخر
                  </button>
                </div>

                {wizardForm.branches.map((br, idx) => (
                  <div key={idx} style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: '10px', padding: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="اسم العيادة / المركز"
                        value={br.clinic_name}
                        onChange={(e) => {
                          const nb = [...wizardForm.branches];
                          nb[idx].clinic_name = e.target.value;
                          setWizardForm({ ...wizardForm, branches: nb });
                        }}
                      />
                      <input
                        type="text"
                        className="form-input"
                        placeholder="اسم الفرع (مثال: فرع المهندسين)"
                        value={br.branch_name}
                        onChange={(e) => {
                          const nb = [...wizardForm.branches];
                          nb[idx].branch_name = e.target.value;
                          setWizardForm({ ...wizardForm, branches: nb });
                        }}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="المدينة / المنطقة"
                        value={br.city}
                        onChange={(e) => {
                          const nb = [...wizardForm.branches];
                          nb[idx].city = e.target.value;
                          setWizardForm({ ...wizardForm, branches: nb });
                        }}
                      />
                      <input
                        type="text"
                        className="form-input"
                        placeholder="العنوان التفصيلي"
                        value={br.address}
                        onChange={(e) => {
                          const nb = [...wizardForm.branches];
                          nb[idx].address = e.target.value;
                          setWizardForm({ ...wizardForm, branches: nb });
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* STEP 4: RECEPTIONIST ACCOUNTS (WITH CUSTOM CREDENTIALS) */}
            {wizardModal.step === 4 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ background: 'var(--surface-2)', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <b style={{ fontSize: '13px', display: 'block' }}>
                      👥 تعيين حسابات موظفي الاستقبال لهذا الطبيب
                    </b>
                    <small style={{ color: 'var(--muted)' }}>
                      الحد الأقصى المسموح للباقة المختارة: {subscriptionsData?.plans?.find(p => p.id === wizardForm.plan_id)?.max_receptionists || 2} حسابات
                    </small>
                  </div>
                  {wizardForm.receptionists.length < (subscriptionsData?.plans?.find(p => p.id === wizardForm.plan_id)?.max_receptionists || 2) && (
                    <button
                      type="button"
                      className="btn secondary small"
                      onClick={() => {
                        setWizardForm({
                          ...wizardForm,
                          receptionists: [
                            ...wizardForm.receptionists,
                            { name: '', email: '', phone: wizardForm.phone, password: generateRandomPassword(), showPassword: false, branch_index: 0 }
                          ]
                        });
                      }}
                      style={{ fontWeight: 700 }}
                    >
                      + إضافة موظف آخر
                    </button>
                  )}
                </div>

                {wizardForm.receptionists.map((rec, idx) => (
                  <div key={idx} style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: '12px', padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <b style={{ fontSize: '12px', color: 'var(--primary)' }}>حساب موظف استقبال #{idx + 1}</b>
                      {wizardForm.receptionists.length > 1 && (
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => {
                            const nr = wizardForm.receptionists.filter((_, i) => i !== idx);
                            setWizardForm({ ...wizardForm, receptionists: nr });
                          }}
                          style={{ color: 'var(--danger)', fontSize: '11px' }}
                        >
                          حذف
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, marginBottom: '2px' }}>اسم الموظف *</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="مثال: منى عبد الله"
                          value={rec.name}
                          onChange={(e) => {
                            const nr = [...wizardForm.receptionists];
                            nr[idx].name = e.target.value;
                            setWizardForm({ ...wizardForm, receptionists: nr });
                          }}
                          style={{ width: '100%', fontSize: '12px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, marginBottom: '2px' }}>البريد الإلكتروني / اسم الدخول *</label>
                        <input
                          type="email"
                          className="form-input"
                          placeholder="rec@dawry.com"
                          value={rec.email}
                          onChange={(e) => {
                            const nr = [...wizardForm.receptionists];
                            nr[idx].email = e.target.value;
                            setWizardForm({ ...wizardForm, receptionists: nr });
                          }}
                          style={{ width: '100%', fontSize: '12px' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, marginBottom: '2px' }}>رقم الهاتف</label>
                        <input
                          type="tel"
                          className="form-input"
                          placeholder="010XXXXXXXX"
                          value={rec.phone}
                          onChange={(e) => {
                            const nr = [...wizardForm.receptionists];
                            nr[idx].phone = e.target.value;
                            setWizardForm({ ...wizardForm, receptionists: nr });
                          }}
                          style={{ width: '100%', fontSize: '12px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, marginBottom: '2px' }}>الفرع المسند إليه:</label>
                        <select
                          className="form-input"
                          value={rec.branch_index}
                          onChange={(e) => {
                            const nr = [...wizardForm.receptionists];
                            nr[idx].branch_index = parseInt(e.target.value, 10);
                            setWizardForm({ ...wizardForm, receptionists: nr });
                          }}
                          style={{ width: '100%', fontSize: '12px' }}
                        >
                          {wizardForm.branches.map((b, bIdx) => (
                            <option key={bIdx} value={bIdx}>{b.branch_name || `فرع ${bIdx + 1}`}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 700 }}>كلمة المرور لدخول الاستقبال *</label>
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => {
                            const nr = [...wizardForm.receptionists];
                            nr[idx].password = generateRandomPassword();
                            setWizardForm({ ...wizardForm, receptionists: nr });
                          }}
                          style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: 700 }}
                        >
                          ⚡ توليد كلمة سر
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type={rec.showPassword ? 'text' : 'password'}
                          className="form-input"
                          value={rec.password}
                          onChange={(e) => {
                            const nr = [...wizardForm.receptionists];
                            nr[idx].password = e.target.value;
                            setWizardForm({ ...wizardForm, receptionists: nr });
                          }}
                          placeholder="كلمة مرور حساب الاستقبال (أو 123456 افتراضياً)"
                          style={{ width: '100%', fontSize: '12px' }}
                        />
                        <button
                          type="button"
                          className="btn secondary small"
                          onClick={() => {
                            const nr = [...wizardForm.receptionists];
                            nr[idx].showPassword = !nr[idx].showPassword;
                            setWizardForm({ ...wizardForm, receptionists: nr });
                          }}
                          style={{ fontSize: '11px', whiteSpace: 'nowrap' }}
                        >
                          {rec.showPassword ? 'إخفاء' : 'إظهار'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* STEP 5: BOOKING CONFIGURATION */}
            {wizardModal.step === 5 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                <div style={{ background: 'var(--surface-2)', padding: '16px', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="checkbox"
                      id="wizardBookingEnable"
                      checked={wizardForm.is_booking_enabled}
                      onChange={(e) => setWizardForm({ ...wizardForm, is_booking_enabled: e.target.checked })}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <label htmlFor="wizardBookingEnable" style={{ fontWeight: 700, cursor: 'pointer' }}>
                      تفعيل الحجز أونلاين للطبيب فور الإنشاء وجعله متاحاً للمرضى في نتائج البحث
                    </label>
                  </div>
                  <p style={{ margin: '8px 0 0 28px', fontSize: '12px', color: 'var(--muted)' }}>
                    سيتمكن المرضى من العثور على الطبيب وفروعه واختيار المواعيد ومتابعة الطابور الحي فور الانتهاء.
                  </p>
                </div>

                <div style={{ background: 'var(--bg)', padding: '14px', borderRadius: '10px', fontSize: '12px' }}>
                  <b>ملخص ما سيتم إنشاؤه:</b>
                  <ul style={{ paddingRight: '18px', margin: '6px 0', lineHeight: 1.7 }}>
                    <li>حساب طبيب: <b>{wizardForm.full_name}</b> ({wizardForm.email})</li>
                    <li>عدد الفروع: <b>{wizardForm.branches.length} فروع</b></li>
                    <li>عدد حسابات الاستقبال: <b>{wizardForm.receptionists.filter(r => r.name).length || 1} حسابات</b></li>
                    <li>باقة اشتراك: <b>سارية لـ ٣٠ يوماً</b></li>
                  </ul>
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', borderTop: '1px solid var(--line)', paddingTop: '14px' }}>
              <button
                type="button"
                className="btn secondary"
                disabled={wizardModal.step === 1}
                onClick={() => setWizardModal(prev => ({ ...prev, step: prev.step - 1 }))}
              >
                ← السابق
              </button>

              {wizardModal.step < 5 ? (
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => {
                    if (wizardModal.step === 1 && (!wizardForm.full_name || !wizardForm.email || !wizardForm.phone)) {
                      showToast('يرجى ملء الاسم، البريد، والهاتف', 'error');
                      return;
                    }
                    setWizardModal(prev => ({ ...prev, step: prev.step + 1 }));
                  }}
                  style={{ fontWeight: 700 }}
                >
                  التالي →
                </button>
              ) : (
                <button
                  type="button"
                  className="btn primary"
                  disabled={wizardModal.submitting}
                  onClick={handleWizardSubmit}
                  style={{ fontWeight: 800, background: '#16a36a', borderColor: '#16a36a' }}
                >
                  {wizardModal.submitting ? 'جاري الإنشاء والربط...' : '✓ تأكيد وإنشاء الطبيب بالكامل'}
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* SUSPEND MODAL */}
      {suspendModal.isOpen && (
        <Modal
          isOpen={true}
          title={`تعليق حساب الطبيب: ${suspendModal.doctor?.full_name}`}
          onClose={() => setSuspendModal({ isOpen: false, doctor: null, reason: '' })}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text)', margin: 0 }}>
              سيؤدي إيقاف الحساب إلى منع الطبيب وموظفي الاستقبال من الدخول، وإخفاء الطبيب من نتائج الحجز العامة.
            </p>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>سبب الإيقاف الإداري:</label>
              <textarea
                rows={3}
                className="form-input"
                value={suspendModal.reason}
                onChange={(e) => setSuspendModal({ ...suspendModal, reason: e.target.value })}
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setSuspendModal({ isOpen: false, doctor: null, reason: '' })}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={handleSuspendDoctor}
                style={{ fontWeight: 700 }}
              >
                تأكيد إيقاف الحساب
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* CONFIRM DELETE MODAL */}
      {confirmDeleteModal.isOpen && (
        <Modal
          isOpen={true}
          title="تأكيد الحذف النهائي"
          onClose={() => setConfirmDeleteModal({ isOpen: false, type: 'doctor', target: null })}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--danger)', margin: 0, fontWeight: 700 }}>
              ⚠️ تحذير: هذا الإجراء نهائي ولا يمكن التراجع عنه.
            </p>
            <p style={{ fontSize: '13px', margin: 0, color: 'var(--text)' }}>
              هل أنت متأكد من الحذف النهائي لـ "{confirmDeleteModal.target?.full_name || confirmDeleteModal.target?.branch_name || confirmDeleteModal.target?.name}"؟
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setConfirmDeleteModal({ isOpen: false, type: 'doctor', target: null })}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={confirmDeleteModal.onConfirm}
                style={{ fontWeight: 700 }}
              >
                نعم، تأكيد الحذف النهائي
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ADD BRANCH MODAL */}
      {addBranchModal.isOpen && (
        <Modal
          isOpen={true}
          title="إضافة فرع جديد لطبيب"
          onClose={() => setAddBranchModal({ isOpen: false, doctorId: '', form: { clinic_name: '', branch_name: '', governorate: 'القاهرة', city: '', address: '', phone: '' } })}
        >
          <form onSubmit={handleAddBranchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>اختر الطبيب *</label>
              <select
                className="form-input"
                value={addBranchModal.doctorId}
                onChange={(e) => setAddBranchModal({ ...addBranchModal, doctorId: e.target.value })}
                style={{ width: '100%' }}
                required
              >
                <option value="">اختر الطبيب...</option>
                {doctors.map(d => <option key={d.id} value={d.id}>{d.full_name} ({d.clinic_name})</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>اسم الفرع *</label>
              <input
                type="text"
                className="form-input"
                required
                placeholder="فرع المهندسين"
                value={addBranchModal.form.branch_name}
                onChange={(e) => setAddBranchModal({ ...addBranchModal, form: { ...addBranchModal.form, branch_name: e.target.value } })}
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="المحافظة"
                value={addBranchModal.form.governorate}
                onChange={(e) => setAddBranchModal({ ...addBranchModal, form: { ...addBranchModal.form, governorate: e.target.value } })}
              />
              <input
                type="text"
                className="form-input"
                placeholder="المدينة"
                value={addBranchModal.form.city}
                onChange={(e) => setAddBranchModal({ ...addBranchModal, form: { ...addBranchModal.form, city: e.target.value } })}
              />
            </div>
            <input
              type="text"
              className="form-input"
              placeholder="العنوان التفصيلي"
              value={addBranchModal.form.address}
              onChange={(e) => setAddBranchModal({ ...addBranchModal, form: { ...addBranchModal.form, address: e.target.value } })}
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
              <button type="button" className="btn secondary" onClick={() => setAddBranchModal({ isOpen: false, doctorId: '', form: { clinic_name: '', branch_name: '', governorate: 'القاهرة', city: '', address: '', phone: '' } })}>إلغاء</button>
              <button type="submit" className="btn primary" style={{ fontWeight: 700 }}>حفظ وإضافة الفرع</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ADD STAFF MODAL */}
      {addStaffModal.isOpen && (
        <Modal
          isOpen={true}
          title="إنشاء حساب موظف استقبال جديد"
          onClose={() => setAddStaffModal({ isOpen: false, doctorId: '', branchId: '', form: { name: '', email: '', phone: '' } })}
        >
          <form onSubmit={handleAddStaffSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>اختر الطبيب المسؤول *</label>
              <select
                className="form-input"
                value={addStaffModal.doctorId}
                onChange={(e) => setAddStaffModal({ ...addStaffModal, doctorId: e.target.value })}
                style={{ width: '100%' }}
                required
              >
                <option value="">اختر الطبيب...</option>
                {doctors.map(d => <option key={d.id} value={d.id}>{d.full_name} ({d.clinic_name})</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>اختر الفرع المسند *</label>
              <select
                className="form-input"
                value={addStaffModal.branchId}
                onChange={(e) => setAddStaffModal({ ...addStaffModal, branchId: e.target.value })}
                style={{ width: '100%' }}
                required
              >
                <option value="">اختر الفرع...</option>
                {branches
                  .filter(b => !addStaffModal.doctorId || String(b.doctor_id) === String(addStaffModal.doctorId))
                  .map(b => <option key={b.id} value={b.id}>{b.branch_name} ({b.clinic_name})</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>اسم الموظف *</label>
              <input
                type="text"
                className="form-input"
                required
                placeholder="سارة أحمد"
                value={addStaffModal.form.name}
                onChange={(e) => setAddStaffModal({ ...addStaffModal, form: { ...addStaffModal.form, name: e.target.value } })}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>البريد الإلكتروني / اسم الدخول *</label>
              <input
                type="email"
                className="form-input"
                required
                placeholder="reception@dawry.com"
                value={addStaffModal.form.email}
                onChange={(e) => setAddStaffModal({ ...addStaffModal, form: { ...addStaffModal.form, email: e.target.value } })}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>رقم الهاتف</label>
              <input
                type="tel"
                className="form-input"
                placeholder="010XXXXXXXX"
                value={addStaffModal.form.phone || ''}
                onChange={(e) => setAddStaffModal({ ...addStaffModal, form: { ...addStaffModal.form, phone: e.target.value } })}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700 }}>كلمة المرور لدخول الاستقبال *</label>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setAddStaffModal({ ...addStaffModal, form: { ...addStaffModal.form, password: generateRandomPassword() } })}
                  style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 700 }}
                >
                  ⚡ توليد كلمة سر
                </button>
              </div>
              <input
                type="text"
                className="form-input"
                placeholder="أدخل كلمة المرور (أو 123456 افتراضياً)"
                value={addStaffModal.form.password || ''}
                onChange={(e) => setAddStaffModal({ ...addStaffModal, form: { ...addStaffModal.form, password: e.target.value } })}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
              <button type="button" className="btn secondary" onClick={() => setAddStaffModal({ isOpen: false, doctorId: '', branchId: '', form: { name: '', email: '', phone: '', password: '' } })}>إلغاء</button>
              <button type="submit" className="btn primary" style={{ fontWeight: 700 }}>إنشاء الحساب</button>
            </div>
          </form>
        </Modal>
      )}

      {/* SUBSCRIPTION ASSIGN / EXTEND MODAL */}
      {subAssignModal.isOpen && (
        <Modal
          isOpen={true}
          title={`تمديد / ترقية باقة الطبيب: ${subAssignModal.doctor?.full_name}`}
          onClose={() => setSubAssignModal({ isOpen: false, doctor: null, planId: 1, extendDays: 30 })}
        >
          <form onSubmit={handleAssignSubSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>اختر الباقة</label>
              <select
                className="form-input"
                value={subAssignModal.planId}
                onChange={(e) => setSubAssignModal({ ...subAssignModal, planId: parseInt(e.target.value, 10) })}
                style={{ width: '100%' }}
              >
                {subscriptionsData?.plans?.map(p => (
                  <option key={p.id} value={p.id}>باقة {p.name} ({p.price} ج.م / شهر)</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>مدة التمديد بالأيام</label>
              <select
                className="form-input"
                value={subAssignModal.extendDays}
                onChange={(e) => setSubAssignModal({ ...subAssignModal, extendDays: e.target.value })}
                style={{ width: '100%' }}
              >
                <option value="30">٣٠ يوماً (شهر واحد)</option>
                <option value="90">٩٠ يوماً (٣ أشهر)</option>
                <option value="180">١٨٠ يوماً (٦ أشهر)</option>
                <option value="365">٣٦٥ يوماً (سنة كاملة)</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
              <button type="button" className="btn secondary" onClick={() => setSubAssignModal({ isOpen: false, doctor: null, planId: 1, extendDays: 30 })}>إلغاء</button>
              <button type="submit" className="btn primary" style={{ fontWeight: 700 }}>تأكيد التمديد وتحديث الباقة</button>
            </div>
          </form>
        </Modal>
      )}

      {/* SPECIALTY MODAL */}
      {specialtyModal.isOpen && (
        <Modal
          isOpen={true}
          title="إضافة تخصص طبي جديد"
          onClose={() => setSpecialtyModal({ isOpen: false, form: { name: '', icon: 'spark', description: '' } })}
        >
          <form onSubmit={handleAddSpecialtySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>اسم التخصص *</label>
              <input
                type="text"
                className="form-input"
                required
                placeholder="جراحة المخ والأعصاب"
                value={specialtyModal.form.name}
                onChange={(e) => setSpecialtyModal({ ...specialtyModal, form: { ...specialtyModal.form, name: e.target.value } })}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>الوصف المختصر</label>
              <input
                type="text"
                className="form-input"
                placeholder="تشخيص وجراحة أمراض الجهاز العصبي والعمود الفقري"
                value={specialtyModal.form.description}
                onChange={(e) => setSpecialtyModal({ ...specialtyModal, form: { ...specialtyModal.form, description: e.target.value } })}
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
              <button type="button" className="btn secondary" onClick={() => setSpecialtyModal({ isOpen: false, form: { name: '', icon: 'spark', description: '' } })}>إلغاء</button>
              <button type="submit" className="btn primary" style={{ fontWeight: 700 }}>حفظ التخصص</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
