import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowLeft, Download, FileText, Plus, Save, Sparkles, Trash2, Upload, Wand2 } from 'lucide-react'
import './index.css'

const API = '/api'
const api = async (path, options = {}) => {
  const headers = options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }
  const r = await fetch(`${API}${path}`, { headers, ...options })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}
const templates = ['classic', 'modern', 'executive', 'technical', 'minimal', 'two-column', 'corporate', 'ats-optimized']
const templateMeta = {
  classic: ['Traditional Serif', 'ResumeGenius / Harvard-style conservative format'],
  modern: ['Modern Accent', 'Novorésumé-style clean tech layout with restrained color'],
  executive: ['Executive Header', 'Zety-style authority header for senior leadership roles'],
  technical: ['Technical Sidebar', 'Novorésumé IT layout with dense skills sidebar'],
  minimal: ['Minimalist', 'Canva-style airy monochrome typography'],
  'two-column': ['Two-Column CV', 'Resume.io-style structured sidebar and scannable main column'],
  corporate: ['Corporate Consultant', 'Finance/consulting polish with navy and gold accents'],
  'ats-optimized': ['ATS Optimized', 'LinkedIn/plain parser-safe professional layout']
}
const blankResume = {
  contact: { name: '', title: '', email: '', phone: '', linkedin: '', portfolio: '', location: '' },
  summary: '', skills: [['', '', '']], technical: {}, experience: [], education: [], certifications: [], additional: [], custom_sections: []
}
const safe = (v) => String(v || '').replace(/<[^>]+>/g, '')
const cloneBlankResume = () => structuredClone(blankResume)
const normalizeSkillRows = (skills) => {
  if (!skills) return []
  const source = Array.isArray(skills) ? skills : Object.values(skills)
  const cells = []
  source.forEach(row => {
    let values = []
    if (Array.isArray(row)) values = row
    else if (typeof row === 'string') values = row.split(/[|,;•\n]/)
    else if (row && typeof row === 'object') {
      if (Array.isArray(row.items)) values = row.items
      else if (typeof row.items === 'string') values = row.items.split(/[|,;•\n]/)
      else values = [row.a, row.b, row.c, row.name, row.label, row.value]
    }
    cells.push(...values.map(x => String(x || '').trim()).filter(Boolean))
  })
  const rows = []
  for (let i = 0; i < cells.length; i += 3) rows.push(cells.slice(i, i + 3).concat(['', '', '']).slice(0, 3))
  return rows
}
const isBlankResumeData = (data) => JSON.stringify(data || {}) === JSON.stringify(blankResume)

function App() {
  const [page, setPage] = useState('editor')
  const [resumes, setResumes] = useState([])
  const [current, setCurrent] = useState(null)
  const load = () => api('/resumes').then(r => { setResumes(r); if (current && !r.find(x => x.id === current.id)) setCurrent(null) })
  useEffect(() => { load() }, [])
  return <div className="min-h-screen">
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#06070d]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div><h1 className="text-2xl font-black">Resume & Career Document Builder</h1><p className="text-sm text-slate-400">Premium self-hosted career tooling</p></div>
        <nav className="flex flex-wrap gap-2">{[['dashboard', 'Dashboard'], ['editor', 'Resume Builder'], ['cover', 'Cover Letter'], ['thanks', 'Thank You'], ['roles', 'Role Builder']].map(x => <button key={x[0]} onClick={() => { if (x[0] === 'editor') setCurrent(null); setPage(x[0]) }} className={`btn ${page === x[0] ? 'btn-primary' : ''}`}>{x[1]}</button>)}</nav>
      </div>
    </header>
    <main className="mx-auto max-w-7xl px-6 py-8">
      {page === 'dashboard' && <Dashboard resumes={resumes} setCurrent={setCurrent} setPage={setPage} reload={load} />}
      {page === 'editor' && (current ? <Editor resume={current} setResume={setCurrent} setPage={setPage} reload={load} /> : <EmptyEditor setCurrent={setCurrent} setPage={setPage} reload={load} />)}
      {page === 'cover' && <LetterBuilder kind="cover_letter" title="Cover Letter Builder" resumes={resumes} />}
      {page === 'thanks' && <LetterBuilder kind="thank_you" title="Thank You Letter Builder" resumes={resumes} />}
      {page === 'roles' && <RoleBuilder setCurrent={setCurrent} setPage={setPage} />}
    </main>
  </div>
}

function Dashboard({ resumes, setCurrent, setPage, reload }) {
  const [importReview, setImportReview] = useState(null)
  async function upload(e) { const f = e.target.files[0]; if (!f) return; const fd = new FormData(); fd.append('file', f); const r = await fetch('/api/upload', { method: 'POST', body: fd }); if (!r.ok) { alert(await r.text()); return } setImportReview(await r.json()); e.target.value = '' }
  async function loadSample() { const r = await api('/sample-resume', { method: 'POST' }); await reload(); setCurrent(r); setPage('editor') }
  async function del(e, id) { e.stopPropagation(); if (!confirm('Delete this saved document?')) return; await api(`/resumes/${id}`, { method: 'DELETE' }); await reload() }
  async function confirmImport(template = 'modern') { const r = await api('/import-confirm', { method: 'POST', body: JSON.stringify({ filename: importReview.filename, template, data: importReview.parsed }) }); setImportReview(null); await reload(); setCurrent(r); setPage('editor') }
  return <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
    <section className="space-y-6">
      <div className="glass p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-3xl font-black">Saved documents</h2><p className="text-slate-400">Dashboard: saved documents and intake tools. The editor lives under Resume Builder. Complicated, apparently.</p></div>
          <div className="flex flex-wrap gap-2"><button className="btn" onClick={loadSample}>Load Sample Resume</button><label className="btn btn-primary cursor-pointer"><Upload className="mr-2 inline h-4 w-4" />Upload Resume<input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={upload} /></label></div>
        </div>
        {resumes.length === 0 ? <div className="mt-10 rounded-3xl border border-dashed border-white/15 p-10 text-center text-slate-400"><FileText className="mx-auto mb-3 h-10 w-10 text-orange-300" />No saved documents. Use Resume Builder for a blank resume, upload one here, or build from description below.</div> : <div className="mt-6 grid gap-4 md:grid-cols-2">{resumes.map(r => <button key={r.id} onClick={() => { setCurrent(r); setPage('editor') }} className="glass relative p-5 text-left hover:border-orange-400"><button className="absolute right-3 top-3 rounded-full bg-red-500/15 p-2 text-red-300 hover:bg-red-500/30" onClick={(e) => del(e, r.id)} title="Delete"><Trash2 className="h-4 w-4" /></button><div className="text-xs uppercase tracking-[.2em] text-orange-300">{r.template}</div><h3 className="mt-2 pr-10 text-xl font-black">{r.name}</h3><p className="mt-1 text-slate-400">{r.title}</p><p className="mt-4 text-xs text-slate-500">Last edited {new Date(r.updated_at).toLocaleString()}</p></button>)}</div>}
      </div>
      <BuildFromDescription setCurrent={setCurrent} setPage={setPage} reload={reload} />
    </section>
    <aside className="glass p-6"><h3 className="text-xl font-black">Portfolio-ready</h3><p className="mt-2 text-slate-400">Live preview, ATS targeting, DOCX/PDF exports, Claude-assisted tailoring, upload review, and eight distinct templates.</p><div className="mt-6 space-y-3 text-sm text-slate-300"><p>• Blank resumes start with template selection</p><p>• Upload review: original left, parsed right</p><p>• AI Build from Description intake</p><p>• Delete cards with confirmation</p></div></aside>
    {importReview && <ImportReview review={importReview} onCancel={() => setImportReview(null)} onConfirm={confirmImport} />}
  </div>
}
function NeedResume() { return <div className="glass p-8 text-center text-slate-300">Create, upload, or load a resume first.</div> }
function EmptyEditor({ setCurrent, setPage, reload }) { return <TemplatePicker setCurrent={setCurrent} setPage={setPage} reload={reload} /> }

function TemplatePicker({ setCurrent, setPage, reload }) {
  function create(template) { setCurrent({ id: null, name: '', title: '', template, data: cloneBlankResume(), isDraft: true }); setPage('editor') }
  return <div className="glass p-6"><div className="mb-6 flex items-center justify-between"><div><h2 className="text-3xl font-black">Blank Resume — choose a template</h2><p className="text-slate-400">Eight research-backed professional categories. Starts blank. Nothing is saved until Save, because databases are not wishing wells.</p></div><button className="btn" onClick={() => setPage('dashboard')}>Back to Dashboard</button></div><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">{templates.map(t => <button key={t} onClick={() => create(t)} className="glass p-4 text-left hover:border-orange-400"><div className="mb-3"><div className="text-xs uppercase tracking-[.2em] text-orange-300">{templateMeta[t][0]}</div><p className="mt-1 min-h-10 text-xs leading-5 text-slate-400">{templateMeta[t][1]}</p></div><div className={`template-thumb resume-${t}`}><div className="thumb-header"></div><div className="thumb-line w-4/5"></div><div className="thumb-line w-3/5"></div><div className="thumb-section"></div><div className="thumb-line"></div><div className="thumb-line w-5/6"></div><div className="thumb-section"></div><div className="thumb-line w-4/6"></div></div></button>)}</div></div>
}

function ImportReview({ review, onCancel, onConfirm }) {
  const [template, setTemplate] = useState('modern')
  return <div className="fixed inset-0 z-50 overflow-auto bg-black/80 p-6 backdrop-blur"><div className="mx-auto max-w-7xl"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-3xl font-black">Review uploaded resume</h2><p className="text-slate-400">Original extraction on the left. Parsed editable resume on the right. Confirm before saving, because blindly trusting parsers is how HR software happened.</p></div><div className="flex gap-2"><select className="input w-56" value={template} onChange={e => setTemplate(e.target.value)}>{templates.map(t => <option key={t} value={t}>{templateMeta[t][0]}</option>)}</select><button className="btn" onClick={onCancel}>Cancel</button><button className="btn btn-primary" onClick={() => onConfirm(template)}>Confirm Import</button></div></div><div className="grid gap-5 lg:grid-cols-2"><pre className="glass max-h-[78vh] overflow-auto whitespace-pre-wrap p-5 text-sm text-slate-200 scrollbar">{review.original_text}</pre><div className="max-h-[78vh] overflow-auto scrollbar"><ResumePreview data={review.parsed} setData={() => { }} template={template} /></div></div></div></div>
}

function BuildFromDescription({ setCurrent, setPage, reload }) {
  const [f, setF] = useState({ title: '', years: '', skills: '', employer_role: '', education: '', achievements: '', target: '', tone: 'modern', template: 'modern' })
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setF({ ...f, [k]: v })
  async function build() { if (!f.title.trim()) { alert('Current or target job title is required'); return } setBusy(true); try { const r = await api('/build-from-description', { method: 'POST', body: JSON.stringify(f) }); await reload(); setCurrent(r); setPage('editor') } finally { setBusy(false) } }
  return <section className="glass p-6"><h2 className="text-2xl font-black">Build from Description</h2><p className="mt-1 text-slate-400">Personalized AI resume generation from real background details. Separate from the generic Role Builder.</p><div className="mt-4 grid gap-3 md:grid-cols-2"><Input label="Current or target job title" v={f.title} on={v => set('title', v)} /><Input label="Years of experience" v={f.years} on={v => set('years', v)} /><Input label="Most recent employer and role" v={f.employer_role} on={v => set('employer_role', v)} /><Input label="Education" v={f.education} on={v => set('education', v)} /><Input label="Target role/industry" v={f.target} on={v => set('target', v)} /><label className="mb-2 block text-sm text-slate-400">Tone preference<select className="input mt-1" value={f.tone} onChange={e => set('tone', e.target.value)}><option>formal</option><option>modern</option><option>technical</option></select></label><label className="mb-2 block text-sm text-slate-400 md:col-span-2">Key skills and technologies<textarea className="input mt-1 h-24" value={f.skills} onChange={e => set('skills', e.target.value)} /></label><label className="mb-2 block text-sm text-slate-400 md:col-span-2">Key achievements or projects<textarea className="input mt-1 h-28" value={f.achievements} onChange={e => set('achievements', e.target.value)} /></label></div><div className="mt-3 flex items-center gap-3"><select className="input w-56" value={f.template} onChange={e => set('template', e.target.value)}>{templates.map(t => <option key={t} value={t}>{templateMeta[t][0]}</option>)}</select><button className="btn btn-primary" onClick={build} disabled={busy}>{busy ? 'Building...' : 'Build Personalized Resume'}</button></div></section>
}

function Editor({ resume, setResume, setPage, reload }) {
  const [data, setData] = useState(resume.data)
  const [template, setTemplate] = useState(resume.template || 'modern')
  const [job, setJob] = useState('')
  const [tailor, setTailor] = useState(null)
  useEffect(() => { setData(resume.data); setTemplate(resume.template || 'modern') }, [resume.id, resume.isDraft])
  const dirty = JSON.stringify(data) !== JSON.stringify(resume.data) || template !== (resume.template || 'modern')
  const set = (path, val) => { const d = structuredClone(data); let o = d; path.slice(0, -1).forEach(k => o = o[k]); o[path.at(-1)] = val; setData(d) }
  async function save() { const payload = { name: (data.contact.name || 'Untitled') + ' Resume', title: data.contact.title || 'Resume', template, data }; const r = resume.id ? await api(`/resumes/${resume.id}`, { method: 'PUT', body: JSON.stringify(payload) }) : await api('/resumes', { method: 'POST', body: JSON.stringify(payload) }); setResume(r); reload() }
  async function dup() { if (!resume.id) { await save(); return } const r = await api(`/resumes/${resume.id}/duplicate`, { method: 'POST' }); setResume(r); reload() }
  async function analyze() { if (!resume.id) { alert('Save the resume before ATS analysis. Claude is not a mind reader.'); return } setTailor(await api('/tailor', { method: 'POST', body: JSON.stringify({ resume_id: resume.id, job_description: job }) })) }
  function back() { if (dirty && !confirm('Discard unsaved changes and return to the Dashboard?')) return; setResume(null); setPage('dashboard') }
  return <div className="grid gap-6 xl:grid-cols-[560px_1fr]">
    <section className="glass max-h-[calc(100vh-130px)] overflow-auto p-5 scrollbar">
      <div className="flex flex-wrap gap-2"><button className="btn" onClick={back}><ArrowLeft className="mr-1 inline h-4 w-4" />Back</button><button className="btn btn-primary" onClick={save}><Save className="mr-1 inline h-4 w-4" />Save</button><button className="btn" onClick={dup}>Save Version</button>{resume.id && <a className="btn" href={`/api/resumes/${resume.id}/export/docx`}><Download className="mr-1 inline h-4 w-4" />DOCX</a>}{resume.id && <a className="btn" href={`/api/resumes/${resume.id}/export/pdf`}>PDF</a>}</div>
      <label className="mt-4 block text-sm text-slate-400">Template</label><select className="input mt-1" value={template} onChange={e => setTemplate(e.target.value)}>{templates.map(t => <option key={t} value={t}>{templateMeta[t][0]}</option>)}</select>
      <Section title="Contact Info"><Input label="Name" v={data.contact.name} on={v => set(['contact', 'name'], v)} /><Input label="Title" v={data.contact.title} on={v => set(['contact', 'title'], v)} /><Input label="Email" v={data.contact.email} on={v => set(['contact', 'email'], v)} /><Input label="Phone" v={data.contact.phone} on={v => set(['contact', 'phone'], v)} /><Input label="LinkedIn" v={data.contact.linkedin} on={v => set(['contact', 'linkedin'], v)} /><Input label="Portfolio" v={data.contact.portfolio} on={v => set(['contact', 'portfolio'], v)} /><Input label="Location" v={data.contact.location} on={v => set(['contact', 'location'], v)} /></Section>
      <Section title="Professional Summary"><RichText value={data.summary} onChange={v => set(['summary'], v)} /></Section>
      <Skills data={data} setData={setData} />
      <Technical data={data} setData={setData} />
      <Experience data={data} setData={setData} />
      <Education data={data} setData={setData} />
      <List title="Certifications" items={data.certifications || []} setItems={x => set(['certifications'], x)} />
      <List title="Additional Experience" items={data.additional || []} setItems={x => set(['additional'], x)} />
      <CustomSections data={data} setData={setData} />
      <Section title="Job-targeted resume mode"><textarea className="input h-32" placeholder="Paste job description" value={job} onChange={e => setJob(e.target.value)} /><button className="btn btn-primary mt-2" onClick={analyze}><Sparkles className="mr-1 inline h-4 w-4" />Analyze ATS Fit</button>{tailor && <div className="mt-3 rounded-xl bg-black/30 p-3"><div className="text-2xl font-black text-orange-300">ATS {tailor.ats_score}%</div><p className="mt-2 text-sm">Missing keywords: {tailor.missing_keywords.join(', ') || 'None obvious'}</p><p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{tailor.suggestions}</p></div>}</Section>
    </section>
    <section className="overflow-auto scrollbar"><ResumePreview data={data} setData={setData} template={template} /></section>
  </div>
}
function Section({ title, children }) { return <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4"><h3 className="mb-3 font-black text-orange-300">{title}</h3>{children}</div> }
function Input({ label, v, on, type = 'text' }) { return <label className="mb-2 block text-sm text-slate-400">{label}<input type={type} className="input mt-1" value={v || ''} onChange={e => on(e.target.value)} /></label> }
function RichText({ value, onChange }) { return <div><div className="mb-2 flex gap-2"><button className="btn" onMouseDown={e => { e.preventDefault(); document.execCommand('bold') }}>Bold</button><button className="btn" onMouseDown={e => { e.preventDefault(); document.execCommand('italic') }}>Italic</button></div><div className="input min-h-28" contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: value || '' }} onBlur={e => onChange(e.currentTarget.innerHTML)} /></div> }
function List({ title, items, setItems, rich = false }) { const update = (i, v) => setItems(items.map((x, n) => n === i ? v : x)); const move = (i, d) => { const a = [...items], j = i + d; if (j < 0 || j >= a.length) return;[a[i], a[j]] = [a[j], a[i]]; setItems(a) }; return <Section title={title}>{items.map((x, i) => <div className="mb-2 flex gap-2" key={i}>{rich ? <div className="flex-1"><RichText value={x} onChange={v => update(i, v)} /></div> : <textarea className="input h-16" value={x} onChange={e => update(i, e.target.value)} />}<button className="btn" onClick={() => move(i, -1)}>↑</button><button className="btn" onClick={() => move(i, 1)}>↓</button><button className="btn" onClick={() => setItems(items.filter((_, n) => n !== i))}>×</button></div>)}<button className="btn" onClick={() => setItems([...items, ''])}><Plus className="mr-1 inline h-4 w-4" />Add</button></Section> }
function Skills({ data, setData }) { const rows = normalizeSkillRows(data.skills); const setCell = (i, j, v) => { const r = rows.map(row => [...row]); r[i][j] = v; setData({ ...data, skills: r }) }; const addChip = (i, v) => { if (!v.trim()) return; const r = rows.map(row => [...row]); const idx = r[i].findIndex(x => !x); if (idx >= 0) r[i][idx] = v.trim(); else r[i].push(v.trim()); setData({ ...data, skills: r.map(x => (x.concat(['', '', ''])).slice(0, 3)) }) }; return <Section title="Areas of Expertise"><p className="mb-3 text-sm text-slate-400">Edit chips or table cells. Three columns render in the preview. Blank cells no longer masquerade as competence.</p>{rows.map((row, i) => <div key={i} className="mb-3 rounded-xl bg-black/20 p-3"><div className="mb-2 flex flex-wrap gap-2">{row.filter(Boolean).map((chip, j) => <span key={j} className="rounded-full bg-orange-500/15 px-3 py-1 text-sm text-orange-200">{chip}<button className="ml-2" onClick={() => setCell(i, j, '')}>×</button></span>)}</div><div className="grid gap-2 md:grid-cols-3">{[0, 1, 2].map(j => <input key={j} className="input" placeholder={`Column ${j + 1}`} value={row[j] || ''} onChange={e => setCell(i, j, e.target.value)} />)}</div><div className="mt-2 flex gap-2"><input className="input" placeholder="Add chip" onKeyDown={e => { if (e.key === 'Enter') { addChip(i, e.currentTarget.value); e.currentTarget.value = '' } }} /><button className="btn" onClick={() => setData({ ...data, skills: rows.filter((_, n) => n !== i) })}>Remove row</button></div></div>)}<button className="btn" onClick={() => setData({ ...data, skills: [...rows, ['', '', '']] })}>Add expertise row</button></Section> }
function Technical({ data, setData }) { const entries = Object.entries(data.technical || {}); const update = (oldK, k, v) => { const t = { ...data.technical }; delete t[oldK]; t[k] = v; setData({ ...data, technical: t }) }; return <Section title="Technical Proficiencies">{entries.map(([k, v]) => <div className="mb-2 grid gap-2 md:grid-cols-[160px_1fr_auto]" key={k}><input className="input" value={k} onChange={e => update(k, e.target.value, v)} /><input className="input" value={v} onChange={e => update(k, k, e.target.value)} /><button className="btn" onClick={() => { const t = { ...data.technical }; delete t[k]; setData({ ...data, technical: t }) }}>×</button></div>)}<button className="btn" onClick={() => setData({ ...data, technical: { ...(data.technical || {}), Category: '' } })}>Add proficiency</button></Section> }
function Experience({ data, setData }) { const jobs = data.experience || []; const setJobs = experience => setData({ ...data, experience }); const [drag, setDrag] = useState(null); const moveJob = (from, to) => { if (from === null || to === null || from === to) return; const a = [...jobs]; const [x] = a.splice(from, 1); a.splice(to, 0, x); setJobs(a) }; return <Section title="Career Experience">{jobs.map((j, idx) => <div key={idx} draggable onDragStart={() => setDrag(idx)} onDragOver={e => e.preventDefault()} onDrop={() => moveJob(drag, idx)} className="mb-5 rounded-xl bg-black/20 p-3"><div className="mb-2 cursor-move text-xs uppercase tracking-[.2em] text-slate-500">Drag position #{idx + 1}</div><div className="grid gap-2 md:grid-cols-2"><Input label="Title" v={j.title} on={v => { const a = [...jobs]; a[idx].title = v; setJobs(a) }} /><Input label="Company" v={j.company} on={v => { const a = [...jobs]; a[idx].company = v; setJobs(a) }} /><Input label="Location" v={j.location} on={v => { const a = [...jobs]; a[idx].location = v; setJobs(a) }} /><Input label="Start date" type="month" v={j.start_date} on={v => { const a = [...jobs]; a[idx].start_date = v; a[idx].dates = `${v || ''} – ${a[idx].end_date || ''}`; setJobs(a) }} /><Input label="End date" type="month" v={j.end_date} on={v => { const a = [...jobs]; a[idx].end_date = v; a[idx].dates = `${a[idx].start_date || ''} – ${v || ''}`; setJobs(a) }} /></div><List title="Bullet points" rich items={j.bullets || []} setItems={items => { const a = [...jobs]; a[idx].bullets = items; setJobs(a) }} /><button className="btn" onClick={() => setJobs(jobs.filter((_, n) => n !== idx))}>Remove Position</button></div>)}<button className="btn" onClick={() => setJobs([...jobs, { title: '', company: '', location: '', start_date: '', end_date: '', dates: '', bullets: [''] }])}>Add Position</button></Section> }
function Education({ data, setData }) { const items = data.education || []; return <Section title="Education">{items.map((e, i) => <div className="mb-3 grid gap-2 md:grid-cols-3" key={i}><input className="input" placeholder="Degree" value={e.degree || ''} onChange={ev => { const a = [...items]; a[i].degree = ev.target.value; setData({ ...data, education: a }) }} /><input className="input" placeholder="School" value={e.school || ''} onChange={ev => { const a = [...items]; a[i].school = ev.target.value; setData({ ...data, education: a }) }} /><input className="input" placeholder="Details" value={e.details || ''} onChange={ev => { const a = [...items]; a[i].details = ev.target.value; setData({ ...data, education: a }) }} /></div>)}<button className="btn" onClick={() => setData({ ...data, education: [...items, { degree: '', school: '', details: '' }] })}>Add Education</button></Section> }
function CustomSections({ data, setData }) { const sections = data.custom_sections || []; return <Section title="Custom Sections">{sections.map((s, i) => <div className="mb-4 rounded-xl bg-black/20 p-3" key={i}><Input label="Section title" v={s.title} on={v => { const a = [...sections]; a[i].title = v; setData({ ...data, custom_sections: a }) }} /><List title="Bullets" items={s.bullets || []} setItems={items => { const a = [...sections]; a[i].bullets = items; setData({ ...data, custom_sections: a }) }} /><button className="btn" onClick={() => setData({ ...data, custom_sections: sections.filter((_, n) => n !== i) })}>Remove Custom Section</button></div>)}<button className="btn" onClick={() => setData({ ...data, custom_sections: [...sections, { title: 'Custom Section', bullets: [''] }] })}>Add Custom Section</button></Section> }

function Editable({ children, onSave, className = '', tag: Tag = 'span' }) { return <Tag className={className} contentEditable suppressContentEditableWarning onBlur={e => onSave(safe(e.currentTarget.innerHTML))}>{children}</Tag> }
function ResumePreview({ data, setData = () => {}, template }) {
  const placeholderResume = {
    contact: {
      name: 'Alex Johnson',
      title: 'Senior IT Professional',
      email: 'alex.johnson@email.com',
      phone: '(555) 555-0100',
      linkedin: 'linkedin.com/in/alexjohnson',
      portfolio: 'portfolio.example.com',
      location: 'Boston, MA'
    },
    summary: 'Senior IT professional with extensive experience supporting secure infrastructure, cloud services, Microsoft 365 environments, endpoint platforms, and business-critical systems. Known for practical troubleshooting, clear documentation, stakeholder support, and dependable execution across complex technology environments.',
    skills: [
      ['Network Administration', 'Cloud Infrastructure', 'Microsoft 365'],
      ['Active Directory', 'Endpoint Management', 'Security'],
      ['PowerShell', 'Virtualization', 'Infrastructure Documentation']
    ],
    technical: {
      'Platforms': 'Windows Server, Windows 10/11, Microsoft 365, Azure, VMware, Hyper-V, cloud-hosted services',
      'Administration': 'Active Directory, Group Policy, endpoint management, patching, backups, access control, documentation',
      'Security': 'Endpoint protection, MFA, monitoring, vulnerability remediation, incident response, policy enforcement'
    },
    experience: [
      { title: 'Senior IT Systems Administrator', company: 'Northbridge Technology Group', location: 'Boston, MA', dates: '2022 – Present', bullets: [
        'Administer secure network, server, Microsoft 365, and endpoint infrastructure supporting daily business operations.',
        'Maintain Active Directory, Group Policy, access controls, patching, backups, endpoint configuration, and technical documentation.',
        'Improve reliability and security by resolving recurring infrastructure issues and standardizing operational procedures.'
      ] },
      { title: 'IT Infrastructure Specialist', company: 'Harborview Professional Services', location: 'Cambridge, MA', dates: '2019 – 2022', bullets: [
        'Delivered infrastructure support, cloud administration, endpoint troubleshooting, and escalated technical resolution for multi-site users.',
        'Supported network, virtualization, Microsoft 365, and security tools while coordinating upgrades and vendor-assisted projects.',
        'Created repeatable support documentation that improved onboarding, troubleshooting consistency, and operational handoff.'
      ] }
    ],
    education: [{ degree: 'Bachelor of Science, Information Technology', school: 'Northeastern State College', details: 'Boston, MA' }],
    certifications: ['CompTIA Network+', 'Microsoft 365 Fundamentals', 'Azure Fundamentals'],
    additional: ['Selected projects include endpoint modernization, Microsoft 365 administration, network documentation, cloud migration support, and security policy improvements.'],
    custom_sections: []
  }
  const hasText = (v) => String(v || '').replace(/<[^>]+>/g, '').trim().length > 0
  const pick = (actual, fallback) => hasText(actual) ? actual : fallback
  const c = data?.contact || {}
  const pc = placeholderResume.contact
  const displayContact = {
    name: pick(c.name, pc.name), title: pick(c.title, pc.title), email: pick(c.email, pc.email), phone: pick(c.phone, pc.phone),
    linkedin: pick(c.linkedin, pc.linkedin), portfolio: pick(c.portfolio, pc.portfolio), location: pick(c.location, pc.location)
  }
  const actualSkillRows = normalizeSkillRows(data?.skills)
  const skillRows = actualSkillRows.flat().some(hasText) ? actualSkillRows : placeholderResume.skills
  const technicalEntries = Object.entries(data?.technical || {}).filter(([, v]) => hasText(v))
  const technicalRows = technicalEntries.length ? technicalEntries : Object.entries(placeholderResume.technical)
  const experienceRows = (data?.experience || []).filter(j => hasText(j?.title) || hasText(j?.company) || (j?.bullets || []).some(hasText))
  const jobs = experienceRows.length ? experienceRows : placeholderResume.experience
  const educationRows = (data?.education || []).filter(e => hasText(e?.degree) || hasText(e?.school) || hasText(e?.details))
  const education = educationRows.length ? educationRows : placeholderResume.education
  const certifications = (data?.certifications || []).filter(hasText)
  const certs = certifications.length ? certifications : placeholderResume.certifications
  const additionalRows = (data?.additional || []).filter(hasText)
  const additional = additionalRows.length ? additionalRows : placeholderResume.additional
  const customSections = (data?.custom_sections || []).filter(s => hasText(s?.title) || (s?.bullets || []).some(hasText))
  const ats = template === 'ats-optimized'
  const isPlaceholder = (value, fallback) => String(value || '') === String(fallback || '')
  const editableClass = (value, fallback, extra = '') => `${extra} ${isPlaceholder(value, fallback) ? 'resume-placeholder' : ''}`.trim()
  const setContact = (k, v) => setData({ ...data, contact: { ...(data.contact || {}), [k]: v } })
  const setSummary = v => setData({ ...data, summary: v })
  const setBullet = (i, j, v) => {
    const experience = structuredClone(data.experience || [])
    if (!experience[i]) return
    experience[i].bullets[j] = v
    setData({ ...data, experience })
  }
  const contactItems = [displayContact.email, displayContact.phone, displayContact.location, displayContact.linkedin, displayContact.portfolio]
  const contactLine = contactItems.filter(Boolean).join(ats ? ' | ' : ' • ')
  const HeaderIdentity = ({ sidebar = false }) => <>
    <Editable tag="h1" className={editableClass(displayContact.name, pc.name)} onSave={v => setContact('name', v)}>{displayContact.name}</Editable>
    <Editable tag="p" className={editableClass(displayContact.title, pc.title, sidebar ? 'sidebar-title' : 'resume-title')} onSave={v => setContact('title', v)}>{displayContact.title}</Editable>
  </>
  const ContactBlock = ({ compact = false }) => <div className={compact ? 'resume-contact-line' : 'resume-contact'}>{compact ? contactLine : contactItems.map((item, i) => <p key={i}>{item}</p>)}</div>
  const SectionHeading = ({ children }) => <H template={template}>{children}</H>
  const SkillsBlock = ({ chips = false } = {}) => <section className="resume-section resume-skills-block"><SectionHeading>Areas of Expertise</SectionHeading>{ats ? <p className="ats-skill-line">{skillRows.flat().filter(Boolean).join(' | ')}</p> : chips ? <div className="skill-chips">{skillRows.flat().filter(Boolean).map((skill, i) => <span key={i}>{skill}</span>)}</div> : <table className="skill-table"><tbody>{skillRows.map((r, i) => <tr key={i}>{[0, 1, 2].map(n => <td key={n}>{r[n] || ''}</td>)}</tr>)}</tbody></table>}</section>
  const TechnicalBlock = () => <section className="resume-section"><SectionHeading>Technical Proficiencies</SectionHeading><div className="technical-list">{technicalRows.map(([k, v]) => <p key={k}><b>{k}:</b> {v}</p>)}</div></section>
  const ExperienceBlock = () => <section className="resume-section"><SectionHeading>Career Experience</SectionHeading>{jobs.map((j, i) => <article key={i} className="experience-entry"><div className="job-line"><div><b>{[pick(j.title, placeholderResume.experience[i]?.title || 'Position Title'), pick(j.company, placeholderResume.experience[i]?.company || 'Company Name')].filter(Boolean).join(' — ')}</b><span>{pick(j.location, placeholderResume.experience[i]?.location || 'Location')}</span></div><time>{pick(j.dates, placeholderResume.experience[i]?.dates || 'Dates')}</time></div><ul>{((j.bullets || []).filter(hasText).length ? j.bullets.filter(hasText) : (placeholderResume.experience[i]?.bullets || placeholderResume.experience[0].bullets)).map((b, n) => <li key={n}>{experienceRows.length && data.experience?.[i]?.bullets?.[n] ? <Editable onSave={v => setBullet(i, n, v)}>{safe(b)}</Editable> : safe(b)}</li>)}</ul></article>)}</section>
  const EducationBlock = () => <section className="resume-section"><SectionHeading>Education</SectionHeading>{education.map((e, i) => <p key={i} className="education-line"><b>{pick(e.degree, placeholderResume.education[0].degree)}</b>{pick(e.school, placeholderResume.education[0].school) ? ` — ${pick(e.school, placeholderResume.education[0].school)}` : ''}{pick(e.details, placeholderResume.education[0].details) ? `, ${pick(e.details, placeholderResume.education[0].details)}` : ''}</p>)}</section>
  const CertBlock = () => <section className="resume-section"><SectionHeading>Certifications</SectionHeading><p className="cert-line">{certs.join(ats ? ' | ' : ' • ')}</p></section>
  const AdditionalBlock = () => <section className="resume-section"><SectionHeading>Additional Experience</SectionHeading>{additional.map((a, i) => <p key={i}>{a}</p>)}</section>
  const CustomBlock = () => customSections.map((s, i) => <section key={i} className="resume-section"><SectionHeading>{s.title}</SectionHeading><ul>{(s.bullets || []).filter(hasText).map((b, n) => <li key={n}>{b}</li>)}</ul></section>)
  const MainContent = ({ includeSkills = true, includeTechnical = true, includeCerts = true, includeAdditional = true, chips = false } = {}) => <main className="resume-main"><section className="resume-section resume-summary"><SectionHeading>Professional Summary</SectionHeading><Editable tag="p" className={editableClass(pick(data?.summary, placeholderResume.summary), placeholderResume.summary)} onSave={setSummary}>{safe(pick(data?.summary, placeholderResume.summary))}</Editable></section>{includeSkills && <SkillsBlock chips={chips} />}{includeTechnical && <TechnicalBlock />}<ExperienceBlock /><EducationBlock />{includeCerts && <CertBlock />}{includeAdditional && <AdditionalBlock />}<CustomBlock /></main>
  if (template === 'technical') return <div className="resume-page resume-technical resume-sidebar-layout"><aside className="resume-sidebar"><HeaderIdentity sidebar /><H template={template}>Contact</H><ContactBlock /><SkillsBlock chips /><CertBlock /></aside><MainContent includeSkills={false} includeCerts={false} /></div>
  if (template === 'two-column') return <div className="resume-page resume-two-column resume-sidebar-layout"><aside className="resume-sidebar"><HeaderIdentity sidebar /><H template={template}>Contact</H><ContactBlock /><SkillsBlock chips /><CertBlock /></aside><MainContent includeSkills={false} includeCerts={false} chips /></div>
  return <div className={`resume-page resume-${template}`}><header className="resume-header"><div className="resume-identity"><HeaderIdentity /></div>{template === 'modern' || template === 'minimal' || template === 'ats-optimized' ? <ContactBlock compact /> : <ContactBlock />}</header><MainContent /></div>
}
function H({ children, template }) { return <h2 className={`resume-section-title ${template === 'ats-optimized' ? 'ats-heading' : ''}`}>{children}</h2> }

function defaultLetter(kind, resume) {
  const c = resume?.data?.contact || {}
  const name = c.name || '[Your Name]'
  const contact = [c.email, c.phone, c.location, c.linkedin].filter(Boolean).join(' | ') || '[Email] | [Phone] | [Location]'
  const date = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  if (kind === 'thank_you') return `${name}\n${contact}\n\n${date}\n\nDear Hiring Manager,\n\nThank you for taking the time to speak with me about the opportunity. I appreciated learning more about the position, the team, and the priorities ahead.\n\nOur conversation reinforced my interest in the role, particularly the discussion around [key talking point]. My background in [relevant experience] would allow me to contribute quickly and thoughtfully.\n\nThank you again for your time and consideration. I look forward to the possibility of continuing the conversation.\n\nSincerely,\n${name}`
  return `${name}\n${contact}\n\n${date}\n\n[Company Name]\n[Company Address]\n\nDear Hiring Manager,\n\nI am writing to express my interest in the [Position Title] role with [Company Name]. My background in [relevant discipline], combined with hands-on experience in [key skill area], aligns well with the needs of your team.\n\nIn previous roles, I have delivered measurable results by [achievement one], [achievement two], and [achievement three]. I bring a practical, professional approach to solving problems, supporting stakeholders, and improving operational outcomes.\n\nI would welcome the opportunity to discuss how my experience can support your organization. Thank you for your time and consideration.\n\nSincerely,\n${name}`
}
function LetterBuilder({ kind, title, resumes }) {
  const [mode, setMode] = useState('choose'), [docs, setDocs] = useState([]), [doc, setDoc] = useState(null), [resumeId, setResumeId] = useState('')
  const [cover, setCover] = useState({ company: '', hiring_manager: 'Hiring Manager', job_description: '' })
  const [thanks, setThanks] = useState({ interviewer: '', company: '', position: '', interview_date: '', talking_points: '' })
  const refresh = () => api(`/documents?kind=${kind}`).then(setDocs)
  useEffect(() => { refresh() }, [kind])
  const linked = resumes.find(r => String(r.id) === String(resumeId))
  async function scratch() { const payload = { kind, title: kind === 'cover_letter' ? 'Cover Letter Draft' : 'Thank You Letter Draft', resume_id: resumeId ? Number(resumeId) : null, data: { content: defaultLetter(kind, linked), sender_name: linked?.data?.contact?.name || '', sender_contact: linked ? [linked.data.contact.email, linked.data.contact.phone, linked.data.contact.location, linked.data.contact.linkedin].filter(Boolean).join(' | ') : '' } }; const saved = await api('/documents', { method: 'POST', body: JSON.stringify(payload) }); setDoc(saved); setMode('edit'); refresh() }
  async function generate() { const endpoint = kind === 'cover_letter' ? '/cover-letter' : '/thank-you'; const payload = kind === 'cover_letter' ? { ...cover, resume_id: resumeId ? Number(resumeId) : null } : { ...thanks, resume_id: resumeId ? Number(resumeId) : null }; const saved = await api(endpoint, { method: 'POST', body: JSON.stringify(payload) }); setDoc(saved); setMode('edit'); refresh() }
  if (mode === 'edit' && doc) return <LetterEditor doc={doc} setDoc={setDoc} refresh={refresh} resumes={resumes} />
  return <div className="glass p-6"><div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-3xl font-black"><FileText className="mr-2 inline h-7 w-7 text-orange-400" />{title}</h2><p className="text-slate-400">Always accessible. Generate with AI, write from scratch, or load a saved letter. No resume gatekeeping.</p></div></div><div className="grid gap-6 lg:grid-cols-3"><section className="rounded-2xl border border-white/10 bg-black/20 p-4"><h3 className="text-xl font-black text-orange-300">Generate with AI</h3><label className="mb-2 mt-3 block text-sm text-slate-400">Optional saved resume<select className="input mt-1" value={resumeId} onChange={e => setResumeId(e.target.value)}><option value="">No linked resume</option>{resumes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>{kind === 'cover_letter' ? <><Input label="Company" v={cover.company} on={v => setCover({ ...cover, company: v })} /><Input label="Hiring manager" v={cover.hiring_manager} on={v => setCover({ ...cover, hiring_manager: v })} /><label className="mb-2 block text-sm text-slate-400">Job description<textarea className="input mt-1 h-36" value={cover.job_description} onChange={e => setCover({ ...cover, job_description: e.target.value })} /></label></> : <><Input label="Interviewer name" v={thanks.interviewer} on={v => setThanks({ ...thanks, interviewer: v })} /><Input label="Company" v={thanks.company} on={v => setThanks({ ...thanks, company: v })} /><Input label="Position" v={thanks.position} on={v => setThanks({ ...thanks, position: v })} /><Input type="date" label="Interview date" v={thanks.interview_date} on={v => setThanks({ ...thanks, interview_date: v })} /><label className="mb-2 block text-sm text-slate-400">Key talking points<textarea className="input mt-1 h-28" value={thanks.talking_points} onChange={e => setThanks({ ...thanks, talking_points: e.target.value })} /></label></>}<button className="btn btn-primary mt-2" onClick={generate}><Wand2 className="mr-1 inline h-4 w-4" />Generate with AI</button></section><section className="rounded-2xl border border-white/10 bg-black/20 p-4"><h3 className="text-xl font-black text-orange-300">Write from scratch</h3><p className="mt-2 text-sm text-slate-400">Starts with a professional printed-letter template. Link a saved resume first if you want letterhead filled automatically.</p><button className="btn btn-primary mt-4" onClick={scratch}>Start Blank Letter</button></section><section className="rounded-2xl border border-white/10 bg-black/20 p-4"><h3 className="text-xl font-black text-orange-300">Load from saved</h3><div className="mt-3 max-h-[420px] overflow-auto scrollbar">{docs.length === 0 ? <p className="text-sm text-slate-400">No saved letters yet.</p> : docs.map(d => <button key={d.id} className="mb-2 w-full rounded-xl border border-white/10 p-3 text-left hover:border-orange-400" onClick={() => { setDoc(d); setMode('edit') }}><div className="font-bold">{d.title}</div><div className="text-xs text-slate-500">{new Date(d.updated_at).toLocaleString()}</div></button>)}</div></section></div></div>
}
function LetterEditor({ doc, setDoc, refresh, resumes }) {
  const [content, setContent] = useState(doc.data.content || '')
  async function save() { const payload = { kind: doc.kind, title: doc.title, resume_id: doc.resume_id, data: { ...(doc.data || {}), content } }; const saved = await api(`/documents/${doc.id}`, { method: 'PUT', body: JSON.stringify(payload) }); setDoc(saved); refresh() }
  async function remove() { if (!confirm('Delete this saved letter?')) return; await api(`/documents/${doc.id}`, { method: 'DELETE' }); setDoc(null); refresh() }
  return <div className="grid gap-6 xl:grid-cols-[520px_1fr]"><section className="glass max-h-[calc(100vh-130px)] overflow-auto p-5 scrollbar"><div className="mb-4 flex flex-wrap gap-2"><button className="btn btn-primary" onClick={save}><Save className="mr-1 inline h-4 w-4" />Save</button><a className="btn" href={`/api/documents/${doc.id}/export/docx`}><Download className="mr-1 inline h-4 w-4" />Word</a><a className="btn" href={`/api/documents/${doc.id}/export/pdf`}>PDF</a><button className="btn" onClick={() => setDoc(null)}>Back</button><button className="btn" onClick={remove}><Trash2 className="mr-1 inline h-4 w-4" />Delete</button></div><Input label="Document title" v={doc.title} on={v => setDoc({ ...doc, title: v })} /><label className="mb-2 block text-sm text-slate-400">Letter content<textarea className="input mt-1 h-[620px] whitespace-pre-wrap font-mono text-sm" value={content} onChange={e => setContent(e.target.value)} /></label></section><section className="overflow-auto scrollbar"><LetterPreview content={content} /></section></div>
}
function LetterPreview({ content }) { return <article className="letter-page"><div className="whitespace-pre-wrap text-[15px] leading-7 text-gray-900">{content}</div></article> }
function RoleBuilder({ setCurrent, setPage }) { const [roles, setRoles] = useState({}), [title, setTitle] = useState('Senior Network Administrator'), [industry, setIndustry] = useState('Information Technology'), [built, setBuilt] = useState(null); useEffect(() => { api('/roles').then(setRoles) }, []); async function build() { setBuilt(await api('/role-build', { method: 'POST', body: JSON.stringify({ title, industry }) })) } async function saveDraft() { const r = await api('/resumes', { method: 'POST', body: JSON.stringify({ name: `${title} Draft`, title, template: 'modern', data: built.resume }) }); setCurrent(r); setPage('editor') } return <div className="grid gap-6 lg:grid-cols-[420px_1fr]"><section className="glass p-6"><h2 className="text-2xl font-black">Position / Role Builder</h2><Input label="Target industry" v={industry} on={setIndustry} /><Input label="Selected title" v={title} on={setTitle} /><button className="btn btn-primary mt-2" onClick={build}>Build Resume Draft</button><div className="mt-4 max-h-[560px] overflow-auto scrollbar">{Object.entries(roles).map(([cat, rs]) => <div key={cat} className="mb-4"><h3 className="font-bold text-orange-300">{cat}</h3>{rs.map(r => <button key={r.title} onClick={() => setTitle(r.title)} className="mb-1 mr-1 rounded-full border border-white/10 px-3 py-1 text-sm hover:border-orange-400">{r.below_target ? '⚠ ' : ''}{r.title}</button>)}</div>)}</div></section><section>{built && <><div className="mb-4 flex justify-end"><button className="btn btn-primary" onClick={saveDraft}>Save Draft & Edit</button></div><ResumePreview data={built.resume} setData={() => { }} template="modern" /></>}</section></div> }
function Builder({ title, icon: Icon, children }) { return <div className="glass mx-auto max-w-4xl p-6"><h2 className="text-3xl font-black"><Icon className="mr-2 inline h-7 w-7 text-orange-400" />{title}</h2><div className="mt-5">{children}</div></div> }
function DocEditor({ doc }) { const [content, setContent] = useState(doc.data.content); return <div className="mt-5"><textarea className="input h-96 whitespace-pre-wrap" value={content} onChange={e => setContent(e.target.value)} /><div className="mt-3 flex gap-2"><button className="btn">Editable Draft</button><button className="btn" onClick={() => navigator.clipboard.writeText(content)}>Copy</button></div></div> }

createRoot(document.getElementById('root')).render(<App />)
