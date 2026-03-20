/**
 * TIME UTILITIES - Complete revamp for accurate time tracking
 * Handles all timezone conversions and formatting consistently
 */

// Philippines timezone (UTC+8)
export const PHILIPPINES_TIMEZONE = 'Asia/Manila'
export const UTC_OFFSET_HOURS = 8

/**
 * Get current Philippines time using proper timezone conversion
 */
export function getCurrentPhilippinesTime(): Date {
  // This should NOT be used - use proper timezone conversion instead
  // Keeping for backwards compatibility but marking as deprecated
  console.warn('getCurrentPhilippinesTime is deprecated - use proper timezone conversion');
  return new Date();
}

/**
 * Format a date to Philippines time string
 */
export function formatPhilippinesTime(date: Date | string): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    
    if (isNaN(dateObj.getTime())) {
      return 'Invalid time'
    }

    // Use proper timezone formatting
    return dateObj.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: PHILIPPINES_TIMEZONE
    })
  } catch (error) {
    console.error('Error formatting Philippines time:', error)
    return 'Invalid time'
  }
}

/**
 * Format a date to Philippines time without seconds
 */
export function formatPhilippinesTimeShort(date: Date | string): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    
    if (isNaN(dateObj.getTime())) {
      return 'Invalid time'
    }

    return dateObj.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: PHILIPPINES_TIMEZONE
    })
  } catch (error) {
    console.error('Error formatting Philippines time (short):', error)
    return 'Invalid time'
  }
}

/**
 * Get current UTC timestamp for database storage
 */
export function getCurrentUTCTimestamp(): string {
  return new Date().toISOString()
}

/**
 * Convert UTC timestamp to Philippines time display
 */
export function utcToPhilippinesTime(utcTimestamp: string): string {
  return formatPhilippinesTime(utcTimestamp)
}

/**
 * Check if a timestamp is from today (Philippines time)
 */
export function isTodayPhilippines(timestamp: string): boolean {
  try {
    const date = new Date(timestamp)
    const today = getCurrentPhilippinesTime()
    
    return date.toDateString() === today.toDateString()
  } catch (error) {
    return false
  }
}

/**
 * Get relative time description (e.g., "2 minutes ago", "1 hour ago")
 */
export function getRelativeTimePhilippines(timestamp: string): string {
  try {
    const date = new Date(timestamp)
    const now = getCurrentPhilippinesTime()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    
    return formatPhilippinesTimeShort(timestamp)
  } catch (error) {
    return formatPhilippinesTimeShort(timestamp)
  }
}

/**
 * Activity time formatter with relative time for recent activities
 */
export function formatActivityTime(timestamp: string): string {
  if (isTodayPhilippines(timestamp)) {
    return getRelativeTimePhilippines(timestamp)
  }
  return formatPhilippinesTimeShort(timestamp)
}
