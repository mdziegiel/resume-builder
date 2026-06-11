# Resume & Career Document Builder

A professional, self-hosted resume and career document builder for creating portfolio-quality resumes, cover letters, thank-you letters, and role-targeted career documents.

## Features

- Premium dark glassmorphism UI using near-black `#06070d`, orange `#f97316`, and Inter/system fonts
- Side-by-side resume editor and LinkedIn-quality browser preview
- Clean two-column resume header layout
- Professional summary, three-column expertise table, technical proficiencies, career experience, education, certifications, and additional experience
- Four resume templates: Classic, Modern, Executive, Technical
- Upload PDF or Word resumes and pre-populate editable fields
- Add/remove/reorder sections and bullet points
- Save multiple resume versions
- Download resume as `.docx` or `.pdf`
- Job-targeted resume mode with ATS keyword gap scoring and Claude recommendations
- Cover letter generation using resume data, job description, company, and hiring manager
- Thank-you letter generation for post-interview follow-up
- Position/Role Builder using title + target industry
- Pre-loaded role library organized by category, including warning indicators for below-target support/junior roles
- SQLite persistence for resumes, generated documents, role library, and uploads

## Seeded default resume

The app starts with Michael Dziegiel's master resume profile:

- Senior Network Administrator / IT Support & Network Engineer
- Contact data, education, certifications, skills tables, technical proficiencies, career experience, and additional MRDTech experience
- Experience entries for Hans Kissle, Skyterra Technologies, and General Investment & Development

The source machine did not contain an uploaded original resume file, so the included seeded bullets are professional reconstructed content based on the provided role history and career level. Replace or refine inside the editor as needed. Honest data beats fabricated artifacts. Satan agrees.

## Docker quickstart

```bash
cp .env.example .env
# Add ANTHROPIC_API_KEY if you want Claude generation.
docker compose up -d --build
```

Open:

```text
http://localhost:8084
```

## Environment

```text
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-20250514
DATABASE_PATH=/data/resume-builder.sqlite
UPLOAD_DIR=/data/uploads
```

## API highlights

- `GET /api/health`
- `GET /api/resumes`
- `POST /api/upload`
- `POST /api/tailor`
- `POST /api/cover-letter`
- `POST /api/thank-you`
- `POST /api/role-build`
- `GET /api/resumes/{id}/export/docx`
- `GET /api/resumes/{id}/export/pdf`

## Screenshots

Place screenshots here after first production deployment:

- Dashboard
- Resume editor with live preview
- Job-targeted resume mode
- Cover letter builder
- Role builder

## Stack

- React + Tailwind
- FastAPI
- SQLite
- Anthropic Claude API
- python-docx
- ReportLab
- pypdf
- Docker single container on port `8084`
