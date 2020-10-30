import { Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import {
  autosetChainToMerge,
  awardBonuses,
  buyStock,
  chooseChainToMerge,
  chooseSurvivingChain,
  declareGameOver,
  drawHotels,
  mergerPhaseNextTurn,
  placeHotel,
} from './game';
import { fillInTestHotels, getMultiplayerTestClients, getSingleTestClient } from './test_utils';
import { Chain, Hotel, IG, Player } from './types';
import { fillStockMap } from './utils';

// TODO:
// - test endgame
// - integration test that starts a game, makes mergers, maybe ends the game

const DEFAULT_CTX: Ctx = {
  numPlayers: 2,
  playOrder: ['0', '1'],
  playOrderPos: 0,
  playerID: '0',
  activePlayers: null,
  currentPlayer: '0',
  turn: 1,
  phase: 'buildingPhase',
};

describe('placeHotel', () => {
  let client;
  let originalBoard: Hotel[][];

  beforeEach(() => {
    originalBoard = [
      [
        { id: '1-A', hasBeenPlaced: true, chain: Chain.Tower },
        { id: '2-A', hasBeenPlaced: true, chain: Chain.Tower },
        { id: '3-A', drawnByPlayer: '0' }, // would join Tower, and bring in 3-B
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
    // originalBoard = setupTestHotels();

    // originalBoard.mergeHotel('1-A', { hasBeenPlaced: true, chain: Chain.Tower });
    // originalBoard.mergeHotel('2-A', { hasBeenPlaced: true, chain: Chain.Tower });
    // originalBoard.mergeHotel('3-A', { drawnByPlayer: '0' }); // would join Tower, and bring in 3-B

    // originalBoard.mergeHotel('1-B', { drawnByPlayer: '0' }); // would join Tower
    // // 2-B is unchanged
    // originalBoard.mergeHotel('3-B', { hasBeenPlaced: true });

    // // 3-A is unchanged
    // // 3-B is unchanged
    // originalBoard.mergeHotel('3-C', { drawnByPlayer: '0' }); // would form a new chain w/ 3-B

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

  it('does not allow a player with hotels to pass', () => {
    const G = {
      hotels: [[{ id: '1-A', drawnByPlayer: '0' }]],
    };
    const ctx: Ctx = {
      ...DEFAULT_CTX,
      playerID: '0',
      events: { endStage: jest.fn() },
    };

    const result = placeHotel(G, ctx);

    expect(result).toEqual(INVALID_MOVE);
  });

  it('allows a player with no hotels to pass', () => {
    const G: IG = {
      hotels: [[]],
    };
    const ctx: Ctx = {
      ...DEFAULT_CTX,
      playerID: '0',
      events: { endStage: jest.fn() },
    };

    placeHotel(G, ctx);

    expect(G.lastMove).toEqual("Player 0 doesn't have any playable hotels");
    expect(ctx.events.endStage).toHaveBeenCalled();
  });
});

describe('buyStock', () => {
  let G: IG;
  let ctx: Ctx;

  const TEST_HOTELS = [
    [
      { id: '1-A', chain: Chain.Tower },
      { id: '2-A', chain: Chain.Tower },
      { id: '3-A' },
      { id: '4-A', chain: Chain.Continental },
      { id: '5-A', chain: Chain.Continental },
      { id: '6-A', chain: Chain.Continental },
    ],
  ];

  const GAME_OVER_HOTELS = [
    [
      { id: '1-A', chain: Chain.Tower },
      { id: '2-A', chain: Chain.Tower },
      { id: '3-A', chain: Chain.Tower },
      { id: '4-A', chain: Chain.Tower },
      { id: '5-A', chain: Chain.Tower },
      { id: '6-A', chain: Chain.Tower },
      { id: '7-A', chain: Chain.Tower },
      { id: '8-A', chain: Chain.Tower },
      { id: '9-A', chain: Chain.Tower },
      { id: '10-A', chain: Chain.Tower },
      { id: '11-A', chain: Chain.Tower },
    ],
  ];

  beforeEach(() => {
    G = {
      hotels: TEST_HOTELS,
      players: {
        '0': {
          stocks: { ...fillStockMap(0), [Chain.Tower]: 10 },
          money: 1000,
        },
      },
      availableStocks: { ...fillStockMap(25), [Chain.Tower]: 2 },
    };
    ctx = {
      ...DEFAULT_CTX,
      playerID: '0',
      events: { setStage: jest.fn() },
    };
  });

  it('buys the right amount of stock for the right prices', () => {
    buyStock(G, ctx, { [Chain.Tower]: 2, [Chain.Continental]: 1 });

    // 2 Towers x $200 + 1 Continental x $500 = $900
    expect(G.players['0'].money).toEqual(100);
    expect(G.players['0'].stocks[Chain.Tower]).toEqual(12);
    expect(G.players['0'].stocks[Chain.Continental]).toEqual(1);
    expect(G.availableStocks[Chain.Tower]).toEqual(0);
    expect(G.availableStocks[Chain.Continental]).toEqual(24);
    expect(ctx.events.setStage).toHaveBeenCalledWith('drawHotelsStage');
  });

  it('allows the player to pass', () => {
    buyStock(G, ctx, {});

    expect(G.players['0'].money).toEqual(1000);
    expect(G.players['0'].stocks[Chain.Tower]).toEqual(10);
    expect(G.players['0'].stocks[Chain.Continental]).toEqual(0);
    expect(G.availableStocks[Chain.Tower]).toEqual(2);
    expect(G.availableStocks[Chain.Continental]).toEqual(25);
    expect(ctx.events.setStage).toHaveBeenCalledWith('drawHotelsStage');
  });

  it('does not buy more stocks than are available', () => {
    buyStock(G, ctx, { [Chain.Tower]: 3 });

    // 2 Towers x $200 = $400
    expect(G.players['0'].money).toEqual(600);
    expect(G.players['0'].stocks[Chain.Tower]).toEqual(12);
    expect(G.availableStocks[Chain.Tower]).toEqual(0);
    expect(ctx.events.setStage).toHaveBeenCalledWith('drawHotelsStage');
  });

  it('does not buy more stocks than the player can afford', () => {
    buyStock(G, ctx, { [Chain.Continental]: 3 });

    // 2 Continental x $500 = $1000
    expect(G.players['0'].money).toEqual(0);
    expect(G.players['0'].stocks[Chain.Continental]).toEqual(2);
    expect(G.availableStocks[Chain.Continental]).toEqual(23);
    expect(ctx.events.setStage).toHaveBeenCalledWith('drawHotelsStage');
  });

  it('does not buy more than 3 stocks', () => {
    G.availableStocks[Chain.Tower] = 15;

    buyStock(G, ctx, { [Chain.Tower]: 4 });

    // 3 Tower x $200 = $600
    expect(G.players['0'].money).toEqual(400);
    expect(G.players['0'].stocks[Chain.Tower]).toEqual(13);
    expect(G.availableStocks[Chain.Tower]).toEqual(12);
    expect(ctx.events.setStage).toHaveBeenCalledWith('drawHotelsStage');
  });

  it('moves to declareGameOverStage if the game can be declared over', () => {
    G.hotels = GAME_OVER_HOTELS;

    buyStock(G, ctx, {});

    expect(ctx.events.setStage).toHaveBeenCalledWith('declareGameOverStage');
  });
});

describe('chooseNewChain', () => {
  let client;
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

describe('awardBonuses', () => {
  let player0: Player;
  let player1: Player;
  let player2: Player;
  let hotels: Hotel[][];
  let G: IG;

  beforeEach(() => {
    player0 = { id: '0', stocks: { ...fillStockMap(0), [Chain.Tower]: 3 }, money: 1000 };
    player1 = { id: '1', stocks: { ...fillStockMap(0), [Chain.Tower]: 4 }, money: 2000 };
    player2 = { id: '2', stocks: { ...fillStockMap(0), [Chain.Tower]: 1 }, money: 3000 };

    // size of chain = 3 => stock price = 300, majority = 3000, minority = 1500
    hotels = [
      [{ chain: Chain.Tower }, { chain: Chain.Tower }],
      [{ chain: Chain.Tower }, { chain: Chain.American }],
    ];

    G = {
      players: { '0': player0, '1': player1, '2': player2 },
      hotels,
    };
  });

  it('awards a single player majority and minority', () => {
    awardBonuses(G, Chain.Tower);

    // player 0 gets 1500
    // player 1 gets 3000
    expect(G).toEqual({
      players: {
        '0': { ...player0, money: 2500 },
        '1': { ...player1, money: 5000 },
        '2': { ...player2, money: 3000 },
      },
      hotels,
    });
  });

  it('splits majority between multiple players', () => {
    G.players['0'].stocks[Chain.Tower] = 3;
    G.players['1'].stocks[Chain.Tower] = 3;
    G.players['2'].stocks[Chain.Tower] = 2;

    awardBonuses(G, Chain.Tower);

    // players 0 and 1 get 4500 / 2 rounded up = 2300
    expect(G).toEqual({
      players: {
        '0': { ...player0, money: 3300 },
        '1': { ...player1, money: 4300 },
        '2': { ...player2, money: 3000 },
      },
      hotels,
    });
  });

  it('splits minority between multiple players', () => {
    G.players['0'].stocks[Chain.Tower] = 3;
    G.players['1'].stocks[Chain.Tower] = 2;
    G.players['2'].stocks[Chain.Tower] = 2;

    awardBonuses(G, Chain.Tower);

    // player 0 gets 3000
    // players 1 and 2 get 1500 / 2 rounded up = 800
    expect(G).toEqual({
      players: {
        '0': { ...player0, money: 4000 },
        '1': { ...player1, money: 2800 },
        '2': { ...player2, money: 3800 },
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

describe('declareGameOver', () => {
  let G: IG;
  let ctx: Ctx;

  const TEST_HOTELS = [
    [
      { id: '1-A', chain: Chain.Tower },
      { id: '2-A', chain: Chain.Tower },
      { id: '3-A' },
      { id: '4-A', chain: Chain.Continental },
      { id: '5-A', chain: Chain.Continental },
      { id: '6-A', chain: Chain.Continental },
    ],
  ];

  beforeEach(() => {
    G = {
      hotels: TEST_HOTELS,
      players: {
        '0': {
          id: '0',
          stocks: { ...fillStockMap(0), [Chain.Tower]: 8 },
          money: 1000,
        },
        '1': {
          id: '1',
          stocks: { ...fillStockMap(0), [Chain.Tower]: 4, [Chain.Continental]: 13 },
          money: 2000,
        },
      },
      availableStocks: { ...fillStockMap(0) },
    };
    ctx = {
      ...DEFAULT_CTX,
      playerID: '0',
      events: {
        endGame: jest.fn(),
        endTurn: jest.fn(),
        endStage: jest.fn(),
        setStage: jest.fn(),
      },
    };
  });

  it('settles the remaining hotel chains', () => {
    declareGameOver(G, ctx, true);

    // Started with $1000
    // Tower majority = $2000
    // Tower stock = 8 x $200 = $1600
    expect(G.players['0'].money).toEqual(4600);

    // Started with $2000
    // Tower minority = $1000
    // Tower stock = 4 x $200 = $800
    // Coninental majority + minority = $7500
    // Coninental stock = 13 x $500 = $6500
    expect(G.players['1'].money).toEqual(17800);

    expect(ctx.events.endGame).toHaveBeenCalled();
  });

  it('allows a player to not declare the game over', () => {
    declareGameOver(G, ctx, false);

    expect(ctx.events.setStage).toHaveBeenCalledWith('drawHotelsStage');
    expect(ctx.events.endGame).not.toHaveBeenCalled();
  });
});

describe('drawHotels', () => {
  let G: IG;
  let ctx;

  beforeEach(() => {
    G = {
      hotels: fillInTestHotels([
        [{ drawnByPlayer: '1' }, { hasBeenRemoved: true }, {}],
        [{ chain: Chain.Tower }, { drawnByPlayer: '0' }, { chain: Chain.Continental }],
        [{ chain: Chain.Tower }, { drawnByPlayer: '0' }, { chain: Chain.Continental }],
        [{ chain: Chain.Tower }, {}, { chain: Chain.Continental }],
        [{ chain: Chain.Tower }, {}, { chain: Chain.Continental }],
        [{ chain: Chain.Tower }, {}, { chain: Chain.Continental }],
        [{ chain: Chain.Tower }, {}, { chain: Chain.Continental }],
        [{ chain: Chain.Tower }, {}, { chain: Chain.Continental }],
        [{ chain: Chain.Tower }, {}, { chain: Chain.Continental }],
        [{ chain: Chain.Tower }, {}, { chain: Chain.Continental }],
        [{ chain: Chain.Tower }, {}, { chain: Chain.Continental }],
        [{ chain: Chain.Tower }, {}, { chain: Chain.Continental }],
        [{ drawnByPlayer: '0' }, { drawnByPlayer: '0' }, { drawnByPlayer: '0' }],
      ]),
      players: {
        '0': { id: '0' },
        '1': { id: '1' },
      },
    };
    ctx = {
      ...DEFAULT_CTX,
      playerID: '0',
      events: {
        endTurn: jest.fn(),
        endStage: jest.fn(),
      },
      random: { Number: () => 0 },
    };
  });

  it('removes unplayable tiles, draws to 6, and ends the turn', () => {
    drawHotels(G, ctx);

    expect(G.hotels).toEqual(
      fillInTestHotels([
        [{ drawnByPlayer: '1' }, { hasBeenRemoved: true }, { drawnByPlayer: '0' }],
        [{ chain: Chain.Tower }, { hasBeenRemoved: true }, { chain: Chain.Continental }],
        [{ chain: Chain.Tower }, { hasBeenRemoved: true }, { chain: Chain.Continental }],
        [{ chain: Chain.Tower }, { drawnByPlayer: '0' }, { chain: Chain.Continental }],
        [{ chain: Chain.Tower }, { drawnByPlayer: '0' }, { chain: Chain.Continental }],
        [{ chain: Chain.Tower }, { id: 'test-4' }, { chain: Chain.Continental }],
        [{ chain: Chain.Tower }, { id: 'test-5' }, { chain: Chain.Continental }],
        [{ chain: Chain.Tower }, { id: 'test-6' }, { chain: Chain.Continental }],
        [{ chain: Chain.Tower }, { id: 'test-7' }, { chain: Chain.Continental }],
        [{ chain: Chain.Tower }, { id: 'test-8' }, { chain: Chain.Continental }],
        [{ chain: Chain.Tower }, { id: 'test-9' }, { chain: Chain.Continental }],
        [{ chain: Chain.Tower }, { id: 'test-10' }, { chain: Chain.Continental }],
        [{ drawnByPlayer: '0' }, { drawnByPlayer: '0' }, { drawnByPlayer: '0' }],
      ]),
    );
    expect(ctx.events.endTurn).toHaveBeenCalled();
    expect(ctx.events.endStage).toHaveBeenCalled();
  });
});

// TODO:
//   - merger where no one has any stock
//   - merger where the person who merged has no stock
describe('mergerPhase', () => {
  describe('a 3-way merger', () => {
    let p0;
    let p1;
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

      const clients = getMultiplayerTestClients(2, originalBoard, (G) => {
        G.players['0'].stocks[Chain.Tower] = 1;
        G.players['0'].stocks[Chain.Continental] = 2;
        G.players['1'].stocks[Chain.American] = 1;
        G.players['1'].stocks[Chain.Continental] = 1;
      });

      p0 = clients[0];
      p1 = clients[1];
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
    let p0;
    let p1;
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

      const clients = getMultiplayerTestClients(2, originalBoard, (G) => {
        G.players['1'].stocks[Chain.Tower] = 1;
      });

      p0 = clients[0];
      p1 = clients[1];
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
