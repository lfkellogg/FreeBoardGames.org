import { INVALID_MOVE } from 'boardgame.io/core';
import { Game, Ctx } from 'boardgame.io';
import { Chain, Hotel, Player, IG, Merger } from './types';
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
  roundUpToNearest100,
  roundDownToNearest2,
  setupInitialState,
  sizeOfChain,
  playerHotels,
} from './utils';

export function placeHotel(G: IG, ctx: Ctx, id?: string) {
  if (!id) {
    const hotels = playerHotels(G.hotels, ctx.playerID);
    const hasPlayableHotels = !!hotels.find((h) => !isUnplayable(G.hotels, h));
    if (hasPlayableHotels && hotels.length > 0) {
      return INVALID_MOVE;
    }
    G.lastMove = `Player ${ctx.playerID} doesn't have any playable hotels`;
    ctx.events.endStage();
    return;
  }

  const hotel: Hotel = getHotel(G.hotels, id);
  if (hotel.hasBeenPlaced || hotel.drawnByPlayer !== ctx.playerID || isUnplayable(G.hotels, hotel)) {
    return INVALID_MOVE;
  }
  hotel.hasBeenPlaced = true;
  G.lastPlacedHotel = id;

  const adjacent = adjacentHotels(G.hotels, hotel);

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
      const mergingChains = Array.from(adjacentDefinedChainSet);
      mergingChains.sort((a, b) => sizeOfChain(b, G.hotels) - sizeOfChain(a, G.hotels));
      G.merger = { mergingChains };
      ctx.events.setPhase('chooseSurvivingChainPhase');
    }
  }
  ctx.events.endStage();
}

// absorb a hotel and all it connects to, into a chain
export function absorbNewHotels(G: IG, chain: Chain, id: string, idsAbsorbed: Set<string> = new Set([id])) {
  const hotel = getHotel(G.hotels, id);
  adjacentHotels(G.hotels, hotel)
    .filter((h) => !idsAbsorbed.has(h.id))
    .forEach((h) => absorbNewHotels(G, chain, h.id, idsAbsorbed.add(h.id)));
  hotel.chain = chain;
}

export function chooseNewChain(G: IG, ctx: Ctx, chain: Chain) {
  if (sizeOfChain(chain, G.hotels) > 0) {
    return INVALID_MOVE;
  }
  const lastPlacedHotel = getHotel(G.hotels, G.lastPlacedHotel);
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
    const player = G.players[ctx.playerID];
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
      G.lastMove += `${stocksToBuy} ${chain} for $${stockPrice * stocksToBuy}`;
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
  // first, find and remove any of this player's unplayable tiles
  const player: Player = G.players[ctx.playerID];
  playerHotels(G.hotels, player.id)
    .filter((h) => isPermanentlyUnplayable(G.hotels, h))
    .forEach((h) => {
      h.drawnByPlayer = undefined;
      h.hasBeenRemoved = true;
    });

  const hotelsToDraw: number = 6 - playerHotels(G.hotels, player.id).length;
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
  hotel.drawnByPlayer = player.id;
  return true;
}

export function getRandomHotel(G: IG, ctx: Ctx): Hotel | undefined {
  const undrawnHotels = G.hotels.flat().filter((h) => !h.drawnByPlayer && !h.hasBeenRemoved);
  if (undrawnHotels.length > 0) {
    return undrawnHotels[Math.floor(ctx.random.Number() * undrawnHotels.length)];
  }
}

export function firstBuildTurn(G: IG, ctx: Ctx): number {
  if (G.lastPlacedHotel) {
    // if we're returning from a merger, it's still the current players turn
    return ctx.playOrder.indexOf(getHotel(G.hotels, G.lastPlacedHotel).drawnByPlayer);
  } else {
    // otherwise choose first player based on initial hotel placement (closest to top left, letter
    // first)
    const allHotels = G.hotels.flat();
    allHotels.sort((a, b) => getColumn(a) - getColumn(b)).sort((a, b) => getRow(a) - getRow(b));
    const topLeftMostHotel = allHotels.find((h) => h.hasBeenPlaced);
    G.lastMove = `Player ${topLeftMostHotel.drawnByPlayer} draws ${topLeftMostHotel.id} and will go first`;
    return ctx.playOrder.indexOf(topLeftMostHotel.drawnByPlayer);
  }
}

export function chooseSurvivingChain(G: IG, ctx, chain: Chain) {
  // must be the same size as the first (largest) chain in the merge
  if (sizeOfChain(chain, G.hotels) !== sizeOfChain(G.merger.mergingChains[0], G.hotels)) {
    return INVALID_MOVE;
  }
  G.merger.survivingChain = chain;
  G.merger.mergingChains.splice(G.merger.mergingChains.indexOf(chain), 1);
  G.lastMove = `Player ${ctx.playerID} chooses ${chain} to survive the merger`;
}

export function chooseChainToMerge(G: IG, ctx, chain: Chain) {
  // must be the same size as the first (largest) merging chain
  if (sizeOfChain(chain, G.hotels) !== sizeOfChain(G.merger.mergingChains[0], G.hotels)) {
    return INVALID_MOVE;
  }

  G.merger.chainToMerge = chain;

  // move the chain to the front of the array
  G.merger.mergingChains.splice(G.merger.mergingChains.indexOf(chain), 1);
  G.merger.mergingChains.unshift(chain);
  G.lastMove = `Player ${ctx.playerID} chooses ${chain} to merge next`;
}

export function swapAndSellStock(G: IG, ctx: Ctx, swap?: number, sell?: number) {
  const { chainToMerge, survivingChain } = G.merger;
  const player = G.players[ctx.playerID];
  const originalStockCount = player.stocks[chainToMerge];

  if (originalStockCount === 0) {
    G.lastMove = `Player ${ctx.playerID} has no ${chainToMerge} stock`;
  } else {
    G.lastMove = '';
  }

  let toSwap = swap || 0;
  toSwap = Math.min(toSwap, originalStockCount);
  toSwap = Math.min(toSwap, G.availableStocks[survivingChain] * 2);
  toSwap = roundDownToNearest2(toSwap);

  let toSell = sell || 0;
  toSell = Math.min(toSell, originalStockCount);

  if (toSwap > 0) {
    G.lastMove = `Player ${ctx.playerID} swaps ${toSwap} ${chainToMerge} for ${toSwap / 2} ${survivingChain}`;
  }
  // player gives away N stocks of the merged chan
  player.stocks[chainToMerge] -= toSwap;
  G.availableStocks[chainToMerge] += toSwap;

  // player receives N / 2 stocks of the surviving chain
  player.stocks[survivingChain] += toSwap / 2;
  G.availableStocks[survivingChain] -= toSwap / 2;

  // players sells stocks
  if (toSell > 0) {
    if (G.lastMove) {
      G.lastMove += ', ';
    } else {
      G.lastMove += `Player ${ctx.playerID} `;
    }
    G.lastMove += `sells ${toSell} ${chainToMerge}`;
  }

  player.stocks[chainToMerge] -= toSell;
  G.availableStocks[chainToMerge] += toSell;
  player.money += toSell * priceOfStock(chainToMerge, G.hotels);
  G.merger.swapAndSells[player.id] = { swap: toSwap, sell: toSell };

  if (originalStockCount > 0 && player.stocks[chainToMerge] > 0) {
    if (!G.lastMove) {
      G.lastMove += `Player ${ctx.playerID} `;
    } else {
      G.lastMove += ', ';
    }
    G.lastMove += `keeps ${player.stocks[chainToMerge]} ${chainToMerge}`;
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
        .sort((a, b) => sizeOfChain(a, G.hotels) - sizeOfChain(b, G.hotels))
        .filter((c) => !!c),
    );
    const finalMergers = [];
    chains.forEach((c) => {
      const mergerResults = getMergerResults(G, c);
      finalMergers.push(mergerResults);
      awardMoneyToPlayers(G, mergerResults.bonuses);
    });

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

    // build gameover object
    let playerArray = Object.values(G.players);
    playerArray = playerArray.slice(0, playerArray.length);
    playerArray.sort((a, b) => b.money - a.money);
    const winningScore = playerArray[0].money;
    const winners = playerArray.filter((p) => p.money === winningScore).map((p) => p.id);
    ctx.events.endGame({
      declaredBy: ctx.playerID,
      winner: winners.length === 1 ? winners[0] : undefined,
      winners: winners.length > 1 ? winners : undefined,
      scores: playerArray.map((p) => ({
        id: p.id,
        money: p.money,
        winner: p.money === winningScore,
      })),
      finalMergers,
    });
    ctx.events.endTurn();
    ctx.events.endStage();
  } else {
    ctx.events.setStage('drawHotelsStage');
  }
}

export function getBonuses(G: IG, chain: Chain): Record<string, number> {
  const bonuses = {};
  const majority = playersInMajority(G.players, chain);
  if (majority.length === 1) {
    // give first bonus to first player
    bonuses[majority[0].id] = majorityBonus(G.hotels, chain);

    const minority = playersInMinority(G.players, chain);
    if (minority.length === 0) {
      // give minority to the majority as well
      bonuses[majority[0].id] += minorityBonus(G.hotels, chain);
    } else if (minority.length === 1) {
      // give minority to second place
      bonuses[minority[0].id] = minorityBonus(G.hotels, chain);
    } else if (minority.length > 1) {
      // split minority bonus between em
      const total = minorityBonus(G.hotels, chain);
      const each = roundUpToNearest100(total / minority.length);
      for (const player of minority) {
        bonuses[player.id] = each;
      }
    }
  } else if (majority.length > 1) {
    // split both bonuses between some number of folks
    const total = majorityBonus(G.hotels, chain) + minorityBonus(G.hotels, chain);
    const each = roundUpToNearest100(total / majority.length);
    for (const player of majority) {
      bonuses[player.id] = each;
    }
  }
  return bonuses;
}

export function awardMoneyToPlayers(G: IG, awards: Record<string, number>) {
  for (const playerID of Object.keys(awards)) {
    G.players[playerID].money += awards[playerID];
  }
}

export function awardBonuses(G: IG, chain: Chain) {
  awardMoneyToPlayers(G, getBonuses(G, chain));
}

export function setupInitialDrawing(G: IG, ctx: Ctx) {
  for (let i = 0; i < ctx.numPlayers; i++) {
    const player = G.players[`${i}`];

    // initial random drawing + placement
    assignRandomHotel(G, ctx, player);
    playerHotels(G.hotels, player.id)[0].hasBeenPlaced = true;

    // draw 6 more tiles
    for (let j = 0; j < 6; j++) {
      assignRandomHotel(G, ctx, player);
    }
  }
}

export function autosetChainToMerge(G: IG) {
  if (!!G.merger.chainToMerge) {
    return;
  }
  if (G.merger.mergingChains.length === 1) {
    G.merger.chainToMerge = G.merger.mergingChains[0];
    return;
  }
  const firstChainSize = sizeOfChain(G.merger.mergingChains[0], G.hotels);
  const secondChainSize = sizeOfChain(G.merger.mergingChains[1], G.hotels);
  if (firstChainSize !== secondChainSize) {
    G.merger.chainToMerge = G.merger.mergingChains[0];
  }
}

export function nextPlayerPos(ctx: Ctx, playerPos: number): number {
  return (playerPos + 1) % ctx.numPlayers;
}

// TODO: simplify this
export function mergerPhaseFirstTurn(G: IG, ctx: Ctx) {
  return mergerPhaseNextTurn(G, ctx, true);
}

// TODO: simplify this
export function mergerPhaseNextTurn(G: IG, ctx: Ctx, isFirst: boolean = false) {
  const mergingPlayerID = getHotel(G.hotels, G.lastPlacedHotel).drawnByPlayer;
  const mergingPlayerPos = ctx.playOrder.indexOf(mergingPlayerID);

  // check if the next player needs to go
  const startingPos = isFirst ? mergingPlayerPos : nextPlayerPos(ctx, ctx.playOrderPos);
  if (!G.merger.swapAndSells[ctx.playOrder[startingPos]]) {
    return startingPos;
  }

  // otherwise, loop once through the rest of the players until we find one
  for (let i = nextPlayerPos(ctx, startingPos); i !== startingPos; i = nextPlayerPos(ctx, i)) {
    if (G.merger.swapAndSells[ctx.playOrder[i]] === undefined) {
      return i;
    }
  }

  if (G.merger.mergingChains.length === 1) {
    ctx.events.setPhase('buildingPhase');
  } else {
    ctx.events.setPhase('chooseChainToMergePhase');
  }

  // return a value to avoid from ending the phase that way, which preempts the setPhase call
  // we also want to set the merging player as the next turn regardless
  return mergingPlayerPos;
}

export function getMergerResults(G: IG, chainToMerge: Chain): Merger {
  const stockCounts = {};
  const swapAndSells = {};
  for (const player of Object.values(G.players)) {
    const numStock = player.stocks[chainToMerge];
    stockCounts[player.id] = numStock;
    if (numStock === 0) {
      // for folks that have no stock, prefill their swaps/sells to empty so they're skipped
      swapAndSells[player.id] = { swap: 0, sell: 0 };
    }
  }

  const bonuses = getBonuses(G, chainToMerge);
  return {
    chainToMerge,
    stockCounts,
    swapAndSells,
    bonuses,
  };
}

export const MergersGame: Game<IG> = {
  name: 'mergers',

  setup: (ctx: Ctx) => {
    const G: IG = setupInitialState(ctx.numPlayers);

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
          const hotel = getHotel(G.hotels, G.lastPlacedHotel);
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

      endIf: (G: IG) => !!G.merger.survivingChain,

      onBegin: (G: IG) => {
        if (!!G.merger.survivingChain) {
          return;
        }
        // if there's a biggest chain, set it as the survivor
        const firstChainSize = sizeOfChain(G.merger.mergingChains[0], G.hotels);
        const secondChainSize = sizeOfChain(G.merger.mergingChains[1], G.hotels);
        if (firstChainSize !== secondChainSize) {
          G.merger.survivingChain = G.merger.mergingChains.shift();
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

      endIf: (G: IG) => !G.merger.survivingChain || !!G.merger.chainToMerge,

      onBegin: (G: IG) => autosetChainToMerge(G),
    },

    mergerPhase: {
      turn: {
        order: {
          first: mergerPhaseFirstTurn,
          next: mergerPhaseNextTurn,
        },
        moveLimit: 1,
      },

      moves: { swapAndSellStock },

      onBegin: (G: IG) => {
        // now that we now which chain is being merged, fill in the rest of the merger info
        const mergerResults: Merger = getMergerResults(G, G.merger.chainToMerge);
        G.merger = {
          ...G.merger,
          ...mergerResults,
        };
        awardMoneyToPlayers(G, G.merger.bonuses);
      },

      onEnd: (G: IG) => {
        // remove the just-merged chain
        G.merger.chainToMerge = undefined;
        G.merger.mergingChains.shift();

        // if we're all done, absorb all hotels into the surviving chain and clear the merer
        if (G.merger.mergingChains.length === 0) {
          absorbNewHotels(G, G.merger.survivingChain, G.lastPlacedHotel);
          G.merger = undefined;
        }
      },
    },
  },
};
