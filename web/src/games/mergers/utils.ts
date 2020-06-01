import { Chain, Hotel, IG, Player } from './types';

export function adjacentHotels(G: IG, hotel: Hotel): Hotel[] {
  const c = hotel.column;
  const r = hotel.row;
  return G.hotels.flat()
    .filter(h => h.hasBeenPlaced)
    .filter(h =>
      (Math.abs(h.row - r) === 1 && h.column === c) ||
      (Math.abs(h.column - c) === 1 && h.row === r));
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
  return priceOfStock(chain, G.hotels) * 5;
}

export function minorityBonus(G: IG, chain: Chain): number {
  return priceOfStock(chain, G.hotels) * 10;
}

export function roundToNearest100(x: number): number {
  return (x / 100) * 100;
}