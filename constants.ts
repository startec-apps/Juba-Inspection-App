
// Paste your Google Apps Script URL here to auto-connect the app
// Set to empty string '' to enable Multi-Tenant Discovery Mode
export const PRE_CONFIGURED_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby1BSzg7NZPms9KH9Km4ods1MqjtbsJYGxCXaTyQ9qnyBIw8in8r4KVMx76poet4hD6dg/exec'; 

// The Master Resolver script is disabled in single-tenant mode
export const MASTER_RESOLVER_URL = ''; 

export const CACHE_TTL = 300000; // 5 minutes

// Re-export everything from modules
export * from './constants/definitions';
export * from './constants/headers';
export * from './constants/scripts';
export * from './constants/templates';