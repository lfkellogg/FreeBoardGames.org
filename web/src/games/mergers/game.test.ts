import { Ctx } from 'boardgame.io';
import { Client } from 'boardgame.io/client';
import { INVALID_MOVE } from 'boardgame.io/core';
import { Local } from 'boardgame.io/multiplayer';
import {
  autosetChainToMerge,
  awardBonuses,
  chooseChainToMerge,
  chooseSurvivingChain,
  mergerPhaseNextTurn,
  MergersGame,
} from './game';
import { Chain, Hotel, IG } from './types';
import { fillStockMap, setupPlayers, playersInDescOrderOfStock, playersInMajority, playersInMinority } from './utils';

// TODO:
// - test endgame

function setupTestHotels(): Hotel[][] {
  return [
    [{ id: '1-A' }, { id: '2-A' }, { id: '3-A' }],
    [{ id: '1-B' }, { id: '2-B' }, { id: '3-B' }],
    [{ id: '1-C' }, { id: '2-C' }, { id: '3-C' }],
  ];
}

function getScenario(hotels?: Hotel[][]) {
  const MergersCustomScenario = {
    ...MergersGame,
    setup: (ctx: Ctx) => {
      const G: IG = {
        hotels: hotels || setupTestHotels(),
        players: setupPlayers(ctx.numPlayers),
        availableStocks: fillStockMap(25),
      };

      ctx.events.setPhase('buildingPhase');

      return G;
    },
  };

  // skip the initial draw and set player 0 to go first
  MergersCustomScenario.phases.buildingPhase.turn.order.first = () => 0;

  return MergersCustomScenario;
}

function getSingleTestClient(numPlayers: number = 2, hotels?: Hotel[][]): Client {
  const client = Client({
    game: getScenario(hotels),
    numPlayers,
  });

  return client;
}

function getAllTestClients(numPlayers: number = 2, hotels?: Hotel[][]): Client[] {
  const spec = {
    game: getScenario(hotels),
    multiplayer: Local(),
    numPlayers,
  };

  const clients = [];
  for (let i = 0; i < numPlayers; i++) {
    clients.push(
      Client({
        ...spec,
        playerID: `${i}`,
      }),
    );
  }

  return clients;
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
    client = getSingleTestClient(2, originalBoard);
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
    client = getSingleTestClient(2, originalBoard);
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
    const player0 = { stocks: { ...fillStockMap(0), [Chain.Tower]: 3, [Chain.American]: 1 } };
    const player1 = { stocks: { ...fillStockMap(0), [Chain.Tower]: 4, [Chain.American]: 2 } };
    const player2 = { stocks: { ...fillStockMap(0), [Chain.Tower]: 1, [Chain.American]: 3 } };
    const players = { '0': player0, '1': player1, '2': player2 };
    const result = playersInDescOrderOfStock(players, Chain.Tower);
    expect(result).toEqual([player1, player0, player2]);
  });
});

describe('playersInMajority', () => {
  it('chooses a single player majority', () => {
    const player0 = { stocks: { ...fillStockMap(0), [Chain.Tower]: 3 } };
    const player1 = { stocks: { ...fillStockMap(0), [Chain.Tower]: 4 } };
    const player2 = { stocks: { ...fillStockMap(0), [Chain.Tower]: 1 } };
    const players = { '0': player0, '1': player1, '2': player2 };
    const result = playersInMajority(players, Chain.Tower);
    expect(result).toEqual([player1]);
  });
  it('chooses a multiple player majority', () => {
    const player0 = { stocks: { ...fillStockMap(0), [Chain.Tower]: 3 } };
    const player1 = { stocks: { ...fillStockMap(0), [Chain.Tower]: 3 } };
    const player2 = { stocks: { ...fillStockMap(0), [Chain.Tower]: 3 } };
    const players = { '0': player0, '1': player1, '2': player2 };
    const result = playersInMajority(players, Chain.Tower);
    expect(result).toEqual([player0, player1, player2]);
  });
  it('chooses an empty majority', () => {
    const player0 = { stocks: fillStockMap(0) };
    const player1 = { stocks: fillStockMap(0) };
    const player2 = { stocks: fillStockMap(0) };
    const players = { '0': player0, '1': player1, '2': player2 };
    const result = playersInMajority(players, Chain.Tower);
    expect(result).toEqual([]);
  });
});

describe('playersInMinority', () => {
  it('chooses the second place player', () => {
    const player0 = { stocks: { ...fillStockMap(0), [Chain.Tower]: 3 } };
    const player1 = { stocks: { ...fillStockMap(0), [Chain.Tower]: 4 } };
    const player2 = { stocks: { ...fillStockMap(0), [Chain.Tower]: 1 } };
    const players = { '0': player0, '1': player1, '2': player2 };
    const result = playersInMinority(players, Chain.Tower);
    expect(result).toEqual([player0]);
  });
  it('chooses a multiple player minority', () => {
    const player0 = { stocks: { ...fillStockMap(0), [Chain.Tower]: 3 } };
    const player1 = { stocks: { ...fillStockMap(0), [Chain.Tower]: 4 } };
    const player2 = { stocks: { ...fillStockMap(0), [Chain.Tower]: 3 } };
    const players = { '0': player0, '1': player1, '2': player2 };
    const result = playersInMinority(players, Chain.Tower);
    expect(result).toEqual([player0, player2]);
  });
  it('chooses an empty minority when only one player has stocks', () => {
    const player0 = { stocks: fillStockMap(0) };
    const player1 = { stocks: { ...fillStockMap(0), [Chain.Tower]: 4 } };
    const player2 = { stocks: fillStockMap(0) };
    const players = { '0': player0, '1': player1, '2': player2 };
    const result = playersInMinority(players, Chain.Tower);
    expect(result).toEqual([]);
  });
  it('chooses an empty minority when multiple players with the only stock are tied', () => {
    const player0 = { stocks: fillStockMap(0) };
    const player1 = { stocks: { ...fillStockMap(0), [Chain.Tower]: 4 } };
    const player2 = { stocks: { ...fillStockMap(0), [Chain.Tower]: 4 } };
    const players = { '0': player0, '1': player1, '2': player2 };
    const result = playersInMinority(players, Chain.Tower);
    expect(result).toEqual([]);
  });
  it('chooses an empty minority when no one has stock', () => {
    const player0 = { stocks: fillStockMap(0) };
    const player1 = { stocks: fillStockMap(0) };
    const player2 = { stocks: fillStockMap(0) };
    const players = { '0': player0, '1': player1, '2': player2 };
    const result = playersInMinority(players, Chain.Tower);
    expect(result).toEqual([]);
  });
});

describe('awardBonuses', () => {
  it('awards a single player majority and minority', () => {
    const player0 = { id: '0', stocks: { ...fillStockMap(0), [Chain.Tower]: 3 }, money: 6000 };
    const player1 = { id: '1', stocks: { ...fillStockMap(0), [Chain.Tower]: 4 }, money: 6000 };
    const player2 = { id: '2', stocks: { ...fillStockMap(0), [Chain.Tower]: 1 }, money: 6000 };

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
      merger: {
        mergingChains: [Chain.Tower, Chain.Continental, Chain.American],
      },
      hotels,
    };
    const result = chooseSurvivingChain(G, {}, Chain.Continental);
    expect(G.merger.survivingChain).toEqual(Chain.Continental);
    expect(G.merger.mergingChains).toEqual([Chain.Tower, Chain.American]);
    expect(result).not.toEqual(INVALID_MOVE);
  });

  it('only allows one of the largest chains to be selected', () => {
    const hotels = [
      [{ chain: Chain.Tower }, { chain: Chain.Tower }],
      [{ chain: Chain.Continental }, { chain: undefined }],
      [{ chain: Chain.Continental }, { chain: Chain.American }],
    ];
    const G: IG = {
      merger: {
        mergingChains: [Chain.Tower, Chain.Continental, Chain.American],
      },
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
      merger: {
        survivingChain: Chain.Tower,
        mergingChains: [Chain.Festival, Chain.American, Chain.Continental],
      },
      hotels,
    };
    const result = chooseChainToMerge(G, {}, Chain.Continental);
    expect(G.merger.chainToMerge).toEqual(Chain.Continental);
    expect(G.merger.mergingChains).toEqual([Chain.Continental, Chain.Festival, Chain.American]);
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
      merger: {
        chainToMerge: Chain.American, // would be disallowed, but illustrates this test
        survivingChain: Chain.Tower,
        mergingChains: [Chain.American, Chain.Continental],
      },
      hotels,
    };
    autosetChainToMerge(G);
    expect(G.merger.chainToMerge).toEqual(Chain.American);
    expect(G.merger.mergingChains).toEqual([Chain.American, Chain.Continental]);
  });

  it('chooses the next largest chain', () => {
    const hotels = [
      [{ chain: Chain.Tower }, { chain: Chain.Tower }],
      [{ chain: Chain.Continental }, { chain: undefined }],
      [{ chain: Chain.Continental }, { chain: Chain.American }],
    ];
    const G: IG = {
      merger: {
        survivingChain: Chain.Tower,
        mergingChains: [Chain.Continental, Chain.American],
      },
      hotels,
    };
    autosetChainToMerge(G);
    expect(G.merger.chainToMerge).toEqual(Chain.Continental);
    expect(G.merger.mergingChains).toEqual([Chain.Continental, Chain.American]);
  });

  it('choose nothing if there is a tie', () => {
    const hotels = [
      [{ chain: Chain.Tower }, { chain: Chain.Tower }],
      [{ chain: Chain.Continental }, { chain: Chain.American }],
      [{ chain: Chain.Continental }, { chain: Chain.American }],
    ];
    const G: IG = {
      merger: {
        survivingChain: Chain.Tower,
        mergingChains: [Chain.American, Chain.Continental],
      },
      hotels,
    };
    autosetChainToMerge(G);
    expect(G.merger.chainToMerge).toBeUndefined();
    expect(G.merger.mergingChains).toEqual([Chain.American, Chain.Continental]);
  });
});

describe('mergerPhaseNextTurn', () => {
  let eventsSpy;
  beforeEach(() => {
    eventsSpy = { setPhase: jest.fn() };
  });

  it('wraps around to the beginning of the order', () => {
    const G: IG = {
      lastPlacedHotel: '1-A',
      hotels: [[{ id: '1-A', drawnByPlayer: 'Player3' }]],
      merger: {
        chainToMerge: Chain.Tower,
        mergingChains: [Chain.Tower],
        swapAndSells: {},
      },
    };
    const ctx: Ctx = {
      playOrderPos: 3,
      numPlayers: 4,
      playOrder: ['Player1', 'Player2', 'Player3', 'Player4'],
      activePlayers: {},
      currentPlayer: 'Player4',
      turn: 0,
      phase: 'mergerPhase',
      events: eventsSpy,
    };
    expect(mergerPhaseNextTurn(G, ctx)).toEqual(0);
    expect(eventsSpy.setPhase.mock.calls.length).toEqual(0);
  });

  it('skips the merging player if they do not have any stock', () => {
    const G: IG = {
      lastPlacedHotel: '1-A',
      hotels: [[{ id: '1-A', drawnByPlayer: 'Player3' }]],
      merger: {
        chainToMerge: Chain.Tower,
        mergingChains: [Chain.Tower],
        swapAndSells: {
          Player1: { swap: 0, sell: 0 },
          Player3: { swap: 0, sell: 0 },
          Player4: { swap: 0, sell: 0 },
        },
      },
    };
    const ctx = {
      playOrderPos: 2,
      numPlayers: 4,
      playOrder: ['Player1', 'Player2', 'Player3', 'Player4'],
      activePlayers: {},
      currentPlayer: 'Player3',
      turn: 0,
      phase: 'mergerPhase',
      events: eventsSpy,
    };
    expect(mergerPhaseNextTurn(G, ctx)).toEqual(1);
    expect(eventsSpy.setPhase.mock.calls.length).toEqual(0);
  });

  it('skips to the next player that has not exchanged stock', () => {
    const G: IG = {
      lastPlacedHotel: '1-A',
      hotels: [[{ id: '1-A', drawnByPlayer: 'Player3' }]],
      merger: {
        chainToMerge: Chain.Tower,
        mergingChains: [Chain.Tower],
        swapAndSells: {
          Player1: { swap: 0, sell: 0 },
          Player3: { swap: 0, sell: 0 },
          Player4: { swap: 0, sell: 0 },
        },
      },
    };
    const ctx = {
      playOrderPos: 3,
      numPlayers: 4,
      playOrder: ['Player1', 'Player2', 'Player3', 'Player4'],
      activePlayers: {},
      currentPlayer: 'Player4',
      turn: 0,
      phase: 'mergerPhase',
      events: eventsSpy,
    };
    expect(mergerPhaseNextTurn(G, ctx)).toEqual(1);
    expect(eventsSpy.setPhase.mock.calls.length).toEqual(0);
  });

  it('stops if the next player caused the merger and they have exchanged', () => {
    const G = {
      lastPlacedHotel: '1-A',
      merger: {
        chainToMerge: Chain.Tower,
        mergingChains: [Chain.Tower],
        swapAndSells: {
          Player1: { swap: 0, sell: 0 },
          Player2: { swap: 0, sell: 0 },
          Player3: { swap: 0, sell: 0 },
          Player4: { swap: 0, sell: 0 },
        },
      },
      hotels: [[{ id: '1-A', drawnByPlayer: 'Player3' }]],
    };
    const ctx = {
      playOrderPos: 1,
      numPlayers: 4,
      playOrder: ['Player1', 'Player2', 'Player3', 'Player4'],
      activePlayers: {},
      currentPlayer: 'Player2',
      turn: 0,
      phase: 'mergerPhase',
      events: eventsSpy,
    };
    expect(mergerPhaseNextTurn(G, ctx)).not.toBeUndefined();
    expect(eventsSpy.setPhase.mock.calls[0]).toEqual(['buildingPhase']);
  });

  it('returns undefined if no one else has any stock', () => {
    const G = {
      lastPlacedHotel: '1-A',
      hotels: [[{ id: '1-A', drawnByPlayer: 'Player3' }]],
      merger: {
        chainToMerge: Chain.Tower,
        mergingChains: [Chain.Tower],
        swapAndSells: {
          Player1: { swap: 0, sell: 0 },
          Player2: { swap: 0, sell: 0 },
          Player3: { swap: 0, sell: 0 },
          Player4: { swap: 0, sell: 0 },
        },
      },
    };
    const ctx = {
      playOrderPos: 2,
      numPlayers: 4,
      playOrder: ['Player1', 'Player2', 'Player3', 'Player4'],
      activePlayers: {},
      currentPlayer: '2',
      turn: 0,
      phase: 'mergerPhase',
      events: eventsSpy,
    };
    expect(mergerPhaseNextTurn(G, ctx)).not.toBeUndefined();
    expect(eventsSpy.setPhase.mock.calls[0]).toEqual(['buildingPhase']);
  });

  it('returns chooseNextMergerPhase if there are more chains to merge', () => {
    const G = {
      lastPlacedHotel: '1-A',
      hotels: [[{ id: '1-A', drawnByPlayer: 'Player3' }]],
      merger: {
        chainToMerge: Chain.Tower,
        mergingChains: [Chain.Tower, Chain.Luxor],
        swapAndSells: {
          Player1: { swap: 0, sell: 0 },
          Player2: { swap: 0, sell: 0 },
          Player3: { swap: 0, sell: 0 },
          Player4: { swap: 0, sell: 0 },
        },
      },
    };
    const ctx = {
      playOrderPos: 2,
      numPlayers: 4,
      playOrder: ['Player1', 'Player2', 'Player3', 'Player4'],
      activePlayers: {},
      currentPlayer: '2',
      turn: 0,
      phase: 'mergerPhase',
      events: eventsSpy,
    };
    expect(mergerPhaseNextTurn(G, ctx)).not.toBeUndefined();
    expect(eventsSpy.setPhase.mock.calls[0]).toEqual(['chooseChainToMergePhase']);
  });
});

// TODO:
//   - merger where no one has any stock
//   - merger where the person who merged has no stock
describe('mergerPhase', () => {
  describe('a 3-way merger', () => {
    let p0: Client;
    let p1: Client;
    let G: IG;
    let originalBoard: Hotel[][];
    beforeEach(() => {
      originalBoard = [
        [
          { id: '1-A', hasBeenPlaced: true, chain: Chain.Tower },
          { id: '2-A', hasBeenPlaced: true, chain: Chain.Tower },
          { id: '3-A' },
          { id: '4-A' },
        ],
        [
          { id: '1-B' },
          { id: '2-B', drawnByPlayer: '0' }, // will merge all three chains
          { id: '3-B', hasBeenPlaced: true, chain: Chain.American },
          { id: '4-B', hasBeenPlaced: true, chain: Chain.American },
        ],
        [
          { id: '1-C', hasBeenPlaced: true, chain: Chain.Continental },
          { id: '2-C', hasBeenPlaced: true, chain: Chain.Continental },
          { id: '3-C' },
          { id: '4-C' },
        ],
      ];
      const clients = getAllTestClients(2, originalBoard);
      p0 = clients[0];
      p1 = clients[1];

      p0.start();
      p1.start();

      G = p0.store.getState().G;

      G.players['0'].stocks[Chain.Tower] = 1;
      G.players['0'].stocks[Chain.Continental] = 2;

      G.players['1'].stocks[Chain.American] = 1;
      G.players['1'].stocks[Chain.Continental] = 1;
    });

    it('completes the merger process twice', () => {
      expect(p0.store.getState().G.players['0'].money).toEqual(6000);
      expect(p1.store.getState().G.players['1'].money).toEqual(6000);
      expect(p0.store.getState().G.players['0'].stocks[Chain.Tower]).toEqual(1);
      expect(p0.store.getState().G.players['0'].stocks[Chain.American]).toEqual(0);
      expect(p0.store.getState().G.players['0'].stocks[Chain.Continental]).toEqual(2);
      expect(p0.store.getState().G.players['1'].stocks[Chain.Tower]).toEqual(0);
      expect(p0.store.getState().G.players['1'].stocks[Chain.American]).toEqual(1);
      expect(p0.store.getState().G.players['1'].stocks[Chain.Continental]).toEqual(1);

      // place merger tile
      p0.moves.placeHotel('2-B');

      // chooseSurvivingChainPhase
      expect(p0.store.getState().ctx.phase).toEqual('chooseSurvivingChainPhase');
      p0.moves.chooseSurvivingChain(Chain.American);

      // chooseChainToMergePhase
      expect(p0.store.getState().ctx.phase).toEqual('chooseChainToMergePhase');
      p0.moves.chooseChainToMerge(Chain.Tower);

      // mergerPhase (merging Tower)
      expect(p0.store.getState().ctx.phase).toEqual('mergerPhase');
      // awards bonuses (2000, 1000, both to p0)
      expect(p0.store.getState().G.players['0'].money).toEqual(9000);
      expect(p0.store.getState().G.players['1'].money).toEqual(6000);
      // p0 swaps and sells stock
      p0.moves.swapAndSellStock(0, 1); // swap 0, sell 1
      expect(p0.store.getState().G.players['0'].stocks[Chain.Tower]).toEqual(0);
      // skips p1

      // mergerPhase (merging Continental)
      expect(p0.store.getState().ctx.phase).toEqual('mergerPhase');
      // awards bonuses (4000 to p0, 2000 to p1)
      expect(p0.store.getState().G.players['0'].money).toEqual(13200);
      expect(p0.store.getState().G.players['1'].money).toEqual(8000);
      // p0 swaps and sells stock

      debugger;
      p0.moves.swapAndSellStock(2, 0); // swap 2, sell 0
      expect(p0.store.getState().G.players['0'].stocks[Chain.Continental]).toEqual(0);
      expect(p0.store.getState().G.players['0'].stocks[Chain.American]).toEqual(1);
      expect(p0.store.getState().G.players['0'].money).toEqual(13200);
      // p1 swaps and sells stock
      p1.moves.swapAndSellStock(0, 0); // swap 0, sell 0
      expect(p0.store.getState().G.players['1'].stocks[Chain.Continental]).toEqual(1);
      expect(p0.store.getState().G.players['1'].money).toEqual(8000);

      // moves on to buildingPhase
      expect(p0.store.getState().ctx.phase).toEqual('buildingPhase');
      expect(p0.store.getState().ctx.activePlayers[0]).toEqual('buyStockStage');

      // absorbs hotels
      const expectedBoard = [
        [
          { id: '1-A', hasBeenPlaced: true, chain: Chain.American },
          { id: '2-A', hasBeenPlaced: true, chain: Chain.American },
          { id: '3-A' },
          { id: '4-A' },
        ],
        [
          { id: '1-B' },
          { id: '2-B', drawnByPlayer: '0', hasBeenPlaced: true, chain: Chain.American },
          { id: '3-B', hasBeenPlaced: true, chain: Chain.American },
          { id: '4-B', hasBeenPlaced: true, chain: Chain.American },
        ],
        [
          { id: '1-C', hasBeenPlaced: true, chain: Chain.American },
          { id: '2-C', hasBeenPlaced: true, chain: Chain.American },
          { id: '3-C' },
          { id: '4-C' },
        ],
      ];
      expect(p0.store.getState().G.hotels).toEqual(expectedBoard);
    });
  });

  describe('when the merging player does not have stock in the chain', () => {
    let p0: Client;
    let p1: Client;
    let G: IG;
    let originalBoard: Hotel[][];
    beforeEach(() => {
      originalBoard = [
        [
          { id: '1-A', hasBeenPlaced: true, chain: Chain.Tower },
          { id: '2-A', hasBeenPlaced: true, chain: Chain.Tower },
          { id: '3-A' },
        ],
        [{ id: '1-B' }, { id: '2-B', drawnByPlayer: '0' }, { id: '3-B' }],
        [
          { id: '1-C', hasBeenPlaced: true, chain: Chain.Continental },
          { id: '2-C', hasBeenPlaced: true, chain: Chain.Continental },
          { id: '3-C' },
        ],
      ];
      const clients = getAllTestClients(2, originalBoard);
      p0 = clients[0];
      p1 = clients[1];

      p0.start();
      p1.start();

      G = p0.store.getState().G;
      G.players['1'].stocks[Chain.Tower] = 1;
    });

    it('skips to the player with stock', () => {
      expect(p0.store.getState().G.players['0'].money).toEqual(6000);
      expect(p1.store.getState().G.players['1'].money).toEqual(6000);

      // place merger tile
      p0.moves.placeHotel('2-B');

      // chooseSurvivingChainPhase
      expect(p0.store.getState().ctx.phase).toEqual('chooseSurvivingChainPhase');
      p0.moves.chooseSurvivingChain(Chain.Continental);

      // chooseChainToMergePhase (skipped)

      // mergerPhase (merging Tower)
      expect(p0.store.getState().ctx.phase).toEqual('mergerPhase');
      // awards bonuses (2000, 1000, both to p1)
      expect(p0.store.getState().G.players['0'].money).toEqual(6000);
      expect(p0.store.getState().G.players['1'].money).toEqual(9000);

      // p1 exchanges stock
      p1.moves.swapAndSellStock(0, 1); // swaps 0, sells 1
      expect(p0.store.getState().G.players['1'].stocks[Chain.Tower]).toEqual(0);
      expect(p0.store.getState().G.players['1'].money).toEqual(9200);

      // moves on to buildingPhase
      expect(p0.store.getState().ctx.phase).toEqual('buildingPhase');
      expect(p0.store.getState().ctx.activePlayers[0]).toEqual('buyStockStage');

      // absorbs hotels
      const expectedBoard = [
        [
          { id: '1-A', hasBeenPlaced: true, chain: Chain.Continental },
          { id: '2-A', hasBeenPlaced: true, chain: Chain.Continental },
          { id: '3-A' },
        ],
        [
          { id: '1-B' },
          { id: '2-B', drawnByPlayer: '0', hasBeenPlaced: true, chain: Chain.Continental },
          { id: '3-B' },
        ],
        [
          { id: '1-C', hasBeenPlaced: true, chain: Chain.Continental },
          { id: '2-C', hasBeenPlaced: true, chain: Chain.Continental },
          { id: '3-C' },
        ],
      ];
      expect(p0.store.getState().G.hotels).toEqual(expectedBoard);
    });
  });
});
