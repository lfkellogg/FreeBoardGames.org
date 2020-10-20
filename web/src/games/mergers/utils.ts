import { Chain, Hotel, IG, Player } from './types';

const NUM_COLUMNS = 12;
const ROW_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
const STOCK_PER_CHAIN = 25;

export function setupInitialState(numPlayers: number): IG {
  return {
    hotels: setupHotels(),
    players: setupPlayers(numPlayers),
    availableStocks: fillStockMap(STOCK_PER_CHAIN),
    lastMove: '',
  };
}

export function setupHotels(): Hotel[][] {
  const hotels: Hotel[][] = [];
  for (let r = 0; r < ROW_LETTERS.length; r++) {
    hotels.push([]);
    for (let c = 0; c < NUM_COLUMNS; c++) {
      hotels[r].push({
        id: `${c + 1}-${ROW_LETTERS[r]}`,
        hasBeenPlaced: false,
      });
    }
  }
  return hotels;
}

export function setupPlayers(numPlayers: number): Record<string, Player> {
  const players: Record<string, Player> = {};
  for (let i = 0; i < numPlayers; i++) {
    const id = `${i}`;
    players[id] = {
      id,
      money: 6000,
      stocks: fillStockMap(0),
    };
  }
  return players;
}

export function fillStockMap<T>(value: T): Record<Chain, T> {
  return {
    Tower: value,
    Luxor: value,
    Worldwide: value,
    American: value,
    Festival: value,
    Continental: value,
    Imperial: value,
  };
}

export function isHotel(hotel: Hotel | string): hotel is Hotel {
  if ((hotel as Hotel).id) {
    return true;
  }
  return false;
}

export function getRow(hotel: Hotel | string): number {
  const id: string = isHotel(hotel) ? hotel.id : hotel;
  return ROW_LETTERS.indexOf(id.split('-')[1]);
}

export function getColumn(hotel: Hotel | string): number {
  const id: string = isHotel(hotel) ? hotel.id : hotel;
  return Number(id.split('-')[0]) - 1; // -1 because columns are 0-based
}

export function getHotel(hotels: Hotel[][], id: string): Hotel {
  return hotels[getRow(id)][getColumn(id)];
}

export function adjacentHotels(hotels: Hotel[][], hotel: Hotel): Hotel[] {
  const r = getRow(hotel);
  const c = getColumn(hotel);
  return hotels
    .flat()
    .filter((h) => h.hasBeenPlaced)
    .filter(
      (h) =>
        (Math.abs(getRow(h) - r) === 1 && getColumn(h) === c) || (Math.abs(getColumn(h) - c) === 1 && getRow(h) === r),
    );
}

export function playerHotels(hotels: Hotel[][], playerID: string) {
  return hotels.flat().filter((h) => h.drawnByPlayer === playerID && !h.hasBeenPlaced && !h.hasBeenRemoved);
}

export function sizeOfChain(chain: Chain, hotels: Hotel[][]): number {
  return hotels.flat().filter((h) => h.chain === chain).length;
}

export function priceOfStock(chain: Chain, hotels: Hotel[][]): number | undefined {
  return priceOfStockBySize(chain, sizeOfChain(chain, hotels));
}

export function priceOfStockBySize(chain: Chain, size: number): number | undefined {
  if (size === 0) {
    return undefined;
  }

  let basePrice: number;
  if (size < 6) {
    basePrice = size * 100;
  } else if (size < 11) {
    basePrice = 600;
  } else if (size < 21) {
    basePrice = 700;
  } else if (size < 31) {
    basePrice = 800;
  } else if (size < 41) {
    basePrice = 900;
  } else {
    basePrice = 1000;
  }

  if ([Chain.Worldwide, Chain.American, Chain.Festival].includes(chain)) {
    return basePrice + 100;
  } else if ([Chain.Continental, Chain.Imperial].includes(chain)) {
    return basePrice + 200;
  } else {
    return basePrice;
  }
}

export function playersInDescOrderOfStock(players: Record<string, Player>, chain: Chain): Player[] {
  const playerList = Object.values(players);
  playerList.sort((a, b) => b.stocks[chain] - a.stocks[chain]);
  return playerList;
}

export function playersInMajority(players: Record<string, Player>, chain: Chain): Player[] {
  const sortedPlayers = playersInDescOrderOfStock(players, chain);
  const majorityStockCount = sortedPlayers[0].stocks[chain];
  if (majorityStockCount === 0) {
    return [];
  }
  return sortedPlayers.filter((p) => p.stocks[chain] === majorityStockCount);
}

export function playersInMinority(players: Record<string, Player>, chain: Chain): Player[] {
  const sortedPlayers = playersInDescOrderOfStock(players, chain);
  const majorityStockCount = sortedPlayers[0].stocks[chain];
  const minorityStockCount = sortedPlayers[1].stocks[chain];
  if (majorityStockCount === minorityStockCount || !minorityStockCount) {
    return [];
  }
  return sortedPlayers.filter((p) => p.stocks[chain] === minorityStockCount);
}

export function majorityBonus(hotels: Hotel[][], chain: Chain): number {
  return priceOfStock(chain, hotels) * 10;
}

export function minorityBonus(hotels: Hotel[][], chain: Chain): number {
  return priceOfStock(chain, hotels) * 5;
}

export function roundUpToNearest100(x: number): number {
  return Math.ceil(x / 100) * 100;
}

export function roundDownToNearest2(x: number): number {
  return Math.floor(x / 2) * 2;
}

export function isUnplayable(hotels: Hotel[][], hotel: Hotel) {
  if (hotel.hasBeenPlaced) {
    return false;
  }

  return isPermanentlyUnplayable(hotels, hotel) || isTemporarilyUnplayable(hotels, hotel);
}

// a hotel is unplayable if it would merge two unmergeable chains
export function isPermanentlyUnplayable(hotels: Hotel[][], hotel: Hotel, maxMergeableSize: number = 10) {
  const adjacentChains = new Set(
    adjacentHotels(hotels, hotel)
      .map((h) => h.chain)
      .filter((c) => !!c),
  );
  const unmergeableChains = Array.from(adjacentChains).filter((c) => sizeOfChain(c, hotels) > maxMergeableSize);
  return unmergeableChains.length > 1;
}

// a hotel is unplayable if it would form a new chain, but they are all on the board
export function isTemporarilyUnplayable(hotels: Hotel[][], hotel: Hotel) {
  const chainsOnBoard: Chain[] = Object.keys(Chain)
    .map((key) => Chain[key])
    .filter((chain) => !!hotels.flat().find((h) => h.chain === chain));
  if (chainsOnBoard.length === 7) {
    const adjacent = adjacentHotels(hotels, hotel);
    return adjacent.length > 0 && adjacent.filter((h) => !!h.chain).length === 0;
  }
  return false;
}
