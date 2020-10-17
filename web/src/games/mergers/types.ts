export interface IG {
  // TODO: change this to { 'A1': Hotel } ?
  hotels?: Hotel[][];
  players?: Record<string, Player>;
  availableStocks?: Record<Chain, number>;
  lastPlacedHotel?: string;
  lastMove?: string;
  // TODO: use this for mergers? replaces survivingChain, chainToMerge, and bonuses
  // - on a merger, fill and use to display snapshot to players
  // - pre-fill SwapAndSells with zeros for folks without any stock
  // - phase flow
  //   - first turn: start from merger player and find first without an entry
  //   - next turn: find next without an entry
  //   - end phase if: all entries are filled
  merger?: Merger;
}

export enum Chain {
  Tower = 'Tower',
  Luxor = 'Luxor',
  Worldwide = 'Worldwide',
  American = 'American',
  Festival = 'Festival',
  Continental = 'Continental',
  Imperial = 'Imperial',
}

export interface Hotel {
  id?: string;
  hasBeenPlaced?: boolean;
  drawnByPlayer?: string;
  chain?: Chain;
  hasBeenRemoved?: boolean;
}

export interface Player {
  id?: string;
  money?: number;
  stocks?: Record<Chain, number>;
}

export interface Score {
  id?: string;
  money?: number;
  winner?: boolean;
}

export interface SwapAndSell {
  swap?: number;
  sell?: number;
}

export interface Merger {
  survivingChain?: Chain;
  chainToMerge?: Chain;
  mergingChains?: Chain[];
  stockCounts?: Record<string, number>;
  bonuses?: Record<string, number>;
  swapAndSells?: Record<string, SwapAndSell>;
}
