import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Edit2, Menu, Plus, Search, Trash2 } from 'lucide-react';
import finalLogo from '../../../assets/finalLogo.png';
import { apiService } from '../../../services/api';
import { useTheme } from '../../../contexts/ThemeContext';
import { getDesignTokens } from '../../../shared/theme';

interface Department {
  id: number;
  name: string;
  slug: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

interface DepartmentFormState {
  name: string;
  slug: string;
  description: string;
  is_active: boolean;
}

const initialForm: DepartmentFormState = {
  name: '',
  slug: '',
  description: '',
  is_active: true,
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const formatDate = (value?: string) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const MobileDepartments: React.FC = () => {
  const { isDark } = useTheme();
  const tokens = getDesignTokens(isDark);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [form, setForm] = useState<DepartmentFormState>(initialForm);

  const fetchDepartments = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getDepartments();
      setDepartments(Array.isArray(response.results) ? response.results : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load departments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return departments;
    return departments.filter((department) =>
      [department.name, department.slug, department.description ?? '']
        .some((value) => value.toLowerCase().includes(term))
    );
  }, [departments, search]);

  const stats = useMemo(() => ({
    total: departments.length,
    active: departments.filter((department) => department.is_active).length,
    inactive: departments.filter((department) => !department.is_active).length,
  }), [departments]);

  const openCreate = () => {
    setEditingDepartment(null);
    setForm(initialForm);
    setSlugTouched(false);
    setFormOpen(true);
    setError(null);
  };

  const openEdit = (department: Department) => {
    setEditingDepartment(department);
    setForm({
      name: department.name,
      slug: department.slug,
      description: department.description ?? '',
      is_active: department.is_active,
    });
    setSlugTouched(true);
    setFormOpen(true);
    setError(null);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingDepartment(null);
    setForm(initialForm);
    setSlugTouched(false);
  };

  const handleFormChange = <K extends keyof DepartmentFormState>(field: K, value: DepartmentFormState[K]) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'name' && !slugTouched) {
        next.slug = slugify(String(value));
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.slug.trim()) {
      setError('Department name and slug are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        slug: slugify(form.slug),
        description: form.description.trim() || undefined,
        is_active: form.is_active,
      };

      if (editingDepartment) {
        await apiService.updateDepartment(editingDepartment.id, payload);
      } else {
        await apiService.createDepartment({
          name: payload.name,
          slug: payload.slug,
          description: payload.description,
        });
      }

      closeForm();
      await fetchDepartments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save department');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    setError(null);
    try {
      await apiService.deleteDepartment(deleteTarget.id);
      setDeleteTarget(null);
      await fetchDepartments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete department');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: tokens.pageBg, minHeight: '100dvh', paddingBottom: 72 }}>
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        padding: '12px 16px 14px',
        background: isDark ? 'rgba(7,9,15,0.92)' : 'rgba(244,246,248,0.94)',
        borderBottom: `1px solid ${tokens.border}`,
        backdropFilter: 'blur(18px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: tokens.primarySoft,
              border: `1px solid ${tokens.border}`,
              boxShadow: tokens.shadow,
            }}>
              <img src={finalLogo} alt="360Watts" style={{ width: 36, height: 36, objectFit: 'contain' }} />
            </div>
            <span style={{ fontSize: '0.88rem', fontWeight: 800, color: tokens.text, fontFamily: "'Outfit', sans-serif" }}>
              360Watts
            </span>
          </div>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-mobile-menu'))}
            style={{
              background: tokens.primarySoft,
              border: `1px solid ${tokens.border}`,
              borderRadius: 9,
              cursor: 'pointer',
              color: tokens.primary,
              padding: 6,
              display: 'flex',
            }}
          >
            <Menu size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: '0.62rem', color: tokens.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Departments
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: tokens.text, marginTop: 2, fontFamily: "'Outfit', sans-serif" }}>
              {stats.total} teams configured
            </div>
          </div>

          <button
            onClick={openCreate}
            style={{
              background: tokens.primary,
              color: tokens.textInverse,
              border: 'none',
              borderRadius: 10,
              padding: '8px 12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Plus size={14} />
            Add
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          {[
            { label: 'Total', value: stats.total, color: tokens.text, bg: tokens.surfaceMuted },
            { label: 'Active', value: stats.active, color: tokens.success, bg: tokens.successSoft },
            { label: 'Inactive', value: stats.inactive, color: tokens.warning, bg: tokens.warningSoft },
          ].map((item) => (
            <div key={item.label} style={{ background: item.bg, border: `1px solid ${tokens.border}`, borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: item.color, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                {item.value}
              </div>
              <div style={{ marginTop: 2, fontSize: '0.58rem', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '12px 12px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {error && (
          <div style={{
            background: tokens.dangerSoft,
            border: `1px solid ${tokens.danger}`,
            color: tokens.danger,
            borderRadius: 14,
            padding: '12px 14px',
            fontSize: '0.82rem',
            fontWeight: 600,
          }}>
            {error}
          </div>
        )}

        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          height: 42,
          padding: '0 12px',
          background: tokens.surface,
          border: `1px solid ${tokens.border}`,
          borderRadius: 12,
        }}>
          <Search size={14} color={tokens.textMuted} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search departments…"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: tokens.text,
              fontSize: '0.84rem',
            }}
          />
        </label>

        {loading ? (
          <div style={{ color: tokens.textMuted, textAlign: 'center', padding: '28px 10px' }}>Loading departments…</div>
        ) : filtered.length === 0 ? (
          <div style={{
            background: tokens.surface,
            border: `1px solid ${tokens.border}`,
            borderRadius: 18,
            padding: '28px 18px',
            textAlign: 'center',
            color: tokens.textMuted,
          }}>
            <Building2 size={20} style={{ marginBottom: 8 }} />
            <div style={{ color: tokens.text, fontWeight: 700, marginBottom: 4 }}>No departments found</div>
            <div style={{ fontSize: '0.8rem' }}>Create a department or refine the search.</div>
          </div>
        ) : (
          filtered.map((department) => (
            <div key={department.id} style={{
              background: tokens.surface,
              border: `1px solid ${tokens.border}`,
              borderRadius: 18,
              padding: 14,
              boxShadow: tokens.shadow,
            }}>
              <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: tokens.text }}>{department.name}</div>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: 999,
                      background: department.is_active ? tokens.successSoft : tokens.warningSoft,
                      color: department.is_active ? tokens.success : tokens.warning,
                      fontSize: '0.66rem',
                      fontWeight: 700,
                    }}>
                      {department.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div style={{ marginTop: 6, color: tokens.textMuted, fontSize: '0.74rem', fontFamily: 'var(--font-mono)' }}>
                    {department.slug}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => openEdit(department)} style={iconButtonStyle(tokens)} aria-label={`Edit ${department.name}`}>
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(department)}
                    style={{ ...iconButtonStyle(tokens), background: tokens.dangerSoft, border: `1px solid ${tokens.danger}`, color: tokens.danger }}
                    aria-label={`Delete ${department.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 12, color: department.description ? tokens.textDim : tokens.textMuted, fontSize: '0.8rem', lineHeight: 1.55 }}>
                {department.description || 'No description added yet.'}
              </div>

              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ fontSize: '0.72rem', color: tokens.textMuted }}>Created</div>
                <div style={{ fontSize: '0.74rem', color: tokens.text, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatDate(department.created_at)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {(formOpen || deleteTarget) && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 40,
          background: isDark ? 'rgba(0,0,0,0.78)' : 'rgba(18,21,26,0.46)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'flex-end',
        }}>
          <div style={{
            width: '100%',
            background: tokens.surfaceRaised,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            border: `1px solid ${tokens.border}`,
            borderBottom: 'none',
            padding: '18px 16px 24px',
          }}>
            {deleteTarget ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: tokens.text }}>Delete department?</div>
                  <div style={{ marginTop: 6, color: tokens.textDim, fontSize: '0.82rem', lineHeight: 1.5 }}>
                    Remove <strong style={{ color: tokens.text }}>{deleteTarget.name}</strong>. This action cannot be undone.
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button onClick={() => setDeleteTarget(null)} style={mobileSecondaryButton(tokens)}>Cancel</button>
                  <button onClick={handleDelete} disabled={saving} style={mobileDangerButton(tokens)}>
                    {saving ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: tokens.text }}>
                    {editingDepartment ? 'Edit department' : 'Create department'}
                  </div>
                  <div style={{ marginTop: 4, color: tokens.textMuted, fontSize: '0.8rem' }}>
                    Keep team ownership clear for employees and workflows.
                  </div>
                </div>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: tokens.text }}>Name</span>
                  <input value={form.name} onChange={(event) => handleFormChange('name', event.target.value)} style={mobileInput(tokens)} />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: tokens.text }}>Slug</span>
                  <input
                    value={form.slug}
                    onChange={(event) => {
                      setSlugTouched(true);
                      handleFormChange('slug', slugify(event.target.value));
                    }}
                    style={{ ...mobileInput(tokens), fontFamily: 'var(--font-mono)' }}
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: tokens.text }}>Description</span>
                  <textarea
                    value={form.description}
                    onChange={(event) => handleFormChange('description', event.target.value)}
                    rows={4}
                    style={{ ...mobileInput(tokens), minHeight: 104, height: 'auto', paddingTop: 12, paddingBottom: 12, resize: 'vertical' }}
                  />
                </label>

                {editingDepartment && (
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: tokens.text, fontSize: '0.82rem', fontWeight: 600 }}>
                    <input type="checkbox" checked={form.is_active} onChange={(event) => handleFormChange('is_active', event.target.checked)} />
                    Active department
                  </label>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button onClick={closeForm} style={mobileSecondaryButton(tokens)}>Cancel</button>
                  <button onClick={handleSave} disabled={saving} style={mobilePrimaryButton(tokens)}>
                    {saving ? 'Saving…' : editingDepartment ? 'Save' : 'Create'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const iconButtonStyle = (tokens: ReturnType<typeof getDesignTokens>): React.CSSProperties => ({
  width: 34,
  height: 34,
  borderRadius: 10,
  border: `1px solid ${tokens.border}`,
  background: tokens.surfaceMuted,
  color: tokens.text,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
});

const mobileInput = (tokens: ReturnType<typeof getDesignTokens>): React.CSSProperties => ({
  width: '100%',
  boxSizing: 'border-box',
  height: 42,
  borderRadius: 12,
  border: `1px solid ${tokens.border}`,
  background: tokens.surfaceMuted,
  color: tokens.text,
  padding: '0 12px',
  outline: 'none',
  fontSize: '0.84rem',
});

const mobilePrimaryButton = (tokens: ReturnType<typeof getDesignTokens>): React.CSSProperties => ({
  height: 42,
  borderRadius: 12,
  border: `1px solid ${tokens.primary}`,
  background: tokens.primary,
  color: tokens.textInverse,
  fontWeight: 700,
  cursor: 'pointer',
});

const mobileSecondaryButton = (tokens: ReturnType<typeof getDesignTokens>): React.CSSProperties => ({
  height: 42,
  borderRadius: 12,
  border: `1px solid ${tokens.border}`,
  background: tokens.surfaceMuted,
  color: tokens.text,
  fontWeight: 700,
  cursor: 'pointer',
});

const mobileDangerButton = (tokens: ReturnType<typeof getDesignTokens>): React.CSSProperties => ({
  ...mobilePrimaryButton(tokens),
  border: `1px solid ${tokens.danger}`,
  background: tokens.danger,
});

export default MobileDepartments;
