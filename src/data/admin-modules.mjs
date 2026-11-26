/**
 * Single source of truth for administrative record modules.
 *
 * - `scripts/build.mjs` generates a page per module (site/admin/<slug>.html) and
 *   the nav data (site/admin/assets/modules.js).
 * - `api/_lib/resources.js` builds the server gateway registry from the same data.
 * Adding a module = add a DB table (via a domain migration using
 * private.apply_record_table) + one entry here. No framework code changes.
 *
 * NAV is the full specification hierarchy; modules not yet implemented render as
 * "coming soon" (never dead links). Each MODULE entry wires a slug to a resource.
 */

export const NAV = [
  [
    'Overview',
    [
      ['Dashboard', ''],
      ['Grant Readiness', 'grant-readiness'],
      ['Calendar', 'calendar'],
      ['Tasks', 'tasks'],
      ['Notifications', 'notifications']
    ]
  ],
  [
    'Corporate',
    [
      ['Corporate Governance', 'corporate-governance'],
      ['Financial Records', 'financial-records'],
      ['Federal Registrations', 'federal-registrations'],
      ['Intellectual Property', 'intellectual-property'],
      ['Research Personnel', 'research-personnel']
    ]
  ],
  [
    'Research & Development',
    [
      ['Research Programs', 'research-programs'],
      ['STRIX', 'strix'],
      ['C-Engine', 'c-engine'],
      ['AFIIS', 'afiis'],
      ['ATLAS', 'atlas']
    ]
  ],
  ['Commercialization', [['Commercialization', 'commercialization']]],
  [
    'Funding',
    [
      ['Funding Opportunities', 'funding-opportunities'],
      ['Funding Applications', 'funding-applications'],
      ['Awards & Reporting', 'awards']
    ]
  ],
  [
    'Administration',
    [
      ['Document Vault', 'document-vault'],
      ['Reports & Exports', 'reports'],
      ['Audit Logs', 'audit-logs'],
      ['Settings', 'settings']
    ]
  ]
];

export const MODULES = [
  {
    slug: 'corporate-governance',
    title: 'Corporate Governance',
    subtitle: 'Formation documents, resolutions, agreements, and governance records.',
    schema: 'corporate',
    table: 'governance_records',
    read: 'governance.read',
    write: 'governance.write',
    filters: ['approval_status', 'record_type'],
    columns: [
      {
        key: 'title',
        label: 'Title',
        type: 'text',
        required: true,
        table: true,
        searchable: true,
        sortable: true
      },
      {
        key: 'record_type',
        label: 'Type',
        type: 'select',
        options: [
          'articles',
          'operating_agreement',
          'resolution',
          'certificate',
          'ein',
          'bylaws',
          'other'
        ],
        table: true,
        sortable: true
      },
      {
        key: 'approval_status',
        label: 'Approval',
        type: 'select',
        options: ['draft', 'under_review', 'approved', 'requires_revision'],
        table: true,
        sortable: true
      },
      { key: 'effective_date', label: 'Effective', type: 'date', table: true, sortable: true },
      { key: 'renewal_date', label: 'Renewal', type: 'date', table: true, sortable: true },
      { key: 'reference', label: 'Reference', type: 'text', searchable: true },
      { key: 'description', label: 'Description', type: 'textarea', searchable: true },
      { key: 'notes', label: 'Notes', type: 'textarea', searchable: true }
    ]
  },
  {
    slug: 'federal-registrations',
    title: 'Federal Registrations',
    subtitle: 'SAM.gov, UEI, CAGE, SBIR and state registrations, with renewal tracking.',
    schema: 'corporate',
    table: 'federal_registrations',
    read: 'registrations.read',
    write: 'registrations.write',
    filters: ['registration_status'],
    columns: [
      {
        key: 'authority',
        label: 'Authority',
        type: 'text',
        required: true,
        table: true,
        searchable: true,
        sortable: true
      },
      { key: 'registration_type', label: 'Type', type: 'text', table: true },
      {
        key: 'registration_identifier',
        label: 'Identifier',
        type: 'text',
        table: true,
        searchable: true
      },
      {
        key: 'registration_status',
        label: 'Status',
        type: 'select',
        options: ['not_registered', 'pending', 'active', 'expired'],
        table: true,
        sortable: true
      },
      { key: 'effective_date', label: 'Effective', type: 'date' },
      { key: 'expiration_date', label: 'Expiration', type: 'date', table: true, sortable: true },
      { key: 'renewal_date', label: 'Renewal', type: 'date', table: true, sortable: true },
      { key: 'verification_date', label: 'Verified', type: 'date' },
      { key: 'official_source', label: 'Official source', type: 'text', searchable: true },
      { key: 'responsible_party', label: 'Responsible party', type: 'text', searchable: true },
      { key: 'notes', label: 'Notes', type: 'textarea', searchable: true }
    ]
  }
];
