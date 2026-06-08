import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import finalLogo from '../../assets/finalLogo.png';
import {
  RefreshCw, Search, Users, UserCheck, UserX, Shield,
  ChevronDown, ChevronUp, Plus, Edit2, Trash2, X, Check,
  Mail, Phone, MapPin, Calendar, Crown,
  Menu,
} from 'lucide-react';

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
  updated_by_username?: string;
  updated_at?: string;
}

const AVATAR_COLORS = [
  '#6366f1','#2FBF71','#F59E0B','#60A5FA','#ec4899','#14b8a6','#F87171','#8b5cf6',
];
const avatarColor = (s: string) => {
  let h = 0; for (const c of s) h = c.charCodeAt(0) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
};
const initials = (e: Employee) => {
  if (e.first_name && e.last_name) return `${e.first_name[0]}${e.last_name[0]}`.toUpperCase();
  return e.username.substring(0, 2).toUpperCase();
};
const fullName = (e: Employee) =>
  [e.first_name, e.last_name].filter(Boolean).join(' ') || e.username;

const MobileEmployees: React.FC = () => {
  const { isDark } = useTheme();
  const { isAdmin } = useAuth();

  const bg      = isDark ? '#07090F' : '#F4F7FA';
  const surface = isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF';
  const border  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const text    = isDark ? '#F1F5F9' : '#0F172A';
  const muted   = isDark ? 'rgba(241,245,249,0.45)' : '#94A3B8';
  const accent  = '#2FBF71';
  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC';

  const [employees, setEmployees]   = useState<Employee[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]         = useState('');
  const [filter, setFilter]         = useState<'all'|'active'|'inactive'|'admin'>('all');
  const [expanded, setExpanded]     = useState<Set<number>>(new Set());
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [modal, setModal] = useState<'none'|'create'|'edit'|'delete'>('none');
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [form, setForm] = useState({
    username: '', email: '', first_name: '', last_name: '',
    mobile_number: '', address: '', password: '',
    is_staff: true, is_superuser: false, is_active: true,
  });

  const fetchEmployees = useCallback(async (silent = false, pg = page, q = search) => {
    if (!silent) setLoading(true);
    try {
      const res = await apiService.getEmployees(q, pg, 15);
      setEmployees(Array.isArray(res.results) ? res.results : Array.isArray(res) ? res : []);
      if (res.count !== undefined) {
        setTotalCount(res.count);
        setTotalPages(Math.ceil(res.count / 15));
      }
    } catch { } finally { setLoading(false); setRefreshing(false); }
  }, [page, search]);

  useEffect(() => { fetchEmployees(); }, [page]);
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); fetchEmployees(false, 1, search); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const displayed = useMemo(() => employees.filter(e => {
    if (filter === 'active'   && !e.is_active)    return false;
    if (filter === 'inactive' &&  e.is_active)    return false;
    if (filter === 'admin'    && !e.is_superuser) return false;
    return true;
  }), [employees, filter]);

  const toggleExpand = (id: number) => setExpanded(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const openCreate = () => {
    setForm({ username:'', email:'', first_name:'', last_name:'',
      mobile_number:'', address:'', password:'', is_staff:true, is_superuser:false, is_active:true });
    setFormErr(''); setModal('create');
  };

  const openEdit = (e: Employee) => {
    setEditTarget(e);
    setForm({ username: e.username, email: e.email, first_name: e.first_name,
      last_name: e.last_name, mobile_number: e.mobile_number ?? '',
      address: e.address ?? '', password: '',
      is_staff: e.is_staff, is_superuser: e.is_superuser, is_active: e.is_active });
    setFormErr(''); setModal('edit');
  };

  const handleSave = async () => {
    if (!form.username.trim() || !form.email.trim()) { setFormErr('Username and email required'); return; }
    setSaving(true); setFormErr('');
    try {
      const payload: any = { ...form };
      if (!payload.password) delete payload.password;
      if (modal === 'create') await apiService.createEmployee(payload);
      else if (editTarget) await apiService.updateUser(editTarget.id, payload);
      setModal('none'); fetchEmployees(true);
    } catch (e: any) {
      setFormErr(e?.message ?? 'Save failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await apiService.deleteUser(deleteTarget.id);
      setModal('none'); setDeleteTarget(null); fetchEmployees(true);
    } catch { } finally { setSaving(false); }
  };

  const counts = useMemo(() => ({
    total: totalCount,
    active: employees.filter(e => e.is_active).length,
    inactive: employees.filter(e => !e.is_active).length,
    admins: employees.filter(e => e.is_superuser).length,
  }), [employees, totalCount]);

  const card = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: surface, backdropFilter: 'blur(16px)', border: `1px solid ${border}`, borderRadius: 16, overflow: 'hidden', ...extra,
  });

  const inputStyle: React.CSSProperties = {
    width: '100%', background: inputBg, border: `1px solid ${border}`, borderRadius: 10,
    padding: '10px 14px', fontSize: '0.82rem', color: text, outline: 'none',
    boxSizing: 'border-box', fontFamily: "'DM Sans', sans-serif",
  };

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100dvh', background: bg, gap:10, color: muted }}>
      <RefreshCw size={18} style={{ animation:'spin 1s linear infinite' }}/><span style={{ fontSize:'0.875rem', fontFamily:"'DM Sans', sans-serif" }}>Loading…</span>
    </div>
  );

  return (
    <div style={{ background: bg, minHeight: '100dvh', paddingBottom: 68 }}>

      <div style={{ position:'sticky', top:0, zIndex:20, background: isDark ? 'rgba(7,9,15,0.92)' : 'rgba(244,247,250,0.92)', backdropFilter:'blur(20px)', borderBottom:`1px solid ${border}`, padding:'12px 16px 14px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? 'rgba(47,191,113,0.08)' : 'rgba(47,191,113,0.06)', border: '1px solid rgba(47,191,113,0.18)', boxShadow: '0 2px 8px rgba(47,191,113,0.2)', flexShrink: 0 }}>
              <img src={finalLogo} alt="360Watts" style={{ width: 36, height: 36, objectFit: 'contain' }} />
            </div>
            <span style={{ fontSize: '0.88rem', fontWeight: 800, color: text, fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.01em' }}>360Watts</span>
          </div>
          <button onClick={() => window.dispatchEvent(new CustomEvent('open-mobile-menu'))} style={{ background: isDark ? 'rgba(47,191,113,0.1)' : 'rgba(47,191,113,0.08)', border: '1px solid rgba(47,191,113,0.22)', borderRadius: 9, cursor: 'pointer', color: '#2FBF71', padding: '6px', display: 'flex' }}>
            <Menu size={16} />
          </button>
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <div>
            <div style={{ fontSize:'0.6rem', color:muted, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', fontFamily:"'DM Sans', sans-serif" }}>Employees</div>
            <div style={{ fontSize:'1.05rem', fontWeight:700, color:text, marginTop:2, fontFamily:"'Outfit', sans-serif" }}>
              {counts.total} total · {counts.active} active
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            {isAdmin && (
              <button onClick={openCreate}
                style={{ background:accent, border:'none', borderRadius:10, cursor:'pointer', color:'#fff', padding:'7px 12px', display:'flex', alignItems:'center', gap:5, fontSize:'0.75rem', fontWeight:700, fontFamily:"'DM Sans', sans-serif" }}>
                <Plus size={14}/> Add
              </button>
            )}
            <button onClick={() => { setRefreshing(true); fetchEmployees(true); }}
              style={{ background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', border:`1px solid ${border}`, borderRadius:10, cursor:'pointer', color:muted, padding:'7px 9px', display:'flex' }}>
              <RefreshCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }}/>
            </button>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6 }}>
          {[
            { label:'Total',    value: counts.total,    color:'rgba(241,245,249,0.9)', bg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
            { label:'Active',   value: counts.active,   color:'#2FBF71', bg:'rgba(47,191,113,0.1)' },
            { label:'Inactive', value: counts.inactive, color:'#F87171', bg:'rgba(248,113,113,0.1)' },
            { label:'Admins',   value: counts.admins,   color:'#a78bfa', bg:'rgba(167,139,250,0.1)' },
          ].map(({ label, value, bg: kb, color }) => (
            <div key={label} style={{ background:kb, borderRadius:10, padding:'8px 4px', textAlign:'center', border:`1px solid ${border}` }}>
              <div style={{ fontSize:'1.15rem', fontWeight:700, color, fontFamily:"'JetBrains Mono', monospace" }}>{value}</div>
              <div style={{ fontSize:'0.57rem', color:muted, marginTop:2, fontFamily:"'DM Sans', sans-serif" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding:'12px 12px 0', display:'flex', flexDirection:'column', gap:10 }}>

        <div style={{ position:'relative' }}>
          <Search size={14} color={muted} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)' }}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employees…"
            style={{ ...inputStyle, paddingLeft:36 }}/>
        </div>

        <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:2 }}>
          {(['all','active','inactive','admin'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding:'5px 14px', borderRadius:999, fontSize:'0.7rem', fontWeight:600, cursor:'pointer', border:'none', whiteSpace:'nowrap', flexShrink:0, background: filter===f ? `${accent}18` : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'), color: filter===f ? accent : muted, fontFamily:"'DM Sans', sans-serif" }}>
              {f.charAt(0).toUpperCase()+f.slice(1)}
            </button>
          ))}
        </div>

        <div style={{ fontSize:'0.7rem', color:muted, fontFamily:"'DM Sans', sans-serif" }}>{displayed.length} employee{displayed.length !== 1 ? 's' : ''}</div>

        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {displayed.map(e => {
            const isExp = expanded.has(e.id);
            const ac = avatarColor(e.username);
            return (
              <div key={e.id} style={card({ opacity: e.is_active ? 1 : 0.6 })}>
                <button onClick={() => toggleExpand(e.id)}
                  style={{ width:'100%', background:'none', border:'none', cursor:'pointer', padding:'14px', textAlign:'left', display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:42, height:42, borderRadius:14, background:ac, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:'0.85rem', fontWeight:700, color:'#fff', fontFamily:"'Outfit', sans-serif" }}>
                    {initials(e)}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                      <span style={{ fontSize:'0.88rem', fontWeight:600, color:text, fontFamily:"'DM Sans', sans-serif" }}>{fullName(e)}</span>
                      {e.is_superuser && <Crown size={12} color="#F59E0B"/>}
                      {e.is_staff && !e.is_superuser && <Shield size={11} color="#60A5FA"/>}
                    </div>
                    <div style={{ fontSize:'0.7rem', color:muted, fontFamily:"'DM Sans', sans-serif" }}>@{e.username}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
                      <span style={{ padding:'2px 8px', borderRadius:999, fontSize:'0.62rem', fontWeight:700, background: e.is_active ? 'rgba(47,191,113,0.12)' : 'rgba(248,113,113,0.12)', color: e.is_active ? accent : '#F87171', fontFamily:"'DM Sans', sans-serif" }}>
                        {e.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {(e.is_superuser || e.is_staff) && (
                        <span style={{ padding:'2px 8px', borderRadius:999, fontSize:'0.62rem', fontWeight:700, background: e.is_superuser ? 'rgba(167,139,250,0.12)' : 'rgba(96,165,250,0.12)', color: e.is_superuser ? '#a78bfa' : '#60A5FA', fontFamily:"'DM Sans', sans-serif" }}>
                          {e.is_superuser ? 'Admin' : 'Staff'}
                        </span>
                      )}
                    </div>
                  </div>
                  {isExp ? <ChevronUp size={14} color={muted}/> : <ChevronDown size={14} color={muted}/>}
                </button>

                {isExp && (
                  <div style={{ padding:'0 14px 14px', borderTop:`1px solid ${border}`, paddingTop:12, display:'flex', flexDirection:'column', gap:10 }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                      <div>
                        <div style={{ fontSize:'0.58rem', color:muted, textTransform:'uppercase', letterSpacing:'0.06em', fontFamily:"'DM Sans', sans-serif" }}>Email</div>
                        <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:'0.72rem', color:text, marginTop:2, fontFamily:"'DM Sans', sans-serif" }}><Mail size={11} color={muted}/>{e.email}</div>
                      </div>
                      {e.mobile_number && (
                        <div>
                          <div style={{ fontSize:'0.58rem', color:muted, textTransform:'uppercase', letterSpacing:'0.06em', fontFamily:"'DM Sans', sans-serif" }}>Mobile</div>
                          <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:'0.72rem', color:text, marginTop:2, fontFamily:"'DM Sans', sans-serif" }}><Phone size={11} color={muted}/>{e.mobile_number}</div>
                        </div>
                      )}
                      {e.address && (
                        <div style={{ gridColumn:'1/-1' }}>
                          <div style={{ fontSize:'0.58rem', color:muted, textTransform:'uppercase', letterSpacing:'0.06em', fontFamily:"'DM Sans', sans-serif" }}>Address</div>
                          <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:'0.72rem', color:text, marginTop:2, fontFamily:"'DM Sans', sans-serif" }}><MapPin size={11} color={muted}/>{e.address}</div>
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize:'0.58rem', color:muted, textTransform:'uppercase', letterSpacing:'0.06em', fontFamily:"'DM Sans', sans-serif" }}>Joined</div>
                        <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:'0.72rem', color:text, marginTop:2, fontFamily:"'DM Sans', sans-serif" }}><Calendar size={11} color={muted}/>{new Date(e.date_joined).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</div>
                      </div>
                      {e.created_by_username && (
                        <div>
                          <div style={{ fontSize:'0.58rem', color:muted, textTransform:'uppercase', letterSpacing:'0.06em', fontFamily:"'DM Sans', sans-serif" }}>Created by</div>
                          <div style={{ fontSize:'0.72rem', color:text, marginTop:2, fontFamily:"'DM Sans', sans-serif" }}>@{e.created_by_username}</div>
                        </div>
                      )}
                    </div>
                    {isAdmin && (
                      <div style={{ display:'flex', gap:8, marginTop:4 }}>
                        <button onClick={() => openEdit(e)}
                          style={{ flex:1, padding:'8px 0', background:`${accent}12`, border:`1px solid ${accent}25`, borderRadius:10, cursor:'pointer', color:accent, fontSize:'0.75rem', fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:4, fontFamily:"'DM Sans', sans-serif" }}>
                          <Edit2 size={12}/> Edit
                        </button>
                        <button onClick={() => { setDeleteTarget(e); setModal('delete'); }}
                          style={{ flex:1, padding:'8px 0', background:'rgba(248,113,113,0.08)', border:'1px solid rgba(248,113,113,0.2)', borderRadius:10, cursor:'pointer', color:'#F87171', fontSize:'0.75rem', fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:4, fontFamily:"'DM Sans', sans-serif" }}>
                          <Trash2 size={12}/> Remove
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {totalPages > 1 && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, padding:'12px 0' }}>
            <button disabled={page <= 1} onClick={() => setPage(p => p-1)}
              style={{ padding:'6px 16px', background: page > 1 ? `${accent}18` : 'transparent', border:`1px solid ${border}`, borderRadius:999, cursor: page > 1 ? 'pointer' : 'default', color: page > 1 ? accent : muted, fontSize:'0.75rem', fontWeight:600, fontFamily:"'DM Sans', sans-serif" }}>
              Prev
            </button>
            <span style={{ fontSize:'0.75rem', color:muted, fontFamily:"'JetBrains Mono', monospace" }}>{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p+1)}
              style={{ padding:'6px 16px', background: page < totalPages ? `${accent}18` : 'transparent', border:`1px solid ${border}`, borderRadius:999, cursor: page < totalPages ? 'pointer' : 'default', color: page < totalPages ? accent : muted, fontSize:'0.75rem', fontWeight:600, fontFamily:"'DM Sans', sans-serif" }}>
              Next
            </button>
          </div>
        )}
      </div>

      {(modal === 'create' || modal === 'edit') && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:1000, display:'flex', alignItems:'flex-end' }}
          onClick={() => setModal('none')}>
          <div style={{ background: isDark ? '#0D1117' : '#FFFFFF', backdropFilter:'blur(20px)', borderRadius:'20px 20px 0 0', padding:'20px 16px 32px', width:'100%', maxHeight:'85dvh', overflowY:'auto', border:`1px solid ${border}` }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width:36, height:4, borderRadius:2, background:border, margin:'0 auto 16px' }}/>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
              <div style={{ fontSize:'1rem', fontWeight:700, color:text, fontFamily:"'Outfit', sans-serif" }}>{modal === 'create' ? 'Add Employee' : 'Edit Employee'}</div>
              <button onClick={() => setModal('none')} style={{ background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', border:`1px solid ${border}`, borderRadius:8, cursor:'pointer', color:muted, padding:'6px' }}><X size={16}/></button>
            </div>
            {formErr && <div style={{ background:'rgba(248,113,113,0.08)', border:'1px solid rgba(248,113,113,0.25)', borderRadius:10, padding:'9px 12px', fontSize:'0.75rem', color:'#F87171', marginBottom:14, fontFamily:"'DM Sans', sans-serif" }}>{formErr}</div>}
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {[
                { key:'first_name', label:'First Name' }, { key:'last_name', label:'Last Name' },
                { key:'username', label:'Username' }, { key:'email', label:'Email', type:'email' },
                { key:'mobile_number', label:'Mobile' }, { key:'address', label:'Address' },
                ...(modal === 'create' ? [{ key:'password', label:'Password', type:'password' }] : []),
              ].map(({ key, label, type='text' }) => (
                <div key={key}>
                  <div style={{ fontSize:'0.62rem', color:muted, marginBottom:5, textTransform:'uppercase', letterSpacing:'0.06em', fontFamily:"'DM Sans', sans-serif" }}>{label}</div>
                  <input type={type} value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    style={inputStyle}/>
                </div>
              ))}
              <div style={{ display:'flex', gap:16 }}>
                {[
                  { key:'is_staff', label:'Staff' },
                  { key:'is_superuser', label:'Admin' },
                  { key:'is_active', label:'Active' },
                ].map(({ key, label }) => (
                  <label key={key} style={{ display:'flex', alignItems:'center', gap:7, cursor:'pointer', fontSize:'0.82rem', color:text, fontFamily:"'DM Sans', sans-serif" }}>
                    <div onClick={() => setForm(f => ({ ...f, [key]: !(f as any)[key] }))}
                      style={{ width:20, height:20, borderRadius:6, border:`1.5px solid ${(form as any)[key] ? accent : border}`, background:(form as any)[key] ? accent : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {(form as any)[key] && <Check size={12} color="#fff"/>}
                    </div>
                    {label}
                  </label>
                ))}
              </div>
              <button onClick={handleSave} disabled={saving}
                style={{ marginTop:6, padding:'12px', background: accent, border:'none', borderRadius:12, cursor:'pointer', color:'#fff', fontSize:'0.875rem', fontWeight:700, opacity: saving ? 0.7 : 1, fontFamily:"'DM Sans', sans-serif" }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'delete' && deleteTarget && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 16px' }}
          onClick={() => setModal('none')}>
          <div style={{ background: isDark ? '#0D1117' : '#FFFFFF', backdropFilter:'blur(20px)', borderRadius:20, padding:'22px 18px', width:'100%', maxWidth:360, border:`1px solid ${border}` }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:'1rem', fontWeight:700, color:text, marginBottom:8, fontFamily:"'Outfit', sans-serif" }}>Remove Employee?</div>
            <div style={{ fontSize:'0.82rem', color:muted, marginBottom:22, fontFamily:"'DM Sans', sans-serif" }}>This will remove <strong style={{ color:text }}>{fullName(deleteTarget)}</strong> from the system.</div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setModal('none')} style={{ flex:1, padding:'11px', background:'transparent', border:`1px solid ${border}`, borderRadius:10, cursor:'pointer', color:text, fontSize:'0.82rem', fontFamily:"'DM Sans', sans-serif" }}>Cancel</button>
              <button onClick={handleDelete} disabled={saving}
                style={{ flex:1, padding:'11px', background:'#F87171', border:'none', borderRadius:10, cursor:'pointer', color:'#fff', fontSize:'0.82rem', fontWeight:700, fontFamily:"'DM Sans', sans-serif" }}>
                {saving ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }`}</style>
    </div>
  );
};

export default MobileEmployees;
