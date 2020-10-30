import { Ctx } from "boardgame.io";
import { Client } from 'boardgame.io/client';
import { Local } from "boardgame.io/multiplayer";
import { MergersGame } from "./game";
import { Hotels } from "./hotels";
import { Hotel } from "./types";
import { setupInitialState } from "./utils";

export interface MergersScenarioConfig {
  phase?: string,
  stage?: string,
  hotels?: Hotel[][],
}

/**
 * Facilitates setting up a test grid, by:
 * 
 * - Filling in IDs based on hotel position
 * - Setting any hotels with chains as "hasBeenPlaced"
 */
export function fillInTestHotels(hotels: Hotel[][]): Hotel[][] {
  for (let r = 0; r < hotels.length; r++) {
    for (let c = 0; c < hotels[r].length; c++) {
      const hotel = hotels[r][c];
      hotel.id = `${c + 1}-${Hotels.rowToLetter(r)}`;
      if (hotel.chain) {
        hotel.hasBeenPlaced = true;
      }
    }
  }
  return hotels;
}

/**
 * Get a custom Mergers scenario, without the random drawing up front, and where player 0 always
 * goes first.
 */
export function getScenario(config?: MergersScenarioConfig, setupFn?: (G, ctx) => void) {
  const phase = config?.phase || 'buildingPhase';

  const MergersCustomScenario = {
    ...MergersGame,
    setup: (ctx: Ctx) => {
      const G = setupInitialState(ctx.numPlayers);
      G.hotels = config.hotels || Hotels.buildGrid(4, 4);
      ctx.events.setPhase(phase);
      if (config?.stage) {
        ctx.events.setActivePlayers({ '0': config.stage });
      }
      if (setupFn) {
        setupFn(G, ctx);
      }
      return G;
    },
  };

  // skip the initial draw and always set player 0 to go first
  MergersCustomScenario.phases[phase].turn.order.first = () => 0;

  return MergersCustomScenario;
}

/** Get a test client, with an optional setup function */
export function getSingleTestClient(
  numPlayers: number = 2, hotels?: Hotel[][], setupFn?: (G, ctx) => void) {

  const client = Client({
    game: getScenario({ hotels }, setupFn),
    numPlayers,
  });

  client.start();

  return client;
}

/** Get clients for a multiplayer test, and start them, with an optional setup function */
export function getMultiplayerTestClients(
  numPlayers: number = 2, hotels?: Hotel[][], setupFn?: (G, ctx) => void) {
  const spec = {
    game: getScenario({ hotels }, setupFn),
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

  clients.forEach((client) => {
    client.start();
  });

  return clients;
}