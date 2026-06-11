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
from seed import DEFAULT_RESUME, insert_sample_resume, seed

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

class ImportConfirmIn(BaseModel):
    filename: str = 'Imported Resume'
    template: str = 'modern'
    data: dict[str, Any]

class PersonalResumeIn(BaseModel):
    title: str
    years: str = ''
    skills: str = ''
    employer_role: str = ''
    education: str = ''
    achievements: str = ''
    target: str = ''
    tone: str = 'modern'
    template: str = 'modern'

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

def normalize_resume_data(data: dict[str, Any]) -> dict[str, Any]:
    data = json.loads(json.dumps(data))
    rows = []
    for row in data.get('skills', []):
        if isinstance(row, dict):
            cells = row.get('items') or [row.get('a', ''), row.get('b', ''), row.get('c', '')]
        elif isinstance(row, str):
            cells = [x.strip() for x in re.split(r'\s*\|\s*', row)]
        else:
            cells = list(row) if isinstance(row, (list, tuple)) else []
        cells = [str(x).strip() for x in cells if str(x).strip()]
        rows.append((cells + ['', '', ''])[:3])
    data['skills'] = rows
    for job in data.get('experience', []):
        if 'start_date' not in job or 'end_date' not in job:
            dates = job.get('dates', '')
            parts = re.split(r'\s+[–-]\s+', dates, maxsplit=1)
            job.setdefault('start_date', parts[0] if parts else '')
            job.setdefault('end_date', parts[1] if len(parts) > 1 else '')
    data.setdefault('custom_sections', [])
    return data


def row_resume(row):
    data = normalize_resume_data(loads(row['data_json']))
    return {'id': row['id'], 'name': row['name'], 'title': row['title'], 'template': row['template'], 'data': data, 'created_at': row['created_at'], 'updated_at': row['updated_at']}

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
                           (payload.name, payload.title, payload.template, dumps(normalize_resume_data(payload.data)), stamp, stamp))
        resume_id = cur.lastrowid
        if resume_id is None:
            raise HTTPException(500, 'Resume insert failed')
        conn.commit()
    return resume(int(resume_id))

@app.put('/api/resumes/{resume_id}')
def update_resume(resume_id: int, payload: ResumeIn):
    with connect() as conn:
        conn.execute('UPDATE resumes SET name=?, title=?, template=?, data_json=?, updated_at=? WHERE id=?',
                     (payload.name, payload.title, payload.template, dumps(normalize_resume_data(payload.data)), now(), resume_id))
    return resume(resume_id)

@app.delete('/api/resumes/{resume_id}')
def delete_resume(resume_id: int):
    with connect() as conn:
        conn.execute('DELETE FROM resumes WHERE id=?', (resume_id,))
    return {'deleted': resume_id}

@app.post('/api/sample-resume')
def load_sample_resume():
    return resume(insert_sample_resume())

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

SECTION_ALIASES = {
    'summary': ['summary', 'professional summary', 'profile', 'objective'],
    'skills': ['areas of expertise', 'skills', 'core competencies', 'expertise'],
    'technical': ['technical proficiencies', 'technical skills', 'technologies', 'tools'],
    'experience': ['career experience', 'professional experience', 'experience', 'employment history', 'work history'],
    'education': ['education'],
    'certifications': ['certifications', 'certificates', 'licenses'],
    'additional': ['additional experience', 'additional information', 'projects']
}

def section_key(line: str) -> Optional[str]:
    clean = re.sub(r'[^a-zA-Z ]', '', line).strip().lower()
    for key, names in SECTION_ALIASES.items():
        if clean in names:
            return key
    return None

def split_sections(lines: list[str]) -> dict[str, list[str]]:
    sections: dict[str, list[str]] = {'header': []}
    current = 'header'
    for line in lines:
        key = section_key(line)
        if key:
            current = key
            sections.setdefault(current, [])
        else:
            sections.setdefault(current, []).append(line)
    return sections

def bullet_lines(lines: list[str]) -> list[str]:
    out = []
    for line in lines:
        clean = re.sub(r'^[•\-*\u2022\s]+', '', line).strip()
        if clean:
            out.append(clean)
    return out

def parse_resume_text(text: str) -> dict[str, Any]:
    data = {'contact': {'name': '', 'title': '', 'email': '', 'phone': '', 'linkedin': '', 'portfolio': '', 'location': ''}, 'summary': '', 'skills': [], 'technical': {}, 'experience': [], 'education': [], 'certifications': [], 'additional': [], 'custom_sections': []}
    lines = [re.sub(r'\s+', ' ', l).strip() for l in text.splitlines() if l.strip()]
    sections = split_sections(lines)
    header = sections.get('header', [])[:8]
    email = re.search(r'[\w.+-]+@[\w.-]+', text)
    phone = re.search(r'(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}', text)
    linkedin = re.search(r'https?://(?:www\.)?linkedin\.com/\S+|linkedin\.com/\S+', text, re.I)
    urls = re.findall(r'https?://\S+', text)
    if header:
        data['contact']['name'] = header[0][:100]
    if len(header) > 1 and not section_key(header[1]):
        data['contact']['title'] = header[1][:140]
    if email: data['contact']['email'] = email.group(0)
    if phone: data['contact']['phone'] = phone.group(0)
    if linkedin: data['contact']['linkedin'] = linkedin.group(0)
    for u in urls:
        if 'linkedin' not in u.lower():
            data['contact']['portfolio'] = u; break
    if len(header) > 2:
        maybe_location = [h for h in header if re.search(r'\b[A-Z]{2}\b|,', h) and '@' not in h and not re.search(r'\d{3}', h)]
        if maybe_location: data['contact']['location'] = maybe_location[-1][:100]
    summary_lines = sections.get('summary') or [l for l in header[2:] if '@' not in l and not re.search(r'\d{3}', l)]
    data['summary'] = ' '.join(summary_lines).strip()[:1200]
    skills = bullet_lines(sections.get('skills', []))
    if skills:
        cells = []
        for line in skills:
            cells += [x.strip() for x in re.split(r'[,|;•]', line) if x.strip()]
        data['skills'] = [(cells[i:i+3] + ['', '', ''])[:3] for i in range(0, len(cells), 3)]
    tech_lines = sections.get('technical', [])
    for line in tech_lines:
        if ':' in line:
            k, v = line.split(':', 1); data['technical'][k.strip()] = v.strip()
        else:
            data['technical'].setdefault('Tools', '')
            data['technical']['Tools'] = (data['technical']['Tools'] + ', ' + line).strip(', ')
    exp_lines = sections.get('experience', [])
    current_job = None
    for line in exp_lines:
        is_bullet = re.match(r'^[•\-*\u2022]', line) or len(line) > 95
        date_match = re.search(r'((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December)?\s*\d{4})\s*[–-]\s*((?:Present|Current|\w+\s+)?\d{4}|Present|Current)', line, re.I)
        if not is_bullet and (date_match or len(line.split()) <= 12):
            if current_job: data['experience'].append(current_job)
            current_job = {'title': line, 'company': '', 'location': '', 'dates': date_match.group(0) if date_match else '', 'bullets': []}
        elif current_job:
            current_job['bullets'].append(re.sub(r'^[•\-*\u2022\s]+', '', line))
    if current_job: data['experience'].append(current_job)
    data['education'] = [{'degree': line, 'school': '', 'details': ''} for line in sections.get('education', [])]
    data['certifications'] = bullet_lines(sections.get('certifications', []))
    data['additional'] = bullet_lines(sections.get('additional', []))
    data['source_text'] = text[:20000]
    return normalize_resume_data(data)

def naive_parse_resume(text: str) -> dict[str, Any]:
    parsed = parse_resume_text(text)
    if not parsed['summary'] and not parsed['skills'] and not parsed['experience']:
        fallback = json.loads(json.dumps(DEFAULT_RESUME))
        fallback['source_text'] = text[:20000]
        return normalize_resume_data(fallback)
    return parsed

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
    return {'filename': file.filename or 'resume-upload', 'original_text': text[:30000], 'parsed': parsed}

@app.post('/api/import-confirm')
def import_confirm(payload: ImportConfirmIn):
    data = normalize_resume_data(payload.data)
    name = data.get('contact', {}).get('name') or Path(payload.filename).stem or 'Imported Resume'
    title = data.get('contact', {}).get('title') or 'Imported Resume'
    return save_resume(ResumeIn(name=f'Imported - {name}', title=title, template=payload.template, data=data))

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

def extract_json_object(text: str) -> Optional[dict[str, Any]]:
    if not text:
        return None
    start = text.find('{'); end = text.rfind('}')
    if start == -1 or end == -1 or end <= start:
        return None
    try:
        return json.loads(text[start:end+1])
    except Exception:
        return None

def fallback_personal_resume(payload: PersonalResumeIn) -> dict[str, Any]:
    skill_cells = [x.strip() for x in re.split(r'[,;\n]', payload.skills) if x.strip()]
    achievement_cells = [x.strip() for x in re.split(r'\n|;', payload.achievements) if x.strip()]
    education = [{'degree': payload.education or 'Education details to be completed', 'school': '', 'details': ''}]
    employer = payload.employer_role or 'Most Recent Employer / Role'
    return normalize_resume_data({
        'contact': {'name': '', 'title': payload.title, 'email': '', 'phone': '', 'linkedin': '', 'portfolio': '', 'location': ''},
        'summary': f"{payload.tone.title()} professional with {payload.years or 'relevant'} years of experience targeting {payload.target or payload.title} roles. Background includes {payload.skills or 'core role-aligned skills'}, measurable execution, stakeholder support, and disciplined documentation.",
        'skills': [(skill_cells[i:i+3] + ['', '', ''])[:3] for i in range(0, max(len(skill_cells), 1), 3)] or [['Leadership', 'Operations', 'Communication']],
        'technical': {'Core Skills': payload.skills or 'Add key tools and technologies', 'Target Role': payload.target or payload.title, 'Tone': payload.tone},
        'experience': [{'title': payload.title, 'company': employer, 'location': '', 'dates': '', 'bullets': achievement_cells or ['Delivered role-aligned work improving reliability, service quality, and business outcomes.', 'Partnered with stakeholders to document requirements, resolve issues, and execute priorities.', 'Applied relevant tools and processes to complete projects accurately and efficiently.']}],
        'education': education,
        'certifications': [],
        'additional': [],
        'custom_sections': [{'title': 'Selected Projects', 'bullets': achievement_cells[:4]}] if achievement_cells else []
    })

@app.post('/api/build-from-description')
def build_from_description(payload: PersonalResumeIn):
    prompt = '''Create a complete professional resume JSON from this intake. Return ONLY JSON matching this schema:
{"contact":{"name":"","title":"","email":"","phone":"","linkedin":"","portfolio":"","location":""},"summary":"","skills":[["","",""]],"technical":{"Category":"items"},"experience":[{"title":"","company":"","location":"","dates":"","bullets":[""]}],"education":[{"degree":"","school":"","details":""}],"certifications":[],"additional":[],"custom_sections":[{"title":"","bullets":[""]}]}
Make it specific, premium, truthful to the intake, and optimized for the target role.''' + '\nINTAKE:\n' + payload.model_dump_json()
    generated = claude(prompt)
    parsed = extract_json_object(generated or '')
    resume_data = normalize_resume_data(parsed) if parsed else fallback_personal_resume(payload)
    return save_resume(ResumeIn(name=f"{payload.title or 'AI'} Resume Draft", title=payload.title or 'Resume Draft', template=payload.template, data=resume_data))

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
