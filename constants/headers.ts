import { INSPECTION_ITEMS, PETROLEUM_V2_ITEMS, ACID_INSPECTION_ITEMS } from './definitions';

const BASE_HEADERS = [
  'id', 'timestamp', 'truckNo', 'trailerNo', 'inspectedBy', 'driverName', 
  'location', 'odometer', 'rate', 'remarks', 'safeToLoad', 'inspectorSignature', 
  'driverSignature', 'photoFront', 'photoLS', 'photoRS', 'photoBack', 
  'photoDamage', 'jobCard'
];

export const SHEET_HEADERS = [
  ...BASE_HEADERS,
  ...INSPECTION_ITEMS.map(item => item.id)
];

export const PETROLEUM_V2_HEADERS = [
  ...BASE_HEADERS,
  ...PETROLEUM_V2_ITEMS.map(item => item.id)
];

export const ACID_HEADERS = [
  ...BASE_HEADERS,
  ...ACID_INSPECTION_ITEMS.map(item => item.id)
];