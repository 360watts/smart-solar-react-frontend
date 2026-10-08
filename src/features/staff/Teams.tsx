import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import {
  ArrowUpDown,
  Building2,
  ChevronRight,
  FileText,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { apiService } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';
import { useIsMobile } from '../../shared/hooks/useIsMobile';
import MobileTeams from '../mobile/staff/MobileTeams';
import PageHeader from '../../shared/layout/PageHeader';
import { getDesignTokens } from '../../shared/theme';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../shared/ui/sheet';

interface Team {
  id: number;
  name: string;
  slug: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

interface EmployeeTeam {
  id: number;
  name: string;
}

interface Employee {
  id: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  is_active?: boolean;
  team?: EmployeeTeam | null;
}

interface TeamFormState {
  name: string;
  slug: string;
  description: string;
  is_active: boolean;
}

type SortKey = 'name' | 'slug' | 'members' | 'status' | 'created';
type StatusFilter = 'all' | 'active' | 'inactive';

type TeamRow = Team & {
  memberCount: number;
  activeMemberCount: number;
  coverageTone: 'empty' | 'light' | 'full';
};

const initialForm: TeamFormState = {
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
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const fullName = (employee: Employee) => {
  const name = [employee.first_name, employee.last_name].filter(Boolean).join(' ').trim();
  return name || employee.email || `Employee #${employee.id}`;
};

const Teams: React.FC = () => {
  const isMobile = useIsMobile();
  if (isMobile) return <MobileTeams />;

  const { isDark } = useTheme();
  const tokens = getDesignTokens(isDark);
  const [teams, setTeams] = useState<Team[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedTeam, setSelectedTeam] = useState<TeamRow | null>(null);
  const [form, setForm] = useState<TeamFormState>(initialForm);
  const [slugTouched, setSlugTouched] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Team | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const fetchPageData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [teamResponse, employeeResponse] = await Promise.all([
        apiService.getTeams(),
        apiService.getEmployees(undefined, 1, 500),
      ]);
      setTeams(Array.isArray(teamResponse.results) ? teamResponse.results : []);
      setEmployees(Array.isArray(employeeResponse.results) ? employeeResponse.results : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load teams');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPageData();
  }, []);

  const memberMap = useMemo(() => {
    const map = new Map<number, Employee[]>();
    for (const employee of employees) {
      const teamId = employee.team?.id;
      if (!teamId) continue;
      const current = map.get(teamId) ?? [];
      current.push(employee);
      map.set(teamId, current);
    }
    return map;
  }, [employees]);

  const rows = useMemo<TeamRow[]>(() => {
    return teams.map((team) => {
      const teamEmployees = memberMap.get(team.id) ?? [];
      const activeMemberCount = teamEmployees.filter((employee) => employee.is_active !== false).length;
      const memberCount = teamEmployees.length;
      let coverageTone: TeamRow['coverageTone'] = 'empty';
      if (memberCount >= 5) coverageTone = 'full';
      else if (memberCount > 0) coverageTone = 'light';

      return {
        ...team,
        memberCount,
        activeMemberCount,
        coverageTone,
      };
    });
  }, [teams, memberMap]);

  const stats = useMemo(() => {
    const teamsWithMembers = rows.filter((row) => row.memberCount > 0).length;
    const unassignedEmployees = employees.filter((employee) => !employee.team?.id).length;
    return {
      total: rows.length,
      active: rows.filter((row) => row.is_active).length,
      staffed: teamsWithMembers,
      unassignedEmployees,
    };
  }, [employees, rows]);

  const filteredTeams = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = rows.filter((team) => {
      if (statusFilter === 'active' && !team.is_active) return false;
      if (statusFilter === 'inactive' && team.is_active) return false;
      if (!term) return true;
      return [team.name, team.slug, team.description ?? '']
        .some((value) => value.toLowerCase().includes(term));
    });

    const sorted = [...filtered].sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1;
      switch (sortKey) {
        case 'members':
          return (a.memberCount - b.memberCount) * direction;
        case 'status':
          return (Number(a.is_active) - Number(b.is_active)) * direction;
        case 'created':
          return ((new Date(a.created_at).getTime() || 0) - (new Date(b.created_at).getTime() || 0)) * direction;
        case 'slug':
          return a.slug.localeCompare(b.slug) * direction;
        case 'name':
        default:
          return a.name.localeCompare(b.name) * direction;
      }
    });

    return sorted;
  }, [rows, search, statusFilter, sortDirection, sortKey]);

  const selectedIdRef = useRef<number | null>(null);
  useEffect(() => {
    selectedIdRef.current = selectedTeam?.id ?? null;
  }, [selectedTeam]);

  useEffect(() => {
    if (selectedIdRef.current === null) return;
    const next = rows.find((row) => row.id === selectedIdRef.current) ?? null;
    setSelectedTeam(next);
  }, [rows]);

  const openCreate = () => {
    setEditingTeam(null);
    setForm(initialForm);
    setSlugTouched(false);
    setError(null);
    setFormOpen(true);
  };

  const openEdit = (team: Team) => {
    setEditingTeam(team);
    setForm({
      name: team.name,
      slug: team.slug,
      description: team.description ?? '',
      is_active: team.is_active,
    });
    setSlugTouched(true);
    setError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingTeam(null);
    setForm(initialForm);
    setSlugTouched(false);
  };

  const handleFormChange = <K extends keyof TeamFormState>(field: K, value: TeamFormState[K]) => {
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
      setError('Team name and slug are required.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        slug: slugify(form.slug),
        description: form.description.trim(),
        is_active: form.is_active,
      };

      if (editingTeam) {
        await apiService.updateTeam(editingTeam.id, payload);
      } else {
        await apiService.createTeam({
          name: payload.name,
          slug: payload.slug,
          description: payload.description || undefined,
        });
      }

      closeForm();
      await fetchPageData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save team');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    setError(null);
    try {
      await apiService.deleteTeam(deleteTarget.id);
      if (selectedTeam?.id === deleteTarget.id) {
        setSelectedTeam(null);
      }
      setDeleteTarget(null);
      await fetchPageData();
    } catch (err) {
      setDeleteTarget(null);
      setError(err instanceof Error ? err.message : 'Failed to delete team');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (team: Team) => {
    setSaving(true);
    setError(null);
    try {
      await apiService.updateTeam(team.id, {
        name: team.name,
        slug: team.slug,
        description: team.description ?? '',
        is_active: !team.is_active,
      });
      await fetchPageData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update team status');
    } finally {
      setSaving(false);
    }
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection(key === 'created' ? 'desc' : 'asc');
  };

  const deskSurfaceStyle: React.CSSProperties = {
    background: tokens.surface,
    border: `1px solid ${tokens.border}`,
    borderRadius: 24,
    boxShadow: tokens.shadow,
  };

  const statCards = [
    {
      label: 'Teams',
      value: stats.total,
      meta: `${stats.active} active`,
      icon: Building2,
      accent: tokens.primary,
      tint: tokens.primarySoft,
    },
    {
      label: 'Teams with people',
      value: stats.staffed,
      meta: `${stats.total - stats.staffed} without members`,
      icon: Users,
      accent: tokens.info,
      tint: tokens.infoSoft,
    },
    {
      label: 'Unassigned Staff',
      value: stats.unassignedEmployees,
      meta: 'Need a team',
      icon: ShieldCheck,
      accent: tokens.warning,
      tint: tokens.warningSoft,
    },
  ];

  const selectedMembers = selectedTeam ? memberMap.get(selectedTeam.id) ?? [] : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <PageHeader
        title="Teams"
        subtitle="Create teams and see who is on each one."
        rightSlot={(
          <button onClick={openCreate} style={primaryButtonStyle(tokens)}>
            <Plus size={14} />
            Create Team
          </button>
        )}
      />

      {error && (
        <div style={{
          ...deskSurfaceStyle,
          padding: '14px 16px',
          color: tokens.danger,
          background: tokens.dangerSoft,
          borderColor: tokens.danger,
          fontSize: '0.9rem',
          fontWeight: 600,
        }}>
          {error}
        </div>
      )}

      <section style={{
        ...deskSurfaceStyle,
        padding: 22,
        background: isDark
          ? `linear-gradient(135deg, ${tokens.surface} 0%, ${tokens.surfaceRaised} 100%)`
          : `linear-gradient(135deg, ${tokens.surface} 0%, #f8fbf8 62%, #eef8f2 100%)`,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 18, alignItems: 'stretch' }}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 18 }}>
            <div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                borderRadius: 999,
                background: tokens.primarySoft,
                border: `1px solid ${tokens.border}`,
                color: tokens.primary,
                fontSize: '0.72rem',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}>
                Teams
              </div>
              <h2 style={{
                margin: '14px 0 10px',
                fontFamily: "'Outfit', sans-serif",
                fontSize: '2rem',
                lineHeight: 1.02,
                letterSpacing: '-0.04em',
                color: tokens.text,
                maxWidth: 560,
              }}>
                Keep teams up to date so every teammate knows who they work with.
              </h2>
              <p style={{ margin: 0, fontSize: '0.96rem', lineHeight: 1.65, color: tokens.textDim, maxWidth: 620 }}>
                The strongest desktop pattern here is a compact command surface: quick search, fast sorting, visible staffing coverage, and a right-side panel for audit details and ownership edits.
              </p>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <Pill tone="neutral" tokens={tokens}>Searchable directory</Pill>
              <Pill tone="success" tokens={tokens}>Staffing coverage signals</Pill>
              <Pill tone="info" tokens={tokens}>Row details panel</Pill>
            </div>
          </div>

          <div style={{
            borderRadius: 22,
            border: `1px solid ${tokens.border}`,
            background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.86)',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 12,
            padding: 16,
            alignContent: 'start',
          }}>
            {statCards.map(({ label, value, meta, icon: Icon, accent, tint }) => (
              <div key={label} style={{
                borderRadius: 18,
                border: `1px solid ${tokens.border}`,
                background: tint,
                padding: '16px 14px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                  <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: tokens.textMuted, fontWeight: 700 }}>
                    {label}
                  </span>
                  <Icon size={16} color={accent} />
                </div>
                <div style={{ fontSize: '2rem', lineHeight: 1, fontWeight: 800, color: tokens.text, fontVariantNumeric: 'tabular-nums' }}>
                  {value}
                </div>
                <div style={{ marginTop: 8, fontSize: '0.76rem', color: tokens.textDim }}>
                  {meta}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ ...deskSurfaceStyle, overflow: 'hidden' }}>
        <div style={{
          padding: '18px 20px',
          borderBottom: `1px solid ${tokens.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: tokens.text }}>Team Directory</div>
            <div style={{ marginTop: 4, fontSize: '0.84rem', color: tokens.textMuted }}>
              Click a row to inspect staffing, audit timing, and ownership readiness.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <label style={searchShellStyle(tokens)}>
              <Search size={15} color={tokens.textMuted} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, slug, or notes"
                style={searchInputStyle(tokens)}
              />
            </label>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: 4,
              gap: 4,
              borderRadius: 14,
              border: `1px solid ${tokens.border}`,
              background: tokens.surfaceMuted,
            }}>
              {(['all', 'active', 'inactive'] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => setStatusFilter(option)}
                  style={{
                    height: 32,
                    padding: '0 12px',
                    borderRadius: 10,
                    border: 'none',
                    background: statusFilter === option ? tokens.surface : 'transparent',
                    color: statusFilter === option ? tokens.text : tokens.textMuted,
                    fontSize: '0.79rem',
                    fontWeight: 700,
                    textTransform: 'capitalize',
                    cursor: 'pointer',
                    boxShadow: statusFilter === option ? tokens.shadow : 'none',
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${tokens.border}` }}>
                <HeaderCell label="Team" onClick={() => toggleSort('name')} tokens={tokens} active={sortKey === 'name'} />
                <HeaderCell label="Code" onClick={() => toggleSort('slug')} tokens={tokens} active={sortKey === 'slug'} />
                <HeaderCell label="Coverage" onClick={() => toggleSort('members')} tokens={tokens} active={sortKey === 'members'} />
                <HeaderCell label="Status" onClick={() => toggleSort('status')} tokens={tokens} active={sortKey === 'status'} />
                <HeaderCell label="Created" onClick={() => toggleSort('created')} tokens={tokens} active={sortKey === 'created'} />
                <th style={headerStyle(tokens)}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: '34px 14px', color: tokens.textMuted, textAlign: 'center' }}>
                    Loading teams…
                  </td>
                </tr>
              ) : filteredTeams.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px 14px' }}>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                      color: tokens.textMuted,
                    }}>
                      <Building2 size={20} />
                      <div style={{ color: tokens.text, fontWeight: 700 }}>No teams match this view</div>
                      <div style={{ fontSize: '0.84rem' }}>Clear filters or create a new team to get started.</div>
                      <button onClick={openCreate} style={{ ...primaryButtonStyle(tokens), marginTop: 8 }}>
                        <Plus size={14} />
                        Create Team
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTeams.map((team) => {
                  const isSelected = selectedTeam?.id === team.id;
                  return (
                    <tr
                      key={team.id}
                      onClick={() => setSelectedTeam(team)}
                      style={{
                        borderBottom: `1px solid ${tokens.border}`,
                        background: isSelected ? tokens.primarySoft : 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <td style={bodyCellStyle(tokens, '18px 14px')}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{
                            width: 42,
                            height: 42,
                            borderRadius: 14,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: team.is_active ? tokens.primarySoft : tokens.surfaceMuted,
                            color: team.is_active ? tokens.primary : tokens.textMuted,
                            border: `1px solid ${tokens.border}`,
                            flexShrink: 0,
                          }}>
                            <Building2 size={17} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: tokens.text, fontSize: '0.92rem' }}>{team.name}</div>
                            <div style={{ marginTop: 4, fontSize: '0.8rem', color: tokens.textDim, lineHeight: 1.45 }}>
                              {team.description || 'No operational note recorded.'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={bodyCellStyle(tokens)}>
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '6px 10px',
                          borderRadius: 10,
                          background: tokens.surfaceMuted,
                          border: `1px solid ${tokens.border}`,
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.8rem',
                          color: tokens.text,
                        }}>
                          {team.slug}
                        </div>
                      </td>
                      <td style={bodyCellStyle(tokens)}>
                        <CoverageMeter team={team} tokens={tokens} />
                      </td>
                      <td style={bodyCellStyle(tokens)}>
                        <span style={statusChipStyle(tokens, team.is_active)}>
                          {team.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={bodyCellStyle(tokens)}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem', color: tokens.text }}>
                          {formatDate(team.created_at)}
                        </div>
                      </td>
                      <td
                        style={bodyCellStyle(tokens)}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                          <button onClick={() => openEdit(team)} style={iconButtonStyle(tokens)} aria-label={`Edit ${team.name}`}>
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(team)}
                            style={{ ...iconButtonStyle(tokens), color: tokens.danger, background: tokens.dangerSoft, border: `1px solid ${tokens.danger}` }}
                            aria-label={`Delete ${team.name}`}
                          >
                            <Trash2 size={14} />
                          </button>
                          <button
                            onClick={() => setSelectedTeam(team)}
                            style={{ ...iconButtonStyle(tokens), width: 40 }}
                            aria-label={`Open ${team.name}`}
                          >
                            <ChevronRight size={14} />
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
      </section>

      <Sheet
        open={selectedTeam !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedTeam(null);
        }}
      >
        <SheetContent
          side="right"
          className="[&>[data-slot=sheet-close]]:hidden"
          style={{
            width: 440,
            maxWidth: '92vw',
            padding: 0,
            background: isDark
              ? `linear-gradient(180deg, ${tokens.surfaceRaised} 0%, ${tokens.pageBg} 100%)`
              : `linear-gradient(180deg, ${tokens.surfaceRaised} 0%, #f8fbf8 100%)`,
            borderLeft: `1px solid ${tokens.border}`,
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
          }}
        >
          {selectedTeam && (
            <>
              <SheetHeader
                style={{
                  padding: '24px 22px 18px',
                  borderBottom: `1px solid ${tokens.border}`,
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 12,
                  background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.72)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 10px',
                    borderRadius: 999,
                    background: tokens.primarySoft,
                    border: `1px solid ${tokens.border}`,
                    color: tokens.primary,
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}>
                    Team Details
                  </div>
                  <SheetTitle
                    style={{
                      marginTop: 14,
                      color: tokens.text,
                      fontFamily: "'Outfit', sans-serif",
                      fontSize: '1.55rem',
                      fontWeight: 800,
                      letterSpacing: '-0.03em',
                    }}
                  >
                    {selectedTeam.name}
                  </SheetTitle>
                  <SheetDescription style={{ margin: '10px 0 0', color: tokens.textDim, fontSize: '0.86rem', lineHeight: 1.6 }}>
                    Ownership snapshot, staffing coverage, and team metadata for admin review.
                  </SheetDescription>
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={statusChipStyle(tokens, selectedTeam.is_active)}>
                      {selectedTeam.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '5px 10px',
                      borderRadius: 10,
                      background: tokens.surfaceMuted,
                      border: `1px solid ${tokens.border}`,
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.78rem',
                      color: tokens.text,
                    }}>
                      {selectedTeam.slug}
                    </span>
                  </div>
                </div>

              </SheetHeader>

              <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={detailBlockStyle(tokens)}>
                  <MetricRow
                    label="Staff assigned"
                    value={String(selectedTeam.memberCount)}
                    sub={`${selectedTeam.activeMemberCount} active`}
                    tokens={tokens}
                  />
                  <MetricRow
                    label="Created"
                    value={formatDate(selectedTeam.created_at)}
                    sub="Team record start"
                    tokens={tokens}
                  />
                </div>

                <div style={detailBlockStyle(tokens)}>
                  <SectionTitle icon={<FileText size={15} />} label="Operational note" tokens={tokens} />
                  <p style={{ margin: 0, color: selectedTeam.description ? tokens.textDim : tokens.textMuted, lineHeight: 1.65, fontSize: '0.9rem' }}>
                    {selectedTeam.description || 'No team note has been added. Use this space for ownership, workflow, or escalation context.'}
                  </p>
                </div>

                <div style={detailBlockStyle(tokens)}>
                  <SectionTitle icon={<Users size={15} />} label="Assigned staff" tokens={tokens} />
                  {selectedMembers.length === 0 ? (
                    <div style={{ color: tokens.textMuted, fontSize: '0.84rem', lineHeight: 1.55 }}>
                      No employees currently point to this team. This is a good candidate for staffing or cleanup.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {selectedMembers.slice(0, 6).map((employee) => (
                        <div key={employee.id} style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          padding: '10px 12px',
                          borderRadius: 14,
                          background: tokens.surfaceMuted,
                          border: `1px solid ${tokens.border}`,
                        }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: tokens.text, fontSize: '0.84rem' }}>
                              {fullName(employee)}
                            </div>
                            <div style={{ marginTop: 4, color: tokens.textMuted, fontSize: '0.76rem' }}>
                              {employee.email || 'No email'}
                            </div>
                          </div>
                          <span style={statusChipStyle(tokens, employee.is_active !== false)}>
                            {employee.is_active === false ? 'Inactive' : 'Active'}
                          </span>
                        </div>
                      ))}
                      {selectedMembers.length > 6 && (
                        <div style={{ color: tokens.textMuted, fontSize: '0.78rem' }}>
                          +{selectedMembers.length - 6} more employees assigned
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div style={{
                  display: 'flex',
                  gap: 10,
                  paddingTop: 2,
                  borderTop: `1px solid ${tokens.border}`,
                }}>
                  <button onClick={() => openEdit(selectedTeam)} style={secondaryButtonStyle(tokens)}>
                    <Pencil size={14} />
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggleActive(selectedTeam)}
                    disabled={saving}
                    style={selectedTeam.is_active ? warningButtonStyle(tokens) : primaryButtonStyle(tokens)}
                  >
                    <ShieldCheck size={14} />
                    {saving ? 'Updating…' : selectedTeam.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => setDeleteTarget(selectedTeam)} style={dangerButtonStyle(tokens)}>
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <TeamDialog
        open={formOpen}
        onClose={closeForm}
        tokens={tokens}
        eyebrow={editingTeam ? 'Edit team' : 'New team'}
        title={editingTeam ? 'Edit team' : 'Create team'}
        description={editingTeam
          ? 'Refine naming, assignment context, and availability without leaving the directory.'
          : 'Create a team to group people who work together.'}
        tone="default"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 0.9fr',
            gap: 12,
            padding: 14,
            borderRadius: 18,
            border: `1px solid ${tokens.border}`,
            background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(248,251,248,0.88)',
          }}>
            <div>
              <div style={{ fontSize: '0.73rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: tokens.textMuted, fontWeight: 700 }}>
                About this team
              </div>
              <div style={{ marginTop: 8, color: tokens.text, fontWeight: 700 }}>
                {editingTeam ? 'Update team details' : 'Create a new team'}
              </div>
              <div style={{ marginTop: 6, color: tokens.textDim, fontSize: '0.82rem', lineHeight: 1.55 }}>
                Use concise names and descriptions that help admins understand ownership fast.
              </div>
            </div>
            <div style={{
              borderRadius: 14,
              border: `1px solid ${tokens.border}`,
              background: tokens.surface,
              padding: '12px 12px 10px',
              alignSelf: 'stretch',
            }}>
              <div style={{ fontSize: '0.72rem', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                Preview code
              </div>
              <div style={{ marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: '0.84rem', color: tokens.text }}>
                {form.slug || 'team-slug'}
              </div>
            </div>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: tokens.text, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Team name</span>
            <input
              value={form.name}
              onChange={(event) => handleFormChange('name', event.target.value)}
              placeholder="Operations"
              style={fieldStyle(tokens)}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: tokens.text, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Team code</span>
            <input
              value={form.slug}
              onChange={(event) => {
                setSlugTouched(true);
                handleFormChange('slug', slugify(event.target.value));
              }}
              placeholder="operations"
              style={{ ...fieldStyle(tokens), fontFamily: 'var(--font-mono)' }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: tokens.text, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Operational note</span>
            <textarea
              value={form.description}
              onChange={(event) => handleFormChange('description', event.target.value)}
              placeholder="Optional note for ownership, workflows, escalation scope, or assignment intent."
              rows={4}
              style={{ ...fieldStyle(tokens), resize: 'vertical', minHeight: 104, height: 'auto', paddingTop: 12, paddingBottom: 12, fontFamily: 'inherit' }}
            />
          </label>

          {editingTeam && (
            <label style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              color: tokens.text,
              fontWeight: 700,
              padding: '12px 14px',
              borderRadius: 14,
              border: `1px solid ${tokens.border}`,
              background: tokens.surfaceMuted,
            }}>
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) => handleFormChange('is_active', event.target.checked)}
              />
              Active team
            </label>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4, paddingTop: 16, borderTop: `1px solid ${tokens.border}` }}>
            <button onClick={closeForm} style={secondaryButtonStyle(tokens)}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} style={primaryButtonStyle(tokens)}>
              {saving ? 'Saving…' : editingTeam ? 'Save Changes' : 'Create Team'}
            </button>
          </div>
        </div>
      </TeamDialog>

      <TeamDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        tokens={tokens}
        eyebrow="Destructive Action"
        title="Delete team"
        description="This removes the team record from the admin directory. Review staff assignment impact before confirming."
        tone="danger"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{
            padding: 14,
            borderRadius: 16,
            border: `1px solid ${tokens.danger}`,
            background: tokens.dangerSoft,
          }}>
            <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: tokens.danger, fontWeight: 800 }}>
              Removal impact
            </div>
            <p style={{ margin: '10px 0 0', color: tokens.text, lineHeight: 1.6, fontSize: '0.9rem' }}>
              Anyone on this team will have no team until you assign them to another.
            </p>
          </div>
          <p style={{ margin: 0, color: tokens.textDim, lineHeight: 1.6 }}>
            Delete <strong style={{ color: tokens.text }}>{deleteTarget?.name}</strong>? You can only remove a team with no one on it. It stays in the list as Inactive.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 12, borderTop: `1px solid ${tokens.border}` }}>
            <button onClick={() => setDeleteTarget(null)} style={secondaryButtonStyle(tokens)}>
              Cancel
            </button>
            <button onClick={handleDelete} disabled={saving} style={dangerButtonStyle(tokens)}>
              {saving ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </TeamDialog>
    </div>
  );
};

function Pill({ children, tone, tokens }: { children: React.ReactNode; tone: 'neutral' | 'success' | 'info'; tokens: ReturnType<typeof getDesignTokens> }) {
  const palette = {
    neutral: { bg: tokens.surfaceMuted, fg: tokens.text },
    success: { bg: tokens.successSoft, fg: tokens.success },
    info: { bg: tokens.infoSoft, fg: tokens.info },
  }[tone];

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '7px 11px',
      borderRadius: 999,
      background: palette.bg,
      color: palette.fg,
      border: `1px solid ${tokens.border}`,
      fontSize: '0.78rem',
      fontWeight: 700,
    }}>
      {children}
    </span>
  );
}

function HeaderCell({
  label,
  onClick,
  tokens,
  active,
}: {
  label: string;
  onClick: () => void;
  tokens: ReturnType<typeof getDesignTokens>;
  active: boolean;
}) {
  return (
    <th style={headerStyle(tokens)}>
      <button
        onClick={onClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'transparent',
          border: 'none',
          color: active ? tokens.text : tokens.textMuted,
          fontWeight: 700,
          cursor: 'pointer',
          padding: 0,
        }}
      >
        {label}
        <ArrowUpDown size={13} />
      </button>
    </th>
  );
}

function CoverageMeter({
  team,
  tokens,
}: {
  team: TeamRow;
  tokens: ReturnType<typeof getDesignTokens>;
}) {
  const fill = team.coverageTone === 'full' ? tokens.success : team.coverageTone === 'light' ? tokens.info : tokens.warning;
  const track = team.coverageTone === 'full' ? tokens.successSoft : team.coverageTone === 'light' ? tokens.infoSoft : tokens.warningSoft;
  const segments = [
    team.memberCount > 0,
    team.memberCount > 2,
    team.memberCount > 4,
  ];

  return (
    <div style={{ minWidth: 180 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ fontWeight: 700, color: tokens.text, fontVariantNumeric: 'tabular-nums' }}>
          {team.memberCount} member{team.memberCount === 1 ? '' : 's'}
        </span>
        <span style={{ fontSize: '0.76rem', color: tokens.textMuted }}>
          {team.coverageTone === 'full' ? 'Staffed' : team.coverageTone === 'light' ? 'Partial' : 'Empty'}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginTop: 8 }}>
        {segments.map((active, index) => (
          <div
            key={index}
            style={{
              height: 7,
              borderRadius: 999,
              background: active ? fill : track,
              opacity: active ? 1 : 0.65,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function MetricRow({
  label,
  value,
  sub,
  tokens,
}: {
  label: string;
  value: string;
  sub: string;
  tokens: ReturnType<typeof getDesignTokens>;
}) {
  return (
    <div style={{
      flex: 1,
      minWidth: 0,
      borderRadius: 16,
      background: tokens.surfaceMuted,
      border: `1px solid ${tokens.border}`,
      padding: '14px 14px 12px',
    }}>
      <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: tokens.textMuted, fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ marginTop: 12, fontSize: '1.2rem', fontWeight: 800, color: tokens.text, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      <div style={{ marginTop: 6, fontSize: '0.78rem', color: tokens.textDim }}>
        {sub}
      </div>
    </div>
  );
}

function SectionTitle({
  icon,
  label,
  tokens,
}: {
  icon: React.ReactNode;
  label: string;
  tokens: ReturnType<typeof getDesignTokens>;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: tokens.text, fontWeight: 700 }}>
      <span style={{ color: tokens.primary }}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

const headerStyle = (tokens: ReturnType<typeof getDesignTokens>): React.CSSProperties => ({
  textAlign: 'left',
  padding: '14px 14px',
  fontSize: '0.72rem',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: tokens.textMuted,
  fontWeight: 700,
  whiteSpace: 'nowrap',
});

const bodyCellStyle = (tokens: ReturnType<typeof getDesignTokens>, padding = '16px 14px'): React.CSSProperties => ({
  padding,
  color: tokens.text,
  verticalAlign: 'middle',
});

const statusChipStyle = (tokens: ReturnType<typeof getDesignTokens>, active: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '5px 10px',
  borderRadius: 999,
  background: active ? tokens.successSoft : tokens.warningSoft,
  color: active ? tokens.success : tokens.warning,
  fontSize: '0.74rem',
  fontWeight: 700,
});

const searchShellStyle = (tokens: ReturnType<typeof getDesignTokens>): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minWidth: 320,
  padding: '0 12px',
  height: 42,
  background: tokens.surfaceMuted,
  border: `1px solid ${tokens.border}`,
  borderRadius: 14,
});

const searchInputStyle = (tokens: ReturnType<typeof getDesignTokens>): React.CSSProperties => ({
  flex: 1,
  border: 'none',
  outline: 'none',
  background: 'transparent',
  color: tokens.text,
  fontSize: '0.92rem',
});

const fieldStyle = (tokens: ReturnType<typeof getDesignTokens>): React.CSSProperties => ({
  width: '100%',
  boxSizing: 'border-box',
  height: 46,
  borderRadius: 14,
  border: `1px solid ${tokens.border}`,
  background: tokens.surface,
  color: tokens.text,
  padding: '0 14px',
  fontSize: '0.94rem',
  outline: 'none',
  boxShadow: `inset 0 1px 0 ${tokens.surfaceMuted}`,
});

const primaryButtonStyle = (tokens: ReturnType<typeof getDesignTokens>): React.CSSProperties => ({
  height: 40,
  borderRadius: 12,
  border: `1px solid ${tokens.primary}`,
  background: tokens.primary,
  color: tokens.textInverse,
  padding: '0 14px',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
});

const secondaryButtonStyle = (tokens: ReturnType<typeof getDesignTokens>): React.CSSProperties => ({
  height: 40,
  borderRadius: 12,
  border: `1px solid ${tokens.border}`,
  background: tokens.surfaceMuted,
  color: tokens.text,
  padding: '0 14px',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
});

const dangerButtonStyle = (tokens: ReturnType<typeof getDesignTokens>): React.CSSProperties => ({
  ...secondaryButtonStyle(tokens),
  border: `1px solid ${tokens.danger}`,
  background: tokens.dangerSoft,
  color: tokens.danger,
});

const warningButtonStyle = (tokens: ReturnType<typeof getDesignTokens>): React.CSSProperties => ({
  ...secondaryButtonStyle(tokens),
  border: `1px solid ${tokens.warning}`,
  background: tokens.warningSoft,
  color: tokens.warning,
});

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

const detailBlockStyle = (tokens: ReturnType<typeof getDesignTokens>): React.CSSProperties => ({
  borderRadius: 18,
  border: `1px solid ${tokens.border}`,
  background: tokens.surface,
  padding: 16,
  boxShadow: tokens.shadow,
});

function TeamDialog({
  open,
  onClose,
  title,
  description,
  eyebrow,
  tone,
  tokens,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  eyebrow: string;
  tone: 'default' | 'danger';
  tokens: ReturnType<typeof getDesignTokens>;
  children: React.ReactNode;
}) {
  if (!open) return null;

  const accent = tone === 'danger'
    ? { fg: tokens.danger, bg: tokens.dangerSoft }
    : { fg: tokens.primary, bg: tokens.primarySoft };

  return ReactDOM.createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => event.target === event.currentTarget && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'rgba(18,21,26,0.48)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div
        style={{
          width: 'min(680px, calc(100vw - 40px))',
          maxHeight: 'min(88vh, 860px)',
          overflowY: 'auto',
          borderRadius: 28,
          border: `1px solid ${tokens.border}`,
          background: `linear-gradient(180deg, ${tokens.surfaceRaised} 0%, ${tokens.surface} 100%)`,
          boxShadow: '0 36px 80px rgba(18,21,26,0.22)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{
          padding: '22px 24px 18px',
          borderBottom: `1px solid ${tokens.border}`,
          background: tone === 'danger'
            ? `linear-gradient(180deg, ${tokens.dangerSoft} 0%, ${tokens.surfaceRaised} 100%)`
            : `linear-gradient(180deg, ${tokens.primarySoft} 0%, ${tokens.surfaceRaised} 100%)`,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '6px 10px',
                borderRadius: 999,
                background: accent.bg,
                border: `1px solid ${tokens.border}`,
                color: accent.fg,
                fontSize: '0.72rem',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}>
                {eyebrow}
              </div>
              <h3 style={{
                margin: '14px 0 8px',
                fontFamily: "'Outfit', sans-serif",
                fontSize: '1.55rem',
                lineHeight: 1.05,
                letterSpacing: '-0.03em',
                color: tokens.text,
              }}>
                {title}
              </h3>
              <p style={{ margin: 0, color: tokens.textDim, fontSize: '0.92rem', lineHeight: 1.65, maxWidth: 520 }}>
                {description}
              </p>
            </div>
            <button onClick={onClose} style={iconButtonStyle(tokens)} aria-label="Close dialog">
              <X size={14} />
            </button>
          </div>
        </div>

        <div style={{ padding: 24 }}>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default Teams;
