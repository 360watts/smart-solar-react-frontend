import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Pencil, Trash2, X, UserPlus, AlertTriangle } from 'lucide-react';
import { apiService } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import AuditTrail from './AuditTrail';

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
  date_joined: string;
  created_by_username?: string;
  created_at?: string;
  updated_by_username?: string;
  updated_at?: string;
}

const Employees: React.FC = () => {
  const { isDark } = useTheme();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ show: boolean; employee: Employee | null }>({ show: false, employee: null });
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [creatingEmployee, setCreatingEmployee] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    mobile_number: '',
    address: '',
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

  useEffect(() => {
    fetchEmployees();
  }, []);

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchEmployees(debouncedSearchTerm);
  }, [debouncedSearchTerm]);

  const fetchEmployees = async (search?: string) => {
    try {
      const response = await apiService.getEmployees(search);
      const staffData = response.results ?? [];
      setEmployees(staffData);
      setFilteredEmployees(staffData);
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
    });
  };

  const handleSave = async () => {
    if (!editingEmployee) return;

    try {
      await apiService.updateUser(editingEmployee.id, editForm);
      setEditingEmployee(null);
      // Refetch to get the updated employee with audit trail fields
      await fetchEmployees(searchTerm);
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
      await fetchEmployees(searchTerm);
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
          <h2>Employees ({filteredEmployees.length})</h2>
          <div className="card-actions">
            <input
              type="text"
              placeholder="Search employees..."
              value={searchTerm}
              onChange={handleSearch}
              className="search-input"
            />
            <button onClick={() => setCreatingEmployee(true)} className="btn">
              Add New Employee
            </button>
          </div>
        </div>
        <div className="table-responsive"><table className="table">
          <thead>
            <tr>
              <th style={{ textAlign: 'center' }}>Name</th>
              <th style={{ textAlign: 'center' }}>Username</th>
              <th style={{ textAlign: 'center' }}>Email</th>
              <th style={{ textAlign: 'center' }}>Mobile</th>
              <th style={{ textAlign: 'center' }}>Joined</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map((employee) => (
                <tr key={employee.id}>
                <td style={{ textAlign: 'center' }}>{employee.first_name} {employee.last_name}</td>
                <td style={{ textAlign: 'center' }}>{employee.username}</td>
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
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
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
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
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
