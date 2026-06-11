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
        'name': 'Michael Dziegiel',
        'title': 'Senior Network Administrator / IT Support & Network Engineer',
        'email': 'mdziegiel74@yahoo.com',
        'phone': '(978) 398-1388',
        'linkedin': 'https://www.linkedin.com/in/mdziegiel/',
        'portfolio': 'https://portfolio.mrdtech.me/',
        'location': 'Lowell, MA 01850'
    },
    'summary': 'Senior Network Administrator and IT Support / Network Engineer with more than 20 years of experience supporting enterprise infrastructure, Microsoft endpoint environments, Active Directory, networking, security, telecommunications, and end-user technology. Known for building reliable systems, resolving complex incidents, improving operational processes, and translating business requirements into secure, maintainable technical solutions.',
    'skills': [
        ['Network Administration', 'Routing & Switching', 'Firewall Management'],
        ['Microsoft 365 / Entra ID', 'Active Directory / Group Policy', 'Intune / Endpoint Management'],
        ['Windows Server', 'Virtualization / Hyper-V', 'Backup & Recovery'],
        ['Cybersecurity Operations', 'SIEM / Monitoring', 'Vulnerability Remediation'],
        ['VoIP / Unified Communications', 'Help Desk Leadership', 'Vendor Management'],
        ['Documentation', 'Project Coordination', 'Executive Support']
    ],
    'technical': {
        'Platforms': 'Windows Server, Windows 10/11, Microsoft 365, Entra ID, Intune, SCCM, Azure, Hyper-V, VMware, Proxmox',
        'Networking': 'Cisco routing and switching, VLANs, VPN, DNS, DHCP, firewalls, wireless, TCP/IP, network monitoring',
        'Security': 'Endpoint security, MFA, conditional access, patching, vulnerability remediation, SIEM, incident response, backups',
        'Tools': 'PowerShell, Remote Monitoring and Management, ticketing systems, documentation systems, backup platforms, VoIP systems'
    },
    'experience': [
        {
            'company': 'Hans Kissle', 'location': 'Haverhill, MA', 'title': 'Senior Network Administrator', 'dates': 'February 2025 – April 2026',
            'bullets': [
                'Administered network, server, endpoint, and Microsoft 365 infrastructure supporting business operations across a production-focused environment.',
                'Managed Active Directory, Group Policy, user access, endpoint configuration, patching, backups, and infrastructure documentation.',
                'Supported switching, firewall, wireless, VPN, DNS, DHCP, and connectivity issues with a focus on uptime and root-cause remediation.',
                'Improved security posture through account hygiene, endpoint hardening, monitoring review, and remediation of recurring technical risks.',
                'Provided senior-level escalation support for complex user, application, network, and systems issues.'
            ]
        },
        {
            'company': 'Skyterra Technologies', 'location': 'Nashua, NH', 'title': 'Systems Analyst', 'dates': 'September 2021 – February 2025',
            'bullets': [
                'Delivered systems analysis, infrastructure support, endpoint troubleshooting, and Microsoft cloud administration for client environments.',
                'Administered Microsoft 365, Entra ID, Active Directory, Windows Server, endpoint policies, and user lifecycle processes.',
                'Resolved escalated incidents involving authentication, networking, application access, endpoint performance, and security controls.',
                'Created technical documentation, standardized support procedures, and improved repeatability for client service delivery.',
                'Collaborated with stakeholders and vendors to plan upgrades, migrations, and corrective actions with minimal disruption.'
            ]
        },
        {
            'company': 'General Investment & Development', 'location': 'Boston, MA', 'title': 'Network Technician', 'dates': 'April 2011 – August 2021',
            'bullets': [
                'Supported enterprise network, desktop, telecommunications, and infrastructure operations for corporate and property environments.',
                'Installed, configured, and troubleshot switches, wireless equipment, cabling, desktops, printers, mobile devices, and business applications.',
                'Maintained user accounts, access permissions, endpoint builds, software deployments, asset records, and technical documentation.',
                'Provided responsive support to executives, office staff, and remote users while maintaining professional service standards.',
                'Assisted with infrastructure projects, office moves, refresh cycles, vendor coordination, and network reliability improvements.'
            ]
        }
    ],
    'education': [{'degree': 'Associate of Arts, Information Technology / Networking', 'school': 'University of Phoenix', 'details': 'GPA 3.97'}],
    'certifications': ['CCENT', 'CCNA (New Horizons 2013)', 'Network Engineering Management Certificate (Xintra 2002)', 'A+ Certified Technician', 'Dell Certified Systems Expert', 'Certificate in Cyber Security (Mount Wachusett Community College)'],
    'additional': ['Owner, MRDTech — IT consulting, infrastructure operations, endpoint management, security monitoring, and self-hosted systems administration.']
}


def seed():
    init_db()
    with connect() as conn:
        for category, titles in ROLE_LIBRARY.items():
            for title in titles:
                below = int(any(token.lower() in title.lower() for token in BELOW_TARGET))
                conn.execute('INSERT OR IGNORE INTO role_library(category,title,below_target) VALUES(?,?,?)', (category, title, below))
        # Earlier builds auto-created Michael's sample resume. That was bad UX.
        # Remove only the untouched default row so the dashboard starts blank.
        conn.execute("DELETE FROM resumes WHERE name=? AND title=?", ('Michael Dziegiel - Master Resume', DEFAULT_RESUME['contact']['title']))


def insert_sample_resume():
    init_db()
    stamp = now()
    with connect() as conn:
        cur = conn.execute('INSERT INTO resumes(name,title,template,data_json,created_at,updated_at) VALUES(?,?,?,?,?,?)',
                           ('Michael Dziegiel - Sample Resume', DEFAULT_RESUME['contact']['title'], 'executive', dumps(DEFAULT_RESUME), stamp, stamp))
        return cur.lastrowid

if __name__ == '__main__':
    seed()
    with connect() as conn:
        print('resumes', conn.execute('SELECT COUNT(*) c FROM resumes').fetchone()['c'])
        print('roles', conn.execute('SELECT COUNT(*) c FROM role_library').fetchone()['c'])
