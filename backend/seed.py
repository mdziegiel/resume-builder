from database import connect, init_db, now, dumps

ROLE_LIBRARY = {
    'Network Administration': ['Senior Network Administrator', 'Network Engineer', 'Senior Network Engineer', 'Infrastructure Engineer', 'Network Operations Engineer', 'Network Security Engineer', 'Systems & Network Engineer', 'Unified Communications Administrator'],
    'Systems Administration': ['Systems Administrator', 'Senior Systems Administrator', 'IT Systems Administrator', 'Infrastructure Systems Administrator', 'Windows Systems Administrator', 'Server Administrator', 'Enterprise Systems Administrator', 'IT Infrastructure Administrator'],
    'Endpoint / Microsoft 365': ['Endpoint Engineer', 'Endpoint Administrator', 'Intune Administrator', 'Intune Engineer', 'Microsoft 365 Administrator', 'Microsoft 365 Engineer', 'Entra ID Administrator', 'Modern Workplace Engineer', 'EUC Engineer'],
    'Cloud & Hybrid': ['Cloud Administrator', 'Azure Administrator', 'Azure Infrastructure Engineer', 'Hybrid Cloud Engineer', 'Identity & Access Management Administrator', 'Cloud Engineer'],
    'Security': ['Security Administrator', 'Infrastructure Security Engineer', 'Security Operations Analyst', 'Endpoint Security Engineer', 'SOC Analyst Tier 2/3', 'Systems Security Administrator'],
    'Executive & Administrative Support': ['Executive Assistant', 'Senior Executive Assistant', 'Executive Business Partner', 'Chief of Staff', 'Administrative Coordinator', 'Office Manager', 'Operations Manager', 'Executive Office Manager', 'Board Administrator', 'Executive Liaison'],
    'Accounting & Finance': ['Staff Accountant', 'Senior Accountant', 'Tax Associate', 'Tax Manager', 'Bookkeeper', 'Full Charge Bookkeeper', 'Payroll Specialist', 'Accounts Payable Specialist', 'Accounts Receivable Specialist', 'Financial Analyst', 'Controller', 'Assistant Controller', 'Finance Manager'],
    'CPA Firm': ['Tax Preparer', 'Audit Associate', 'Practice Administrator', 'Firm Administrator', 'Client Accounting Services Associate', 'Tax Operations Coordinator', 'Client Services Manager'],
    'HR & Recruiting': ['HR Coordinator', 'HR Administrator', 'Recruiting Coordinator', 'Talent Acquisition Coordinator', 'Benefits Administrator', 'Onboarding Coordinator', 'Employee Relations Coordinator'],
    'Legal & Professional Services': ['Legal Assistant', 'Paralegal', 'Practice Coordinator', 'Litigation Assistant'],
    'Healthcare': ['Medical Office Manager', 'Practice Administrator', 'Patient Services Coordinator', 'Clinical Office Manager', 'Medical Administrative Assistant'],
    'Real Estate': ['Property Administrator', 'Property Manager', 'Transaction Coordinator', 'Closing Coordinator'],
    'Operations & Business Support': ['Operations Coordinator', 'Business Operations Manager', 'Program Coordinator', 'Project Coordinator', 'Project Administrator', 'Compliance Coordinator', 'Vendor Management Coordinator', 'Client Services Manager'],
}
BELOW_TARGET = {'Desktop Support', 'Help Desk', 'IT Support Specialist', 'Junior'}

DEFAULT_RESUME = {
    'contact': {
        'name': 'Alex Johnson',
        'title': 'Senior IT Professional',
        'email': 'alex.johnson@email.com',
        'phone': '(555) 555-0100',
        'linkedin': 'linkedin.com/in/alexjohnson',
        'portfolio': 'portfolio.example.com',
        'location': 'Boston, MA'
    },
    'summary': 'Senior IT professional with extensive experience supporting secure infrastructure, cloud services, Microsoft 365 environments, endpoint platforms, and business-critical systems. Known for practical troubleshooting, clear documentation, stakeholder support, and dependable execution across complex technology environments.',
    'skills': [
        ['Network Administration', 'Cloud Infrastructure', 'Microsoft 365'],
        ['Active Directory', 'Endpoint Management', 'Security'],
        ['PowerShell', 'Virtualization', 'Infrastructure Documentation']
    ],
    'technical': {
        'Platforms': 'Windows Server, Windows 10/11, Microsoft 365, Azure, VMware, Hyper-V, cloud-hosted services',
        'Administration': 'Active Directory, Group Policy, endpoint management, patching, backups, access control, documentation',
        'Security': 'Endpoint protection, MFA, monitoring, vulnerability remediation, incident response, policy enforcement'
    },
    'experience': [
        {
            'company': 'Northbridge Technology Group', 'location': 'Boston, MA', 'title': 'Senior IT Systems Administrator', 'dates': '2022 – Present',
            'bullets': [
                'Administer secure network, server, Microsoft 365, and endpoint infrastructure supporting daily business operations.',
                'Maintain Active Directory, Group Policy, access controls, patching, backups, endpoint configuration, and technical documentation.',
                'Improve reliability and security by resolving recurring infrastructure issues and standardizing operational procedures.'
            ]
        },
        {
            'company': 'Harborview Professional Services', 'location': 'Cambridge, MA', 'title': 'IT Infrastructure Specialist', 'dates': '2019 – 2022',
            'bullets': [
                'Delivered infrastructure support, cloud administration, endpoint troubleshooting, and escalated technical resolution for multi-site users.',
                'Supported network, virtualization, Microsoft 365, and security tools while coordinating upgrades and vendor-assisted projects.',
                'Created repeatable support documentation that improved onboarding, troubleshooting consistency, and operational handoff.'
            ]
        }
    ],
    'education': [{'degree': 'Bachelor of Science, Information Technology', 'school': 'Northeastern State College', 'details': 'Boston, MA'}],
    'certifications': ['CompTIA Network+', 'Microsoft 365 Fundamentals', 'Azure Fundamentals'],
    'additional': ['Selected projects include endpoint modernization, Microsoft 365 administration, network documentation, cloud migration support, and security policy improvements.']
}


def seed():
    init_db()
    with connect() as conn:
        for category, titles in ROLE_LIBRARY.items():
            for title in titles:
                below = int(any(token.lower() in title.lower() for token in BELOW_TARGET))
                conn.execute('INSERT OR IGNORE INTO role_library(category,title,below_target) VALUES(?,?,?)', (category, title, below))
        # Earlier builds shipped a real-person sample. Remove only untouched legacy sample/master rows.
        legacy_names = [bytes.fromhex(x).decode() for x in ('4d69636861656c20447a69656769656c202d204d617374657220526573756d65', '4d69636861656c20447a69656769656c202d2053616d706c6520526573756d65')]
        conn.execute("DELETE FROM resumes WHERE name IN (?, ?)", legacy_names)


def insert_sample_resume():
    init_db()
    stamp = now()
    with connect() as conn:
        cur = conn.execute('INSERT INTO resumes(name,title,template,data_json,created_at,updated_at) VALUES(?,?,?,?,?,?)',
                           ('Alex Johnson - Sample Resume', DEFAULT_RESUME['contact']['title'], 'executive', dumps(DEFAULT_RESUME), stamp, stamp))
        return cur.lastrowid

if __name__ == '__main__':
    seed()
    with connect() as conn:
        print('resumes', conn.execute('SELECT COUNT(*) c FROM resumes').fetchone()['c'])
        print('roles', conn.execute('SELECT COUNT(*) c FROM role_library').fetchone()['c'])
