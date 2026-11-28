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
  },
  {
    slug: 'financial-records',
    title: 'Financial Records',
    subtitle: 'Invoices, expenses, revenue, accounts, budgets and tax records.',
    schema: 'finance',
    table: 'financial_records',
    read: 'finance.read',
    write: 'finance.write',
    filters: ['finance_status', 'record_type'],
    columns: [
      { key: 'title', label: 'Title', type: 'text', required: true, table: true, searchable: true, sortable: true },
      {
        key: 'record_type',
        label: 'Type',
        type: 'select',
        options: ['invoice', 'expense', 'revenue', 'account', 'budget', 'tax', 'statement', 'other'],
        table: true,
        sortable: true
      },
      { key: 'amount', label: 'Amount', type: 'number', table: true, sortable: true },
      { key: 'currency', label: 'Currency', type: 'text' },
      { key: 'counterparty', label: 'Counterparty', type: 'text', table: true, searchable: true },
      { key: 'transaction_date', label: 'Date', type: 'date', table: true, sortable: true },
      { key: 'period', label: 'Period', type: 'text', searchable: true },
      {
        key: 'finance_status',
        label: 'Status',
        type: 'select',
        options: ['recorded', 'pending', 'reconciled', 'disputed'],
        table: true,
        sortable: true
      },
      { key: 'reference', label: 'Reference', type: 'text', searchable: true },
      { key: 'notes', label: 'Notes', type: 'textarea', searchable: true }
    ]
  },
  {
    slug: 'intellectual-property',
    title: 'Intellectual Property',
    subtitle: 'Patents, trademarks, copyrights and trade secrets, with status and renewals.',
    schema: 'corporate',
    table: 'ip_assets',
    read: 'ip.read',
    write: 'ip.write',
    filters: ['ip_status', 'ip_type'],
    columns: [
      { key: 'title', label: 'Title', type: 'text', required: true, table: true, searchable: true, sortable: true },
      {
        key: 'ip_type',
        label: 'Type',
        type: 'select',
        options: ['patent', 'provisional', 'trademark', 'copyright', 'trade_secret', 'other'],
        table: true,
        sortable: true
      },
      {
        key: 'ip_status',
        label: 'Status',
        type: 'select',
        options: ['conception', 'disclosed', 'filed', 'pending', 'granted', 'abandoned', 'expired'],
        table: true,
        sortable: true
      },
      { key: 'jurisdiction', label: 'Jurisdiction', type: 'text', table: true, searchable: true },
      { key: 'application_number', label: 'Application #', type: 'text', searchable: true },
      { key: 'registration_number', label: 'Registration #', type: 'text', searchable: true },
      { key: 'filing_date', label: 'Filed', type: 'date', table: true, sortable: true },
      { key: 'grant_date', label: 'Granted', type: 'date', sortable: true },
      { key: 'expiration_date', label: 'Expires', type: 'date', table: true, sortable: true },
      { key: 'inventors', label: 'Inventors', type: 'text', searchable: true },
      { key: 'owner_of_record', label: 'Owner of record', type: 'text', searchable: true },
      { key: 'notes', label: 'Notes', type: 'textarea', searchable: true }
    ]
  },
  {
    slug: 'research-personnel',
    title: 'Research Personnel',
    subtitle: 'Investigators, staff, advisors and contractors supporting research.',
    schema: 'research',
    table: 'personnel',
    read: 'personnel.read',
    write: 'personnel.write',
    filters: ['engagement_status', 'personnel_type'],
    columns: [
      { key: 'full_name', label: 'Name', type: 'text', required: true, table: true, searchable: true, sortable: true },
      { key: 'role_title', label: 'Role', type: 'text', table: true, searchable: true },
      {
        key: 'personnel_type',
        label: 'Type',
        type: 'select',
        options: ['staff', 'pi', 'co_pi', 'advisor', 'contractor', 'student'],
        table: true,
        sortable: true
      },
      { key: 'affiliation', label: 'Affiliation', type: 'text', table: true, searchable: true },
      { key: 'email', label: 'Email', type: 'text', searchable: true },
      { key: 'orcid', label: 'ORCID', type: 'text', searchable: true },
      { key: 'clearance', label: 'Clearance', type: 'text' },
      {
        key: 'engagement_status',
        label: 'Status',
        type: 'select',
        options: ['active', 'inactive', 'prospective'],
        table: true,
        sortable: true
      },
      { key: 'start_date', label: 'Start', type: 'date', table: true, sortable: true },
      { key: 'notes', label: 'Notes', type: 'textarea', searchable: true }
    ]
  },
  {
    slug: 'research-programs',
    title: 'Research Programs',
    subtitle: 'All research initiatives and proprietary technology programs.',
    schema: 'research',
    table: 'programs',
    resource: 'research.programs',
    read: 'research.read',
    write: 'research.write',
    filters: ['program_status', 'program_code'],
    columns: [
      { key: 'name', label: 'Name', type: 'text', required: true, table: true, searchable: true, sortable: true },
      {
        key: 'program_code',
        label: 'Initiative',
        type: 'select',
        options: ['STRIX', 'C_ENGINE', 'AFIIS', 'ATLAS', 'GENERAL'],
        table: true,
        sortable: true
      },
      { key: 'category', label: 'Category', type: 'text', table: true, searchable: true },
      { key: 'trl', label: 'TRL', type: 'number', table: true, sortable: true },
      { key: 'lead', label: 'Lead', type: 'text', table: true, searchable: true },
      {
        key: 'program_status',
        label: 'Status',
        type: 'select',
        options: ['concept', 'active', 'paused', 'completed', 'archived'],
        table: true,
        sortable: true
      },
      { key: 'start_date', label: 'Start', type: 'date', sortable: true },
      { key: 'target_date', label: 'Target', type: 'date', table: true, sortable: true },
      { key: 'summary', label: 'Summary', type: 'textarea', searchable: true },
      { key: 'notes', label: 'Notes', type: 'textarea', searchable: true }
    ]
  },
  ...['STRIX', 'C_ENGINE', 'AFIIS', 'ATLAS'].map((code) => {
    const slug = { STRIX: 'strix', C_ENGINE: 'c-engine', AFIIS: 'afiis', ATLAS: 'atlas' }[code];
    const title = { STRIX: 'STRIX', C_ENGINE: 'C-Engine', AFIIS: 'AFIIS', ATLAS: 'ATLAS' }[code];
    return {
      slug,
      title,
      subtitle: `${title} program records — milestones, status and technology readiness.`,
      schema: 'research',
      table: 'programs',
      resource: `research.programs:${slug}`,
      read: 'research.read',
      write: 'research.write',
      scope: { program_code: code },
      filters: ['program_status'],
      columns: [
        { key: 'name', label: 'Name', type: 'text', required: true, table: true, searchable: true, sortable: true },
        { key: 'category', label: 'Category', type: 'text', table: true, searchable: true },
        { key: 'trl', label: 'TRL', type: 'number', table: true, sortable: true },
        { key: 'lead', label: 'Lead', type: 'text', table: true, searchable: true },
        {
          key: 'program_status',
          label: 'Status',
          type: 'select',
          options: ['concept', 'active', 'paused', 'completed', 'archived'],
          table: true,
          sortable: true
        },
        { key: 'start_date', label: 'Start', type: 'date', sortable: true },
        { key: 'target_date', label: 'Target', type: 'date', table: true, sortable: true },
        { key: 'summary', label: 'Summary', type: 'textarea', searchable: true },
        { key: 'notes', label: 'Notes', type: 'textarea', searchable: true }
      ]
    };
  }),
  {
    slug: 'commercialization',
    title: 'Commercialization',
    subtitle: 'Licensing, spinouts, partnerships and market initiatives.',
    schema: 'commercialization',
    table: 'commercialization_records',
    read: 'commercialization.read',
    write: 'commercialization.write',
    filters: ['commercialization_status', 'initiative_type'],
    columns: [
      { key: 'title', label: 'Title', type: 'text', required: true, table: true, searchable: true, sortable: true },
      {
        key: 'initiative_type',
        label: 'Type',
        type: 'select',
        options: ['license', 'spinout', 'partnership', 'product', 'market_study', 'other'],
        table: true,
        sortable: true
      },
      {
        key: 'commercialization_status',
        label: 'Status',
        type: 'select',
        options: ['exploring', 'in_negotiation', 'active', 'on_hold', 'closed'],
        table: true,
        sortable: true
      },
      { key: 'market', label: 'Market', type: 'text', table: true, searchable: true },
      { key: 'partner', label: 'Partner', type: 'text', table: true, searchable: true },
      { key: 'estimated_value', label: 'Est. value', type: 'number', table: true, sortable: true },
      { key: 'target_date', label: 'Target', type: 'date', table: true, sortable: true },
      { key: 'notes', label: 'Notes', type: 'textarea', searchable: true }
    ]
  },
  {
    slug: 'funding-opportunities',
    title: 'Funding Opportunities',
    subtitle: 'Solicitations and funding programs tracked for fit and deadlines.',
    schema: 'funding',
    table: 'funding_opportunities',
    read: 'funding.read',
    write: 'funding.write',
    filters: ['opportunity_status', 'agency'],
    columns: [
      { key: 'title', label: 'Title', type: 'text', required: true, table: true, searchable: true, sortable: true },
      { key: 'agency', label: 'Agency', type: 'text', table: true, searchable: true, sortable: true },
      { key: 'program', label: 'Program', type: 'text', table: true, searchable: true },
      { key: 'solicitation_number', label: 'Solicitation #', type: 'text', searchable: true },
      {
        key: 'opportunity_status',
        label: 'Status',
        type: 'select',
        options: ['identified', 'watching', 'preparing', 'submitted', 'closed'],
        table: true,
        sortable: true
      },
      { key: 'award_ceiling', label: 'Ceiling', type: 'number', table: true, sortable: true },
      { key: 'open_date', label: 'Opens', type: 'date', sortable: true },
      { key: 'close_date', label: 'Closes', type: 'date', table: true, sortable: true },
      { key: 'fit_score', label: 'Fit', type: 'number', table: true, sortable: true },
      { key: 'url', label: 'URL', type: 'text' },
      { key: 'notes', label: 'Notes', type: 'textarea', searchable: true }
    ]
  },
  {
    slug: 'funding-applications',
    title: 'Funding Applications',
    subtitle: 'Proposals in preparation, under review, submitted or decided.',
    schema: 'funding',
    table: 'funding_applications',
    read: 'funding.read',
    write: 'funding.write',
    filters: ['application_status', 'agency'],
    columns: [
      { key: 'title', label: 'Title', type: 'text', required: true, table: true, searchable: true, sortable: true },
      { key: 'agency', label: 'Agency', type: 'text', table: true, searchable: true, sortable: true },
      { key: 'program', label: 'Program', type: 'text', table: true, searchable: true },
      { key: 'solicitation_number', label: 'Solicitation #', type: 'text', searchable: true },
      {
        key: 'application_status',
        label: 'Status',
        type: 'select',
        options: ['draft', 'in_review', 'submitted', 'awarded', 'rejected', 'withdrawn'],
        table: true,
        sortable: true
      },
      { key: 'requested_amount', label: 'Requested', type: 'number', table: true, sortable: true },
      { key: 'pi_name', label: 'PI', type: 'text', table: true, searchable: true },
      { key: 'submission_date', label: 'Submitted', type: 'date', table: true, sortable: true },
      { key: 'decision_date', label: 'Decision', type: 'date', sortable: true },
      { key: 'notes', label: 'Notes', type: 'textarea', searchable: true }
    ]
  },
  {
    slug: 'awards',
    title: 'Awards & Reporting',
    subtitle: 'Active and historical awards with reporting deadlines.',
    schema: 'funding',
    table: 'awards',
    read: 'awards.read',
    write: 'awards.write',
    filters: ['award_status', 'award_type'],
    columns: [
      { key: 'title', label: 'Title', type: 'text', required: true, table: true, searchable: true, sortable: true },
      { key: 'agency', label: 'Agency', type: 'text', table: true, searchable: true, sortable: true },
      { key: 'award_number', label: 'Award #', type: 'text', table: true, searchable: true },
      {
        key: 'award_type',
        label: 'Type',
        type: 'select',
        options: ['grant', 'contract', 'cooperative_agreement'],
        table: true,
        sortable: true
      },
      {
        key: 'award_status',
        label: 'Status',
        type: 'select',
        options: ['active', 'completed', 'terminated', 'closeout'],
        table: true,
        sortable: true
      },
      { key: 'award_amount', label: 'Amount', type: 'number', table: true, sortable: true },
      { key: 'pi_name', label: 'PI', type: 'text', table: true, searchable: true },
      { key: 'start_date', label: 'Start', type: 'date', sortable: true },
      { key: 'end_date', label: 'End', type: 'date', table: true, sortable: true },
      { key: 'next_report_due', label: 'Next report', type: 'date', table: true, sortable: true },
      { key: 'notes', label: 'Notes', type: 'textarea', searchable: true }
    ]
  }
];
