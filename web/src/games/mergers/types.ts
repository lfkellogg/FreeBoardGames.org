export interface IG {
  // TODO: change this to { 'A1': Hotel } ?
  hotels?: Hotel[][];
  players?: Record<string, Player>;
  availableStocks?: Record<Chain, number>;
  lastPlacedHotel?: string;
  lastMove?: LastMove;
  merger?: Merger;
}

export interface LastMove {
  move: Move;
  text: string;
}

export enum Move {
  OpeningDraw = 'OpeningDraw',
  PlaceHotel = 'PlaceHotel',
  PlaceNoHotel = 'PlaceNoHotel',
  ChooseNewChain = 'ChooseNewChain',
  ChooseSurvivingChain = 'ChooseSurvivingChain',
  ChooseChainToMerge = 'ChooseChainToMerge',
  BuyStock = 'BuyStock',
  BuyNoStock = 'BuyNoStock',
  DrawHotels = 'DrawHotels',
  ExchangeStock = 'ExchangeStock',
  ExchangeNoStock = 'ExchangeNoStock',
  DeclareGameOver = 'DeclareGameOver',
}

export enum Chain {
  Toro = 'Toro',
  Lucius = 'Lucius',
  Worldywise = 'Worldywise',
  Amore = 'Amore',
  Festivus = 'Festivus',
  Continuum = 'Continuum',
  Imperative = 'Imperative',
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
  chainSize?: number;
  stockCounts?: Record<string, number>;
  bonuses?: Record<string, number>;
  swapAndSells?: Record<string, SwapAndSell>;
}
