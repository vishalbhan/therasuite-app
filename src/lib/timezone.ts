import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

// Common timezone options with display names
export const TIMEZONE_OPTIONS = [
  // Popular US timezones
  { value: 'America/New_York', label: 'Eastern Time (ET) - New York' },
  { value: 'America/Chicago', label: 'Central Time (CT) - Chicago' },
  { value: 'America/Denver', label: 'Mountain Time (MT) - Denver' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT) - Los Angeles' },
  { value: 'America/Phoenix', label: 'Mountain Standard Time - Phoenix' },
  { value: 'America/Anchorage', label: 'Alaska Time - Anchorage' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time - Honolulu' },
  
  // Major international timezones
  { value: 'Europe/London', label: 'Greenwich Mean Time (GMT) - London' },
  { value: 'Europe/Paris', label: 'Central European Time (CET) - Paris' },
  { value: 'Europe/Berlin', label: 'Central European Time (CET) - Berlin' },
  { value: 'Europe/Rome', label: 'Central European Time (CET) - Rome' },
  { value: 'Europe/Madrid', label: 'Central European Time (CET) - Madrid' },
  { value: 'Europe/Amsterdam', label: 'Central European Time (CET) - Amsterdam' },
  { value: 'Europe/Brussels', label: 'Central European Time (CET) - Brussels' },
  { value: 'Europe/Vienna', label: 'Central European Time (CET) - Vienna' },
  { value: 'Europe/Zurich', label: 'Central European Time (CET) - Zurich' },
  { value: 'Europe/Stockholm', label: 'Central European Time (CET) - Stockholm' },
  { value: 'Europe/Oslo', label: 'Central European Time (CET) - Oslo' },
  { value: 'Europe/Copenhagen', label: 'Central European Time (CET) - Copenhagen' },
  { value: 'Europe/Helsinki', label: 'Eastern European Time (EET) - Helsinki' },
  { value: 'Europe/Warsaw', label: 'Central European Time (CET) - Warsaw' },
  { value: 'Europe/Prague', label: 'Central European Time (CET) - Prague' },
  { value: 'Europe/Budapest', label: 'Central European Time (CET) - Budapest' },
  { value: 'Europe/Bucharest', label: 'Eastern European Time (EET) - Bucharest' },
  { value: 'Europe/Athens', label: 'Eastern European Time (EET) - Athens' },
  { value: 'Europe/Istanbul', label: 'Turkey Time (TRT) - Istanbul' },
  { value: 'Europe/Moscow', label: 'Moscow Time (MSK) - Moscow' },
  
  // Asia-Pacific
  { value: 'Asia/Kolkata', label: 'India Standard Time (IST) - Mumbai/Delhi' },
  { value: 'Asia/Dubai', label: 'Gulf Standard Time (GST) - Dubai' },
  { value: 'Asia/Shanghai', label: 'China Standard Time (CST) - Shanghai' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST) - Tokyo' },
  { value: 'Asia/Seoul', label: 'Korea Standard Time (KST) - Seoul' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong Time (HKT) - Hong Kong' },
  { value: 'Asia/Singapore', label: 'Singapore Time (SGT) - Singapore' },
  { value: 'Asia/Bangkok', label: 'Indochina Time (ICT) - Bangkok' },
  { value: 'Asia/Jakarta', label: 'Western Indonesia Time (WIB) - Jakarta' },
  { value: 'Asia/Kuala_Lumpur', label: 'Malaysia Time (MYT) - Kuala Lumpur' },
  { value: 'Asia/Manila', label: 'Philippines Time (PHT) - Manila' },
  { value: 'Asia/Dhaka', label: 'Bangladesh Time (BDT) - Dhaka' },
  { value: 'Asia/Karachi', label: 'Pakistan Time (PKT) - Karachi' },
  { value: 'Asia/Tehran', label: 'Iran Time (IRST) - Tehran' },
  { value: 'Asia/Riyadh', label: 'Arabia Standard Time (AST) - Riyadh' },
  { value: 'Asia/Jerusalem', label: 'Israel Time (IST) - Jerusalem' },
  
  // Australia & New Zealand
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (AEST) - Sydney' },
  { value: 'Australia/Melbourne', label: 'Australian Eastern Time (AEST) - Melbourne' },
  { value: 'Australia/Brisbane', label: 'Australian Eastern Time (AEST) - Brisbane' },
  { value: 'Australia/Perth', label: 'Australian Western Time (AWST) - Perth' },
  { value: 'Australia/Adelaide', label: 'Australian Central Time (ACST) - Adelaide' },
  { value: 'Pacific/Auckland', label: 'New Zealand Time (NZST) - Auckland' },
  
  // Americas (other)
  { value: 'America/Toronto', label: 'Eastern Time (ET) - Toronto' },
  { value: 'America/Vancouver', label: 'Pacific Time (PT) - Vancouver' },
  { value: 'America/Mexico_City', label: 'Central Time (CT) - Mexico City' },
  { value: 'America/Sao_Paulo', label: 'Brasilia Time (BRT) - São Paulo' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Argentina Time (ART) - Buenos Aires' },
  { value: 'America/Lima', label: 'Peru Time (PET) - Lima' },
  { value: 'America/Bogota', label: 'Colombia Time (COT) - Bogotá' },
  { value: 'America/Caracas', label: 'Venezuela Time (VET) - Caracas' },
  { value: 'America/Santiago', label: 'Chile Time (CLT) - Santiago' },
  
  // Africa
  { value: 'Africa/Cairo', label: 'Eastern European Time (EET) - Cairo' },
  { value: 'Africa/Lagos', label: 'West Africa Time (WAT) - Lagos' },
  { value: 'Africa/Johannesburg', label: 'South Africa Time (SAST) - Johannesburg' },
  { value: 'Africa/Nairobi', label: 'East Africa Time (EAT) - Nairobi' },
  { value: 'Africa/Casablanca', label: 'Western European Time (WET) - Casablanca' },
];

/**
 * Format a date in a specific timezone with timezone abbreviation
 */
export function formatDateInTimezone(
  date: Date | string,
  timezone: string,
  formatString: string = 'PPP p'
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return formatInTimeZone(dateObj, timezone, formatString);
}

/**
 * Get timezone abbreviation for a given timezone at a specific date
 */
export function getTimezoneAbbreviation(timezone: string, date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short'
    });
    
    const parts = formatter.formatToParts(date);
    const timeZoneName = parts.find(part => part.type === 'timeZoneName');
    return timeZoneName?.value || timezone;
  } catch (error) {
    console.warn(`Could not get timezone abbreviation for ${timezone}:`, error);
    return timezone;
  }
}

/**
 * Format a date with timezone abbreviation in parentheses
 */
export function formatDateWithTimezone(
  date: Date | string,
  timezone: string,
  formatString: string = 'PPP p'
): string {
  const formattedDate = formatDateInTimezone(date, timezone, formatString);
  const abbreviation = getTimezoneAbbreviation(timezone, typeof date === 'string' ? new Date(date) : date);
  return `${formattedDate} (${abbreviation})`;
}

/**
 * Search timezones by query string
 */
export function searchTimezones(query: string): typeof TIMEZONE_OPTIONS {
  if (!query.trim()) return TIMEZONE_OPTIONS;
  
  const searchTerm = query.toLowerCase().trim();
  return TIMEZONE_OPTIONS.filter(tz => 
    tz.label.toLowerCase().includes(searchTerm) ||
    tz.value.toLowerCase().includes(searchTerm)
  );
}

/**
 * Get timezone display name by value
 */
export function getTimezoneDisplayName(timezone: string): string {
  const found = TIMEZONE_OPTIONS.find(tz => tz.value === timezone);
  return found ? found.label : timezone;
}
