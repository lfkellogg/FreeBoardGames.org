import React from 'react';
import Enzyme from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';
import { State } from 'boardgame.io';
import { Client } from 'boardgame.io/client';
import { GameMode } from 'gamesShared/definitions/mode';
import { MergersGame } from './game';

import { Board } from './board';

Enzyme.configure({ adapter: new Adapter() });

describe('#renderBuyStock', () => {
  const TestBoard = (props: any) => (
    <Board
      {...{
        ...props,
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

  const setUpComponent = (phase?: string, stage?: string, setUpStateFn?: (state: State) => void) => {
    const client = Client({
      game: MergersGame,
      numPlayers: 3,
      playerId: '0',
    });
    client.moves.buyStock = jest.fn();

    const state0 = client.store.getState();

    if (phase) {
      state0.ctx.phase = phase;
    }
    if (stage) {
      state0.ctx.activePlayers = { '0': stage };
    }
    if (setUpStateFn) {
      setUpStateFn(state0);
    }

    return Enzyme.mount(<TestBoard G={state0.G} ctx={state0.ctx} moves={client.moves} playerID="0" />);
  };

  // TODO: add more tests
  describe('#Board', () => {
    describe('on game start', () => {
      const comp = setUpComponent();

      it('renders all players', () => {
        expect(comp.find('#player-label-0').at(0).text()).toContain('player0');
        expect(comp.find('#player-label-1').at(0).text()).toContain('player1');
        expect(comp.find('#player-label-2').at(0).text()).toContain('player2');
      });
    });
  });
});
