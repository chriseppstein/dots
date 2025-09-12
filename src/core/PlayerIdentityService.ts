/**
 * PlayerIdentityService manages the mapping between different player ID systems.
 * 
 * The game has two ID systems:
 * 1. Engine IDs: Fixed identifiers used by GameEngine ('player1', 'player2')
 * 2. Network IDs: Socket IDs used by the network layer (e.g., 'socket-abc123')
 * 
 * This service provides a single source of truth for player identity mapping,
 * eliminating the confusion and bugs caused by distributed ID management.
 */
export class PlayerIdentityService {
  private engineToNetworkMap: Map<string, string> = new Map();
  private networkToEngineMap: Map<string, string> = new Map();
  private playerNames: Map<string, string> = new Map(); // Maps any ID to player name
  
  // Standard engine player IDs
  public static readonly PLAYER1 = 'player1';
  public static readonly PLAYER2 = 'player2';
  
  /**
   * Register a player mapping between engine ID and network ID
   */
  public registerPlayer(engineId: string, networkId: string, playerName?: string): void {
    if (!engineId || !networkId) {
      throw new Error('Both engineId and networkId are required');
    }
    
    // Clear any existing mappings for these IDs
    this.clearMappingsForEngineId(engineId);
    this.clearMappingsForNetworkId(networkId);
    
    // Set bidirectional mapping
    this.engineToNetworkMap.set(engineId, networkId);
    this.networkToEngineMap.set(networkId, engineId);
    
    // Store player name if provided
    if (playerName) {
      this.playerNames.set(engineId, playerName);
      this.playerNames.set(networkId, playerName);
    }
  }
  
  /**
   * Get the network ID (socket ID) for a given engine ID
   */
  public getNetworkId(engineId: string): string | undefined {
    return this.engineToNetworkMap.get(engineId);
  }
  
  /**
   * Get the engine ID for a given network ID (socket ID)
   */
  public getEngineId(networkId: string): string | undefined {
    return this.networkToEngineMap.get(networkId);
  }
  
  /**
   * Get player name by any ID (engine or network)
   */
  public getPlayerName(anyId: string): string | undefined {
    return this.playerNames.get(anyId);
  }
  
  /**
   * Check if an ID is an engine ID
   */
  public isEngineId(id: string): boolean {
    return id === PlayerIdentityService.PLAYER1 || id === PlayerIdentityService.PLAYER2;
  }
  
  /**
   * Check if an ID is a network ID
   */
  public isNetworkId(id: string): boolean {
    return this.networkToEngineMap.has(id);
  }
  
  /**
   * Translate any ID to its corresponding ID in the other system
   */
  public translateId(id: string): string | undefined {
    if (this.isEngineId(id)) {
      return this.getNetworkId(id);
    } else if (this.isNetworkId(id)) {
      return this.getEngineId(id);
    }
    return undefined;
  }
  
  /**
   * Get the engine ID for a player by their position (0-indexed)
   */
  public getEngineIdByPosition(position: number): string {
    if (position === 0) return PlayerIdentityService.PLAYER1;
    if (position === 1) return PlayerIdentityService.PLAYER2;
    throw new Error(`Invalid player position: ${position}. Must be 0 or 1.`);
  }
  
  /**
   * Get the position (0 or 1) for an engine ID
   */
  public getPositionByEngineId(engineId: string): number {
    if (engineId === PlayerIdentityService.PLAYER1) return 0;
    if (engineId === PlayerIdentityService.PLAYER2) return 1;
    throw new Error(`Invalid engine ID: ${engineId}. Must be 'player1' or 'player2'.`);
  }
  
  /**
   * Clear all mappings
   */
  public clear(): void {
    this.engineToNetworkMap.clear();
    this.networkToEngineMap.clear();
    this.playerNames.clear();
  }
  
  /**
   * Get all registered mappings (for debugging)
   */
  public getMappings(): { engineId: string; networkId: string; playerName?: string }[] {
    const mappings: { engineId: string; networkId: string; playerName?: string }[] = [];
    for (const [engineId, networkId] of this.engineToNetworkMap) {
      mappings.push({
        engineId,
        networkId,
        playerName: this.playerNames.get(engineId)
      });
    }
    return mappings;
  }
  
  /**
   * Check if service has any mappings
   */
  public hasMappings(): boolean {
    return this.engineToNetworkMap.size > 0;
  }
  
  private clearMappingsForEngineId(engineId: string): void {
    const oldNetworkId = this.engineToNetworkMap.get(engineId);
    if (oldNetworkId) {
      this.networkToEngineMap.delete(oldNetworkId);
      this.playerNames.delete(oldNetworkId);
    }
    this.engineToNetworkMap.delete(engineId);
    this.playerNames.delete(engineId);
  }
  
  private clearMappingsForNetworkId(networkId: string): void {
    const oldEngineId = this.networkToEngineMap.get(networkId);
    if (oldEngineId) {
      this.engineToNetworkMap.delete(oldEngineId);
      this.playerNames.delete(oldEngineId);
    }
    this.networkToEngineMap.delete(networkId);
    this.playerNames.delete(networkId);
  }
}