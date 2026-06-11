import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowLeft, Download, Eye, EyeOff, FileText, Plus, Save, Sparkles, Trash2, Upload, Wand2 } from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import './index.css'
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

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
  summary: '', skills: [['', '', '']], technical: {}, experience: [], education: [], certifications: [], additional: [], custom_sections: [], section_meta: {}
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

const defaultSectionTitles = { contact: 'Contact Info', summary: 'Professional Summary', skills: 'Areas of Expertise', technical: 'Technical Proficiencies', experience: 'Career Experience', education: 'Education', certifications: 'Certifications', additional: 'Additional Experience', custom_sections: 'Custom Sections', ats: 'Job-targeted resume mode' }
const sectionTitle = (data, key, fallback) => data?.section_meta?.[key]?.title || fallback || defaultSectionTitles[key] || key
const sectionHidden = (data, key) => !!data?.section_meta?.[key]?.hidden
const setSectionMeta = (data, setData, key, patch) => setData({ ...data, section_meta: { ...(data.section_meta || {}), [key]: { title: sectionTitle(data, key), hidden: false, ...((data.section_meta || {})[key] || {}), ...patch } } })
const prepareResumeForRender = (data) => {
  const d = structuredClone(data || {})
  const meta = d.section_meta || {}
  Object.entries(meta).forEach(([key, value]) => {
    if (!value?.hidden) return
    if (key === 'contact') d.contact = { name: '', title: '', email: '', phone: '', linkedin: '', portfolio: '', location: '' }
    if (key === 'summary') d.summary = ''
    if (key === 'skills') d.skills = []
    if (key === 'technical') d.technical = {}
    if (key === 'experience') d.experience = []
    if (key === 'education') d.education = []
    if (key === 'certifications') d.certifications = []
    if (key === 'additional') d.additional = []
  })
  d.custom_sections = (d.custom_sections || []).filter(x => !x.hidden)
  return d
}

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
  return <div className="fixed inset-0 z-50 overflow-auto bg-black/80 p-6 backdrop-blur"><div className="mx-auto max-w-7xl"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-3xl font-black">Review uploaded resume</h2><p className="text-slate-400">Original extraction on the left. Parsed editable resume on the right. Confirm before saving, because blindly trusting parsers is how HR software happened.</p></div><div className="flex gap-2"><select className="input w-56" value={template} onChange={e => setTemplate(e.target.value)}>{templates.map(t => <option key={t} value={t}>{templateMeta[t][0]}</option>)}</select><button className="btn" onClick={onCancel}>Cancel</button><button className="btn btn-primary" onClick={() => onConfirm(template)}>Confirm Import</button></div></div><div className="grid gap-5 lg:grid-cols-2"><pre className="glass max-h-[78vh] overflow-auto whitespace-pre-wrap p-5 text-sm text-slate-200 scrollbar">{review.original_text}</pre><div className="max-h-[78vh] overflow-auto scrollbar"><PdfPreview data={review.parsed} template={template} /></div></div></div></div>
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
      <div className="flex flex-wrap gap-2"><button className="btn" onClick={back}><ArrowLeft className="mr-1 inline h-4 w-4" />Back</button><button className="btn btn-primary" onClick={save}><Save className="mr-1 inline h-4 w-4" />Save</button><button className="btn" onClick={dup}>Save Version</button><button className="btn" onClick={() => downloadResume(prepareResumeForRender(data), template, 'docx')}><Download className="mr-1 inline h-4 w-4" />DOCX</button><button className="btn" onClick={() => downloadResume(prepareResumeForRender(data), template, 'pdf')}>PDF</button></div>
      <label className="mt-4 block text-sm text-slate-400">Template</label><select className="input mt-1" value={template} onChange={e => setTemplate(e.target.value)}>{templates.map(t => <option key={t} value={t}>{templateMeta[t][0]}</option>)}</select>
      <Section title="Contact Info" sectionKey="contact" data={data} setData={setData}><Input label="Name" v={data.contact.name} on={v => set(['contact', 'name'], v)} /><Input label="Title" v={data.contact.title} on={v => set(['contact', 'title'], v)} /><Input label="Email" v={data.contact.email} on={v => set(['contact', 'email'], v)} /><Input label="Phone" v={data.contact.phone} on={v => set(['contact', 'phone'], v)} /><Input label="LinkedIn" v={data.contact.linkedin} on={v => set(['contact', 'linkedin'], v)} /><Input label="Portfolio" v={data.contact.portfolio} on={v => set(['contact', 'portfolio'], v)} /><Input label="Location" v={data.contact.location} on={v => set(['contact', 'location'], v)} /></Section>
      <Section title="Professional Summary" sectionKey="summary" data={data} setData={setData}><RichText value={data.summary} onChange={v => set(['summary'], v)} /></Section>
      <Skills data={data} setData={setData} />
      <Technical data={data} setData={setData} />
      <Experience data={data} setData={setData} />
      <Education data={data} setData={setData} />
      <List title="Certifications" sectionKey="certifications" data={data} setData={setData} items={data.certifications || []} setItems={x => set(['certifications'], x)} />
      <List title="Additional Experience" sectionKey="additional" data={data} setData={setData} items={data.additional || []} setItems={x => set(['additional'], x)} />
      <CustomSections data={data} setData={setData} />
      <Section title="Job-targeted resume mode" sectionKey="ats" data={data} setData={setData}><textarea className="input h-32" placeholder="Paste job description" value={job} onChange={e => setJob(e.target.value)} /><button className="btn btn-primary mt-2" onClick={analyze}><Sparkles className="mr-1 inline h-4 w-4" />Analyze ATS Fit</button>{tailor && <div className="mt-3 rounded-xl bg-black/30 p-3"><div className="text-2xl font-black text-orange-300">ATS {tailor.ats_score}%</div><p className="mt-2 text-sm">Missing keywords: {tailor.missing_keywords.join(', ') || 'None obvious'}</p><p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{tailor.suggestions}</p></div>}</Section>
    </section>
    <section className="pdf-preview-panel overflow-auto scrollbar"><PdfPreview data={prepareResumeForRender(data)} template={template} /></section>
  </div>
}
function Section({ title, children, sectionKey = '', data = null, setData = null, hideable = true }) {
  const editable = sectionKey && data && setData
  const hidden = editable && sectionHidden(data, sectionKey)
  const shownTitle = editable ? sectionTitle(data, sectionKey, title) : title
  return <div className={`mt-5 rounded-2xl border ${hidden ? 'border-yellow-400/30 bg-yellow-500/5' : 'border-white/10 bg-black/20'} p-4`}>
    <div className="mb-3 flex items-center justify-between gap-3">
      {editable ? <input className="section-title-input" value={shownTitle} onChange={e => setSectionMeta(data, setData, sectionKey, { title: e.target.value })} title="Rename section" /> : <h3 className="font-black text-orange-300">{title}</h3>}
      {editable && hideable && <button className="btn btn-compact" onClick={() => setSectionMeta(data, setData, sectionKey, { hidden: !hidden })} title={hidden ? 'Show section in preview/export' : 'Hide section from preview/export'}>{hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}{hidden ? 'Hidden' : 'Visible'}</button>}
    </div>
    {hidden ? <div className="rounded-xl border border-yellow-400/20 bg-black/20 p-3 text-sm text-yellow-200">Hidden from preview and export. Controls remain here so you can resurrect it when sanity returns.</div> : children}
  </div>
}
function Input({ label, v, on, type = 'text' }) { return <label className="mb-2 block text-sm text-slate-400">{label}<input type={type} className="input mt-1" value={v || ''} onChange={e => on(e.target.value)} /></label> }
function RichText({ value, onChange }) { return <div><div className="mb-2 flex gap-2"><button className="btn" onMouseDown={e => { e.preventDefault(); document.execCommand('bold') }}>Bold</button><button className="btn" onMouseDown={e => { e.preventDefault(); document.execCommand('italic') }}>Italic</button></div><div className="input min-h-28" contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: value || '' }} onBlur={e => onChange(e.currentTarget.innerHTML)} /></div> }
function List({ title, items, setItems, rich = false, sectionKey = '', data = null, setData = null }) { const update = (i, v) => setItems(items.map((x, n) => n === i ? v : x)); const move = (i, d) => { const a = [...items], j = i + d; if (j < 0 || j >= a.length) return;[a[i], a[j]] = [a[j], a[i]]; setItems(a) }; return <Section title={title} sectionKey={sectionKey} data={data} setData={setData}>{items.map((x, i) => <div className="mb-2 flex gap-2" key={i}>{rich ? <div className="flex-1"><RichText value={x} onChange={v => update(i, v)} /></div> : <textarea className="input h-16" value={x} onChange={e => update(i, e.target.value)} />}<button className="btn" onClick={() => move(i, -1)}>↑</button><button className="btn" onClick={() => move(i, 1)}>↓</button><button className="btn" onClick={() => setItems(items.filter((_, n) => n !== i))}>×</button></div>)}<button className="btn" onClick={() => setItems([...items, ''])}><Plus className="mr-1 inline h-4 w-4" />Add</button></Section> }
function Skills({ data, setData }) { const rows = normalizeSkillRows(data.skills); const setCell = (i, j, v) => { const r = rows.map(row => [...row]); r[i][j] = v; setData({ ...data, skills: r }) }; const addChip = (i, v) => { if (!v.trim()) return; const r = rows.map(row => [...row]); const idx = r[i].findIndex(x => !x); if (idx >= 0) r[i][idx] = v.trim(); else r[i].push(v.trim()); setData({ ...data, skills: r.map(x => (x.concat(['', '', ''])).slice(0, 3)) }) }; return <Section title="Areas of Expertise" sectionKey="skills" data={data} setData={setData}><p className="mb-3 text-sm text-slate-400">Edit chips or table cells. Three columns render in the preview. Blank cells no longer masquerade as competence.</p>{rows.map((row, i) => <div key={i} className="mb-3 rounded-xl bg-black/20 p-3"><div className="mb-2 flex flex-wrap gap-2">{row.filter(Boolean).map((chip, j) => <span key={j} className="rounded-full bg-orange-500/15 px-3 py-1 text-sm text-orange-200">{chip}<button className="ml-2" onClick={() => setCell(i, j, '')}>×</button></span>)}</div><div className="grid gap-2 md:grid-cols-3">{[0, 1, 2].map(j => <input key={j} className="input" placeholder={`Column ${j + 1}`} value={row[j] || ''} onChange={e => setCell(i, j, e.target.value)} />)}</div><div className="mt-2 flex gap-2"><input className="input" placeholder="Add chip" onKeyDown={e => { if (e.key === 'Enter') { addChip(i, e.currentTarget.value); e.currentTarget.value = '' } }} /><button className="btn" onClick={() => setData({ ...data, skills: rows.filter((_, n) => n !== i) })}>Remove row</button></div></div>)}<button className="btn" onClick={() => setData({ ...data, skills: [...rows, ['', '', '']] })}>Add expertise row</button></Section> }
function Technical({ data, setData }) { const entries = Object.entries(data.technical || {}); const update = (oldK, k, v) => { const t = { ...data.technical }; delete t[oldK]; t[k] = v; setData({ ...data, technical: t }) }; return <Section title="Technical Proficiencies" sectionKey="technical" data={data} setData={setData}>{entries.map(([k, v]) => <div className="mb-2 grid gap-2 md:grid-cols-[160px_1fr_auto]" key={k}><input className="input" value={k} onChange={e => update(k, e.target.value, v)} /><input className="input" value={v} onChange={e => update(k, k, e.target.value)} /><button className="btn" onClick={() => { const t = { ...data.technical }; delete t[k]; setData({ ...data, technical: t }) }}>×</button></div>)}<button className="btn" onClick={() => setData({ ...data, technical: { ...(data.technical || {}), Category: '' } })}>Add proficiency</button></Section> }
function Experience({ data, setData }) { const jobs = data.experience || []; const setJobs = experience => setData({ ...data, experience }); const [drag, setDrag] = useState(null); const moveJob = (from, to) => { if (from === null || to === null || from === to) return; const a = [...jobs]; const [x] = a.splice(from, 1); a.splice(to, 0, x); setJobs(a) }; return <Section title="Career Experience" sectionKey="experience" data={data} setData={setData}>{jobs.map((j, idx) => <div key={idx} draggable onDragStart={() => setDrag(idx)} onDragOver={e => e.preventDefault()} onDrop={() => moveJob(drag, idx)} className="mb-5 rounded-xl bg-black/20 p-3"><div className="mb-2 cursor-move text-xs uppercase tracking-[.2em] text-slate-500">Drag position #{idx + 1}</div><div className="grid gap-2 md:grid-cols-2"><Input label="Title" v={j.title} on={v => { const a = [...jobs]; a[idx].title = v; setJobs(a) }} /><Input label="Company" v={j.company} on={v => { const a = [...jobs]; a[idx].company = v; setJobs(a) }} /><Input label="Location" v={j.location} on={v => { const a = [...jobs]; a[idx].location = v; setJobs(a) }} /><Input label="Start date" type="month" v={j.start_date} on={v => { const a = [...jobs]; a[idx].start_date = v; a[idx].dates = `${v || ''} – ${a[idx].end_date || ''}`; setJobs(a) }} /><Input label="End date" type="month" v={j.end_date} on={v => { const a = [...jobs]; a[idx].end_date = v; a[idx].dates = `${a[idx].start_date || ''} – ${v || ''}`; setJobs(a) }} /></div><List title="Bullet points" rich items={j.bullets || []} setItems={items => { const a = [...jobs]; a[idx].bullets = items; setJobs(a) }} /><button className="btn" onClick={() => setJobs(jobs.filter((_, n) => n !== idx))}>Remove Position</button></div>)}<button className="btn" onClick={() => setJobs([...jobs, { title: '', company: '', location: '', start_date: '', end_date: '', dates: '', bullets: [''] }])}>Add Position</button></Section> }
function Education({ data, setData }) { const items = data.education || []; return <Section title="Education" sectionKey="education" data={data} setData={setData}>{items.map((e, i) => <div className="mb-3 grid gap-2 md:grid-cols-3" key={i}><input className="input" placeholder="Degree" value={e.degree || ''} onChange={ev => { const a = [...items]; a[i].degree = ev.target.value; setData({ ...data, education: a }) }} /><input className="input" placeholder="School" value={e.school || ''} onChange={ev => { const a = [...items]; a[i].school = ev.target.value; setData({ ...data, education: a }) }} /><input className="input" placeholder="Details" value={e.details || ''} onChange={ev => { const a = [...items]; a[i].details = ev.target.value; setData({ ...data, education: a }) }} /></div>)}<button className="btn" onClick={() => setData({ ...data, education: [...items, { degree: '', school: '', details: '' }] })}>Add Education</button></Section> }
function CustomSections({ data, setData }) { const sections = data.custom_sections || []; return <Section title="Custom Sections" sectionKey="custom_sections" data={data} setData={setData}>{sections.map((s, i) => <div className="mb-4 rounded-xl bg-black/20 p-3" key={i}><div className="mb-2 flex items-center gap-2"><Input label="Section title" v={s.title} on={v => { const a = [...sections]; a[i].title = v; setData({ ...data, custom_sections: a }) }} /><button className="btn mt-5" onClick={() => { const a = [...sections]; a[i].hidden = !a[i].hidden; setData({ ...data, custom_sections: a }) }}>{s.hidden ? <EyeOff className="mr-1 inline h-4 w-4" /> : <Eye className="mr-1 inline h-4 w-4" />}{s.hidden ? 'Hidden' : 'Visible'}</button></div><List title="Bullets" items={s.bullets || []} setItems={items => { const a = [...sections]; a[i].bullets = items; setData({ ...data, custom_sections: a }) }} /><button className="btn" onClick={() => setData({ ...data, custom_sections: sections.filter((_, n) => n !== i) })}>Remove Custom Section</button></div>)}<button className="btn" onClick={() => setData({ ...data, custom_sections: [...sections, { title: 'Custom Section', bullets: [''] }] })}>Add Custom Section</button></Section> }

async function downloadResume(data, template, fmt) {
  const r = await fetch(`/api/resumes/export/${fmt}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, template, name: data?.contact?.name || 'resume' })
  })
  if (!r.ok) { alert(await r.text()); return }
  const blob = await r.blob()
  const disposition = r.headers.get('Content-Disposition') || ''
  const match = disposition.match(/filename="?([^";]+)"?/)
  const name = match?.[1] || `resume-${template}.${fmt}`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

function PdfPreview({ data, template }) {
  const [pdfData, setPdfData] = useState(null)
  const [zoom, setZoom] = useState(1.35)
  const [state, setState] = useState('Rendering PDF preview...')
  const canvasRef = useRef(null)
  useEffect(() => {
    let cancelled = false
    const handle = setTimeout(async () => {
      setState('Regenerating PDF preview...')
      try {
        const r = await fetch('/api/resume-preview/pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data, template, name: data?.contact?.name || 'resume' })
        })
        if (!r.ok) throw new Error(await r.text())
        const bytes = await r.arrayBuffer()
        if (!cancelled) { setPdfData(bytes); setState('PDF.js canvas preview. No thumbnails. No iframe. Civilization advances slowly.') }
      } catch (e) {
        if (!cancelled) setState(`PDF preview failed: ${e.message || e}`)
      }
    }, 900)
    return () => { cancelled = true; clearTimeout(handle) }
  }, [JSON.stringify(data), template])

  useEffect(() => {
    if (!pdfData || !canvasRef.current) return
    let cancelled = false
    const task = pdfjsLib.getDocument({ data: pdfData.slice(0) })
    task.promise.then(async pdf => {
      const page = await pdf.getPage(1)
      if (cancelled) return
      const container = canvasRef.current.parentElement
      const baseViewport = page.getViewport({ scale: 1 })
      const available = Math.max(820, (container?.clientWidth || 900) - 28)
      const fitScale = available / baseViewport.width
      const viewport = page.getViewport({ scale: fitScale * zoom })
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.floor(viewport.width * dpr)
      canvas.height = Math.floor(viewport.height * dpr)
      canvas.style.width = `${Math.floor(viewport.width)}px`
      canvas.style.height = `${Math.floor(viewport.height)}px`
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      await page.render({ canvasContext: context, viewport }).promise
    }).catch(e => !cancelled && setState(`PDF.js render failed: ${e.message || e}`))
    return () => { cancelled = true; task.destroy() }
  }, [pdfData, zoom])

  return <div className="pdf-preview-shell">
    <div className="pdf-preview-toolbar sticky top-0 z-10 mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-300">
      <span>{state}</span>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn" onClick={() => setZoom(z => Math.max(0.75, +(z - 0.15).toFixed(2)))}>−</button>
        <span className="pdf-zoom-label">{Math.round(zoom * 100)}%</span>
        <button className="btn" onClick={() => setZoom(z => Math.min(2.25, +(z + 0.15).toFixed(2)))}>+</button>
        <button className="btn" onClick={() => setZoom(1.35)}>Readable</button>
        <button className="btn" onClick={() => downloadResume(data, template, 'docx')}>Download DOCX</button>
        <button className="btn" onClick={() => downloadResume(data, template, 'pdf')}>Download PDF</button>
      </div>
    </div>
    <div className="pdf-canvas-stage">{pdfData ? <canvas ref={canvasRef} className="pdf-preview-canvas" /> : <div className="pdf-preview-placeholder">Waiting for server-generated PDF. Patience, unfortunately.</div>}</div>
  </div>
}

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
function RoleBuilder({ setCurrent, setPage }) { const [roles, setRoles] = useState({}), [title, setTitle] = useState('Senior Network Administrator'), [industry, setIndustry] = useState('Information Technology'), [built, setBuilt] = useState(null); useEffect(() => { api('/roles').then(setRoles) }, []); async function build() { setBuilt(await api('/role-build', { method: 'POST', body: JSON.stringify({ title, industry }) })) } async function saveDraft() { const r = await api('/resumes', { method: 'POST', body: JSON.stringify({ name: `${title} Draft`, title, template: 'modern', data: built.resume }) }); setCurrent(r); setPage('editor') } return <div className="grid gap-6 lg:grid-cols-[420px_1fr]"><section className="glass p-6"><h2 className="text-2xl font-black">Position / Role Builder</h2><Input label="Target industry" v={industry} on={setIndustry} /><Input label="Selected title" v={title} on={setTitle} /><button className="btn btn-primary mt-2" onClick={build}>Build Resume Draft</button><div className="mt-4 max-h-[560px] overflow-auto scrollbar">{Object.entries(roles).map(([cat, rs]) => <div key={cat} className="mb-4"><h3 className="font-bold text-orange-300">{cat}</h3>{rs.map(r => <button key={r.title} onClick={() => setTitle(r.title)} className="mb-1 mr-1 rounded-full border border-white/10 px-3 py-1 text-sm hover:border-orange-400">{r.below_target ? '⚠ ' : ''}{r.title}</button>)}</div>)}</div></section><section>{built && <><div className="mb-4 flex justify-end"><button className="btn btn-primary" onClick={saveDraft}>Save Draft & Edit</button></div><PdfPreview data={built.resume} template="modern" /></>}</section></div> }
function Builder({ title, icon: Icon, children }) { return <div className="glass mx-auto max-w-4xl p-6"><h2 className="text-3xl font-black"><Icon className="mr-2 inline h-7 w-7 text-orange-400" />{title}</h2><div className="mt-5">{children}</div></div> }
function DocEditor({ doc }) { const [content, setContent] = useState(doc.data.content); return <div className="mt-5"><textarea className="input h-96 whitespace-pre-wrap" value={content} onChange={e => setContent(e.target.value)} /><div className="mt-3 flex gap-2"><button className="btn">Editable Draft</button><button className="btn" onClick={() => navigator.clipboard.writeText(content)}>Copy</button></div></div> }

createRoot(document.getElementById('root')).render(<App />)
