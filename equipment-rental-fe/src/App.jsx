import { useState, useEffect, useCallback } from 'react'

const API = (process.env.REACT_APP_API_URL || 'http://localhost:8080').replace(/\/$/, '')
const CATS = ['กีฬา', 'ไอที', 'อุปกรณ์ถ่ายภาพ', 'อื่นๆ']
const ICON = { 'กีฬา': '⚽', 'ไอที': '💻', 'อุปกรณ์ถ่ายภาพ': '📷', 'อื่นๆ': '📦' }
const ST = { pending: ['รออนุมัติ', 'warn'], approved: ['กำลังยืม', 'info'], rejected: ['ปฏิเสธ', 'bad'], returned: ['คืนแล้ว', 'ok'] }
const today = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)

let token = localStorage.getItem('token')
async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {}
  if (token) headers.Authorization = 'Bearer ' + token
  if (body) headers['Content-Type'] = 'application/json'
  const res = await fetch(API + path, { method, headers, body: form || (body && JSON.stringify(body)) })
  if (res.status === 204) return null
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error?.message || 'เกิดข้อผิดพลาด'), { code: data.error?.code, status: res.status })
  return data
}

export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || 'null'))
  // หน้าปัจจุบันเก็บใน URL (#/detail/3, #/admin ...) จึงกด Back/Refresh ได้ และไม่ต้องตั้งค่า rewrite บน Vercel
  const parse = () => {
    const [n, id] = window.location.hash.replace(/^#\/?/, '').split('/')
    return { name: ['detail', 'login', 'register', 'profile', 'admin'].includes(n) ? n : 'home', id }
  }
  const [view, setView] = useState(parse)
  useEffect(() => {
    const h = () => { setView(parse()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h)
  }, [])
  const [toast, setToast] = useState(null)
  const say = (msg, type = 'ok') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }
  const go = (name, id) => { window.location.hash = name === 'home' ? '' : '/' + name + (id ? '/' + id : '') }
  const login = (t, m) => { token = t; localStorage.setItem('token', t); localStorage.setItem('user', JSON.stringify(m)); setUser(m) }
  const logout = (msg) => { token = null; localStorage.clear(); setUser(null); go('login'); msg && say(msg, 'bad') }
  // เรียก API: ตั๋วหมดอายุ/ไม่ถูกต้อง (401) -> พากลับหน้า login
  const call = async (...a) => {
    try { return await api(...a) } catch (e) {
      if (e.status === 401 && e.code !== 'BAD_CREDENTIALS') logout('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่')
      throw e
    }
  }
  const ctx = { user, go, say, call, login, logout }
  const isMember = user && user.role !== 'guest'
  const V = { home: Home, detail: Detail, login: Auth, register: Auth, profile: Profile, admin: Admin }[view.name]

  return (<>
    <nav><div className="in">
      <span className="logo" onClick={() => go('home')}>📦 ระบบยืม-คืนอุปกรณ์</span>
      <button className="btn" onClick={() => go('home')}>อุปกรณ์</button>
      {user?.role === 'admin' && <button className="btn" onClick={() => go('admin')}>จัดการระบบ</button>}
      {isMember && <button className="btn" onClick={() => go('profile')}>👤 {user.displayName}</button>}
      {user ? <button className="btn" onClick={() => logout()}>ออกจากระบบ</button> : <>
        <button className="btn" onClick={() => go('login')}>เข้าสู่ระบบ</button>
        <button className="btn pri" onClick={() => go('register')}>สมัครสมาชิก</button></>}
    </div></nav>
    <div className="wrap"><V key={view.name + (view.id || '')} {...ctx} view={view} /></div>
    {toast && <div className={'toast ' + toast.type}>{toast.msg}</div>}
  </>)
}

function Home({ go, say }) {
  const [items, setItems] = useState(null), [q, setQ] = useState(''), [cat, setCat] = useState('')
  const [cats, setCats] = useState(CATS)
  useEffect(() => { api('/api/categories').then(r => setCats(r.items)).catch(() => {}) }, [])
  useEffect(() => {
    const t = setTimeout(() => api(`/api/equipment?q=${encodeURIComponent(q)}&category=${encodeURIComponent(cat)}`)
      .then(r => setItems(r.items)).catch(e => say(e.message, 'bad')), 250)
    return () => clearTimeout(t)
  }, [q, cat])
  return (<>
    <h1>อุปกรณ์ที่ให้ยืม</h1><p className="sub">เลือกอุปกรณ์ที่ต้องการ แล้วส่งคำขอยืมได้เลย</p>
    <input placeholder="🔍 ค้นหาชื่ออุปกรณ์…" value={q} onChange={e => setQ(e.target.value)} />
    <div className="chips">{['', ...cats].map(c => <button key={c} className={'chip' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>{c ? ICON[c] + ' ' + c : 'ทั้งหมด'}</button>)}</div>
    {!items ? <div className="empty">กำลังโหลด…</div> : !items.length ? <div className="empty">ไม่พบอุปกรณ์</div> :
      <div className="grid">{items.map(e => (
        <div key={e.id} className="card item" onClick={() => go('detail', e.id)}>
          <Pic e={e} /><div className="b"><span className="tag">{e.category}</span><h3>{e.name}</h3>
            <span className={'badge ' + (e.available ? 'ok' : 'bad')}>{e.available ? 'พร้อมให้ยืม' : 'ถูกยืมหมดแล้ว'}</span>
            <span style={{ color: 'var(--mute)', fontSize: 13, marginLeft: 8 }}>เหลือ {e.availableQty}/{e.totalQty}</span></div></div>))}</div>}
  </>)
}
const Pic = ({ e }) => <div className="img">{e.imageUrl ? <img src={e.imageUrl} alt={e.name} /> : ICON[e.category] || '📦'}</div>

function Detail({ view, user, go, say, call }) {
  const [e, setE] = useState(null)
  const [f, setF] = useState({ quantity: 1, borrowDate: today(), returnDate: today() })
  const [busy, setBusy] = useState(false)
  useEffect(() => { api('/api/equipment/' + view.id).then(setE).catch(x => say(x.message, 'bad')) }, [])
  if (!e) return <div className="empty">กำลังโหลด…</div>
  const submit = async () => {
    if (!user) { say('กรุณาเข้าสู่ระบบก่อนขอยืม', 'bad'); return go('login') }
    if (user.role === 'guest') return say('บัญชี Guest ไม่มีสิทธิ์ขอยืม กรุณาสมัครเป็นสมาชิก', 'bad')
    setBusy(true)
    try { await call('/api/borrow-requests', { method: 'POST', body: { equipmentId: e.id, ...f, quantity: +f.quantity } })
      say('ส่งคำขอยืมแล้ว รอผู้ดูแลอนุมัติ'); go('profile') } catch (x) { say(x.message, 'bad') }
    setBusy(false)
  }
  return (<>
    <button className="btn sm" onClick={() => go('home')}>← กลับ</button><div style={{ height: 16 }} />
    <div className="two"><div className="card" style={{ padding: 0, overflow: 'hidden' }}><Pic e={e} /></div>
      <div className="card"><span className="tag">{e.category}</span><h1 style={{ marginTop: 8 }}>{e.name}</h1>
        <span className={'badge ' + (e.available ? 'ok' : 'bad')}>{e.available ? 'พร้อมให้ยืม' : 'ถูกยืมหมดแล้ว'}</span>
        <p style={{ color: 'var(--mute)' }}>{e.description || 'ไม่มีรายละเอียด'}</p><p>คงเหลือ <b>{e.availableQty}</b> จากทั้งหมด {e.totalQty} ชิ้น</p>
        <div className="row"><div><label>จำนวน</label><input type="number" min="1" max={e.availableQty} value={f.quantity} onChange={x => setF({ ...f, quantity: x.target.value })} /></div>
          <div><label>วันที่ยืม</label><input type="date" min={today()} value={f.borrowDate} onChange={x => setF({ ...f, borrowDate: x.target.value, returnDate: x.target.value > f.returnDate ? x.target.value : f.returnDate })} /></div>
          <div><label>วันที่คืน</label><input type="date" min={f.borrowDate} value={f.returnDate} onChange={x => setF({ ...f, returnDate: x.target.value })} /></div></div>
        <div style={{ height: 16 }} /><button className="btn pri" disabled={!e.available || busy} onClick={submit}>{e.available ? 'ขอยืม' : 'ถูกยืมหมดแล้ว'}</button>
        {!user && e.available && <p className="sub" style={{ marginTop: 8 }}>* ต้องเข้าสู่ระบบก่อนจึงจะขอยืมได้</p>}</div></div>
  </>)
}

function Auth({ view, go, say, login }) {
  const reg = view.name === 'register'
  const [f, setF] = useState({ email: '', password: '', displayName: '' }), [busy, setBusy] = useState(false)
  const set = k => x => setF({ ...f, [k]: x.target.value })
  const submit = async (ev) => {
    ev.preventDefault(); setBusy(true)
    try {
      if (reg) { await api('/api/auth/register', { method: 'POST', body: { ...f, role: 'member' } }); say('สมัครสำเร็จ กำลังเข้าสู่ระบบ') }
      const r = await api('/api/auth/login', { method: 'POST', body: { email: f.email, password: f.password } })
      login(r.token, r.member); go('home')
    } catch (e) { say(e.message, 'bad') }
    setBusy(false)
  }
  return (<form className="card center" onSubmit={submit}><h1>{reg ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}</h1><p className="sub">{reg ? 'สร้างบัญชีเพื่อขอยืมอุปกรณ์' : 'ยินดีต้อนรับกลับมา'}</p>
    {reg && <><label>ชื่อที่แสดง</label><input required maxLength="50" value={f.displayName} onChange={set('displayName')} /></>}
    <label>อีเมล</label><input type="email" required value={f.email} onChange={set('email')} />
    <label>รหัสผ่าน{reg && ' (อย่างน้อย 8 ตัวอักษร)'}</label><input type="password" required minLength={reg ? 8 : 1} value={f.password} onChange={set('password')} />
    <div style={{ height: 20 }} /><button className="btn pri" style={{ width: '100%' }} disabled={busy}>{reg ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}</button>
    <p className="sub" style={{ marginTop: 16, textAlign: 'center' }}>{reg ? 'มีบัญชีแล้ว?' : 'ยังไม่มีบัญชี?'} <a href="#" onClick={e => { e.preventDefault(); go(reg ? 'login' : 'register') }}>{reg ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}</a></p></form>)
}

const Status = ({ s }) => <span className={'badge ' + ST[s][1]}>{ST[s][0]}</span>

function Profile({ user, go, say, call }) {
  const [me, setMe] = useState(null), [hist, setHist] = useState(null), [p, setP] = useState({ currentPassword: '', newPassword: '' })
  useEffect(() => {
    if (!user || user.role === 'guest') return
    call('/api/me').then(setMe).catch(() => {}); call('/api/me/borrow-requests').then(r => setHist(r.items)).catch(() => {})
  }, [])
  if (!user) { return <div className="empty">กรุณาเข้าสู่ระบบ <button className="btn pri" onClick={() => go('login')}>เข้าสู่ระบบ</button></div> }
  if (user.role === 'guest') return <div className="empty">บัญชี Guest ไม่มีหน้า Profile กรุณาสมัครสมาชิก</div>
  const change = async (e) => {
    e.preventDefault()
    try { const r = await call('/api/me/password', { method: 'PUT', body: p }); say(r.message); setP({ currentPassword: '', newPassword: '' }) } catch (x) { say(x.message, 'bad') }
  }
  return (<>
    <h1>โปรไฟล์ของฉัน</h1><p className="sub">ข้อมูลส่วนตัว ประวัติการยืม และเปลี่ยนรหัสผ่าน</p>
    <div className="two" style={{ marginBottom: 20 }}>
      <div className="card"><h2>ข้อมูลส่วนตัว</h2>{me ? <><p>ชื่อ: <b>{me.displayName}</b></p><p>อีเมล: <b>{me.email}</b></p><p>สถานะ: <span className="tag">{me.role === 'admin' ? 'ผู้ดูแลระบบ' : 'สมาชิก'}</span></p></> : 'กำลังโหลด…'}</div>
      <form className="card" onSubmit={change}><h2>เปลี่ยนรหัสผ่าน</h2>
        <label>รหัสผ่านเดิม</label><input type="password" required value={p.currentPassword} onChange={e => setP({ ...p, currentPassword: e.target.value })} />
        <label>รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)</label><input type="password" required minLength="8" value={p.newPassword} onChange={e => setP({ ...p, newPassword: e.target.value })} />
        <div style={{ height: 16 }} /><button className="btn pri">บันทึกรหัสผ่านใหม่</button></form></div>
    <div className="card"><h2>ประวัติการยืมของฉัน</h2>{!hist ? 'กำลังโหลด…' : !hist.length ? <div className="empty">ยังไม่เคยยืมอุปกรณ์</div> :
      <div className="scroll"><table className="tbl"><thead><tr><th>อุปกรณ์</th><th>จำนวน</th><th>วันที่ยืม</th><th>วันที่คืน</th><th>สถานะ</th></tr></thead>
        <tbody>{hist.map(r => <tr key={r.id}><td>{r.equipmentName}</td><td>{r.quantity}</td><td>{r.borrowDate}</td><td>{r.returnDate}</td><td><Status s={r.status} /></td></tr>)}</tbody></table></div>}</div>
  </>)
}

function Admin({ user, say, call }) {
  const [tab, setTab] = useState('requests')
  const [stats, setStats] = useState(null)
  const loadStats = useCallback(() => call('/api/admin/stats').then(setStats).catch(() => {}), [])
  useEffect(() => { loadStats() }, [])
  if (user?.role !== 'admin') return <div className="empty">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</div>
  const S = [['equipment', 'อุปกรณ์'], ['outOfStock', 'ถูกยืมหมด'], ['members', 'สมาชิก'], ['pendingRequests', 'รออนุมัติ'], ['activeLoans', 'กำลังถูกยืม']]
  return (<>
    <h1>Admin Dashboard</h1><p className="sub">จัดการคลังอุปกรณ์และอนุมัติการยืม–คืน</p>
    <div className="stats">{S.map(([k, l]) => <div key={k} className="card stat"><b>{stats ? stats[k] : '–'}</b><span>{l}</span></div>)}</div>
    <div className="tabs"><button className={'chip' + (tab === 'requests' ? ' on' : '')} onClick={() => setTab('requests')}>คำขอยืม–คืน</button>
      <button className={'chip' + (tab === 'equipment' ? ' on' : '')} onClick={() => setTab('equipment')}>คลังอุปกรณ์</button></div>
    {tab === 'requests' ? <Requests call={call} say={say} reload={loadStats} /> : <Stock call={call} say={say} reload={loadStats} />}
  </>)
}

function Requests({ call, say, reload }) {
  const [st, setSt] = useState('pending'), [rows, setRows] = useState(null)
  const load = useCallback(() => call('/api/admin/borrow-requests?status=' + st).then(r => setRows(r.items)).catch(e => say(e.message, 'bad')), [st])
  useEffect(() => { setRows(null); load() }, [st])
  const act = async (id, what, ok) => {
    try { await call(`/api/admin/borrow-requests/${id}/${what}`, { method: 'PUT' }); say(ok); load(); reload() } catch (e) { say(e.message, 'bad') }
  }
  return (<div className="card">
    <div className="chips" style={{ marginTop: 0 }}>{[['pending', 'รออนุมัติ'], ['approved', 'กำลังยืม'], ['returned', 'คืนแล้ว'], ['rejected', 'ปฏิเสธ'], ['', 'ทั้งหมด']].map(([v, l]) =>
      <button key={v} className={'chip' + (st === v ? ' on' : '')} onClick={() => setSt(v)}>{l}</button>)}</div>
    {!rows ? 'กำลังโหลด…' : !rows.length ? <div className="empty">ไม่มีรายการ</div> :
      <div className="scroll"><table className="tbl"><thead><tr><th>ผู้ขอยืม</th><th>อุปกรณ์</th><th>จำนวน</th><th>ช่วงเวลา</th><th>สถานะ</th><th></th></tr></thead>
        <tbody>{rows.map(r => <tr key={r.id}><td>{r.memberName}<br /><small style={{ color: 'var(--mute)' }}>{r.memberEmail}</small></td><td>{r.equipmentName}</td><td>{r.quantity}</td>
          <td>{r.borrowDate} → {r.returnDate}</td><td><Status s={r.status} /></td>
          <td><div className="acts">
            {r.status === 'pending' && <><button className="btn sm pri" onClick={() => act(r.id, 'approve', 'อนุมัติแล้ว (หักสต็อกแล้ว)')}>อนุมัติ</button><button className="btn sm bad" onClick={() => act(r.id, 'reject', 'ปฏิเสธคำขอแล้ว')}>ปฏิเสธ</button></>}
            {r.status === 'approved' && <button className="btn sm pri" onClick={() => act(r.id, 'return', 'รับคืนแล้ว (คืนสต็อกแล้ว)')}>รับคืน</button>}</div></td></tr>)}</tbody></table></div>}
  </div>)
}

const blank = { name: '', category: 'อื่นๆ', description: '', totalQty: 1, imageUrl: '' }
function Stock({ call, say, reload }) {
  const [rows, setRows] = useState(null), [f, setF] = useState(null)
  const load = useCallback(() => api('/api/equipment').then(r => setRows(r.items)).catch(e => say(e.message, 'bad')), [])
  useEffect(() => { load() }, [])
  const save = async (e) => {
    e.preventDefault()
    try { await call(f.id ? '/api/admin/equipment/' + f.id : '/api/admin/equipment', { method: f.id ? 'PUT' : 'POST', body: { ...f, totalQty: +f.totalQty } })
      say(f.id ? 'บันทึกการแก้ไขแล้ว' : 'เพิ่มอุปกรณ์แล้ว'); setF(null); load(); reload() } catch (x) { say(x.message, 'bad') }
  }
  const del = async (r) => {
    if (!window.confirm(`ลบ "${r.name}" ออกจากระบบ?\n(ประวัติการยืมยังอยู่ครบ)`)) return
    try { await call('/api/admin/equipment/' + r.id, { method: 'DELETE' }); say('ลบอุปกรณ์แล้ว'); load(); reload() } catch (x) { say(x.message, 'bad') }
  }
  const upload = async (file) => {
    if (!file) return
    const fd = new FormData(); fd.append('image', file)
    try { const r = await call('/api/admin/upload-image', { method: 'POST', form: fd }); setF(v => ({ ...v, imageUrl: r.url })); say('อัปโหลดรูปแล้ว') } catch (x) { say(x.message, 'bad') }
  }
  const set = k => e => setF({ ...f, [k]: e.target.value })
  return (<>
    {f && <form className="card" style={{ marginBottom: 16 }} onSubmit={save}><h2>{f.id ? 'แก้ไขอุปกรณ์' : 'เพิ่มอุปกรณ์ใหม่'}</h2>
      <div className="row"><div><label>ชื่ออุปกรณ์</label><input required maxLength="100" value={f.name} onChange={set('name')} /></div>
        <div><label>หมวดหมู่</label><select value={f.category} onChange={set('category')}>{CATS.map(c => <option key={c}>{c}</option>)}</select></div>
        <div><label>จำนวนทั้งหมด</label><input type="number" min="0" required value={f.totalQty} onChange={set('totalQty')} /></div></div>
      <label>รายละเอียด</label><textarea rows="3" value={f.description || ''} onChange={set('description')} />
      <label>รูปภาพ (JPG/PNG/WEBP ไม่เกิน 5MB)</label>
      <div className="row" style={{ alignItems: 'center' }}><input type="file" accept="image/*" onChange={e => upload(e.target.files[0])} />
        {f.imageUrl && <img src={f.imageUrl} alt="" style={{ height: 64, borderRadius: 8, flex: 'none', minWidth: 0 }} />}</div>
      <div style={{ height: 16 }} /><div className="acts"><button className="btn pri">บันทึก</button><button type="button" className="btn" onClick={() => setF(null)}>ยกเลิก</button></div></form>}
    <div className="card"><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}><h2 style={{ margin: 0 }}>คลังอุปกรณ์</h2>
      <button className="btn pri" onClick={() => setF({ ...blank })}>+ เพิ่มอุปกรณ์</button></div>
      {!rows ? 'กำลังโหลด…' : !rows.length ? <div className="empty">ยังไม่มีอุปกรณ์</div> :
        <div className="scroll"><table className="tbl"><thead><tr><th>ชื่อ</th><th>หมวดหมู่</th><th>ว่าง/ทั้งหมด</th><th>สถานะ</th><th></th></tr></thead>
          <tbody>{rows.map(r => <tr key={r.id}><td>{r.name}</td><td><span className="tag">{r.category}</span></td><td>{r.availableQty}/{r.totalQty}</td>
            <td><span className={'badge ' + (r.available ? 'ok' : 'bad')}>{r.available ? 'พร้อมให้ยืม' : 'ถูกยืมหมดแล้ว'}</span></td>
            <td><div className="acts"><button className="btn sm" onClick={() => setF({ ...r })}>แก้ไข</button><button className="btn sm bad" onClick={() => del(r)}>ลบ</button></div></td></tr>)}</tbody></table></div>}</div>
  </>)
}
