/**
 * TIME DISPLAY UTILITIES - Focused for Employee & Activity Log
 * Simple, reliable time formatting and updates
 */

// Philippines timezone
export const PH_TIMEZONE = 'Asia/Manila'

/**
 * Format timestamp for display in Philippines time
 */
export function formatDisplayTime(timestamp: string | null | undefined): string {
  if (!timestamp) return 'Never'
  
  try {
    const date = new Date(timestamp)
    if (isNaN(date.getTime())) return 'Invalid time'
    
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: PH_TIMEZONE
    })
  } catch (error) {
    console.error('Time formatting error:', error)
    return 'Invalid time'
  }
}

/**
 * Format timestamp for activity log with relative time
 */
export function formatActivityTime(timestamp: string): string {
  try {
    const date = new Date(timestamp)
    if (isNaN(date.getTime())) return 'Invalid time'
    
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    
    // Show relative time for recent activities
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    
    // Show full time for older activities
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: PH_TIMEZONE
    })
  } catch (error) {
    console.error('Activity time formatting error:', error)
    return 'Invalid time'
  }
}

/**
 * Get current UTC timestamp for database
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString()
}
