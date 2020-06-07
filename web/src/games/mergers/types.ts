export interface IG {
  // TODO: change this to { 'A1': Hotel } ?
  hotels: Hotel[][];
  players: Record<string, Player>;
  availableStocks: Record<Chain, number>;
  lastPlacedHotel?: string;
  survivingChain?: Chain;
  chainToMerge?: Chain;
  mergingChains?: Chain[];
}

export enum Chain {
  Tower = "Tower",
  Luxor = "Luxor",
  Worldwide = "Worldwide",
  American = "American",
  Festival = "Festival",
  Continental = "Continental",
  Imperial = "Imperial",
}

export interface Hotel {
  id: string;
  hasBeenPlaced?: boolean;
  isUnplayable?: boolean;
  drawnByPlayer?: string;
  chain?: Chain;
}

export interface Player {
  id: string;
  money: number;
  stocks: Record<Chain, number>;
  hotels: Hotel[];
}
