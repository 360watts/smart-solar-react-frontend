import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Pencil, Trash2, X, UserPlus, AlertTriangle, Users as UsersIcon, ShieldCheck, ShieldOff } from 'lucide-react';
import { apiService } from '../services/api';
import { cacheService } from '../services/cacheService';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import AuditTrail from './AuditTrail';
import { DEFAULT_PAGE_SIZE } from '../constants';

// ── Avatar helpers ────────────────────────────────────────────────────────────
const EMP_AVATAR_COLORS = [
  'linear-gradient(135deg,#6366f1,#8b5cf6)',
  'linear-gradient(135deg,#10b981,#059669)',
  'linear-gradient(135deg,#f59e0b,#d97706)',
  'linear-gradient(135deg,#3b82f6,#1d4ed8)',
  'linear-gradient(135deg,#ec4899,#be185d)',
  'linear-gradient(135deg,#14b8a6,#0f766e)',
];
const empAvatarColor = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return EMP_AVATAR_COLORS[Math.abs(h) % EMP_AVATAR_COLORS.length];
};
const empInitials = (first: string, last: string, username: string) => {
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first) return first.substring(0, 2).toUpperCase();
  return username.substring(0, 2).toUpperCase();
};

interface Employee {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  mobile_number?: string;
  address?: string;
  is_staff: boolean;
  is_superuser: boolean;
  is_active: boolean;
  date_joined: string;
  created_by_username?: string;
  created_at?: string;
  updated_by_username?: string;
  updated_at?: string;
}

const Employees: React.FC = () => {
  const { isDark } = useTheme();
  const { isAdmin, user: currentUser } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ show: boolean; employee: Employee | null }>({ show: false, employee: null });
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [creatingEmployee, setCreatingEmployee] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    mobile_number: '',
    address: '',
    is_active: true,
    is_staff: true,
    is_superuser: false,
  });
  const [createForm, setCreateForm] = useState({
    username: '',
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    mobile_number: '',
    address: '',
    is_staff: true,
  });

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Bust cache on mount so is_active field is always fresh
  useEffect(() => {
    cacheService.clearPattern(/^employees_/);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchEmployees(debouncedSearchTerm, currentPage, pageSize);
  }, [debouncedSearchTerm, currentPage, pageSize]);

  const fetchEmployees = async (search?: string, page = 1, size = DEFAULT_PAGE_SIZE) => {
    setLoading(true);
    try {
      const response = await apiService.getEmployees(search, page, size);
      const staffData = response.results ?? [];
      setEmployees(staffData);
      setFilteredEmployees(staffData);
      setTotalCount(response.count ?? 0);
      setTotalPages(response.total_pages ?? 0);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setEditForm({
      first_name: employee.first_name,
      last_name: employee.last_name,
      email: employee.email,
      mobile_number: employee.mobile_number || '',
      address: employee.address || '',
      is_active: employee.is_active ?? true,
      is_staff: employee.is_staff,
      is_superuser: employee.is_superuser,
    });
  };

  const handleSave = async () => {
    if (!editingEmployee) return;

    try {
      await apiService.updateUser(editingEmployee.id, editForm);
      setEditingEmployee(null);
      await fetchEmployees(searchTerm, currentPage, pageSize);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update employee');
    }
  };

  const handleCreate = async () => {
    try {
      await apiService.createEmployee(createForm);
      setCreatingEmployee(false);
      setCreateForm({
        username: '',
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        mobile_number: '',
        address: '',
        is_staff: true,
      });
      // Refetch to get the new employee with all fields including audit trail
      await fetchEmployees(searchTerm, currentPage, pageSize);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create employee');
    }
  };

  const handleDelete = (employee: Employee) => {
    setDeleteConfirmModal({ show: true, employee });
  };

  const confirmDeleteEmployee = async () => {
    if (!deleteConfirmModal.employee) return;
    try {
      await apiService.deleteUser(deleteConfirmModal.employee.id);
      setEmployees(employees.filter(e => e.id !== deleteConfirmModal.employee!.id));
      setFilteredEmployees(filteredEmployees.filter(e => e.id !== deleteConfirmModal.employee!.id));
      setDeleteConfirmModal({ show: false, employee: null });
    } catch (err) {
      setDeleteConfirmModal({ show: false, employee: null });
      setError(err instanceof Error ? err.message : 'Failed to delete employee');
    }
  };

  const handleCancel = () => {
    setEditingEmployee(null);
    setCreatingEmployee(false);
  };

  if (loading) {
    return <div className="loading">Loading employees...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div>
      <h1>Employee Management</h1>

      <div className="card">
        <div className="card-header">
          <h2>Employees</h2>
          <div className="card-actions">
            <input
              type="text"
              placeholder="Search employees..."
              value={searchTerm}
              onChange={handleSearch}
              className="search-input"
            />
            <button onClick={() => setCreatingEmployee(true)} className="btn">
              <UserPlus size={15} style={{ marginRight: 6 }} />
              Add New Employee
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="stats-chips-row">
          <div className="stats-chip">
            <UsersIcon size={13} />
            <span className="stats-chip-count">{filteredEmployees.filter(e => e.is_superuser).length}</span>
            <span>Admins</span>
          </div>
          <div className="stats-chip">
            <UsersIcon size={13} />
            <span className="stats-chip-count">{filteredEmployees.filter(e => !e.is_superuser && e.is_staff).length}</span>
            <span>Staff</span>
          </div>
        </div>

        <div className="table-responsive"><table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th style={{ textAlign: 'center' }}>Role</th>
              <th style={{ textAlign: 'center' }}>Status</th>
              <th style={{ textAlign: 'center' }}>Email</th>
              <th style={{ textAlign: 'center' }}>Mobile</th>
              <th style={{ textAlign: 'center' }}>Joined</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map((employee) => (
                <tr key={employee.id}>
                <td>
                  <div className="table-avatar-cell">
                    <div
                      className="avatar-initials avatar-initials-sm"
                      style={{ background: empAvatarColor(employee.username) }}
                    >
                      {empInitials(employee.first_name, employee.last_name, employee.username)}
                    </div>
                    <div className="table-name-block">
                      <span className="table-name-primary">{employee.first_name} {employee.last_name}</span>
                      <span className="table-name-secondary">@{employee.username}</span>
                    </div>
                  </div>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <span className={`role-badge ${employee.is_superuser ? 'role-badge-admin' : 'role-badge-staff'}`}>
                    {employee.is_superuser ? 'Admin' : 'Staff'}
                  </span>
                </td>
                <td style={{ textAlign: 'center' }}>
                  {(() => {
                    const active = employee.is_active !== false;
                    return (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                        background: active ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                        color: active ? '#10b981' : '#ef4444',
                        border: `1px solid ${active ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
                        {active ? 'Active' : 'Inactive'}
                      </span>
                    );
                  })()}
                </td>
                <td style={{ textAlign: 'center' }}>{employee.email}</td>
                <td style={{ textAlign: 'center' }}>{employee.mobile_number || '-'}</td>
                <td style={{ textAlign: 'center' }}>
                  {(() => {
                    if (!employee.date_joined) return 'N/A';
                    const date = new Date(employee.date_joined);
                    return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleDateString();
                  })()}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <button onClick={() => handleEdit(employee)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', margin: '0 6px' }} title="Edit">
                    <Pencil size={16} strokeWidth={2} />
                  </button>
                  <button onClick={() => handleDelete(employee)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', margin: '0 6px' }} title="Delete">
                    <Trash2 size={16} strokeWidth={2} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>

        {/* Pagination */}
        {totalCount > 0 && (
          <div className="pagination-bar" style={{ padding: '16px', borderTop: '1px solid var(--border-color)', gap: '16px' }}>
            <div className="pagination-info" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Showing {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, totalCount)} of {totalCount} employees
            </div>
            <div className="pagination-controls">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                style={{ padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '6px', background: currentPage === 1 ? 'rgba(148,163,184,0.1)' : 'transparent', color: 'var(--text-primary)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? '0.5' : '1' }}
              >← Previous</button>
              <div className="pagination-pages">
                {(() => {
                  const pages: React.ReactNode[] = [];
                  let lastWasEllipsis = false;
                  for (let i = 1; i <= totalPages; i++) {
                    const show = i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1;
                    if (show) {
                      lastWasEllipsis = false;
                      pages.push(
                        <button key={i} onClick={() => setCurrentPage(i)} style={{ padding: '6px 10px', border: '1px solid var(--border-color)', borderRadius: '4px', background: i === currentPage ? 'rgba(99,102,241,0.2)' : 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: i === currentPage ? 'bold' : 'normal', minWidth: '32px' }}>{i}</button>
                      );
                    } else if (!lastWasEllipsis) {
                      lastWasEllipsis = true;
                      pages.push(<span key={`e${i}`} style={{ padding: '0 4px', color: 'var(--text-muted)' }}>…</span>);
                    }
                  }
                  return pages;
                })()}
              </div>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                style={{ padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '6px', background: currentPage === totalPages ? 'rgba(148,163,184,0.1)' : 'transparent', color: 'var(--text-primary)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? '0.5' : '1' }}
              >Next →</button>
            </div>
            <select
              className="pagination-size-select"
              value={pageSize}
              onChange={(e) => { setPageSize(parseInt(e.target.value)); setCurrentPage(1); }}
              style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.875rem', cursor: 'pointer' }}
            >
              {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n} per page</option>)}
            </select>
          </div>
        )}
      </div>

      {(editingEmployee || creatingEmployee) && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '20px',
        }} onClick={handleCancel}>
          <div style={{
            background: isDark ? '#1a1a1a' : '#ffffff',
            borderRadius: 16,
            boxShadow: isDark
              ? '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)'
              : '0 25px 50px -12px rgba(0,0,0,0.25)',
            maxWidth: '600px', width: '100%',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '24px 28px',
              borderBottom: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                  background: editingEmployee ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'linear-gradient(135deg, #10b981, #059669)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: editingEmployee ? '0 4px 14px rgba(99,102,241,0.4)' : '0 4px 14px rgba(16,185,129,0.4)',
                }}>
                  {editingEmployee ? <Pencil size={22} color="white" /> : <UserPlus size={22} color="white" />}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.125rem', color: isDark ? '#f9fafb' : '#111827' }}>
                    {editingEmployee ? `Edit Employee: ${editingEmployee.username}` : 'Add New Employee'}
                  </div>
                  <div style={{ fontSize: '0.813rem', color: isDark ? '#9ca3af' : '#6b7280', marginTop: 2 }}>
                    {editingEmployee ? 'Update employee account details' : 'Create a new employee account'}
                  </div>
                </div>
              </div>
              <button type="button" onClick={handleCancel} style={{
                width: 40, height: 40, borderRadius: 10, border: 'none',
                background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                color: isDark ? '#9ca3af' : '#6b7280', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); editingEmployee ? handleSave() : handleCreate(); }} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

                {/* Account Information */}
                <div style={{
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                  borderRadius: 12, padding: '20px', marginBottom: 16,
                  border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 4, height: 20, borderRadius: 3, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.813rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#a5b4fc' : '#6366f1' }}>Account Information</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <input type="text" autoComplete="username" style={{ display: 'none' }} />
                    <input type="password" autoComplete="current-password" style={{ display: 'none' }} />
                    {creatingEmployee && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Username</label>
                          <input
                            type="text"
                            value={createForm.username}
                            onChange={(e) => setCreateForm({...createForm, username: e.target.value})}
                            required autoComplete="off" placeholder="jdoe"
                            style={{ padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb', background: isDark ? '#2a2a2a' : '#ffffff', color: isDark ? '#f3f4f6' : '#111827', fontSize: '0.875rem' }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Password</label>
                          <input
                            type="password"
                            value={createForm.password}
                            onChange={(e) => setCreateForm({...createForm, password: e.target.value})}
                            required autoComplete="new-password" placeholder="••••••••"
                            style={{ padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb', background: isDark ? '#2a2a2a' : '#ffffff', color: isDark ? '#f3f4f6' : '#111827', fontSize: '0.875rem' }}
                          />
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Email Address</label>
                      <input
                        type="email"
                        value={editingEmployee ? editForm.email : createForm.email}
                        onChange={(e) => editingEmployee ? setEditForm({...editForm, email: e.target.value}) : setCreateForm({...createForm, email: e.target.value})}
                        required autoComplete="off" placeholder="john.doe@example.com"
                        style={{ padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb', background: isDark ? '#2a2a2a' : '#ffffff', color: isDark ? '#f3f4f6' : '#111827', fontSize: '0.875rem' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Personal Details */}
                <div style={{
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                  borderRadius: 12, padding: '20px', marginBottom: 16,
                  border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 4, height: 20, borderRadius: 3, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.813rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#a5b4fc' : '#6366f1' }}>Personal Details</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>First Name</label>
                      <input
                        type="text"
                        value={editingEmployee ? editForm.first_name : createForm.first_name}
                        onChange={(e) => editingEmployee ? setEditForm({...editForm, first_name: e.target.value}) : setCreateForm({...createForm, first_name: e.target.value})}
                        required autoComplete="off" placeholder="John"
                        style={{ padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb', background: isDark ? '#2a2a2a' : '#ffffff', color: isDark ? '#f3f4f6' : '#111827', fontSize: '0.875rem' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Last Name</label>
                      <input
                        type="text"
                        value={editingEmployee ? editForm.last_name : createForm.last_name}
                        onChange={(e) => editingEmployee ? setEditForm({...editForm, last_name: e.target.value}) : setCreateForm({...createForm, last_name: e.target.value})}
                        required autoComplete="off" placeholder="Doe"
                        style={{ padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb', background: isDark ? '#2a2a2a' : '#ffffff', color: isDark ? '#f3f4f6' : '#111827', fontSize: '0.875rem' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div style={{
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                  borderRadius: 12, padding: '20px', marginBottom: 16,
                  border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 4, height: 20, borderRadius: 3, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.813rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#a5b4fc' : '#6366f1' }}>Contact Information</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Mobile Number</label>
                      <input
                        type="tel"
                        value={editingEmployee ? editForm.mobile_number : createForm.mobile_number}
                        onChange={(e) => editingEmployee ? setEditForm({...editForm, mobile_number: e.target.value}) : setCreateForm({...createForm, mobile_number: e.target.value})}
                        autoComplete="off" placeholder="+1 (555) 000-0000"
                        style={{ padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb', background: isDark ? '#2a2a2a' : '#ffffff', color: isDark ? '#f3f4f6' : '#111827', fontSize: '0.875rem' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>Address</label>
                      <textarea
                        value={editingEmployee ? editForm.address : createForm.address}
                        onChange={(e) => editingEmployee ? setEditForm({...editForm, address: e.target.value}) : setCreateForm({...createForm, address: e.target.value})}
                        autoComplete="off" rows={3} placeholder="123 Solar Street..."
                        style={{ padding: '10px 12px', borderRadius: 8, width: '100%', boxSizing: 'border-box', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb', background: isDark ? '#2a2a2a' : '#ffffff', color: isDark ? '#f3f4f6' : '#111827', fontSize: '0.875rem', resize: 'vertical' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Role & Status — admin only, edit only */}
                {editingEmployee && isAdmin && editingEmployee.id !== currentUser?.id && (
                  <div style={{
                    background: isDark ? 'rgba(99,102,241,0.06)' : 'rgba(99,102,241,0.04)',
                    borderRadius: 12, padding: '20px', marginBottom: 16,
                    border: isDark ? '1px solid rgba(99,102,241,0.18)' : '1px solid rgba(99,102,241,0.18)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                      <div style={{ width: 4, height: 20, borderRadius: 3, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.813rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#a5b4fc' : '#6366f1' }}>Role &amp; Status</span>
                      <span style={{ marginLeft: 'auto', fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'rgba(99,102,241,0.15)', color: isDark ? '#a5b4fc' : '#4f46e5' }}>Admin only</span>
                    </div>

                    {/* Active / Inactive toggle */}
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151', display: 'block', marginBottom: 8 }}>Account Status</label>
                      <div style={{ display: 'flex', gap: 10 }}>
                        {[{ val: true, label: 'Active', icon: <ShieldCheck size={14} />, green: true }, { val: false, label: 'Inactive', icon: <ShieldOff size={14} />, green: false }].map(({ val, label, icon, green }) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => setEditForm({ ...editForm, is_active: val })}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 6,
                              padding: '8px 16px', borderRadius: 8, fontSize: '0.875rem', fontWeight: 600,
                              cursor: 'pointer',
                              border: editForm.is_active === val
                                ? `2px solid ${green ? '#10b981' : '#ef4444'}`
                                : `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'}`,
                              background: editForm.is_active === val
                                ? (green ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)')
                                : (isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb'),
                              color: editForm.is_active === val
                                ? (green ? '#10b981' : '#ef4444')
                                : (isDark ? '#9ca3af' : '#6b7280'),
                            }}
                          >
                            {icon}{label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Role selector */}
                    <div>
                      <label style={{ fontSize: '0.813rem', fontWeight: 600, color: isDark ? '#d1d5db' : '#374151', display: 'block', marginBottom: 8 }}>Role</label>
                      <div style={{ display: 'flex', gap: 10 }}>
                        {[
                          { label: 'Staff', is_staff: true, is_superuser: false },
                          { label: 'Admin', is_staff: true, is_superuser: true },
                        ].map(({ label, is_staff, is_superuser }) => {
                          const selected = editForm.is_superuser === is_superuser && editForm.is_staff === is_staff;
                          return (
                            <button
                              key={label}
                              type="button"
                              onClick={() => setEditForm({ ...editForm, is_staff, is_superuser })}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '8px 16px', borderRadius: 8, fontSize: '0.875rem', fontWeight: 600,
                                cursor: 'pointer',
                                border: selected
                                  ? '2px solid #6366f1'
                                  : `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'}`,
                                background: selected
                                  ? 'rgba(99,102,241,0.15)'
                                  : (isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb'),
                                color: selected ? '#6366f1' : (isDark ? '#9ca3af' : '#6b7280'),
                              }}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {editingEmployee && (
                  <AuditTrail
                    createdBy={editingEmployee.created_by_username}
                    createdAt={editingEmployee.created_at}
                    updatedBy={editingEmployee.updated_by_username}
                    updatedAt={editingEmployee.updated_at}
                  />
                )}
              </div>

              {/* Footer */}
              <div style={{
                display: 'flex', gap: 10, justifyContent: 'flex-end',
                padding: '16px 28px',
                borderTop: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                flexShrink: 0,
              }}>
                <button type="button" onClick={handleCancel} style={{
                  padding: '10px 20px', borderRadius: 8,
                  border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e5e7eb',
                  background: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb',
                  color: isDark ? '#d1d5db' : '#374151', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                }}>Cancel</button>
                <button type="submit" style={{
                  padding: '10px 20px', borderRadius: 8, border: 'none',
                  background: editingEmployee ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'linear-gradient(135deg, #10b981, #059669)',
                  color: 'white', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                  boxShadow: editingEmployee ? '0 4px 12px rgba(99,102,241,0.35)' : '0 4px 12px rgba(16,185,129,0.35)',
                }}>{editingEmployee ? 'Save Changes' : 'Create Employee'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {deleteConfirmModal.show && deleteConfirmModal.employee && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '20px',
        }} onClick={() => setDeleteConfirmModal({ show: false, employee: null })}>
          <div style={{
            background: isDark ? '#1a1a1a' : '#ffffff',
            borderRadius: 16,
            boxShadow: isDark
              ? '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)'
              : '0 25px 50px -12px rgba(0,0,0,0.25)',
            maxWidth: '420px', width: '100%', overflow: 'hidden',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 24px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0, background: 'linear-gradient(135deg, #dc3545, #c82333)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(220,53,69,0.4)' }}>
                  <AlertTriangle size={22} color="white" />
                </div>
                <span style={{ fontWeight: 700, fontSize: '1.125rem', color: isDark ? '#f9fafb' : '#111827' }}>Delete Employee</span>
              </div>
              <button onClick={() => setDeleteConfirmModal({ show: false, employee: null })} style={{ width: 36, height: 36, borderRadius: 8, border: 'none', background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', color: isDark ? '#9ca3af' : '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <p style={{ color: isDark ? '#d1d5db' : '#374151', lineHeight: 1.6, fontSize: '0.9rem', marginBottom: 12 }}>
                Are you sure you want to permanently delete <strong style={{ color: isDark ? '#f9fafb' : '#111827' }}>{deleteConfirmModal.employee.username}</strong>?
              </p>
              <div style={{ background: isDark ? 'rgba(220,53,69,0.12)' : '#f8d7da', border: isDark ? '1px solid rgba(220,53,69,0.25)' : '1px solid #f5c6cb', borderRadius: 8, padding: '10px 14px', fontSize: '0.875rem', color: isDark ? '#fca5a5' : '#721c24' }}>
                This action cannot be undone.
              </div>
            </div>
            <div style={{ padding: '0 24px 24px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirmModal({ show: false, employee: null })} style={{ padding: '10px 18px', borderRadius: 8, border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e5e7eb', background: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb', color: isDark ? '#d1d5db' : '#374151', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={confirmDeleteEmployee} style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #dc3545, #c82333)', color: 'white', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(220,53,69,0.35)' }}>
                Delete Employee
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Employees;
