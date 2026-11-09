import { TemplateConfig } from '../types';

export const TEMPLATE_CONFIGS: Record<string, TemplateConfig> = {
  general: {
    title: 'GENERAL VEHICLE CHECKLIST',
    docNo: 'MNT-F-015',
    revisionNo: '01',
    revisionDate: '01/02/2024',
    initialIssueDate: '03/02/2017'
  },
  petroleum_v2: {
    title: 'PETROLEUM TANKER CHECKLIST',
    docNo: 'MNT-F-002',
    revisionNo: '05',
    revisionDate: '15/03/2022',
    initialIssueDate: '03/02/2017',
    nextRevisionDate: '15/04/2025'
  },
  acid: {
    title: 'ACID TANKER CHECKLIST',
    docNo: 'MNT-F-013',
    revisionNo: '06',
    revisionDate: '15/03/24',
    initialIssueDate: '03/02/17',
    nextRevisionDate: '15/03/26'
  }
};
