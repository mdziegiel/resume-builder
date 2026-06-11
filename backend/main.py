import io
import json
import os
import re
from pathlib import Path
from typing import Any, Optional

import requests
from docx import Document
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from database import DB_PATH, UPLOAD_DIR, connect, dumps, loads, now
from seed import DEFAULT_RESUME, seed

app = FastAPI(title='Resume Builder', version='1.0.0')
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_methods=['*'], allow_headers=['*'])

class ResumeIn(BaseModel):
    name: str
    title: str
    template: str = 'executive'
    data: dict[str, Any]

class DocIn(BaseModel):
    kind: str
    title: str
    resume_id: Optional[int] = None
    data: dict[str, Any]

class TailorIn(BaseModel):
    resume_id: int
    job_description: str

class CoverIn(BaseModel):
    resume_id: int
    company: str
    job_description: str
    hiring_manager: str = 'Hiring Manager'

class ThankYouIn(BaseModel):
    interviewer: str
    company: str
    position: str
    interview_date: str
    talking_points: str

class RoleBuildIn(BaseModel):
    title: str
    industry: str = 'Information Technology'

@app.on_event('startup')
def startup():
    seed()

@app.get('/api/health')
def health():
    with connect() as conn:
        return {
            'status': 'ok',
            'database': str(DB_PATH),
            'resumes': conn.execute('SELECT COUNT(*) c FROM resumes').fetchone()['c'],
            'roles': conn.execute('SELECT COUNT(*) c FROM role_library').fetchone()['c']
        }

def row_resume(row):
    return {'id': row['id'], 'name': row['name'], 'title': row['title'], 'template': row['template'], 'data': loads(row['data_json']), 'created_at': row['created_at'], 'updated_at': row['updated_at']}

@app.get('/api/resumes')
def resumes():
    with connect() as conn:
        return [row_resume(r) for r in conn.execute('SELECT * FROM resumes ORDER BY updated_at DESC')]

@app.get('/api/resumes/{resume_id}')
def resume(resume_id: int):
    with connect() as conn:
        r = conn.execute('SELECT * FROM resumes WHERE id=?', (resume_id,)).fetchone()
        if not r: raise HTTPException(404, 'Resume not found')
        return row_resume(r)

@app.post('/api/resumes')
def save_resume(payload: ResumeIn):
    stamp = now()
    with connect() as conn:
        cur = conn.execute('INSERT INTO resumes(name,title,template,data_json,created_at,updated_at) VALUES(?,?,?,?,?,?)',
                           (payload.name, payload.title, payload.template, dumps(payload.data), stamp, stamp))
        return resume(cur.lastrowid)

@app.put('/api/resumes/{resume_id}')
def update_resume(resume_id: int, payload: ResumeIn):
    with connect() as conn:
        conn.execute('UPDATE resumes SET name=?, title=?, template=?, data_json=?, updated_at=? WHERE id=?',
                     (payload.name, payload.title, payload.template, dumps(payload.data), now(), resume_id))
    return resume(resume_id)

@app.post('/api/resumes/{resume_id}/duplicate')
def duplicate(resume_id: int):
    r = resume(resume_id)
    payload = ResumeIn(name=r['name'] + ' - Copy', title=r['title'], template=r['template'], data=r['data'])
    return save_resume(payload)

@app.get('/api/roles')
def roles():
    with connect() as conn:
        rows = conn.execute('SELECT * FROM role_library ORDER BY category,title').fetchall()
        out = {}
        for r in rows:
            out.setdefault(r['category'], []).append({'title': r['title'], 'below_target': bool(r['below_target'])})
        return out

@app.get('/api/documents')
def documents(kind: Optional[str] = None):
    sql = 'SELECT * FROM documents' + (' WHERE kind=?' if kind else '') + ' ORDER BY updated_at DESC'
    args = (kind,) if kind else ()
    with connect() as conn:
        return [dict(r) | {'data': loads(r['data_json'])} for r in conn.execute(sql, args)]

@app.post('/api/documents')
def save_doc(payload: DocIn):
    stamp = now()
    with connect() as conn:
        cur = conn.execute('INSERT INTO documents(kind,title,resume_id,data_json,created_at,updated_at) VALUES(?,?,?,?,?,?)',
                           (payload.kind, payload.title, payload.resume_id, dumps(payload.data), stamp, stamp))
        return {'id': cur.lastrowid, **payload.model_dump(), 'created_at': stamp, 'updated_at': stamp}

def extract_text_docx(content: bytes) -> str:
    doc = Document(io.BytesIO(content))
    return '\n'.join(p.text for p in doc.paragraphs if p.text.strip())

def extract_text_pdf(content: bytes) -> str:
    reader = PdfReader(io.BytesIO(content))
    return '\n'.join(page.extract_text() or '' for page in reader.pages)

def naive_parse_resume(text: str) -> dict[str, Any]:
    data = json.loads(json.dumps(DEFAULT_RESUME))
    email = re.search(r'[\w.+-]+@[\w.-]+', text)
    phone = re.search(r'(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}', text)
    if email: data['contact']['email'] = email.group(0)
    if phone: data['contact']['phone'] = phone.group(0)
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    if lines:
        data['contact']['name'] = lines[0][:80]
    data['summary'] = ' '.join(lines[1:5])[:900] or data['summary']
    data['additional'].append('Imported resume text preserved in source_text for manual cleanup.')
    data['source_text'] = text[:12000]
    return data

@app.post('/api/upload')
async def upload(file: UploadFile = File(...)):
    content = await file.read()
    suffix = Path(file.filename or '').suffix.lower()
    if suffix == '.pdf': text = extract_text_pdf(content)
    elif suffix in {'.docx', '.doc'}: text = extract_text_docx(content)
    else: raise HTTPException(400, 'Upload a PDF or Word document')
    path = UPLOAD_DIR / (file.filename or 'resume-upload')
    path.write_bytes(content)
    parsed = naive_parse_resume(text)
    payload = ResumeIn(name=f'Imported - {parsed["contact"].get("name", "Resume")}', title=parsed['contact'].get('title', 'Resume'), template='modern', data=parsed)
    return save_resume(payload)

def keywords(text: str) -> set[str]:
    words = re.findall(r'\b[A-Za-z][A-Za-z0-9+#.-]{2,}\b', text.lower())
    stop = {'the','and','for','with','you','are','will','that','this','from','our','your','have','has','into','using','work','team','role','job'}
    return {w for w in words if w not in stop}

def claude(prompt: str) -> Optional[str]:
    key = os.getenv('ANTHROPIC_API_KEY') or os.getenv('ANTHROPIC_TOKEN')
    if not key: return None
    resp = requests.post('https://api.anthropic.com/v1/messages', headers={'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json'}, json={'model': os.getenv('ANTHROPIC_MODEL', 'claude-sonnet-4-20250514'), 'max_tokens': 1800, 'messages': [{'role': 'user', 'content': prompt}]}, timeout=60)
    resp.raise_for_status()
    return resp.json()['content'][0]['text']

@app.post('/api/tailor')
def tailor(payload: TailorIn):
    r = resume(payload.resume_id)
    resume_text = json.dumps(r['data'])
    missing = sorted(list(keywords(payload.job_description) - keywords(resume_text)))[:30]
    score = max(0, min(100, round(100 * (1 - len(missing) / max(30, len(keywords(payload.job_description)))))))
    generated = claude('Analyze this resume JSON against this job description. Return concise tailored summary, missing keyword recommendations, and revised bullets.\nRESUME:\n' + resume_text + '\nJOB:\n' + payload.job_description)
    return {'ats_score': score, 'missing_keywords': missing, 'suggestions': generated or 'Claude API key not configured. Keyword analysis completed locally. Add the missing keywords where truthful and relevant.', 'tailored_resume': r['data']}

@app.post('/api/cover-letter')
def cover(payload: CoverIn):
    r = resume(payload.resume_id)
    prompt = f"Write a professional cover letter for {payload.company}, hiring manager {payload.hiring_manager}, using this resume JSON and job description. Include bullet highlights and formal tone. RESUME={json.dumps(r['data'])} JOB={payload.job_description}"
    text = claude(prompt) or f"Dear {payload.hiring_manager},\n\nI am writing to express interest in the opportunity with {payload.company}. My background in infrastructure administration, Microsoft endpoint management, networking, and executive-level technical support aligns well with the needs described.\n\nHighlights include:\n• Senior network and systems administration experience\n• Microsoft 365, Entra ID, endpoint, security, and network operations expertise\n• Proven ability to resolve complex incidents and improve operational reliability\n\nI would welcome the opportunity to discuss how my experience can support {payload.company}.\n\nSincerely,\n{r['data']['contact']['name']}"
    return save_doc(DocIn(kind='cover_letter', title=f'Cover Letter - {payload.company}', resume_id=payload.resume_id, data={'content': text, **payload.model_dump()}))

@app.post('/api/thank-you')
def thank_you(payload: ThankYouIn):
    text = claude(f'Write a professional post-interview thank you letter from these details: {payload.model_dump_json()}') or f"Dear {payload.interviewer},\n\nThank you for taking the time to speak with me on {payload.interview_date} about the {payload.position} position at {payload.company}. I appreciated the opportunity to learn more about the role and discuss {payload.talking_points}.\n\nOur conversation reinforced my interest in the opportunity and my confidence that my experience can contribute value to your team.\n\nSincerely,\nMichael Dziegiel"
    return save_doc(DocIn(kind='thank_you', title=f'Thank You - {payload.company}', data={'content': text, **payload.model_dump()}))

@app.post('/api/role-build')
def role_build(payload: RoleBuildIn):
    generated = claude(f'Create resume content JSON for a {payload.title} in {payload.industry}. Include summary, skills, technical, experience bullets. Keep it professional and editable.')
    base = json.loads(json.dumps(DEFAULT_RESUME))
    base['contact']['title'] = payload.title
    base['summary'] = generated or f'Experienced professional targeting {payload.title} roles in {payload.industry}, with strengths in operational reliability, stakeholder support, documentation, process improvement, and secure technology delivery.'
    return {'resume': base, 'raw_generation': generated}

def render_text(data):
    c = data['contact']
    lines = [c['name'], c['title'], f"{c['email']} | {c['phone']} | {c['location']}", c.get('linkedin',''), c.get('portfolio',''), '', 'PROFESSIONAL SUMMARY', data.get('summary',''), '', 'AREAS OF EXPERTISE']
    lines += [' | '.join(row) for row in data.get('skills', [])]
    lines += ['', 'TECHNICAL PROFICIENCIES'] + [f'{k}: {v}' for k,v in data.get('technical', {}).items()]
    lines += ['', 'CAREER EXPERIENCE']
    for job in data.get('experience', []):
        lines.append(f"{job['title']} | {job['company']} | {job['location']} | {job['dates']}")
        lines += ['• ' + b for b in job.get('bullets', [])]
    lines += ['', 'EDUCATION'] + [f"{e.get('degree')} — {e.get('school')} ({e.get('details','')})" for e in data.get('education', [])]
    lines += ['', 'CERTIFICATIONS'] + data.get('certifications', [])
    lines += ['', 'ADDITIONAL EXPERIENCE'] + data.get('additional', [])
    return '\n'.join(lines)

@app.get('/api/resumes/{resume_id}/export/{fmt}')
def export_resume(resume_id: int, fmt: str):
    r = resume(resume_id); data = r['data']; text = render_text(data)
    if fmt == 'docx':
        doc = Document(); c = data['contact']; doc.add_heading(c['name'], 0); doc.add_paragraph(c['title']); doc.add_paragraph(f"{c['email']} | {c['phone']} | {c['location']} | {c.get('linkedin','')} | {c.get('portfolio','')}")
        for line in text.split('\n')[5:]:
            if line.isupper() and line: doc.add_heading(line, level=1)
            elif line.startswith('• '): doc.add_paragraph(line[2:], style='List Bullet')
            else: doc.add_paragraph(line)
        buf = io.BytesIO(); doc.save(buf)
        return Response(buf.getvalue(), media_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document', headers={'Content-Disposition': 'attachment; filename=resume.docx'})
    if fmt == 'pdf':
        buf = io.BytesIO(); styles = getSampleStyleSheet(); story = []
        doc = SimpleDocTemplate(buf, pagesize=LETTER, leftMargin=.55*inch, rightMargin=.55*inch, topMargin=.45*inch, bottomMargin=.45*inch)
        for line in text.split('\n'):
            if not line: story.append(Spacer(1, 6)); continue
            style = styles['Heading2'] if line.isupper() else styles['BodyText']
            story.append(Paragraph(line.replace('&','&amp;'), style))
        doc.build(story)
        return Response(buf.getvalue(), media_type='application/pdf', headers={'Content-Disposition': 'attachment; filename=resume.pdf'})
    raise HTTPException(400, 'fmt must be docx or pdf')

@app.post('/api/documents/export/{fmt}')
def export_document(fmt: str, payload: DocIn):
    content = payload.data.get('content', '')
    if fmt == 'docx':
        doc = Document(); doc.add_heading(payload.title, 0)
        for para in content.split('\n'):
            doc.add_paragraph(para)
        buf = io.BytesIO(); doc.save(buf)
        return Response(buf.getvalue(), media_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    if fmt == 'pdf':
        buf = io.BytesIO(); pdf = SimpleDocTemplate(buf, pagesize=LETTER); story=[]; styles=getSampleStyleSheet()
        for para in content.split('\n'):
            story.append(Paragraph(para.replace('&','&amp;'), styles['BodyText'])); story.append(Spacer(1,6))
        pdf.build(story); return Response(buf.getvalue(), media_type='application/pdf')
    raise HTTPException(400, 'fmt must be docx or pdf')

static_dir = Path('/app/frontend-dist')
if static_dir.exists():
    app.mount('/', StaticFiles(directory=static_dir, html=True), name='static')
