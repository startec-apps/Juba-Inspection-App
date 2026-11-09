import { CODE_1_CONTROLLER } from './scripts/controller';
import { CODE_2_AUTH_AND_ADMIN } from './scripts/auth';
import { CODE_3_CORE_OPERATIONS } from './scripts/core';
import { CODE_4_SUPPORT_MODULE } from './scripts/support';
import { CODE_5_LIB_AND_UTILS } from './scripts/utils';
import { CODE_6_GENERAL_REPORT_PDF } from './scripts/generalReportPdf';
import { CODE_8_ACID_REPORT_PDF } from './scripts/acidReportPdf';
import { CODE_9_PETROLEUM_V2_REPORT_PDF } from './scripts/petroleumV2ReportPdf';
import { CODE_10_EMERGENCY_REPAIR } from './scripts/emergencyRepair';

export const BACKEND_FILES: Record<string, string> = {
    '1_Controller.gs': CODE_1_CONTROLLER,
    '2_AuthAndAdmin.gs': CODE_2_AUTH_AND_ADMIN,
    '3_CoreOperations.gs': CODE_3_CORE_OPERATIONS,
    '4_SupportModule.gs': CODE_4_SUPPORT_MODULE,
    '5_LibAndUtils.gs': CODE_5_LIB_AND_UTILS,
    'EmergencyRepair.gs': CODE_10_EMERGENCY_REPAIR,
    'GeneralreportPDF.gs': CODE_6_GENERAL_REPORT_PDF,
    'AcidreportPDF.gs': CODE_8_ACID_REPORT_PDF,
    'PetroV2reportPDF.gs': CODE_9_PETROLEUM_V2_REPORT_PDF
};

export const BACKEND_SCRIPT_TEMPLATE = Object.values(BACKEND_FILES).join('\n\n');