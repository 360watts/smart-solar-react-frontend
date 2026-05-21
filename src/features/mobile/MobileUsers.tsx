import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { apiService } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';
import {
  RefreshCw, Search, UserCheck, UserX, Shield, Crown,
  ChevronDown, ChevronUp, Plus, Edit2, Trash2, X, Check,
  Mail, Phone, MapPin, Calendar, Cpu,
} from 'lucide-react';

interface User {
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
}

interface Device {
  id: number;
  device_serial: string;
  hw_id?: string;
  model?: string;
  provisioned_at?: string;
}

const COLORS = ['#6366f1','#10b981','#f59e0b','#3b82f6','#ec4899','#14b8a6','#ef4444','#8b5cf6'];
const avatarColor = (s: string) => { let h = 0; for (const c of s) h = c.charCodeAt(0)+((h<<5)-h); return COLORS[Math.abs(h)%COLORS.length]; };
const initials = (u: User) => u.first_name && u.last_name ? `${u.first_name[0]}${u.last_name[0]}`.toUpperCase() : u.username.substring(0,2).toUpperCase();
const fullName = (u: User) => [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username;

const MobileUsers: React.FC = () => {
  const { isDark } = useTheme();

  const bg      = isDark ? '#060d18' : '#f0fdf4';
  const surface = isDark ? '#0d1829' : '#ffffff';
  const border  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,166,62,0.14)';
  const text    = isDark ? '#f1f5f9' : '#0f172a';
  const muted   = isDark ? '#64748b' : '#94a3b8';
  const sub     = isDark ? '#94a3b8' : '#475569';
  const accent  = '#00a63e';
  const inputBg = isDark ? '#0a1628' : '#f8fafc';

  const [users, setUsers]           = useState<User[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]         = useState('');
  const [filter, setFilter]         = useState<'all'|'staff'|'admin'>('all');
  const [expanded, setExpanded]     = useState<Set<number>>(new Set());
  const [devices, setDevices]       = useState<Record<number, Device[]>>({});
  const [loadingDev, setLoadingDev] = useState<Set<number>>(new Set());
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [modal, setModal]           = useState<'none'|'create'|'edit'|'delete'>('none');
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [saving, setSaving]         = useState(false);
  const [formErr, setFormErr]       = useState('');
  const [form, setForm] = useState({
    username: '', email: '', first_name: '', last_name: '',
    mobile_number: '', address: '', password: '',
    is_staff: false, is_superuser: false,
  });

  const fetchUsers = useCallback(async (silent = false, pg = page, q = search) => {
    if (!silent) setLoading(true);
    try {
      const res = await apiService.getUsers(q, pg, 15);
      setUsers(Array.isArray(res.results) ? res.results : Array.isArray(res) ? res : []);
      if (res.count !== undefined) { setTotalCount(res.count); setTotalPages(Math.ceil(res.count/15)); }
    } catch { } finally { setLoading(false); setRefreshing(false); }
  }, [page, search]);

  useEffect(() => { fetchUsers(); }, [page]);
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); fetchUsers(false, 1, search); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const loadDevices = async (uid: number) => {
    if (devices[uid]) return;
    setLoadingDev(prev => new Set(prev).add(uid));
    try {
      const d = await apiService.getUserDevices(uid);
      setDevices(prev => ({ ...prev, [uid]: Array.isArray(d) ? d : [] }));
    } catch { setDevices(prev => ({ ...prev, [uid]: [] })); }
    finally { setLoadingDev(prev => { const n = new Set(prev); n.delete(uid); return n; }); }
  };

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); } else { n.add(id); loadDevices(id); }
      return n;
    });
  };

  const displayed = useMemo(() => users.filter(u => {
    if (filter === 'staff' && !u.is_staff)      return false;
    if (filter === 'admin' && !u.is_superuser)  return false;
    return true;
  }), [users, filter]);

  const openCreate = () => {
    setForm({ username:'', email:'', first_name:'', last_name:'', mobile_number:'', address:'', password:'', is_staff:false, is_superuser:false });
    setFormErr(''); setModal('create');
  };

  const openEdit = (u: User) => {
    setEditTarget(u);
    setForm({ username:u.username, email:u.email, first_name:u.first_name, last_name:u.last_name,
      mobile_number:u.mobile_number??'', address:u.address??'', password:'', is_staff:u.is_staff, is_superuser:u.is_superuser });
    setFormErr(''); setModal('edit');
  };

  const handleSave = async () => {
    if (!form.username.trim() || !form.email.trim()) { setFormErr('Username and email required'); return; }
    setSaving(true); setFormErr('');
    try {
      const payload: any = { ...form };
      if (!payload.password) delete payload.password;
      if (modal === 'create') await apiService.createUser(payload);
      else if (editTarget) await apiService.updateUser(editTarget.id, payload);
      setModal('none'); fetchUsers(true);
    } catch (e: any) { setFormErr(e?.message ?? 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try { await apiService.deleteUser(deleteTarget.id); setModal('none'); fetchUsers(true); }
    catch { } finally { setSaving(false); }
  };

  const card = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: surface, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden', ...extra,
  });
  const pill = (active: boolean, color = accent): React.CSSProperties => ({
    padding:'5px 12px', borderRadius:999, fontSize:'0.7rem', fontWeight:600,
    cursor:'pointer', border:'none', whiteSpace:'nowrap' as const, flexShrink:0,
    background: active ? `${color}22` : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'),
    color: active ? color : sub,
  });
  const inputStyle: React.CSSProperties = {
    width:'100%', background:inputBg, border:`1px solid ${border}`, borderRadius:8,
    padding:'9px 12px', fontSize:'0.8rem', color:text, outline:'none', boxSizing:'border-box',
  };

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100dvh', background:bg, gap:10, color:muted }}>
      <RefreshCw size={18} style={{ animation:'spin 1s linear infinite' }}/><span style={{ fontSize:'0.875rem' }}>Loading…</span>
    </div>
  );

  return (
    <div style={{ background:bg, minHeight:'100dvh', paddingBottom:96 }}>

      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#004d1e,#006b2b)', padding:'14px 16px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <div>
            <div style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.6)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>Users</div>
            <div style={{ fontSize:'1rem', fontWeight:700, color:'#fff', marginTop:1 }}>{totalCount} registered users</div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={openCreate}
              style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, cursor:'pointer', color:'#fff', padding:'6px 8px', display:'flex', alignItems:'center', gap:4, fontSize:'0.75rem', fontWeight:600 }}>
              <Plus size={14}/> Add
            </button>
            <button onClick={() => { setRefreshing(true); fetchUsers(true); }}
              style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, cursor:'pointer', color:'#fff', padding:'6px 8px', display:'flex' }}>
              <RefreshCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }}/>
            </button>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
          {[
            { label:'Total',  value: totalCount,                                           bg:'rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.9)' },
            { label:'Staff',  value: users.filter(u=>u.is_staff&&!u.is_superuser).length, bg:'rgba(59,130,246,0.25)',  color:'#93c5fd' },
            { label:'Admins', value: users.filter(u=>u.is_superuser).length,              bg:'rgba(139,92,246,0.25)', color:'#c4b5fd' },
          ].map(({ label, value, bg:kb, color }) => (
            <div key={label} style={{ background:kb, borderRadius:10, padding:'8px 4px', textAlign:'center', border:'1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize:'1.2rem', fontWeight:700, color }}>{value}</div>
              <div style={{ fontSize:'0.58rem', color:'rgba(255,255,255,0.6)', marginTop:1 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding:'12px 12px 0', display:'flex', flexDirection:'column', gap:10 }}>

        <div style={{ position:'relative' }}>
          <Search size={14} color={muted} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)' }}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users…"
            style={{ ...inputStyle, paddingLeft:32 }}/>
        </div>

        <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:2 }}>
          {(['all','staff','admin'] as const).map(f => (
            <button key={f} style={pill(filter===f)} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase()+f.slice(1)}
            </button>
          ))}
        </div>

        <div style={{ fontSize:'0.7rem', color:muted }}>{displayed.length} user{displayed.length!==1?'s':''}</div>

        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {displayed.map(u => {
            const isExp = expanded.has(u.id);
            const ac = avatarColor(u.username);
            const devList = devices[u.id] ?? [];
            return (
              <div key={u.id} style={card()}>
                <button onClick={() => toggleExpand(u.id)}
                  style={{ width:'100%', background:'none', border:'none', cursor:'pointer', padding:'12px', textAlign:'left', display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:38, height:38, borderRadius:12, background:ac, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:'0.8rem', fontWeight:700, color:'#fff' }}>
                    {initials(u)}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                      <span style={{ fontSize:'0.85rem', fontWeight:600, color:text }}>{fullName(u)}</span>
                      {u.is_superuser && <Crown size={12} color="#f59e0b"/>}
                      {u.is_staff && !u.is_superuser && <Shield size={11} color="#3b82f6"/>}
                    </div>
                    <div style={{ fontSize:'0.7rem', color:muted }}>@{u.username} · {u.email}</div>
                    <div style={{ fontSize:'0.68rem', color:sub, marginTop:2 }}>
                      Joined {new Date(u.date_joined).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
                    </div>
                  </div>
                  {isExp ? <ChevronUp size={14} color={muted}/> : <ChevronDown size={14} color={muted}/>}
                </button>

                {isExp && (
                  <div style={{ padding:'10px 12px 12px', borderTop:`1px solid ${border}`, display:'flex', flexDirection:'column', gap:8 }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                      <div>
                        <div style={{ fontSize:'0.6rem', color:muted, textTransform:'uppercase', letterSpacing:'0.04em' }}>Email</div>
                        <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:'0.72rem', color:sub }}><Mail size={11} color={muted}/>{u.email}</div>
                      </div>
                      {u.mobile_number && (
                        <div>
                          <div style={{ fontSize:'0.6rem', color:muted, textTransform:'uppercase', letterSpacing:'0.04em' }}>Mobile</div>
                          <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:'0.72rem', color:sub }}><Phone size={11} color={muted}/>{u.mobile_number}</div>
                        </div>
                      )}
                    </div>
                    {/* Devices */}
                    <div>
                      <div style={{ fontSize:'0.65rem', color:muted, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:6 }}>
                        Devices {loadingDev.has(u.id) ? '…' : `(${devList.length})`}
                      </div>
                      {devList.length > 0 ? (
                        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                          {devList.map(d => (
                            <div key={d.id} style={{ display:'flex', alignItems:'center', gap:6, background: isDark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.03)', borderRadius:8, padding:'6px 8px' }}>
                              <Cpu size={12} color={accent}/>
                              <span style={{ fontSize:'0.72rem', fontFamily:'monospace', color:sub }}>{d.device_serial}</span>
                              {d.model && <span style={{ fontSize:'0.65rem', color:muted }}>· {d.model}</span>}
                            </div>
                          ))}
                        </div>
                      ) : !loadingDev.has(u.id) && (
                        <div style={{ fontSize:'0.72rem', color:muted, fontStyle:'italic' }}>No devices assigned</div>
                      )}
                    </div>
                    <div style={{ display:'flex', gap:8, marginTop:4 }}>
                      <button onClick={() => openEdit(u)}
                        style={{ flex:1, padding:'7px 0', background:`${accent}18`, border:`1px solid ${accent}44`, borderRadius:8, cursor:'pointer', color:accent, fontSize:'0.75rem', fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
                        <Edit2 size={12}/> Edit
                      </button>
                      <button onClick={() => { setDeleteTarget(u); setModal('delete'); }}
                        style={{ flex:1, padding:'7px 0', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, cursor:'pointer', color:'#ef4444', fontSize:'0.75rem', fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
                        <Trash2 size={12}/> Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {totalPages > 1 && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, padding:'12px 0' }}>
            <button disabled={page<=1} onClick={() => setPage(p=>p-1)}
              style={{ padding:'6px 14px', background:page>1?`${accent}22`:'transparent', border:`1px solid ${border}`, borderRadius:8, cursor:page>1?'pointer':'default', color:page>1?accent:muted, fontSize:'0.75rem', fontWeight:600 }}>Prev</button>
            <span style={{ fontSize:'0.75rem', color:muted }}>{page} / {totalPages}</span>
            <button disabled={page>=totalPages} onClick={() => setPage(p=>p+1)}
              style={{ padding:'6px 14px', background:page<totalPages?`${accent}22`:'transparent', border:`1px solid ${border}`, borderRadius:8, cursor:page<totalPages?'pointer':'default', color:page<totalPages?accent:muted, fontSize:'0.75rem', fontWeight:600 }}>Next</button>
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      {(modal==='create'||modal==='edit') && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:1000, display:'flex', alignItems:'flex-end' }} onClick={() => setModal('none')}>
          <div style={{ background:surface, borderRadius:'20px 20px 0 0', padding:'20px 16px 32px', width:'100%', maxHeight:'85dvh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <div style={{ fontSize:'1rem', fontWeight:700, color:text }}>{modal==='create'?'Add User':'Edit User'}</div>
              <button onClick={() => setModal('none')} style={{ background:'none', border:'none', cursor:'pointer', color:muted }}><X size={18}/></button>
            </div>
            {formErr && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, padding:'8px 12px', fontSize:'0.75rem', color:'#ef4444', marginBottom:12 }}>{formErr}</div>}
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                {key:'first_name',label:'First Name'},{key:'last_name',label:'Last Name'},
                {key:'username',label:'Username'},{key:'email',label:'Email',type:'email'},
                {key:'mobile_number',label:'Mobile'},{key:'address',label:'Address'},
                ...(modal==='create'?[{key:'password',label:'Password',type:'password'}]:[]),
              ].map(({key,label,type='text'}) => (
                <div key={key}>
                  <div style={{ fontSize:'0.7rem', color:muted, marginBottom:4 }}>{label}</div>
                  <input type={type} value={(form as any)[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} style={inputStyle}/>
                </div>
              ))}
              <div style={{ display:'flex', gap:12 }}>
                {[{key:'is_staff',label:'Staff'},{key:'is_superuser',label:'Admin'}].map(({key,label}) => (
                  <label key={key} style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:'0.8rem', color:sub }}>
                    <div onClick={()=>setForm(f=>({...f,[key]:!(f as any)[key]}))}
                      style={{ width:18,height:18,borderRadius:5,border:`1.5px solid ${(form as any)[key]?accent:border}`,background:(form as any)[key]?accent:'transparent',display:'flex',alignItems:'center',justifyContent:'center' }}>
                      {(form as any)[key] && <Check size={11} color="#fff"/>}
                    </div>{label}
                  </label>
                ))}
              </div>
              <button onClick={handleSave} disabled={saving}
                style={{ marginTop:8,padding:'11px',background:'linear-gradient(135deg,#004d1e,#006b2b)',border:'none',borderRadius:10,cursor:'pointer',color:'#fff',fontSize:'0.875rem',fontWeight:700,opacity:saving?0.7:1 }}>
                {saving?'Saving…':'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal==='delete' && deleteTarget && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 16px' }} onClick={() => setModal('none')}>
          <div style={{ background:surface, borderRadius:16, padding:'20px 16px', width:'100%', maxWidth:360 }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:'1rem', fontWeight:700, color:text, marginBottom:8 }}>Delete User?</div>
            <div style={{ fontSize:'0.8rem', color:sub, marginBottom:20 }}>Remove <strong>{fullName(deleteTarget)}</strong> permanently?</div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setModal('none')} style={{ flex:1,padding:'10px',background:'transparent',border:`1px solid ${border}`,borderRadius:8,cursor:'pointer',color:text,fontSize:'0.8rem' }}>Cancel</button>
              <button onClick={handleDelete} disabled={saving} style={{ flex:1,padding:'10px',background:'#ef4444',border:'none',borderRadius:8,cursor:'pointer',color:'#fff',fontSize:'0.8rem',fontWeight:700 }}>
                {saving?'Deleting…':'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }`}</style>
    </div>
  );
};

export default MobileUsers;
