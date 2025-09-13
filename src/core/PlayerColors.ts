/**
 * Global player color constants
 * Single source of truth for all player colors throughout the application
 */

export const PLAYER_COLORS = {
  PLAYER_1: '#9932CC', // Purple (DarkOrchid)
  PLAYER_2: '#87CEEB', // Sky Blue
  
  // Legacy aliases for backward compatibility
  get PURPLE() { return this.PLAYER_1; },
  get BLUE() { return this.PLAYER_2; }
} as const;

/**
 * Get player color by position (0-based index)
 */
export function getPlayerColor(playerIndex: number): string {
  switch (playerIndex) {
    case 0:
      return PLAYER_COLORS.PLAYER_1;
    case 1:
      return PLAYER_COLORS.PLAYER_2;
    default:
      // Fallback colors for additional players
      const fallbackColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'];
      return fallbackColors[playerIndex % fallbackColors.length] || '#888888';
  }
}

/**
 * Get player color by player ID
 */
export function getPlayerColorById(playerId: string): string {
  if (playerId.includes('player1') || playerId.includes('1')) {
    return PLAYER_COLORS.PLAYER_1;
  } else if (playerId.includes('player2') || playerId.includes('2')) {
    return PLAYER_COLORS.PLAYER_2;
  }
  
  // Fallback to index-based for socket IDs
  const hash = playerId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return getPlayerColor(hash % 2);
}