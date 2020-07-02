import { Ctx } from 'boardgame.io';
import { Client } from 'boardgame.io/client';
import { INVALID_MOVE } from 'boardgame.io/core';
import {
  autosetChainToMerge,
  awardBonuses,
  chooseChainToMerge,
  chooseSurvivingChain,
  mergerPhaseNextTurn,
  MergersGame,
} from './game';
import { Chain, Hotel, IG } from './types';
import {
  setupPlayers,
  setupAvailableStocks,
  playersInDescOrderOfStock,
  playersInMajority,
  playersInMinority,
} from './utils';

// TODO:
// - test mergers
// - test unplayable tiles
// - test endgame

function setupTestHotels(): Hotel[][] {
  // const h1A = { id: '1-A' };
  // const h1B = { id: '1-B' };
  // const h1C = { id: '1-C' };
  // const h2A = { id: '2-A' };
  // const h2B = { id: '2-B' };
  // const h2C = { id: '2-C' };
  // const h3A = { id: '3-A' };
  // const h3B = { id: '3-B' };
  // const h3C = { id: '3-C' };

  return [
    [{ id: '1-A' }, { id: '2-A' }, { id: '3-A' }],
    [{ id: '1-B' }, { id: '2-B' }, { id: '3-B' }],
    [{ id: '1-C' }, { id: '2-C' }, { id: '3-C' }],
  ];
}

function getTestClient(numPlayers: number = 2, hotels?: Hotel[][]): Client {
  const MergersCustomScenario = {
    ...MergersGame,
    setup: (ctx: Ctx) => {
      const G: IG = {
        hotels: hotels || setupTestHotels(),
        players: setupPlayers(ctx.numPlayers),
        availableStocks: setupAvailableStocks(),
      };

      ctx.events.setPhase('buildingPhase');

      return G;
    },
  };

  // skip the initial draw and set player 0 to go first
  MergersCustomScenario.phases.buildingPhase.turn.order.first = () => 0;

  const client = Client({
    game: MergersCustomScenario,
    numPlayers,
  });

  return client;
}

describe('placeHotel', () => {
  let client: Client;
  let originalBoard: Hotel[][];
  beforeEach(() => {
    originalBoard = [
      [
        { id: '1-A', hasBeenPlaced: true, chain: Chain.Tower },
        { id: '2-A', hasBeenPlaced: true, chain: Chain.Tower },
        { id: '3-A', drawnByPlayer: '0' }, // would join Tower, and bring in 3-B as well
      ],
      [
        { id: '1-B', drawnByPlayer: '0' }, // would join Tower
        { id: '2-B' },
        { id: '3-B', hasBeenPlaced: true },
      ],
      [
        { id: '1-C' },
        { id: '2-C' },
        { id: '3-C', drawnByPlayer: '0' }, // would form a new chain w/ 3-B
      ],
    ];
    client = getTestClient(2, originalBoard);
  });
  it('sets the last placed hotel', () => {
    client.moves.placeHotel('1-B');

    expect(client.store.getState().G.lastPlacedHotel).toEqual('1-B');
  });
  it('joins hotel to a single adjacent chain', () => {
    client.moves.placeHotel('1-B');

    expect(client.store.getState().G.hotels).toEqual([
      [
        { id: '1-A', hasBeenPlaced: true, chain: Chain.Tower },
        { id: '2-A', hasBeenPlaced: true, chain: Chain.Tower },
        { id: '3-A', drawnByPlayer: '0' },
      ],
      [
        { id: '1-B', hasBeenPlaced: true, chain: Chain.Tower, drawnByPlayer: '0' }, // joined Tower
        { id: '2-B' },
        { id: '3-B', hasBeenPlaced: true },
      ],
      [{ id: '1-C' }, { id: '2-C' }, { id: '3-C', drawnByPlayer: '0' }],
    ]);
  });
  it('joins a neighboring unassigned hotel to adjacent chain', () => {
    client.moves.placeHotel('3-A');

    expect(client.store.getState().G.hotels).toEqual([
      [
        { id: '1-A', hasBeenPlaced: true, chain: Chain.Tower },
        { id: '2-A', hasBeenPlaced: true, chain: Chain.Tower },
        { id: '3-A', hasBeenPlaced: true, chain: Chain.Tower, drawnByPlayer: '0' }, // joined Tower
      ],
      [
        { id: '1-B', drawnByPlayer: '0' },
        { id: '2-B' },
        { id: '3-B', hasBeenPlaced: true, chain: Chain.Tower }, // joined Tower
      ],
      [{ id: '1-C' }, { id: '2-C' }, { id: '3-C', drawnByPlayer: '0' }],
    ]);
  });
  it('starts a new chain when placed next to a lone hotel', () => {
    client.moves.placeHotel('3-C');
    expect(client.store.getState().G.hotels).toEqual([
      [
        { id: '1-A', hasBeenPlaced: true, chain: Chain.Tower },
        { id: '2-A', hasBeenPlaced: true, chain: Chain.Tower },
        { id: '3-A', drawnByPlayer: '0' },
      ],
      [{ id: '1-B', drawnByPlayer: '0' }, { id: '2-B' }, { id: '3-B', hasBeenPlaced: true }],
      [
        { id: '1-C' },
        { id: '2-C' },
        { id: '3-C', hasBeenPlaced: true, drawnByPlayer: '0' }, // placed
      ],
    ]);
    expect(client.store.getState().ctx.activePlayers).toEqual({
      '0': 'chooseNewChainStage',
    });
  });
});

describe('chooseNewChain', () => {
  let client: Client;
  let originalBoard: Hotel[][];

  beforeEach(() => {
    originalBoard = [
      [
        { id: '1-A', hasBeenPlaced: true },
        { id: '2-A', drawnByPlayer: '0' },
        { id: '3-A', hasBeenPlaced: true },
        { id: '4-A', hasBeenPlaced: true },
      ],
    ];
    client = getTestClient(2, originalBoard);
    client.moves.placeHotel('2-A');
  });

  it('should assign the chain to all hotels in the new chain', () => {
    client.moves.chooseNewChain(Chain.American);

    expect(client.store.getState().G.hotels).toEqual([
      [
        { id: '1-A', hasBeenPlaced: true, chain: Chain.American },
        { id: '2-A', hasBeenPlaced: true, chain: Chain.American, drawnByPlayer: '0' },
        { id: '3-A', hasBeenPlaced: true, chain: Chain.American },
        { id: '4-A', hasBeenPlaced: true, chain: Chain.American },
      ],
    ]);
  });

  it('should assign one bonus stock to the player who placed the last hotel', () => {
    client.moves.chooseNewChain(Chain.American);

    expect(client.store.getState().G.players['0'].stocks[Chain.American]).toEqual(1);
  });
});

describe('playersInDescOrderOfStock', () => {
  it('should sort by the given chain', () => {
    const player0 = { stocks: { [Chain.Tower]: 3, [Chain.American]: 1 } };
    const player1 = { stocks: { [Chain.Tower]: 4, [Chain.American]: 2 } };
    const player2 = { stocks: { [Chain.Tower]: 1, [Chain.American]: 3 } };
    const G: IG = { players: { '0': player0, '1': player1, '2': player2 } };
    const result = playersInDescOrderOfStock(G, Chain.Tower);
    expect(result).toEqual([player1, player0, player2]);
  });
});

describe('playersInMajority', () => {
  it('chooses a single player majority', () => {
    const player0 = { stocks: { [Chain.Tower]: 3 } };
    const player1 = { stocks: { [Chain.Tower]: 4 } };
    const player2 = { stocks: { [Chain.Tower]: 1 } };
    const G: IG = { players: { '0': player0, '1': player1, '2': player2 } };
    const result = playersInMajority(G, Chain.Tower);
    expect(result).toEqual([player1]);
  });
  it('chooses a multiple player majority', () => {
    const player0 = { stocks: { [Chain.Tower]: 3 } };
    const player1 = { stocks: { [Chain.Tower]: 3 } };
    const player2 = { stocks: { [Chain.Tower]: 3 } };
    const G: IG = { players: { '0': player0, '1': player1, '2': player2 } };
    const result = playersInMajority(G, Chain.Tower);
    expect(result).toEqual([player0, player1, player2]);
  });
  it('chooses an empty majority', () => {
    const player0 = { stocks: { [Chain.Tower]: 0 } };
    const player1 = { stocks: { [Chain.Tower]: 0 } };
    const player2 = { stocks: { [Chain.Tower]: 0 } };
    const G: IG = { players: { '0': player0, '1': player1, '2': player2 } };
    const result = playersInMajority(G, Chain.Tower);
    expect(result).toEqual([]);
  });
});

describe('playersInMinority', () => {
  it('chooses the second place player', () => {
    const player0 = { stocks: { [Chain.Tower]: 3 } };
    const player1 = { stocks: { [Chain.Tower]: 4 } };
    const player2 = { stocks: { [Chain.Tower]: 1 } };
    const G: IG = { players: { '0': player0, '1': player1, '2': player2 } };
    const result = playersInMinority(G, Chain.Tower);
    expect(result).toEqual([player0]);
  });
  it('chooses a multiple player minority', () => {
    const player0 = { stocks: { [Chain.Tower]: 3 } };
    const player1 = { stocks: { [Chain.Tower]: 4 } };
    const player2 = { stocks: { [Chain.Tower]: 3 } };
    const G: IG = { players: { '0': player0, '1': player1, '2': player2 } };
    const result = playersInMinority(G, Chain.Tower);
    expect(result).toEqual([player0, player2]);
  });
  it('chooses an empty minority when only one player has stocks', () => {
    const player0 = { stocks: { [Chain.Tower]: 0 } };
    const player1 = { stocks: { [Chain.Tower]: 4 } };
    const player2 = { stocks: { [Chain.Tower]: 0 } };
    const G: IG = { players: { '0': player0, '1': player1, '2': player2 } };
    const result = playersInMinority(G, Chain.Tower);
    expect(result).toEqual([]);
  });
  it('chooses an empty minority when multiple players with the only stock are tied', () => {
    const player0 = { stocks: { [Chain.Tower]: 0 } };
    const player1 = { stocks: { [Chain.Tower]: 4 } };
    const player2 = { stocks: { [Chain.Tower]: 4 } };
    const G: IG = { players: { '0': player0, '1': player1, '2': player2 } };
    const result = playersInMinority(G, Chain.Tower);
    expect(result).toEqual([]);
  });
  it('chooses an empty minority when no one has stock', () => {
    const player0 = { stocks: { [Chain.Tower]: 0 } };
    const player1 = { stocks: { [Chain.Tower]: 0 } };
    const player2 = { stocks: { [Chain.Tower]: 0 } };
    const G: IG = { players: { '0': player0, '1': player1, '2': player2 } };
    const result = playersInMinority(G, Chain.Tower);
    expect(result).toEqual([]);
  });
});

describe('awardBonuses', () => {
  it('awards a single player majority and minority', () => {
    const player0 = { stocks: { [Chain.Tower]: 3 }, money: 6000 };
    const player1 = { stocks: { [Chain.Tower]: 4 }, money: 6000 };
    const player2 = { stocks: { [Chain.Tower]: 1 }, money: 6000 };

    // size of chain = 3 => stock price = 300, majority = 3000, minority = 1500
    const hotels = [
      [{ chain: Chain.Tower }, { chain: Chain.Tower }],
      [{ chain: Chain.Tower }, { chain: Chain.American }],
    ];

    const G: IG = {
      players: { '0': player0, '1': player1, '2': player2 },
      hotels,
    };

    awardBonuses(G, Chain.Tower);

    expect(G).toEqual({
      players: {
        '0': { ...player0, money: 7500 },
        '1': { ...player1, money: 9000 },
        '2': { ...player2, money: 6000 },
      },
      hotels,
    });
  });
});

describe('chooseSurvivingChain', () => {
  it('sets survivingChain and removes it from the mergingChains', () => {
    const hotels = [
      [{ chain: Chain.Tower }, { chain: Chain.Tower }],
      [{ chain: Chain.Continental }, { chain: undefined }],
      [{ chain: Chain.Continental }, { chain: Chain.American }],
    ];
    const G: IG = {
      mergingChains: [Chain.Tower, Chain.Continental, Chain.American],
      hotels,
    };
    const result = chooseSurvivingChain(G, {}, Chain.Continental);
    expect(G.survivingChain).toEqual(Chain.Continental);
    expect(G.mergingChains).toEqual([Chain.Tower, Chain.American]);
    expect(result).not.toEqual(INVALID_MOVE);
  });

  it('only allows one of the largest chains to be selected', () => {
    const hotels = [
      [{ chain: Chain.Tower }, { chain: Chain.Tower }],
      [{ chain: Chain.Continental }, { chain: undefined }],
      [{ chain: Chain.Continental }, { chain: Chain.American }],
    ];
    const G: IG = {
      mergingChains: [Chain.Tower, Chain.Continental, Chain.American],
      hotels,
    };
    const result = chooseSurvivingChain(G, {}, Chain.American);
    expect(result).toEqual(INVALID_MOVE);
  });
});

describe('chooseChainToMerge', () => {
  it('sets chainToMerge and re-sorts mergingChains', () => {
    const hotels = [
      [{ chain: Chain.Tower }, { chain: Chain.Tower }],
      [{ chain: Chain.Continental }, { chain: Chain.American }],
      [{ chain: Chain.Continental }, { chain: Chain.American }],
      [{ chain: Chain.Festival }, { chain: Chain.Festival }],
    ];
    const G: IG = {
      survivingChain: Chain.Tower,
      mergingChains: [Chain.Festival, Chain.American, Chain.Continental],
      hotels,
    };
    const result = chooseChainToMerge(G, {}, Chain.Continental);
    expect(G.chainToMerge).toEqual(Chain.Continental);
    expect(G.mergingChains).toEqual([Chain.Continental, Chain.Festival, Chain.American]);
    expect(result).not.toEqual(INVALID_MOVE);
  });
});

describe('autosetChainToMerge', () => {
  it('does nothing if chainToMerge is set', () => {
    const hotels = [
      [{ chain: Chain.Tower }, { chain: Chain.Tower }],
      [{ chain: Chain.Tower }, { chain: Chain.Continental }],
      [{ chain: Chain.Continental }, { chain: Chain.American }],
    ];
    const G: IG = {
      chainToMerge: Chain.American, // would be disallowed, but illustrates this test
      survivingChain: Chain.Tower,
      mergingChains: [Chain.American, Chain.Continental],
      hotels,
    };
    autosetChainToMerge(G);
    expect(G.chainToMerge).toEqual(Chain.American);
    expect(G.mergingChains).toEqual([Chain.American, Chain.Continental]);
  });

  it('chooses the next largest chain', () => {
    const hotels = [
      [{ chain: Chain.Tower }, { chain: Chain.Tower }],
      [{ chain: Chain.Continental }, { chain: undefined }],
      [{ chain: Chain.Continental }, { chain: Chain.American }],
    ];
    const G: IG = {
      survivingChain: Chain.Tower,
      mergingChains: [Chain.Continental, Chain.American],
      hotels,
    };
    autosetChainToMerge(G);
    expect(G.chainToMerge).toEqual(Chain.Continental);
    expect(G.mergingChains).toEqual([Chain.Continental, Chain.American]);
  });

  it('choose nothing if there is a tie', () => {
    const hotels = [
      [{ chain: Chain.Tower }, { chain: Chain.Tower }],
      [{ chain: Chain.Continental }, { chain: Chain.American }],
      [{ chain: Chain.Continental }, { chain: Chain.American }],
    ];
    const G: IG = {
      survivingChain: Chain.Tower,
      mergingChains: [Chain.American, Chain.Continental],
      hotels,
    };
    autosetChainToMerge(G);
    expect(G.chainToMerge).toBeUndefined();
    expect(G.mergingChains).toEqual([Chain.American, Chain.Continental]);
  });
});

describe('mergerPhaseNextTurn', () => {
  it('wraps around to the beginning of the order', () => {
    const G = {
      lastPlacedHotel: '1-A',
      hotels: [[{ id: '1-A', drawnByPlayer: 'Player3' }]],
      chainToMerge: Chain.Tower,
      players: {
        Player1: { stocks: { [Chain.Tower]: 1 } },
        Player2: { stocks: { [Chain.Tower]: 0 } },
        Player3: { stocks: { [Chain.Tower]: 0 } },
        Player4: { stocks: { [Chain.Tower]: 0 } },
      },
    };
    const ctx = {
      playOrderPos: 3,
      numPlayers: 4,
      playOrder: ['Player1', 'Player2', 'Player3', 'Player4'],
    };
    expect(mergerPhaseNextTurn(G, ctx)).toEqual(0);
  });

  it('skips to the next player with stock', () => {
    const G = {
      lastPlacedHotel: '1-A',
      hotels: [[{ id: '1-A', drawnByPlayer: 'Player3' }]],
      chainToMerge: Chain.Tower,
      players: {
        Player1: { stocks: { [Chain.Tower]: 0 } },
        Player2: { stocks: { [Chain.Tower]: 1 } },
        Player3: { stocks: { [Chain.Tower]: 0 } },
        Player4: { stocks: { [Chain.Tower]: 0 } },
      },
    };
    const ctx = {
      playOrderPos: 3,
      numPlayers: 4,
      playOrder: ['Player1', 'Player2', 'Player3', 'Player4'],
    };
    expect(mergerPhaseNextTurn(G, ctx)).toEqual(1);
  });

  it('stops if the next player caused the merger', () => {
    const G = {
      lastPlacedHotel: '1-A',
      hotels: [[{ id: '1-A', drawnByPlayer: 'Player3' }]],
    };
    const ctx = {
      playOrderPos: 1,
      numPlayers: 4,
      playOrder: ['Player1', 'Player2', 'Player3', 'Player4'],
    };
    expect(mergerPhaseNextTurn(G, ctx)).toBeUndefined();
  });

  it('returns undefined if no one else has any stock', () => {
    const G = {
      lastPlacedHotel: '1-A',
      hotels: [[{ id: '1-A', drawnByPlayer: 'Player3' }]],
      chainToMerge: Chain.Tower,
      players: {
        Player1: { stocks: { [Chain.Tower]: 0 } },
        Player2: { stocks: { [Chain.Tower]: 0 } },
        Player3: { stocks: { [Chain.Tower]: 1 } },
        Player4: { stocks: { [Chain.Tower]: 0 } },
      },
    };
    const ctx = {
      playOrderPos: 2,
      numPlayers: 4,
      playOrder: ['Player1', 'Player2', 'Player3', 'Player4'],
    };
    expect(mergerPhaseNextTurn(G, ctx)).toBeUndefined();
  });
});
// it('should declare player 1 as the winner', () => {
//   const spec = {
//     game: NineMensMorrisGame,
//     multiplayer: Local(),
//   };

//   const p0 = Client({ ...spec, playerID: '0' } as any) as any;
//   const p1 = Client({ ...spec, playerID: '1' } as any) as any;

//   p0.start();
//   p1.start();

//   p0.moves.placePiece(0);
//   p1.moves.placePiece(8);
//   p0.moves.placePiece(7);
//   p1.moves.placePiece(15);
//   p0.moves.placePiece(12);
//   p1.moves.placePiece(14);
//   p1.moves.removePiece(12);
//   p0.moves.placePiece(6);
//   p0.moves.removePiece(14); // Force remove piece from mill
//   p1.moves.placePiece(5);
//   p0.moves.placePiece(1);
//   p1.moves.placePiece(2);
//   p0.moves.placePiece(9);
//   p1.moves.placePiece(17);
//   p0.moves.placePiece(10);
//   p1.moves.placePiece(14);
//   p1.moves.removePiece(9);
//   p0.moves.placePiece(19);
//   p1.moves.placePiece(11);
//   p0.moves.placePiece(21);
//   p1.moves.placePiece(20);
//   p0.moves.movePiece(1, 9);
//   p1.moves.movePiece(14, 13);
//   p0.moves.movePiece(21, 22);
//   p1.moves.movePiece(13, 14);
//   p1.moves.removePiece(22);
//   p0.moves.movePiece(9, 1);
//   p1.moves.movePiece(20, 21);
//   p0.moves.movePiece(1, 9);
//   p1.moves.movePiece(14, 13);
//   p1.moves.removePiece(9);
//   p0.moves.movePiece(0, 1);
//   p1.moves.movePiece(13, 14);
//   p1.moves.removePiece(1);
//   p0.moves.movePiece(10, 9);
//   p1.moves.movePiece(14, 13);
//   p1.moves.removePiece(19);
//   p0.moves.movePiece(9, 14);
//   p1.moves.movePiece(13, 12);
//   p0.moves.movePiece(7, 10);
//   p1.moves.movePiece(12, 13);
//   p1.moves.removePiece(10);

//   // player '1' should be declared the winner
//   const { ctx } = p0.getState();
//   expect(ctx.gameover).toEqual({ winner: '1' });
// });
