import { INVALID_MOVE } from 'boardgame.io/core';
import { Game, Ctx } from 'boardgame.io';
import { Chain, Hotel, Player, IG } from './types';
import {
  adjacentHotels,
  getColumn,
  getHotel,
  getRow,
  isPermanentlyUnplayable,
  isUnplayable,
  majorityBonus,
  minorityBonus,
  playersInMajority,
  playersInMinority,
  priceOfStock,
  roundToNearest100,
  roundToNearest2,
  setupAvailableStocks,
  setupHotels,
  setupPlayers,
  sizeOfChain,
} from './utils';

export function moveHotelToBoard(G: IG, hotel: Hotel) {
  hotel.hasBeenPlaced = true;
  if (hotel.drawnByPlayer) {
    const player: Player = G.players[hotel.drawnByPlayer];
    const playerHotels = player.hotels;
    const indexInRack = playerHotels.findIndex((h) => h.id === hotel.id);
    player.hotels.splice(indexInRack, 1);
  }
}

export function placeHotel(G: IG, ctx: Ctx, id?: string) {
  if (!id) {
    const playerHotels = G.players[ctx.playerID].hotels;
    const hasPlayableHotels = !!playerHotels.find((h) => !isUnplayable(G, h));
    if (hasPlayableHotels && playerHotels.length > 0) {
      return INVALID_MOVE;
    }
    G.lastMove = `Player ${ctx.playerID} doesn't have any playable hotels`;
    ctx.events.endStage();
    return;
  }

  const hotel: Hotel = getHotel(G, id);
  if (hotel.drawnByPlayer !== ctx.playerID || isUnplayable(G, hotel)) {
    return INVALID_MOVE;
  }
  moveHotelToBoard(G, hotel);
  G.lastMove = `Player ${ctx.playerID} plays ${id}`;
  G.lastPlacedHotel = id;

  const adjacent = adjacentHotels(G, hotel);

  if (adjacent.length > 0) {
    const adjacentChains = adjacent.map((h) => h.chain);
    const adjacentDefinedChains = adjacentChains.filter((c) => !!c);
    const adjacentDefinedChainSet = new Set(adjacentDefinedChains);
    const numAdjacentChains = adjacentDefinedChainSet.size;

    if (numAdjacentChains === 0) {
      ctx.events.setStage('chooseNewChainStage');
      return;
    } else if (numAdjacentChains === 1) {
      absorbNewHotels(G, adjacentDefinedChains[0], id);
    } else if (numAdjacentChains > 1) {
      // merger
      G.mergingChains = Array.from(adjacentDefinedChainSet);
      G.mergingChains.sort((a, b) => sizeOfChain(b, G.hotels) - sizeOfChain(a, G.hotels));
      ctx.events.setPhase('chooseSurvivingChainPhase');
    }
  }
  ctx.events.endStage();
}

// absorb a hotel and all it connects to, into a chain
export function absorbNewHotels(G: IG, chain: Chain, id: string, idsAbsorbed: Set<string> = new Set([id])) {
  const hotel = getHotel(G, id);
  adjacentHotels(G, hotel)
    .filter((h) => !idsAbsorbed.has(h.id))
    .forEach((h) => absorbNewHotels(G, chain, h.id, idsAbsorbed.add(h.id)));
  hotel.chain = chain;
}

export function chooseNewChain(G: IG, ctx: Ctx, chain: Chain) {
  if (sizeOfChain(chain, G.hotels) > 0) {
    return INVALID_MOVE;
  }
  const lastPlacedHotel = getHotel(G, G.lastPlacedHotel);
  lastPlacedHotel.chain = chain;
  absorbNewHotels(G, chain, lastPlacedHotel.id);

  // assign free stock
  if (G.availableStocks[chain] > 0) {
    G.availableStocks[chain]--;
    G.players[lastPlacedHotel.drawnByPlayer].stocks[chain]++;
  }
  G.lastMove = `Player ${ctx.playerID} chooses ${chain} as the new chain`;
  ctx.events.endStage();
}

export function gameCanBeDeclaredOver(G: IG) {
  const chainSizes = Object.keys(Chain).map((key) => sizeOfChain(Chain[key], G.hotels));
  const chainsOnBoard = chainSizes.filter((s) => s > 0).length;
  const unmergeableChains = chainSizes.filter((s) => s > 10).length;
  if (chainsOnBoard > 0 && chainsOnBoard === unmergeableChains) {
    return true;
  } else if (chainSizes.find((s) => s > 40)) {
    return true;
  }
  return false;
}

export function buyStock(G: IG, ctx: Ctx, order: Record<Chain, number>) {
  G.lastMove = '';
  if (order) {
    const player = G.players[ctx.playOrderPos];
    let purchasesRemaining = 3;
    Object.keys(Chain).forEach((key) => {
      const chain = Chain[key];
      const num = order[chain];
      if (!num) {
        return;
      }
      const stockPrice = priceOfStock(chain, G.hotels);
      if (stockPrice === undefined) {
        return;
      }
      let stocksToBuy = Math.min(num, Math.min(G.availableStocks[chain], purchasesRemaining));
      if (!G.lastMove) {
        G.lastMove += `Player ${ctx.playerID} buys `;
      } else {
        G.lastMove += ', ';
      }
      G.lastMove += `${stocksToBuy} ${chain}`;
      while (stocksToBuy > 0 && player.money >= stockPrice) {
        player.stocks[chain]++;
        player.money -= stockPrice;
        G.availableStocks[chain]--;
        stocksToBuy--;
        purchasesRemaining--;
      }
    });
  }

  if (!G.lastMove) {
    G.lastMove = `Player ${ctx.playerID} doesn't buy any stock`;
  }

  if (gameCanBeDeclaredOver(G)) {
    ctx.events.setStage('declareGameOverStage');
  } else {
    ctx.events.setStage('drawHotelsStage');
  }
}

export function drawHotels(G: IG, ctx: Ctx) {
  const player: Player = G.players[ctx.playerID];
  const hotelsToDraw: number = 6 - player.hotels.length;
  for (let i = 0; i < hotelsToDraw; i++) {
    assignRandomHotel(G, ctx, player);
  }
  ctx.events.endStage();
  ctx.events.endTurn();
}

export function assignRandomHotel(G: IG, ctx: Ctx, player: Player): boolean {
  const hotel = getRandomHotel(G, ctx);
  if (!hotel) {
    return false;
  }
  assignHotelToPlayer(hotel, player);
  return true;
}

export function getRandomHotel(G: IG, ctx: Ctx): Hotel | undefined {
  const undrawnHotels = G.hotels.flat().filter((h) => !h.drawnByPlayer && !isUnplayable(G, h));
  if (undrawnHotels.length > 0) {
    return undrawnHotels[Math.floor(ctx.random.Number() * undrawnHotels.length)];
  }
}

export function assignHotelToPlayer(hotel: Hotel, player: Player) {
  hotel.drawnByPlayer = player.id;
  player.hotels.push(hotel);
}

export function firstBuildTurn(G: IG, ctx: Ctx): number {
  if (G.lastPlacedHotel) {
    // if we're returning from a merger, it's still the current players turn
    return ctx.playOrder.indexOf(getHotel(G, G.lastPlacedHotel).drawnByPlayer);
  } else {
    // otherwise choose first player based on initial hotel placement (closest to top left, letter
    // first)
    const allHotels = G.hotels.flat();
    allHotels.sort((a, b) => getColumn(a) - getColumn(b)).sort((a, b) => getRow(a) - getRow(b));
    return ctx.playOrder.indexOf(allHotels.find((h) => h.hasBeenPlaced).drawnByPlayer);
  }
}

export function chooseSurvivingChain(G: IG, ctx, chain: Chain) {
  // must be the same size as the first (largest) chain in the merge
  if (sizeOfChain(chain, G.hotels) !== sizeOfChain(G.mergingChains[0], G.hotels)) {
    return INVALID_MOVE;
  }
  G.survivingChain = chain;
  G.mergingChains.splice(G.mergingChains.indexOf(chain), 1);
  G.lastMove = `Player ${ctx.playerID} chooses ${chain} to survive the merger`;
}

export function chooseChainToMerge(G: IG, ctx, chain: Chain) {
  // must be the same size as the first (largest) merging chain
  if (sizeOfChain(chain, G.hotels) !== sizeOfChain(G.mergingChains[0], G.hotels)) {
    return INVALID_MOVE;
  }

  G.chainToMerge = chain;

  // move the chain to the front of the array
  G.mergingChains.splice(G.mergingChains.indexOf(chain), 1);
  G.mergingChains.unshift(chain);
  G.lastMove = `Player ${ctx.playerID} chooses ${chain} to merge next`;
}

// TODO: test this
export function swapAndSellStock(G: IG, ctx: Ctx, swap?: number, sell?: number) {
  const player = G.players[ctx.playerID];
  const originalStockCount = player.stocks[G.chainToMerge];

  if (originalStockCount === 0) {
    G.lastMove = `Player ${ctx.playerID} has no ${G.chainToMerge} stock`;
  } else {
    G.lastMove = '';
  }

  let toSwap = swap || 0;
  toSwap = Math.min(toSwap, originalStockCount);
  toSwap = Math.min(toSwap, G.availableStocks[G.survivingChain] * 2);
  toSwap = roundToNearest2(toSwap);

  let toSell = sell || 0;
  toSell = Math.min(toSell, originalStockCount);

  if (toSwap > 0) {
    G.lastMove = `Player ${ctx.playerID} swaps ${toSwap} ${G.chainToMerge} for ${toSwap / 2} ${G.survivingChain}`;
  }

  // player gives away N stocks of the merged chan
  player.stocks[G.chainToMerge] -= toSwap;
  G.availableStocks[G.chainToMerge] += toSwap;

  // player receives N / 2 stocks of the surviving chain
  player.stocks[G.survivingChain] += toSwap / 2;
  G.availableStocks[G.survivingChain] -= toSwap / 2;

  // players sells stocks
  if (toSell > 0) {
    if (G.lastMove) {
      G.lastMove += ', ';
    } else {
      G.lastMove += `Player ${ctx.playerID} `;
    }
    G.lastMove += `sells ${toSell} ${G.chainToMerge}`;
  }
  player.stocks[G.chainToMerge] -= toSell;
  G.availableStocks[G.chainToMerge] += toSell;
  player.money += toSell * priceOfStock(G.chainToMerge, G.hotels);

  if (originalStockCount > 0 && player.stocks[G.chainToMerge] > 0) {
    if (!G.lastMove) {
      G.lastMove += `Player ${ctx.playerID} `;
    } else {
      G.lastMove += ', ';
    }
    G.lastMove += `keeps ${player.stocks[G.chainToMerge]} ${G.chainToMerge}`;
  }
}

export function declareGameOver(G: IG, ctx: Ctx, isGameOver: boolean) {
  if (isGameOver) {
    G.lastMove = `Player ${ctx.playerID} declares the game over`;
    // award bonuses for remaining chains
    const chains = new Set<Chain>(
      G.hotels
        .flat()
        .map((h) => h.chain)
        .filter((c) => !!c),
    );
    chains.forEach((c) => awardBonuses(G, c));

    // sell off all remaining stock in those chains
    chains.forEach((c) => {
      const stockPrice = priceOfStock(c, G.hotels);
      if (stockPrice === undefined) {
        return;
      }
      Object.keys(G.players).forEach((key) => {
        const numStock = G.players[key].stocks[c];
        G.players[key].money += numStock * stockPrice;
        G.players[key].stocks[c] -= numStock;
        G.availableStocks[c] += numStock;
      });
    });

    let playerArray = Object.values(G.players);
    playerArray = playerArray.slice(0, playerArray.length);
    playerArray.sort((a, b) => b.money - a.money);
    const winningScore = playerArray[0].money;
    const winners = playerArray.filter((p) => p.money === winningScore).map((p) => p.id);
    ctx.events.endGame({
      winner: winners.length === 1 ? winners[0] : undefined,
      winners: winners.length > 1 ? winners : undefined,
      scores: playerArray.map((p) => ({
        id: p.id,
        money: p.money,
        winner: p.money === winningScore,
      })),
    });
    ctx.events.endTurn();
    ctx.events.endStage();
  } else {
    ctx.events.setStage('drawHotelsStage');
  }
}

// TODO: log all messages so we can log individual messages for each bonus payout etc.
export function awardBonuses(G: IG, chain: Chain) {
  const majority = playersInMajority(G, chain);
  if (majority.length === 1) {
    // give first bonus to first player
    majority[0].money += majorityBonus(G, chain);
    // console.log(`${majority[0].id} gets ${majorityBonus(G, chain)}`);

    const minority = playersInMinority(G, chain);
    if (minority.length === 0) {
      // give minority to the majority as well
      majority[0].money += minorityBonus(G, chain);
      // console.log(`${majority[0].id} gets ${minorityBonus(G, chain)}`);
    } else if (minority.length === 1) {
      // give minority to second place
      minority[0].money += minorityBonus(G, chain);
      // console.log(`${minority[0].id} gets ${minorityBonus(G, chain)}`);
    } else if (minority.length > 1) {
      // split minority bonus between em
      const total = minorityBonus(G, chain);
      const each = roundToNearest100(total / minority.length);
      minority.forEach((p) => (p.money += each));
      // console.log(`${minority.map(p => p.id)} all get ${each}`);
    }
  } else if (majority.length > 1) {
    // split both bonuses between some number of folks
    const total = majorityBonus(G, chain) + minorityBonus(G, chain);
    const each = roundToNearest100(total / majority.length);
    majority.forEach((p) => (p.money += each));
    // console.log(`${majority.map(p => p.id)} all get ${each}`);
  }
}

export function setupInitialDrawing(G: IG, ctx: Ctx) {
  for (let i = 0; i < ctx.numPlayers; i++) {
    const player = G.players[`${i}`];

    // initial random drawing + placement
    assignRandomHotel(G, ctx, player);
    moveHotelToBoard(G, player.hotels[0]);

    // draw 6 more tiles
    for (let j = 0; j < 6; j++) {
      assignRandomHotel(G, ctx, player);
    }
  }
}

export function autosetChainToMerge(G: IG) {
  // if there's an obvious next chain to merge, set it
  if (
    !G.chainToMerge &&
    (G.mergingChains.length === 1 ||
      sizeOfChain(G.mergingChains[0], G.hotels) !== sizeOfChain(G.mergingChains[1], G.hotels))
  ) {
    G.chainToMerge = G.mergingChains[0];
  }
}

export const MergersGame: Game<IG> = {
  name: 'mergers',

  setup: (ctx: Ctx) => {
    const hotels = setupHotels();

    const G: IG = {
      hotels,
      players: setupPlayers(ctx.numPlayers),
      availableStocks: setupAvailableStocks(),
      lastMove: '',
    };

    setupInitialDrawing(G, ctx);

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

  phases: {
    buildingPhase: {
      turn: {
        order: {
          first: firstBuildTurn,
          next: (G: IG, ctx: Ctx) => (ctx.playOrderPos + 1) % ctx.numPlayers,
        },

        activePlayers: { currentPlayer: 'placeHotelStage' },

        onEnd: (G: IG) => {
          // find and mark any unplayable tiles, and remove from players' racks
          // TODO: maybe move this, gets triggered on merger, for example
          G.hotels
            .flat()
            .filter((h) => isPermanentlyUnplayable(G, h) && h.drawnByPlayer)
            .forEach((h) => {
              const player: Player = G.players[h.drawnByPlayer];
              player.hotels = player.hotels.filter((h2) => h2.id !== h.id);
              h.drawnByPlayer = undefined;
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
          drawHotelsStage: {
            moves: { drawHotels },
          },
        },
      },

      onBegin: (G: IG, ctx: Ctx) => {
        if (G.lastPlacedHotel) {
          // if returning from a merger phase, we're now in the buy stock stage
          const hotel = getHotel(G, G.lastPlacedHotel);
          absorbNewHotels(G, hotel.chain, G.lastPlacedHotel);
          ctx.events.setActivePlayers({ value: { [hotel.drawnByPlayer]: 'buyStockStage' } });
        }
      },
    },

    chooseSurvivingChainPhase: {
      turn: {
        order: {
          first: (G: IG, ctx: Ctx) => ctx.playOrderPos,
          next: () => undefined,
        },
      },

      next: 'chooseChainToMergePhase',

      moves: { chooseSurvivingChain },

      endIf: (G: IG) => !!G.survivingChain,

      onBegin: (G: IG) => {
        // if there's a biggest chain, set it as the survivor
        if (
          !G.survivingChain &&
          sizeOfChain(G.mergingChains[0], G.hotels) !== sizeOfChain(G.mergingChains[1], G.hotels)
        ) {
          G.survivingChain = G.mergingChains.shift();
        }
      },
    },

    chooseChainToMergePhase: {
      turn: {
        order: {
          first: (G: IG, ctx: Ctx) => ctx.playOrderPos,
          next: () => undefined,
        },
      },

      next: 'mergerPhase',

      moves: { chooseChainToMerge },

      endIf: (G: IG) => !G.survivingChain || !!G.chainToMerge,

      onBegin: (G: IG) => autosetChainToMerge(G),
    },

    mergerPhase: {
      turn: {
        order: {
          first: (G: IG, ctx: Ctx) => ctx.playOrderPos,
          next: (G: IG, ctx: Ctx) => {
            // go through each player once until we get back to the current player
            const nextPos = (ctx.playOrderPos + 1) % ctx.numPlayers;
            if (nextPos !== ctx.playOrder.indexOf(getHotel(G, G.lastPlacedHotel).drawnByPlayer)) {
              return nextPos;
            }
          },
        },
        moveLimit: 1,
      },

      next: 'buildingPhase',

      moves: { swapAndSellStock },

      endIf: (G: IG) => G.mergingChains.length === 0,

      onBegin: (G: IG) => awardBonuses(G, G.chainToMerge),

      onEnd: (G: IG, ctx: Ctx) => {
        // remove the just-merged chain
        G.chainToMerge = undefined;
        G.mergingChains.shift();

        // if we're all done, remove the surviving chain reference
        if (G.mergingChains.length === 0) {
          absorbNewHotels(G, G.survivingChain, G.lastPlacedHotel);
          G.survivingChain = undefined;
        } else {
          ctx.events.setPhase('chooseChainToMergePhase');
        }
      },
    },
  },
};
