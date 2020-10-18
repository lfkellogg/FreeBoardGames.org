import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import { Ctx } from 'boardgame.io';
import React from 'react';
import { Chain, IG } from '../types';
import { fillStockMap, isUnplayable, playerHotels, priceOfStock, sizeOfChain } from '../utils';

import { StockLabel } from './StockLabel';
import css from './PlayerActions.css';

interface PlayerActionsProps {
  G: IG;
  ctx: Ctx;
  moves: any;
  playerID: string;
  gameOverMessage?: string;
}

interface PlayerActionsState {
  stocksToBuy: Record<Chain, string>;
  stocksToSwap?: number;
  stocksToSell?: number;
}

export class PlayerActions extends React.Component<PlayerActionsProps, PlayerActionsState> {
  constructor(props: PlayerActionsProps) {
    super(props);
    this.state = {
      stocksToBuy: {
        Tower: '',
        Luxor: '',
        Worldwide: '',
        American: '',
        Festival: '',
        Continental: '',
        Imperial: '',
      },
    };
  }

  playerID() {
    return this.props.playerID;
  }

  playerIndex() {
    return this.props.ctx.playOrder.indexOf(this.playerID());
  }

  playerState() {
    return this.props.G.players[this.playerID()];
  }

  parseNumber(text: string): number {
    if (!text) {
      return 0;
    }
    return Number(text);
  }

  parseStocksToBuy(): Partial<Record<Chain, number>> {
    const parsed = {};
    for (const key of Object.keys(this.state.stocksToBuy)) {
      parsed[key] = this.parseNumber(this.state.stocksToBuy[key]);
    }
    return parsed;
  }

  validateStocksToBuy(): string {
    const parsed = this.parseStocksToBuy();
    let totalCount = 0;
    let totalPrice = 0;
    for (const key of Object.keys(parsed)) {
      const chain = Chain[key];
      const numToBuy = parsed[chain];
      if (numToBuy === 0) {
        continue;
      }
      if (Number.isNaN(numToBuy)) {
        return 'Please enter numbers only';
      }
      const numAvailable = this.props.G.availableStocks[chain];
      if (numToBuy > numAvailable) {
        return `There are only ${numAvailable} ${chain} available`;
      }
      totalCount += numToBuy;
      totalPrice += numToBuy * priceOfStock(chain, this.props.G.hotels);
    }
    if (totalCount > 3) {
      return 'You  may only buy up to 3 stocks per turn';
    }
    if (totalPrice > this.playerState().money) {
      return 'You don\'t have enough money';
    }
    return '';
  }

  renderButton(text: string, onClick: () => void) {
    return (
      <Button className={css.ActionButton} variant="contained" color="primary" onClick={onClick}>
        {text}
      </Button>
    );
  }

  renderChooseChainLabel(chain: Chain) {
    return (
      <StockLabel
        key={`choose-${chain}`}
        chain={chain}
        onClick={() => this.props.moves.chooseNewChain(chain)}
      ></StockLabel>
    );
  }

  renderChooseChain() {
    const chainLabels = Object.keys(Chain)
      .filter((key) => sizeOfChain(Chain[key], this.props.G.hotels) === 0)
      .map((key) => this.renderChooseChainLabel(Chain[key]));

    return (
      <div className={css.WrapRow}>
        <div className={css.MarginRight}>Choose the new chain:</div>
        {chainLabels}
      </div>
    );
  }

  renderStockToBuy(chain: Chain) {
    const stockPrice = priceOfStock(chain, this.props.G.hotels);
    if (stockPrice === undefined) {
      return;
    }

    return (
      <div key={`stock-to-buy-${chain}`} className={`${css.MarginRight} ${css.WrapRow}`}>
        <StockLabel chain={chain}></StockLabel>
        <TextField
          name={`stock-to-buy-input-${chain}`}
          className={css.ActionInput}
          placeholder="#"
          value={this.state.stocksToBuy[chain]}
          error={!!this.validateStocksToBuy()}
          onChange={(e) => {
            this.setState({
              stocksToBuy: {
                ...this.state.stocksToBuy,
                [chain]: e.target.value || '',
              },
            });
          }}
        ></TextField>
      </div>
    );
  }

  renderBuyStock() {
    const stocksToBuy = this.parseStocksToBuy();
    let numStocksToBuy = 0;
    for (const key of Object.keys(stocksToBuy)) {
      numStocksToBuy += stocksToBuy[key];
    }
    const errorMsg = this.validateStocksToBuy();
    return (
      <div className="BuyStockContainer">
        <div className={css.WrapRow}>
          <div className={css.MarginRight}>Buy up to 3 stocks:</div>
          {Object.keys(Chain).map((key) => this.renderStockToBuy(Chain[key]))}
          <Button
            className={css.ActionButton}
            disabled={!!errorMsg}
            variant="contained"
            color="primary"
            onClick={() => {
              if (!!errorMsg) {
                return;
              }
              this.props.moves.buyStock(stocksToBuy);
              this.setState({ stocksToBuy: fillStockMap('') });
            }}
          >
            {numStocksToBuy === 0 ? 'Pass' : 'Buy'}
          </Button>
        </div>
        <div className={css.ErrorText}>{errorMsg}</div>
      </div>
    );
  }

  renderGameOverChoice() {
    return (
      <div className={css.WrapRow}>
        <div className={css.MarginRight}>Do you want to end the game?</div>
        <div className={css.MarginRight}>
          {this.renderButton('Yes (end the game)', () => this.props.moves.declareGameOver(true))}
        </div>
        {this.renderButton('No (keep playing)', () => this.props.moves.declareGameOver(false))}
      </div>
    );
  }

  renderBreakMergerTieChain(message: string, move: string) {
    const chainSizes = this.props.G.merger.mergingChains.map((c) => ({
      chain: c,
      size: sizeOfChain(c, this.props.G.hotels),
    }));
    const biggestChainSize = chainSizes[0].size;
    const choices = chainSizes
      .filter((chainSize) => chainSize.size === biggestChainSize)
      .map((chainSize) => chainSize.chain)
      .map((chain) => (
        <StockLabel key={`stock-${chain}`} chain={chain} onClick={() => this.props.moves[move](chain)}></StockLabel>
      ));
    return (
      <div className={css.WrapRow}>
        <div className={css.MarginRight}>{message}</div>
        {choices}
      </div>
    );
  }

  renderChooseSurvivingChain() {
    return this.renderBreakMergerTieChain(
      'There is a tie. Choose the chain that will survive the merger:',
      'chooseSurvivingChain',
    );
  }

  renderChooseChainToMerge() {
    return this.renderBreakMergerTieChain('There is a tie. Choose the chain to merge next:', 'chooseChainToMerge');
  }

  // TODO: refactor and simlify
  renderSwapAndSellStock() {
    const numToSwap = this.state.stocksToSwap || 0;
    const numToSell = this.state.stocksToSell || 0;
    return (
      <div className={css.WrapRow}>
        <div
          className={css.MarginRight}
        >{`Do you want to exchange any ${this.props.G.merger.chainToMerge} stock?`}</div>
        <div className={css.SwapSellEntry}>
          <div className={css.SwapSellLabel}>Swap</div>
          <TextField
            className={css.ActionInput}
            placeholder="#"
            value={this.state.stocksToSwap || ''}
            onChange={(e) => {
              let n = e.target.value === '' ? 0 : Number(e.target.value);
              if (Number.isNaN(n)) {
                n = 0;
              }
              this.setState({
                stocksToSwap: n,
              });
            }}
          ></TextField>
        </div>
        <div className={css.SwapSellEntry}>
          <div className={css.SwapSellLabel}>Sell</div>
          <TextField
            className={css.ActionInput}
            placeholder="#"
            value={this.state.stocksToSell || ''}
            onChange={(e) => {
              let n = e.target.value === '' ? 0 : Number(e.target.value);
              if (Number.isNaN(n)) {
                n = 0;
              }
              this.setState({
                stocksToSell: n,
              });
            }}
          ></TextField>
        </div>
        <Button
          className={css.ActionButton}
          variant="contained"
          color="primary"
          onClick={() => {
            this.props.moves.swapAndSellStock(numToSwap, numToSell);
            this.setState({ stocksToSwap: 0, stocksToSell: 0 });
          }}
        >
          {numToSwap + numToSell > 0 ? 'OK' : 'Pass'}
        </Button>
      </div>
    );
  }

  render() {
    let content;
    if (this.props.gameOverMessage) {
      content = <div>{this.props.gameOverMessage}</div>;
    } else if (this.props.ctx.phase === 'buildingPhase') {
      const stage = this.props.ctx.activePlayers[this.playerIndex()];
      switch (stage) {
        case 'placeHotelStage':
          const hasPlayableHotel = !!playerHotels(this.props.G, this.playerID()).find(
            (h) => !isUnplayable(this.props.G, h),
          );
          if (!hasPlayableHotel) {
            content = this.renderButton('Continue (you have no playable hotels)', () => this.props.moves.placeHotel());
          } else {
            content = <div>Click an outlined square above to place hotel</div>;
          }
          break;
        case 'chooseNewChainStage':
          content = this.renderChooseChain();
          break;
        case 'buyStockStage':
          content = this.renderBuyStock();
          break;
        case 'declareGameOverStage':
          content = this.renderGameOverChoice();
          break;
        case 'drawHotelsStage':
          content = this.renderButton('Draw hotels', () => this.props.moves.drawHotels());
          break;
        default:
          break;
      }
    } else if (this.props.ctx.currentPlayer === this.playerID()) {
      switch (this.props.ctx.phase) {
        case 'chooseSurvivingChainPhase':
          content = this.renderChooseSurvivingChain();
          break;
        case 'chooseChainToMergePhase':
          content = this.renderChooseChainToMerge();
          break;
        case 'mergerPhase':
          content = this.renderSwapAndSellStock();
          break;
        default:
          break;
      }
    }

    return (
      <div className={`${css.Actions} ${css.WrapRow} ${content ? css.YourTurn : ''}`}>{content || 'Not your turn'}</div>
    );
  }
}
