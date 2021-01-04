import React from 'react';
import Enzyme, { ReactWrapper, ShallowWrapper } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';
import { Client } from 'boardgame.io/client';
import { GameMode } from 'gamesShared/definitions/mode';
import { MergersGame } from './game';

import { Board, BoardProps, BoardState } from './board';
import * as sound from './sound';
import { Chain, Move } from './types';
import { setupInitialState } from './utils';
import { Ctx } from 'boardgame.io';

// mock functions for HTMLMediaElement
// https://github.com/jsdom/jsdom/issues/2155#issuecomment-366703395
(window as any).HTMLMediaElement.prototype.play = () => {
  /* do nothing */
};

Enzyme.configure({ adapter: new Adapter() });

const DEFAULT_CTX: Ctx = {
  numPlayers: 3,
  playOrder: ['0', '1', '2'],
  playOrderPos: 0,
  playerID: '0',
  activePlayers: null,
  currentPlayer: '0',
  turn: 1,
  phase: 'buildingPhase',
};

let client;
let playSoundSpy;
let repeatSoundSpy;

class TestBoard extends Board {
  render() {
    return (
      <Board
        {...{
          ...this.props,
          gameArgs: {
            gameCode: 'mergers',
            mode: GameMode.OnlineFriend,
            players: [
              { playerID: 0, name: 'player0', roomID: '' },
              { playerID: 1, name: 'player1', roomID: '' },
              { playerID: 2, name: 'player2', roomID: '' },
            ],
          },
        }}
      />
    );
  }
}

// TODO: add more tests
describe('Board', () => {
  beforeEach(() => {
    playSoundSpy = jest.spyOn(sound, 'playSound');
    repeatSoundSpy = jest.spyOn(sound, 'repeatSound');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('on game start', () => {
    let comp: ReactWrapper<BoardProps, BoardState, Board>;

    beforeEach(() => {
      client = Client({
        game: MergersGame,
        numPlayers: 3,
        playerID: '0',
      });

      const state0 = client.store.getState();

      comp = Enzyme.mount(<TestBoard G={state0.G} ctx={state0.ctx} moves={client.moves} playerID="0" />);
    });

    it('renders all players', () => {
      expect(comp.find('#player-label-0').at(0).text()).toContain('player0');
      expect(comp.find('#player-label-1').at(0).text()).toContain('player1');
      expect(comp.find('#player-label-2').at(0).text()).toContain('player2');
    });

    it('renders the available stocks', () => {
      expect(comp.find('#available-stock-Toro').at(0).text()).toContain('25');
      expect(comp.find('#available-stock-Lucius').at(0).text()).toContain('25');
      expect(comp.find('#available-stock-Worldywise').at(0).text()).toContain('25');
      expect(comp.find('#available-stock-Amore').at(0).text()).toContain('25');
      expect(comp.find('#available-stock-Festivus').at(0).text()).toContain('25');
      expect(comp.find('#available-stock-Continuum').at(0).text()).toContain('25');
      expect(comp.find('#available-stock-Imperative').at(0).text()).toContain('25');
    });

    it('renders the last move', () => {
      expect(comp.find('#last-move').at(0).text()).toContain('and will go first');
    });

    it('renders your money', () => {
      expect(comp.find('#player-status').text()).toContain('You have:$6000');
    });

    it('does not render the merger dialog', () => {
      expect(comp.find('#merger-details-dialog').length).toEqual(0);
    });

    it('plays sounds of opening tiles', () => {
      expect(repeatSoundSpy).toHaveBeenCalledWith(sound.MergersSound.Click, 3);
    });
  });

  describe('during mergerPhase', () => {
    let comp: ReactWrapper<BoardProps, BoardState, Board>;

    beforeEach(() => {
      const G = setupInitialState(3);
      G.merger = {
        survivingChain: Chain.Continuum,
        chainToMerge: Chain.Toro,
        mergingChains: [Chain.Toro],
        chainSize: 3,
        stockCounts: { '0': 10, '1': 5, '2': 0 },
        bonuses: { '0': 3000, '1': 1500 },
      };

      const ctx = { ...DEFAULT_CTX, phase: 'mergerPhase' };

      comp = Enzyme.mount(<TestBoard G={G} ctx={ctx} moves={{}} playerID="0" />);
    });

    it('renders the merger dialog', () => {
      expect(comp.find('#merger-details-dialog').length).toBeGreaterThan(0);
    });

    it('displays merger details', () => {
      expect(comp.find('#bonus-Toro-0').first().text()).toContain('player0 gets $3000');
      expect(comp.find('#bonus-Toro-1').first().text()).toContain('player1 gets $1500');
    });

    describe('after the dialog is dismissed', () => {
      beforeEach(() => {
        comp.find('#merger-details-dialog-close').first().simulate('click');
      });

      it('no longers renders the dialog', () => {
        expect(comp.find('#merger-details-dialog').length).toEqual(0);
      });
    });
  });

  describe('componentDidUpdate', () => {
    const updateProps = (propsUpdate: Partial<BoardProps>, soundEnabled: boolean = true) => {
      const G = setupInitialState(3);
      const ctx = { ...DEFAULT_CTX, currentPlayer: '1' };

      const prevProps = {
        G,
        ctx,
        moves: {},
        playerID: '0',
      };

      const currentProps = {
        ...prevProps,
        G: { ...G, ...propsUpdate.G },
        ctx: { ...ctx, ...propsUpdate.ctx },
      };

      // render with the "current" props, including the last move
      const comp: ShallowWrapper<BoardProps, BoardState, Board> = Enzyme.shallow(<TestBoard {...currentProps} />);

      // set sound enabled state
      comp.setState({ soundEnabled });
      comp.update();

      // simulate a props change by calling componentDidUpdate with the "previous" props
      comp.instance().componentDidUpdate(prevProps);
    };

    describe('when there is a new merger', () => {
      beforeEach(() => {
        updateProps({ G: { merger: { chainToMerge: Chain.Toro } } });
      });

      it('plays the right sound', () => {
        expect(playSoundSpy).toHaveBeenCalledWith(sound.MergersSound.Tada);
      });
    });

    describe('when the game is over', () => {
      beforeEach(() => {
        updateProps({ ctx: { ...DEFAULT_CTX, gameover: { winner: '0' } } });
      });

      it('plays the right sound', () => {
        expect(playSoundSpy).toHaveBeenCalledWith(sound.MergersSound.Tada);
      });
    });

    describe('when it is your turn', () => {
      beforeEach(() => {
        updateProps({ ctx: { ...DEFAULT_CTX, currentPlayer: '0' } });
      });

      it('plays the right sound', () => {
        expect(playSoundSpy).toHaveBeenCalledWith(sound.MergersSound.Chime);
      });
    });

    describe('when a player places a hotel', () => {
      beforeEach(() => {
        updateProps({ G: { lastMove: { move: Move.PlaceHotel, text: 'move-text' } } });
      });

      it('plays the right sound', () => {
        expect(playSoundSpy).toHaveBeenCalledWith(sound.MergersSound.Click);
      });
    });

    describe('when a player buys stock', () => {
      beforeEach(() => {
        updateProps({ G: { lastMove: { move: Move.BuyStock, text: 'move-text' } } });
      });

      it('plays the right sound', () => {
        expect(playSoundSpy).toHaveBeenCalledWith(sound.MergersSound.Card);
      });
    });

    describe('when a player passes', () => {
      beforeEach(() => {
        updateProps({ G: { lastMove: { move: Move.ExchangeNoStock, text: 'move-text' } } });
      });

      it('plays the right sound', () => {
        expect(playSoundSpy).toHaveBeenCalledWith(sound.MergersSound.Whoosh);
      });
    });

    describe('when a player draws hotels', () => {
      beforeEach(() => {
        updateProps({ G: { lastMove: { move: Move.DrawHotels, text: 'move-text' } } });
      });

      it('plays the right sound', () => {
        expect(playSoundSpy).toHaveBeenCalledWith(sound.MergersSound.Tiles);
      });
    });

    describe('when the sound is disabled', () => {
      beforeEach(() => {
        updateProps({ G: { lastMove: { move: Move.PlaceHotel, text: 'move-text' } } }, false);
      });

      it('plays no sound', () => {
        expect(playSoundSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe('on game end', () => {
    // TODO
  });
});
