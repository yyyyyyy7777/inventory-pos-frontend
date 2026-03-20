/**
 * Centralized Date/Time Utilities
 * 
 * All timestamps are stored in UTC in the database.
 * The frontend displays times in the local timezone (defaulting to Asia/Manila if detection fails).
 * This ensures accurate timestamps regardless of server location.
 */

const DEFAULT_TIMEZONE = 'Asia/Manila';

/**
 * Get current timestamp in UTC ISO format for database storage
 */
export function getUtcTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Get current timestamp with timezone info for logging
 */
export function getLocalTimestamp(): string {
  return new Date().toLocaleString('en-US', {
    timeZone: DEFAULT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

/**
 * Debug function to check timezone conversion
 */
export function debugTimezone(timestamp: string): void {
  const date = new Date(timestamp);
  console.log('=== TIMEZONE DEBUG ===');
  console.log('Raw timestamp:', timestamp);
  console.log('Parsed date object:', date);
  console.log('Is valid date:', !isNaN(date.getTime()));
  
  if (!isNaN(date.getTime())) {
    console.log('Parsed date (UTC):', date.toISOString());
    console.log('Asia/Manila time:', date.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    console.log('Local browser time:', date.toLocaleString());
  } else {
    console.log('ERROR: Invalid date format!');
  }
  
  console.log('Current time UTC:', new Date().toISOString());
  console.log('Current time Manila:', new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
}

/**
 * Format a timestamp for display (handles both UTC ISO and Manila time formats)
 */
export function formatToLocalTime(
  timestamp: string | null | undefined,
  options?: {
    includeDate?: boolean;
    includeTime?: boolean;
    includeSeconds?: boolean;
  }
): string {
  if (!timestamp) return 'Never';
  
  try {
    let date: Date;
    
    // Check if it's in Manila time format (e.g., "3/20/2026, 5:30:00 PM" or "3/20/2026 5:30:00 PM")
    if (timestamp.match(/^\d{1,2}\/\d{1,2}\/\d{4}[, ]\d{1,2}:\d{2}:\d{2} (AM|PM)$/)) {
      // Parse Manila time format - it's already in local time, so parse as is
      date = new Date(timestamp);
    } else {
      // Assume it's UTC ISO format
      date = new Date(timestamp);
    }
    
    if (isNaN(date.getTime())) return 'Invalid date';
    
    const defaultOptions = {
      includeDate: true,
      includeTime: true,
      includeSeconds: false,
      ...options
    };
    
    return date.toLocaleString('en-US', {
      year: defaultOptions.includeDate ? 'numeric' : undefined,
      month: defaultOptions.includeDate ? 'short' : undefined,
      day: defaultOptions.includeDate ? 'numeric' : undefined,
      hour: defaultOptions.includeTime ? 'numeric' : undefined,
      minute: defaultOptions.includeTime ? 'numeric' : undefined,
      second: defaultOptions.includeTime && defaultOptions.includeSeconds ? 'numeric' : undefined,
      hour12: true
    });
  } catch (error) {
    return 'Invalid date';
  }
}

/**
 * Format timestamp with relative time (e.g., "2 minutes ago", "Just now")
 */
export function formatRelativeTime(utcTimestamp: string | null | undefined): string {
  if (!utcTimestamp) return 'Never';
  
  try {
    const date = new Date(utcTimestamp);
    if (isNaN(date.getTime())) return 'Invalid date';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    
    // Fall back to full date for older entries
    return formatToLocalTime(utcTimestamp);
  } catch (error) {
    return 'Invalid date';
  }
}

/**
 * Format timestamp for compact display (mobile-friendly)
 */
export function formatCompactTime(utcTimestamp: string | null | undefined): string {
  if (!utcTimestamp) return 'Never';
  
  try {
    const date = new Date(utcTimestamp);
    if (isNaN(date.getTime())) return 'Invalid';
    
    return date.toLocaleString('en-US', {
      timeZone: DEFAULT_TIMEZONE,
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    return 'Invalid';
  }
}

/**
 * Parse a local date string to UTC ISO string
 */
export function localToUtc(localDateStr: string): string {
  try {
    // Assume input is in local timezone, convert to UTC
    const date = new Date(localDateStr);
    return date.toISOString();
  } catch (error) {
    throw new Error(`Failed to parse date: ${localDateStr}`);
  }
}

/**
 * Check if a timestamp is from today
 */
export function isToday(utcTimestamp: string): boolean {
  try {
    const date = new Date(utcTimestamp);
    const now = new Date();
    
    return date.getUTCFullYear() === now.getUTCFullYear() &&
           date.getUTCMonth() === now.getUTCMonth() &&
           date.getUTCDate() === now.getUTCDate();
  } catch {
    return false;
  }
}

/**
 * Get start of day in UTC for a given date
 */
export function getStartOfDay(date: Date = new Date()): string {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  return start.toISOString();
}

/**
 * Get end of day in UTC for a given date
 */
export function getEndOfDay(date: Date = new Date()): string {
  const end = new Date(date);
  end.setUTCHours(23, 59, 59, 999);
  return end.toISOString();
}

/**
 * Generate a unique ID for activity entries
 * Uses timestamp + random for better uniqueness than just Date.now()
 */
export function generateActivityId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
