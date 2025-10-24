/**
 * Time formatting utilities for loan duration and expiry display
 */

/**
 * Convert seconds to a human-readable duration format
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration (e.g., "2h 30m", "3d 4h", "1w 2d")
 */
export const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return "0m";
  
  const weeks = Math.floor(seconds / (7 * 24 * 3600));
  const days = Math.floor((seconds % (7 * 24 * 3600)) / (24 * 3600));
  const hours = Math.floor((seconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  const parts = [];
  
  if (weeks > 0) parts.push(`${weeks}w`);
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 && parts.length < 2) parts.push(`${minutes}m`);
  
  return parts.slice(0, 2).join(' ') || '0m';
};

/**
 * Get time remaining until expiry
 * @param {number} expiryTimestamp - Expiry timestamp in seconds
 * @returns {object} { timeLeft: string, isExpired: boolean, urgency: string }
 */
export const getTimeRemaining = (expiryTimestamp) => {
  const now = Math.floor(Date.now() / 1000);
  const timeLeft = expiryTimestamp - now;
  
  if (timeLeft <= 0) {
    return {
      timeLeft: "Expired",
      isExpired: true,
      urgency: "expired"
    };
  }
  
  const formatted = formatDuration(timeLeft);
  
  // Determine urgency level
  let urgency = "normal";
  if (timeLeft < 3600) urgency = "critical"; // < 1 hour
  else if (timeLeft < 24 * 3600) urgency = "warning"; // < 1 day
  else if (timeLeft < 7 * 24 * 3600) urgency = "caution"; // < 1 week
  
  return {
    timeLeft: formatted,
    isExpired: false,
    urgency
  };
};

/**
 * Format a timestamp to a readable date
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string} Formatted date (e.g., "Dec 25, 2024 3:30 PM")
 */
export const formatDate = (timestamp) => {
  if (!timestamp) return "Unknown";
  
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

/**
 * Get a relative time string (e.g., "2 hours ago", "in 3 days")
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string} Relative time string
 */
export const getRelativeTime = (timestamp) => {
  if (!timestamp) return "Unknown";
  
  const now = Math.floor(Date.now() / 1000);
  const diff = timestamp - now;
  const absDiff = Math.abs(diff);
  
  if (absDiff < 60) return "just now";
  if (absDiff < 3600) {
    const mins = Math.floor(absDiff / 60);
    return diff > 0 ? `in ${mins}m` : `${mins}m ago`;
  }
  if (absDiff < 86400) {
    const hours = Math.floor(absDiff / 3600);
    return diff > 0 ? `in ${hours}h` : `${hours}h ago`;
  }
  
  const days = Math.floor(absDiff / 86400);
  return diff > 0 ? `in ${days}d` : `${days}d ago`;
};

/**
 * Get urgency color class for time remaining
 * @param {string} urgency - Urgency level from getTimeRemaining
 * @returns {string} CSS class name
 */
export const getUrgencyColor = (urgency) => {
  switch (urgency) {
    case 'expired': return 'time-expired';
    case 'critical': return 'time-critical';
    case 'warning': return 'time-warning';
    case 'caution': return 'time-caution';
    default: return 'time-normal';
  }
};
