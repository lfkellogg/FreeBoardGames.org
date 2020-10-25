import React from 'react';
import Enzyme from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';
import { State } from 'boardgame.io';
import { Client } from 'boardgame.io/client';
import { MergersGame } from '../game';
import { Chain, IG } from '../types';
import * as utils from '../utils';

import { PlayerActions } from './PlayerActions';
import css from './PlayerActions.css';
import Hotels from '../hotels';

Enzyme.configure({ adapter: new Adapter() });

describe('#renderBuyStock', () => {
  const setUpComponent = (phase: string, stage: string, setUpStateFn: (state: State) => void) => {
    const client = Client({
      game: MergersGame,
      numPlayers: 3,
      playerId: '0',
    });
    client.moves.buyStock = jest.fn();

    const state0 = client.store.getState();
    const state1 = {
      ...state0,
      ctx: {
        ...state0.ctx,
        phase,
        activePlayers: { '0': stage },
      },
    };

    setUpStateFn(state1);

    return Enzyme.mount(
      <PlayerActions
        hotels={new Hotels(state1.G.hotels)}
        players={state1.G.players}
        availableStocks={state1.G.availableStocks}
        merger={state1.G.merger}
        moves={client.moves}
        playerStage={stage}
        playerPhase={phase}
        playerID="0"
        playerIndex={0}
        gameOverMessage=""
      />,
    );
  };

  const setUpHotel = (G: IG, id: string, chain?: Chain) => {
    const hotels = new Hotels(G.hotels);
    hotels.getHotel(id).hasBeenPlaced = true;
    hotels.getHotel(id).chain = chain;
  };

  describe('trying to buy zero stocks, even with no money', () => {
    const comp = setUpComponent('buildingPhase', 'buyStockStage', (state: State) => {
      setUpHotel(state.G, '1-A', Chain.Tower);
      setUpHotel(state.G, '2-A', Chain.Tower);
      setUpHotel(state.G, '3-B', Chain.Luxor);
      setUpHotel(state.G, '4-B', Chain.Luxor);

      // player doesn't have any money
      state.G.players['0'].money = 0;
    });

    comp.find(`.${css.ActionButton}`).at(0).simulate('click');

    it('submits an empty order', () => {
      expect(comp.props().moves.buyStock).toHaveBeenCalledWith(utils.fillStockMap(0));
      expect(comp.find(`.${css.ActionButton}`).at(0).props().disabled).toBeFalse();
    });
  });

  describe('trying to buy 3 stocks with exactly the right amount of money left', () => {
    const comp = setUpComponent('buildingPhase', 'buyStockStage', (state: State) => {
      // hotels are all from the cheapest tier and of size 2 = $200 per stock
      setUpHotel(state.G, '1-A', Chain.Tower);
      setUpHotel(state.G, '2-A', Chain.Tower);
      setUpHotel(state.G, '3-B', Chain.Luxor);
      setUpHotel(state.G, '4-B', Chain.Luxor);

      // player has exactly the right amount of money
      state.G.players['0'].money = 600;
    });

    // player buys 3 stock
    comp
      .find('input[name="stock-to-buy-input-Tower"]')
      .at(0)
      .simulate('change', { target: { name: 'stock-to-buy-input-Tower', value: '2' } });
    comp
      .find('input[name="stock-to-buy-input-Luxor"]')
      .at(0)
      .simulate('change', { target: { name: 'stock-to-buy-input-Luxor', value: '1' } });

    comp.find(`.${css.ActionButton}`).at(0).simulate('click');

    it('submits the correct order', () => {
      expect(comp.props().moves.buyStock).toHaveBeenCalledWith({
        ...utils.fillStockMap(0),
        [Chain.Tower]: 2,
        [Chain.Luxor]: 1,
      });
      expect(comp.find(`.${css.ActionButton}`).at(0).props().disabled).toBeFalse();
    });
  });

  describe('trying to buy stock with not enough money left', () => {
    const comp = setUpComponent('buildingPhase', 'buyStockStage', (state: State) => {
      // hotels are all from the cheapest tier and of size 2 = $200 per stock
      setUpHotel(state.G, '1-A', Chain.Tower);
      setUpHotel(state.G, '2-A', Chain.Tower);
      setUpHotel(state.G, '3-B', Chain.Luxor);
      setUpHotel(state.G, '4-B', Chain.Luxor);

      // player is short $100
      state.G.players['0'].money = 500;
    });

    // player buys 3 stock
    comp
      .find('input[name="stock-to-buy-input-Tower"]')
      .at(0)
      .simulate('change', { target: { name: 'stock-to-buy-input-Tower', value: '2' } });
    comp
      .find('input[name="stock-to-buy-input-Luxor"]')
      .at(0)
      .simulate('change', { target: { name: 'stock-to-buy-input-Luxor', value: '1' } });

    comp.find(`.${css.ActionButton}`).at(0).simulate('click');

    it('disables the Buy button', () => {
      expect(comp.props().moves.buyStock).not.toHaveBeenCalled();
      expect(comp.find(`.${css.ActionButton}`).at(0).props().disabled).toBeTrue();
    });
  });

  describe('trying to buy more of a stock than is available', () => {
    const comp = setUpComponent('buildingPhase', 'buyStockStage', (state: State) => {
      setUpHotel(state.G, '1-A', Chain.Tower);
      setUpHotel(state.G, '2-A', Chain.Tower);
      setUpHotel(state.G, '3-B', Chain.Luxor);
      setUpHotel(state.G, '4-B', Chain.Luxor);
      state.G.players['0'].money = 1000;

      // there is only 1 Tower left
      state.G.availableStocks[Chain.Tower] = 1;
    });

    // player tries to buy 2 Tower
    comp
      .find('input[name="stock-to-buy-input-Tower"]')
      .at(0)
      .simulate('change', { target: { name: 'stock-to-buy-input-Tower', value: '2' } });

    comp.find(`.${css.ActionButton}`).at(0).simulate('click');

    it('disables the Buy button', () => {
      expect(comp.props().moves.buyStock).not.toHaveBeenCalled();
      expect(comp.find(`.${css.ActionButton}`).at(0).props().disabled).toBeTrue();
    });
  });

  describe('trying to buy more than 3 stocks', () => {
    const comp = setUpComponent('buildingPhase', 'buyStockStage', (state: State) => {
      setUpHotel(state.G, '1-A', Chain.Tower);
      setUpHotel(state.G, '2-A', Chain.Tower);
      setUpHotel(state.G, '3-B', Chain.Luxor);
      setUpHotel(state.G, '4-B', Chain.Luxor);
      state.G.players['0'].money = 1000;
    });

    // player tries to buy 4 stocks
    comp
      .find('input[name="stock-to-buy-input-Tower"]')
      .at(0)
      .simulate('change', { target: { name: 'stock-to-buy-input-Tower', value: '2' } });
    comp
      .find('input[name="stock-to-buy-input-Luxor"]')
      .at(0)
      .simulate('change', { target: { name: 'stock-to-buy-input-Luxor', value: '2' } });

    comp.find(`.${css.ActionButton}`).at(0).simulate('click');

    it('disables the Buy button', () => {
      expect(comp.props().moves.buyStock).not.toHaveBeenCalled();
      expect(comp.find(`.${css.ActionButton}`).at(0).props().disabled).toBeTrue();
    });
  });

  describe('entering a value that is not a number', () => {
    const comp = setUpComponent('buildingPhase', 'buyStockStage', (state: State) => {
      setUpHotel(state.G, '1-A', Chain.Tower);
      setUpHotel(state.G, '2-A', Chain.Tower);
      setUpHotel(state.G, '3-B', Chain.Luxor);
      setUpHotel(state.G, '4-B', Chain.Luxor);
      state.G.players['0'].money = 1000;
    });

    // player enters a non-numerical value
    comp
      .find('input[name="stock-to-buy-input-Tower"]')
      .at(0)
      .simulate('change', { target: { name: 'stock-to-buy-input-Tower', value: 'oops' } });

    comp.find(`.${css.ActionButton}`).at(0).simulate('click');

    it('disables the Buy button', () => {
      expect(comp.props().moves.buyStock).not.toHaveBeenCalled();
      expect(comp.find(`.${css.ActionButton}`).at(0).props().disabled).toBeTrue();
    });
  });
});
