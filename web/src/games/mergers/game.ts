import { TurnOrder } from 'boardgame.io/core';
import { Game, Ctx, } from 'boardgame.io';
import { Chain, Hotel, Player, IG } from './types';
import { adjacentHotels, majorityBonus, minorityBonus, playersInMajority, playersInMinority, priceOfStock, roundToNearest100, sizeOfChain } from './utils';

const NUM_COLUMNS = 12;
const ROW_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

function setupHotels(): Hotel[][] {
  const hotels: Hotel[][] = [];
  for (let r = 0; r < ROW_LETTERS.length; r++) {
    hotels.push([]);
    for (let c = 0; c < NUM_COLUMNS; c++) {
      hotels[r].push({
        id: `${c + 1}-${ROW_LETTERS[r]}`,
        column: c,
        row: r,
        hasBeenPlaced: false,
        isUnplayable: false,
      });
    }
  }
  return hotels;
}

function setupPlayers(numPlayers: number): Record<string, Player> {
  const players: Record<string, Player> = {};
  for (let i = 0; i < numPlayers; i++) {
    const id = `${i}`;
    players[id] = {
      id: id,
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

function setupAvailableStocks(): Record<Chain, number> {
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

// function setupTurnOrder(numPlayers: number, hotels: Hotel[][]): string[] {
//   const order: string[] = [];

//   const firstPlayerId = hotels.flat().find(h => h.hasBeenPlaced).drawnByPlayer;
//   order.push(firstPlayerId);

//   // for the rest of the players, fill in
//   for (let i = 0; i < numPlayers; i++) {
//     const hotel = hotels.flat().find(h =>
//       !!h.drawnByPlayer && !order.includes(h.drawnByPlayer));
//     order.push(hotel.drawnByPlayer);
//   }
//   return order;
// }

function moveHotelFromPlayerToBoard(G: IG, ctx: Ctx, player: Player, hotel: Hotel) {
  hotel.hasBeenPlaced = true;
  const playerHotels = player.hotels;
  const indexInRack = playerHotels.findIndex(h => h.id === hotel.id);
  player.hotels.splice(indexInRack, 1);
}

function placeHotel(G: IG, ctx: Ctx, id: string) {
  const hotel: Hotel = G.hotels.flat().find(h => h.id === id);

  moveHotelFromPlayerToBoard(G, ctx, G.players[ctx.currentPlayer], hotel);
  G.lastPlacedHotel = hotel;

  const adjacent = adjacentHotels(G, hotel);

  if (adjacent.length > 0) {
    const adjacentChains = adjacent.map(h => h.chain);
    const adjacentDefinedChains = new Set(adjacentChains.filter(c => !!c));

    if (adjacentDefinedChains.size === 0) {
      ctx.events.setStage('chooseNewChainStage');
      return;
    } else if (adjacentDefinedChains.size === 1) {
      absorbNewHotels(G);
    } else if (adjacentDefinedChains.size > 1) {
      // merger
      G.mergingChains = Array.from(adjacentChains);
      G.mergingChains.sort((a, b) => sizeOfChain(b, G.hotels) - sizeOfChain(a, G.hotels));
      ctx.events.setPhase('chooseSurvivingChainPhase');
    }
  }
  ctx.events.endStage();
}

function absorbNewHotels(G: IG) {
  const adjacent = adjacentHotels(G, G.lastPlacedHotel);
  const chain = adjacent.find(h => !!h.chain).chain;
  // assign the placed hotel to the chain
  G.lastPlacedHotel.chain = chain;
  // assign any other unassigned adjacent hotels to the chain
  adjacent
    .filter(h => !h.chain)
    .forEach(h => h.chain = chain);
}

function chooseNewChain(G: IG, ctx: Ctx, chain: Chain) {
  G.lastPlacedHotel.chain = chain;
  adjacentHotels(G, G.lastPlacedHotel).forEach(h => h.chain = chain);
  // assign free stock
  if (G.availableStocks[chain] > 0) {
    G.availableStocks[chain]--;
    G.players[G.lastPlacedHotel.drawnByPlayer].stocks[chain]++;
  }
  ctx.events.endStage();
}

function gameCanBeDeclaredOver(G: IG) {
  const chainSizes = Object.keys(Chain).map(key => sizeOfChain(Chain[key], G.hotels));
  if (chainSizes.filter(s => s > 0) == chainSizes.filter(s => s > 10)) {
    return true;
  } else if (chainSizes.find(s => s > 40)) {
    return true;
  }
  return false;
}

function buyStock(G: IG, ctx: Ctx, order: Record<Chain, number>) {
  const player = G.players[ctx.playOrderPos];
  let purchasesRemaining = 3;
  for (let key in Object.keys(Chain)) {
    const chain = Chain[key];
    const num = order[chain];
    if (!num) {
      continue;
    }
    if (!G.hotels.flat().find(h => h.chain === chain)) {
      continue;
    }
    const stockPrice = priceOfStock(chain, G.hotels);
    let stocksToBuy = Math.min(num, Math.min(G.availableStocks[chain], purchasesRemaining));
    while (stocksToBuy > 0 && player.money >= stockPrice) {
      player.stocks[chain]++;
      player.money -= stockPrice;
      G.availableStocks[chain]--;
      stocksToBuy--;
      purchasesRemaining--;
    }
  }

  if (gameCanBeDeclaredOver(G)) {
    ctx.events.setStage('declareGameOverStage');
  } else {
    ctx.events.endTurn();
  }
}

function assignRandomHotel(G: IG, ctx: Ctx, player: Player): Hotel | undefined {
  const undrawnHotels = G.hotels.flat().filter(h => !h.drawnByPlayer && !h.isUnplayable);
  if (undrawnHotels.length > 0) {
    const randomHotel = undrawnHotels[Math.floor(ctx.random.Number() * undrawnHotels.length)];
    randomHotel.drawnByPlayer = player.id;
    G.players[player.id].hotels.push(randomHotel);
    return randomHotel;
  }
}

function firstBuildTurn(G: IG, ctx: Ctx): number {
  if (G.lastPlacedHotel) {
    // if we're returning from a merger, it's still the current players turn
    return ctx.playOrder.indexOf(G.lastPlacedHotel.drawnByPlayer);
  } else {
    // otherwise choose first player based on initial hotel placement (closest to top left)
    return ctx.playOrder.indexOf(G.hotels.flat().find(h => h.hasBeenPlaced).drawnByPlayer);
  }
}

function chooseSurvivingChain(G: IG, ctx: Ctx, chain: Chain) {
  G.survivingChain = chain;
  G.mergingChains.splice(G.mergingChains.indexOf(chain), 1);
}

function chooseChainToMerge(G: IG, ctx: Ctx, chain: Chain) {
  const otherChain = G.mergingChains.find(c => c !== chain);
  G.mergingChains[0] = chain;
  G.mergingChains[1] = otherChain;
}

function swapAndSellStock(G: IG, ctx: Ctx, swap: number, sell: number) {
  const player = G.players[ctx.currentPlayer];
  const toSwap =
    Math.min(
      swap,
      Math.min(
        player.stocks[G.chainToMerge],
        G.availableStocks[G.survivingChain] * 2));

  // player gives away N stocks of the merged chan
  player.stocks[G.chainToMerge] -= toSwap;
  G.availableStocks[G.chainToMerge] += toSwap;

  // player receives N / 2 stocks of the surviving chain
  player.stocks[G.survivingChain] += toSwap / 2;
  G.availableStocks[G.survivingChain] -= toSwap / 2;

  // players sells stocks
  player.stocks[G.chainToMerge] -= sell;
  G.availableStocks[G.chainToMerge] += sell;
  player.money += priceOfStock(G.chainToMerge, G.hotels);
}

function isUnplayable(G: IG, hotel: Hotel) {
  if (hotel.hasBeenPlaced) {
    return false;
  }

  const adjacentChains = adjacentHotels(G, hotel).map(h => h.chain);
  const unmergeableChains = new Set(adjacentChains.filter(c => sizeOfChain(c, G.hotels) > 10));
  return unmergeableChains.size > 1;
}

function declareGameOver(G: IG, ctx: Ctx, isGameOver: boolean) {
  if (isGameOver) {
    ctx.events.endGame();
  }
  ctx.events.endTurn();
}

function awardBonuses(G: IG, chain: Chain) {
  const majority = playersInMajority(G, chain);
  if (majority.length === 0) {
    return;
  } else if (majority.length > 1) {
    // split both bonuses between some number of folks
    const total = majorityBonus(G, chain) + minorityBonus(G, chain);
    const each = roundToNearest100(total / majority.length);
    majority.forEach(p => p.money += each);
  } else {
    // give first bonus to first player
    playersInMajority[0].money += majorityBonus(G, chain);

    const minority = playersInMinority(G, chain);
    if (minority.length === 0) {
      return;
    } else if (minority.length > 1) {
      // split minority bonus between em
      const total = minorityBonus(G, chain);
      const each = roundToNearest100(total / minority.length);
      minority.forEach(p => p.money += each);
    } else {
      // give minority to second place
      minority[0].money += minorityBonus(G, chain);
    }
  }
}

export const MergersGame: Game<IG> = {
  name: 'mergers',

  setup: (ctx: Ctx) => {
    console.log('settin up!');
    let hotels = setupHotels();

    let G: IG = {
      hotels: hotels,
      players: setupPlayers(ctx.numPlayers),
      availableStocks: setupAvailableStocks(),
    };

    for (let i = 0; i < ctx.numPlayers; i++) {
      const player = G.players[`${i}`];

      // initial random drawing + placement
      assignRandomHotel(G, ctx, player);
      moveHotelFromPlayerToBoard(G, ctx, player, player.hotels[0]);

      // draw 6 more tiles
      for (let j = 0; j < 6; j++) {
        assignRandomHotel(G, ctx, player);
      }
    }

    console.log('G', G);

    ctx.events.setPhase('buildingPhase');

    return G;
  },

  // playerView: (G: IG, ctx: Ctx, playerID: string): any => {
  //   // remove hotels from other players
  //   Object.values(G.players).filter(p => p.id !== playerID).forEach(p => {
  //     p.hotels = [];
  //   });
  //   return G;

  //   // TODO:
  //   // remove entire state if playerID is undefined
  //   // check if playing in secret mode, remove money, stocks too
  // },

  onEnd: (G: IG, ctx: Ctx) => {
    // award bonuses for remaining chains
    const chains = new Set<Chain>(G.hotels.flat().map(h => h.chain));
    chains.forEach(c => awardBonuses(G, c));

    // sell off all remaining stock in those chains
    chains.forEach(c => {
      Object.values(G.players).forEach(p => {
        const numStock = p.stocks[c];
        p.money += numStock * priceOfStock(c, G.hotels);
        p.stocks[c] -= numStock;
        G.availableStocks[c] += numStock;
      });
    });
  },

  phases: {
    'buildingPhase': {
      turn: {
        order: {
          first: firstBuildTurn,
          next: (G: IG, ctx: Ctx) => (ctx.playOrderPos + 1) % ctx.numPlayers,
        },

        onEnd: (G: IG, ctx: Ctx) => {
          // find and mark any unplayable tiles, and replace if they have been drawn
          G.hotels.flat().filter(h => isUnplayable(G, h)).forEach(h => {
            h.isUnplayable = true;
            if (h.drawnByPlayer) {
              const player: Player = G.players[h.drawnByPlayer];
              assignRandomHotel(G, ctx, player);
              player.hotels = player.hotels.filter(h2 => h2.id !== h.id);
              h.drawnByPlayer = undefined;
            }
          });
        },

        stages: {
          placeHotelStage: {
            moves: { placeHotel },
            next: 'buyStockStage',
          },
          chooseNewChainStage: {
            moves: { chooseNewChain },
            next: 'buyStockStage',
          },
          buyStockStage: {
            moves: { buyStock },
          },
          declareGameOverStage: {
            moves: { declareGameOver },
          },
        },
      },

      onBegin: (G: IG, ctx: Ctx) => {
        console.log('in building phase');
        // if returning from a merger phase, we're now in the buy stock stage
        if (G.lastPlacedHotel) {
          absorbNewHotels(G);
          ctx.events.setStage('buyStockStage');
        } else {
          ctx.events.setStage('placeHotelStage');
        }
      },
    },

    'chooseSurvivingChainPhase': {
      turn: {
        order: {
          first: (G: IG, ctx: Ctx) => ctx.playOrderPos,
          next: (G: IG, ctx: Ctx) => undefined,
        }
      },

      next: 'chooseChainToMergePhase',

      moves: { chooseSurvivingChain },

      endIf: (G: IG, ctx: Ctx) => !!G.survivingChain,

      onBegin: (G: IG, ctx: Ctx) => {
        // if there's a biggest chain, set it as the survivor
        if (!G.survivingChain && sizeOfChain(G.mergingChains[0], G.hotels) !== sizeOfChain(G.mergingChains[1], G.hotels)) {
          G.survivingChain = G.mergingChains.shift();
        }
      }
    },

    'chooseChainToMergePhase': {
      turn: {
        order: {
          first: (G: IG, ctx: Ctx) => ctx.playOrderPos,
          next: (G: IG, ctx: Ctx) => undefined,
        },
      },

      next: 'mergerPhase',

      moves: { chooseChainToMerge },

      endIf: (G: IG, ctx: Ctx) => !G.survivingChain || !!G.chainToMerge,

      onBegin: (G: IG, ctx: Ctx) => {
        // if there's an obvious next chain to merge, set it
        if (!G.chainToMerge &&
          (G.mergingChains.length === 1 ||
            sizeOfChain(G.mergingChains[0], G.hotels) !== sizeOfChain(G.mergingChains[1], G.hotels))) {
          G.chainToMerge = G.mergingChains[0];
        }
      }
    },

    'mergerPhase': {
      turn: {
        order: {
          first: (G: IG, ctx: Ctx) => ctx.playOrderPos,
          next: (G: IG, ctx: Ctx) => {
            // go through each player once until we get back to the current player
            const nextPos = (ctx.playOrderPos + 1) % ctx.numPlayers;
            if (nextPos !== ctx.playOrder.indexOf(G.lastPlacedHotel.drawnByPlayer)) {
              return nextPos;
            }
          },
        },
        stages: {
          swapAndSellStockStage: { moves: { swapAndSellStock } },
        },
      },

      next: 'buildingPhase',

      endIf: (G: IG, ctx: Ctx) => G.mergingChains.length === 0,

      onBegin: (G: IG, ctx: Ctx) => {
        awardBonuses(G, G.chainToMerge);
      },

      onEnd: (G: IG, ctx: Ctx) => {
        // absorb the merged chain into the survivor
        G.hotels.flat()
          .filter(h => h.chain === G.chainToMerge)
          .forEach(h => h.chain = G.survivingChain);

        // remove the just-merged chain
        G.chainToMerge = undefined;
        G.mergingChains.shift();

        // if we're all done, remove the surviving chain reference
        if (G.mergingChains.length === 0) {
          G.survivingChain = undefined;
        } else {
          ctx.events.setPhase('chooseChainToMergePhase');
        }
      },
    },
  },
};