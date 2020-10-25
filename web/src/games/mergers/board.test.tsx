import React from 'react';
import Enzyme, { ReactWrapper } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';
import { State } from 'boardgame.io';
import { Client } from 'boardgame.io/client';
import { GameMode } from 'gamesShared/definitions/mode';
import { MergersGame } from './game';

import { Board, BoardProps, BoardState } from './board';
import { Chain } from './types';

type SetUpStateFn = (state: State) => void;

interface TestConfig {
  phase?: string;
  stage?: string;
}

Enzyme.configure({ adapter: new Adapter() });

let client: Client;

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

const setUpComponent = (
  config?: TestConfig,
  setUpStateFn?: SetUpStateFn,
): ReactWrapper<BoardProps, BoardState, Board> => {
  client = Client({
    game: MergersGame,
    numPlayers: 3,
    playerId: '0',
  });
  client.moves.buyStock = jest.fn();

  const state0 = client.store.getState();

  // force it to be playerO's turn
  state0.ctx.playOrderPos = 0;
  state0.ctx.currentPlayer = '0';

  if (config?.phase) {
    state0.ctx.phase = config.phase;
  }
  if (config?.stage) {
    state0.ctx.activePlayers = { '0': config.stage };
  }
  if (setUpStateFn) {
    setUpStateFn(state0);
  }

  return Enzyme.mount(<TestBoard G={state0.G} ctx={state0.ctx} moves={client.moves} playerID="0" />);
};

// TODO: add more tests
describe('Board', () => {
  describe('on game start', () => {
    const comp = setUpComponent();

    it('renders all players', () => {
      expect(comp.find('#player-label-0').at(0).text()).toContain('player0');
      expect(comp.find('#player-label-1').at(0).text()).toContain('player1');
      expect(comp.find('#player-label-2').at(0).text()).toContain('player2');
    });

    it('renders the available stocks', () => {
      expect(comp.find('#available-stock-Tower').at(0).text()).toContain('25');
      expect(comp.find('#available-stock-Luxor').at(0).text()).toContain('25');
      expect(comp.find('#available-stock-Worldwide').at(0).text()).toContain('25');
      expect(comp.find('#available-stock-American').at(0).text()).toContain('25');
      expect(comp.find('#available-stock-Festival').at(0).text()).toContain('25');
      expect(comp.find('#available-stock-Continental').at(0).text()).toContain('25');
      expect(comp.find('#available-stock-Imperial').at(0).text()).toContain('25');
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
  });

  describe('during mergerPhase', () => {
    let comp: ReactWrapper<BoardProps, BoardState, Board>;

    beforeEach(() => {
      comp = setUpComponent({ phase: 'mergerPhase' }, (state) => {
        state.G.merger = {
          survivingChain: Chain.Continental,
          chainToMerge: Chain.Tower,
          chainSize: 3,
          stockCounts: { '0': 10, '1': 5 },
          bonuses: { '0': 3000, '1': 1500 },
        };
      });
    });

    it('renders the merger dialog', () => {
      expect(comp.find('#merger-details-dialog').length).toBeGreaterThan(0);
    });

    it('displays merger details', () => {
      expect(comp.find('#bonus-Tower-0').first().text()).toContain('player0 gets $3000');
      expect(comp.find('#bonus-Tower-1').first().text()).toContain('player1 gets $1500');
    });

    describe('when the dialog is dismissed', () => {
      beforeEach(() => {
        comp.find('#merger-details-dialog-close').first().simulate('click');
      });

      it('no longers renders the dialog', () => {
        expect(comp.find('#merger-details-dialog').length).toEqual(0);
      });
    });
  });

  describe('on game end', () => {
    // TODO
  });
});
