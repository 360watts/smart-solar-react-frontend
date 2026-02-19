import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
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
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      const data = await apiService.getUsers(search);
      // Filter only staff users (employees) but exclude superusers/admins
      const staffData = data.filter((user: any) => user.is_staff && !user.is_superuser);
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

  const handleDelete = async (employee: Employee) => {
    if (window.confirm(`Are you sure you want to delete employee ${employee.username}?`)) {
      try {
        await apiService.deleteUser(employee.id);
        setEmployees(employees.filter(e => e.id !== employee.id));
        setFilteredEmployees(filteredEmployees.filter(e => e.id !== employee.id));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete employee');
      }
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
        <table className="table">
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
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                  <button onClick={() => handleDelete(employee)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', margin: '0 6px' }} title="Delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3,6 5,6 21,6"></polyline>
                      <path d="M19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"></path>
                      <line x1="10" y1="11" x2="10" y2="17"></line>
                      <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(editingEmployee || creatingEmployee) && (
        <div className="modal">
          <div className="modal-content">
            <h3>{editingEmployee ? `Edit Employee: ${editingEmployee.username}` : 'Add New Employee'}</h3>
            <form onSubmit={(e) => { e.preventDefault(); editingEmployee ? handleSave() : handleCreate(); }}>
              <div className="modal-body">
                
                {/* Account Section */}
                <div className="form-section">
                   <h4 className="form-section-title">Account Information</h4>
                   <div className="form-grid"> 
                    {creatingEmployee && (
                      <>
                        <input type="text" autoComplete="username" style={{display: 'none'}} />
                        <input type="password" autoComplete="current-password" style={{display: 'none'}} />
                        <div className="form-group">
                          <label>Username</label>
                          <input
                            type="text"
                            value={createForm.username}
                            onChange={(e) => setCreateForm({...createForm, username: e.target.value})}
                            required
                            autoComplete="off"
                            placeholder="jdoe"
                          />
                        </div>
                        <div className="form-group">
                          <label>Password</label>
                          <input
                            type="password"
                            value={createForm.password}
                            onChange={(e) => setCreateForm({...createForm, password: e.target.value})}
                            required
                            autoComplete="new-password"
                            placeholder="••••••••"
                          />
                        </div>
                      </>
                    )}
                    <div className="form-group">
                       <label>Email Address</label>
                       <input
                         type="email"
                         value={editingEmployee ? editForm.email : createForm.email}
                         onChange={(e) => editingEmployee ? setEditForm({...editForm, email: e.target.value}) : setCreateForm({...createForm, email: e.target.value})}
                         required
                         autoComplete="off"
                         placeholder="john.doe@example.com"
                       />
                     </div>
                   </div>
                </div>

                {/* Personal Section */}
                <div className="form-section">
                  <h4 className="form-section-title">Personal Details</h4>
                  <div className="form-grid form-grid-2">
                    <div className="form-group">
                      <label>First Name</label>
                      <input
                        type="text"
                        value={editingEmployee ? editForm.first_name : createForm.first_name}
                        onChange={(e) => editingEmployee ? setEditForm({...editForm, first_name: e.target.value}) : setCreateForm({...createForm, first_name: e.target.value})}
                        required
                        autoComplete="off"
                        placeholder="John"
                      />
                    </div>
                    <div className="form-group">
                      <label>Last Name</label>
                      <input
                        type="text"
                        value={editingEmployee ? editForm.last_name : createForm.last_name}
                        onChange={(e) => editingEmployee ? setEditForm({...editForm, last_name: e.target.value}) : setCreateForm({...createForm, last_name: e.target.value})}
                        required
                        autoComplete="off"
                        placeholder="Doe"
                      />
                    </div>
                  </div>
                </div>

                {/* Contact Section */}
                <div className="form-section">
                  <h4 className="form-section-title">Contact Information</h4>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Mobile Number</label>
                      <input
                        type="tel"
                        value={editingEmployee ? editForm.mobile_number : createForm.mobile_number}
                        onChange={(e) => editingEmployee ? setEditForm({...editForm, mobile_number: e.target.value}) : setCreateForm({...createForm, mobile_number: e.target.value})}
                        autoComplete="off"
                        placeholder="+1 (555) 000-0000"
                      />
                    </div>
                    <div className="form-group">
                      <label>Address</label>
                      <textarea
                        value={editingEmployee ? editForm.address : createForm.address}
                        onChange={(e) => editingEmployee ? setEditForm({...editForm, address: e.target.value}) : setCreateForm({...createForm, address: e.target.value})}
                        autoComplete="off"
                        rows={3}
                        placeholder="123 Solar Street..."
                      />
                    </div>
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
              <div className="form-actions">
                <button type="submit" className="btn">{editingEmployee ? 'Save' : 'Create'}</button>
                <button type="button" onClick={handleCancel} className="btn btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Employees;
