import { Chain, Hotel, IG, Player } from './types';

const NUM_COLUMNS = 12;
const ROW_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

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
      stocks: {
        Tower: 0,
        Luxor: 0,
        Worldwide: 0,
        American: 0,
        Festival: 0,
        Continental: 0,
        Imperial: 0,
      },
      hotels: [],
    };
  }
  return players;
}

export function setupAvailableStocks(): Record<Chain, number> {
  return {
    Tower: 25,
    Luxor: 25,
    Worldwide: 25,
    American: 25,
    Festival: 25,
    Continental: 25,
    Imperial: 25,
  };
}

function isHotel(hotel: Hotel | string): hotel is Hotel {
  if ((hotel as Hotel).id) {
    return true
  }
  return false
}

export function getRow(hotel: Hotel | string): number {
  const id: string = isHotel(hotel) ? hotel.id : hotel;
  return ROW_LETTERS.indexOf(id.split('-')[1]);
}

export function getColumn(hotel: Hotel | string): number {
  const id: string = isHotel(hotel) ? hotel.id : hotel;
  return parseInt(id.split('-')[0], 10) - 1; // -1 because columns are 0-based
}

export function getHotel(G: IG, id: string): Hotel {
  return G.hotels[getRow(id)][getColumn(id)];
}

export function adjacentHotels(G: IG, hotel: Hotel): Hotel[] {
  const r = getRow(hotel);
  const c = getColumn(hotel);
  return G.hotels.flat()
    .filter(h => h.hasBeenPlaced)
    .filter(h =>
      (Math.abs(getRow(h) - r) === 1 && getColumn(h) === c) ||
      (Math.abs(getColumn(h) - c) === 1 && getRow(h) === r));
}

export function sizeOfChain(chain: Chain, hotels: Hotel[][]): number {
  return hotels.flat().filter(h => h.chain === chain).length;
}

export function priceOfStock(chain: Chain, hotels: Hotel[][]): number {
  const size = sizeOfChain(chain, hotels);
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

export function playersInDescOrderOfStock(G: IG, chain: Chain): Player[] {
  const players = Object.values(G.players);
  players.sort((a, b) => b.stocks[chain] - a.stocks[chain]);
  return players;
}

export function playersInMajority(G: IG, chain: Chain): Player[] {
  const players = playersInDescOrderOfStock(G, chain);
  const majorityStockCount = players[0].stocks[chain];
  if (majorityStockCount === 0) {
    return [];
  }
  return players.filter(p => p.stocks[chain] === majorityStockCount);
}

export function playersInMinority(G: IG, chain: Chain): Player[] {
  const players = playersInDescOrderOfStock(G, chain);
  const majorityStockCount = players[0].stocks[chain];
  const minorityStockCount = players[1].stocks[chain];
  if (majorityStockCount === minorityStockCount || minorityStockCount === 0) {
    return [];
  }
  return players.filter(p => p.stocks[chain] === minorityStockCount);
}

export function majorityBonus(G: IG, chain: Chain): number {
  return priceOfStock(chain, G.hotels) * 10;
}

export function minorityBonus(G: IG, chain: Chain): number {
  return priceOfStock(chain, G.hotels) * 5;
}

export function roundToNearest100(x: number): number {
  return (x / 100) * 100;
}