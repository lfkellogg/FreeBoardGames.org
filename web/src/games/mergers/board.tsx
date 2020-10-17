import * as React from 'react';
import Button from '@material-ui/core/Button';
import DialogTitle from '@material-ui/core/DialogTitle';
import Dialog from '@material-ui/core/Dialog';
import TextField from '@material-ui/core/TextField';
import { IGameArgs } from 'gamesShared/definitions/game';
import { GameLayout } from 'gamesShared/components/fbg/GameLayout';
import { Ctx } from 'boardgame.io';
import { DialogActions, DialogContent, DialogContentText } from '@material-ui/core';

import css from './Board.css';
import { HotelGrid } from './components/HotelGrid';
import { StockGuide } from './components/StockGuide';
import { Chain, IG, Merger, Score } from './types';
import { fillStockMap, isUnplayable, playerHotels, priceOfStock, priceOfStockBySize, sizeOfChain } from './utils';

interface BoardProps {
  G: IG;
  ctx: Ctx;
  moves: any;
  playerID: string;
  gameArgs?: IGameArgs;
}

interface BoardState {
  stocksToBuy: Record<Chain, string>;
  mergerDetailsDismissed: boolean;
  gameOverDetailsDismissed: boolean;
  showPriceCard: boolean;
  stocksToSwap?: number;
  stocksToSell?: number;
}

// TODO:
//  - refactor out actions area
//  - animations
//  - sounds
//  - fix layout on small screens
//  - add validation to swap/sell stock
//  - test what happens around unplayable tiles (e.g. if all tiles are unplayable)
//  - test drawHotels()
export class Board extends React.Component<BoardProps, BoardState> {
  constructor(props) {
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
      mergerDetailsDismissed: false,
      gameOverDetailsDismissed: false,
      showPriceCard: false,
    };
  }

  componentDidUpdate(prevProps) {
    if (this.props.G.merger?.chainToMerge !== prevProps.G.merger?.chainToMerge) {
      // reset the merger dialog dismissed state
      this.setState({ mergerDetailsDismissed: false });
    }
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

  playerMetadata() {
    return this.props.gameArgs.players[this.playerID()];
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

  renderStockLabel(chain: Chain, onClick?: () => void) {
    return (
      <div
        key={`stock-label-${chain}`}
        className={`${css.PlayerStockLabel} ${css[chain]} ${onClick ? css.Clickable : ''}`}
        onClick={onClick}
      >
        {chain[0]}
      </div>
    );
  }

  renderStock(chain: Chain, count: number, hideEmpty?: boolean) {
    const hiddenClass = hideEmpty && count === 0 ? css.HiddenStock : '';
    return (
      <div key={`stock-count-${chain}`} className={`${css.PlayerStock} ${hiddenClass}`}>
        {this.renderStockLabel(chain)}
        <div className={css.PlayerStockCount}>{`/${count}`}</div>
      </div>
    );
  }

  renderPlayers() {
    return (
      <div className={css.WrapRow}>
        <div className={css.RowLabel}>Current turn:</div>
        {this.props.gameArgs.players.map((player) => {
          let turnClass = '';
          if (!this.props.ctx.gameover && this.props.ctx.currentPlayer === `${player.playerID}`) {
            if (this.props.ctx.currentPlayer === this.playerID()) {
              turnClass = css.YourTurn;
            } else {
              turnClass = css.CurrentTurn;
            }
          }
          return (
            <div key={player.playerID} className={`${css.Player} ${turnClass}`}>
              {player.name}
            </div>
          );
        })}
        <div className={css.Spacer}></div>
        <Button variant="text" color="primary" onClick={() => this.setState({ showPriceCard: true })}>
          Show Guide
        </Button>
      </div>
    );
  }

  renderAvailableStock(chain: Chain) {
    const size = sizeOfChain(chain, this.props.G.hotels);
    const stockPrice = priceOfStockBySize(chain, size);
    const stockPriceMessage = stockPrice === undefined ? '--' : `$${stockPrice}`;
    const hotelSizeMessage = stockPrice === undefined ? '' : ` (${size})`;
    return (
      <div key={`available-stock-${chain}`} className={css.AvailableStockAndPrice}>
        {this.renderStock(chain, this.props.G.availableStocks[chain])}
        {stockPriceMessage}
        {hotelSizeMessage}
      </div>
    );
  }

  renderAvailableStocks() {
    return (
      <div className={css.WrapRow}>
        <div className={css.RowLabel}>Available stocks:</div>
        {Object.keys(Chain).map((key) => this.renderAvailableStock(Chain[key]))}
      </div>
    );
  }

  renderChooseChain() {
    return (
      <div className={css.WrapRow}>
        <div className={css.RowLabel}>Choose the new chain:</div>
        {Object.keys(Chain)
          .filter((key) => sizeOfChain(Chain[key], this.props.G.hotels) === 0)
          .map((key) => this.renderStockLabel(Chain[key], () => this.props.moves.chooseNewChain(Chain[key])))}
      </div>
    );
  }

  renderStockToBuy(chain: Chain) {
    const stockPrice = priceOfStock(chain, this.props.G.hotels);
    if (stockPrice === undefined) {
      return;
    }

    return (
      <div key={`stock-to-buy-${chain}`} className={`${css.StockToBuy} ${css.WrapRow}`}>
        {this.renderStockLabel(chain)}
        <TextField
          name={`stock-to-buy-input-${chain}`}
          className={css.BuyStockInput}
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

  renderButton(text: string, onClick: () => void) {
    return (
      <Button variant="contained" color="primary" onClick={onClick}>
        {text}
      </Button>
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
      <div>
        <div className={css.WrapRow}>
          <div className={css.RowLabel}>Buy up to 3 stocks:</div>
          {Object.keys(Chain).map((key) => this.renderStockToBuy(Chain[key]))}
          <Button
            className="BuyStockButton"
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
        <div className={css.RowLabel}>Do you want to end the game?</div>
        {this.renderButton('Yes (end the game)', () => this.props.moves.declareGameOver(true))}
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
      .map((chainSize) => chainSize.chain);
    return (
      <div className={css.WrapRow}>
        <div className={css.RowLabel}>{message}</div>
        {choices.map((chain) => this.renderStockLabel(chain, () => this.props.moves[move](chain)))}
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

  renderSwapAndSellStock() {
    const numToSwap = this.state.stocksToSwap || 0;
    const numToSell = this.state.stocksToSell || 0;
    return (
      <div className={css.WrapRow}>
        <div className={css.RowLabel}>{`Do you want to exchange any ${this.props.G.merger.chainToMerge} stock?`}</div>
        <div className={css.SwapSellEntry}>
          <div className={css.SwapSellLabel}>Swap</div>
          <TextField
            className={css.BuyStockInput}
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
            className={css.BuyStockInput}
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

  winnerMessage() {
    const { winner, winners } = this.props.ctx.gameover;
    if (winner) {
      return `${this.props.gameArgs.players[winner].name} wins!`;
    } else {
      return `${winners.map((id) => this.props.gameArgs.players[id].name).join(' & ')} tied!`;
    }
  }

  finalScoresMessage() {
    const { scores } = this.props.ctx.gameover;
    const { players } = this.props.gameArgs;
    return `Scores: ${scores.map((s) => `${players[s.id].name}: $${s.money}`).join(', ')}`;
  }

  renderActions() {
    let content;
    if (this.props.ctx.gameover) {
      content = (
        <div>
          {this.winnerMessage()} {this.finalScoresMessage()}
        </div>
      );
    } else if (this.props.ctx.phase === 'buildingPhase') {
      const stage = this.props.ctx.activePlayers[this.playerIndex()];
      //console.log('stage: ', stage);
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

  renderPlayerStatus() {
    const player = this.playerState();
    return (
      <div className={css.WrapRow}>
        <div className={css.RowLabel}>You have:</div>
        <span className={css.PlayerMoney}>${player.money}</span>
        {Object.keys(Chain).map((key) => this.renderStock(Chain[key], player.stocks[Chain[key]], true))}
      </div>
    );
  }

  renderLastMove() {
    let message: string;
    message = this.props.G.lastMove;
    for (const p of this.props.gameArgs.players) {
      message = message.replace(new RegExp(`Player ${p.playerID}`, 'g'), p.name);
    }
    return (
      <div className={css.WrapRow}>
        <div className={css.RowLabel}>Last move:</div>
        <div>{message}</div>
      </div>
    );
  }

  renderMergerDetails(merger: Merger) {
    const { bonuses, chainToMerge, stockCounts } = merger;
    const renderStockCount = (player) => {
      const name = this.props.gameArgs.players[player.id].name;
      return (
        <div className={css.MarginLeft}>
          {name} has {stockCounts[player.id]}
        </div>
      );
    };

    const renderBonus = (playerID) => {
      const name = this.props.gameArgs.players[playerID].name;
      const bonus = bonuses[playerID];
      return (
        <div className={css.MarginLeft}>
          {name} gets ${bonus}
        </div>
      );
    };

    return (
      <div className={css.MarginTopBottom}>
        <div>The following players have {chainToMerge} stock:</div>
        {Object.values(this.props.G.players)
          .filter((p) => !!stockCounts[p.id])
          .sort((a, b) => stockCounts[b.id] - stockCounts[a.id])
          .map(renderStockCount)}
        <div>The bonuses are: </div>
        {Object.keys(bonuses)
          .sort((a, b) => bonuses[b] - bonuses[a])
          .map(renderBonus)}
      </div>
    );
  }

  maybeRenderMergerDetails() {
    if (this.props.ctx.phase !== 'mergerPhase') {
      return;
    }

    const { chainToMerge, survivingChain } = this.props.G.merger;

    const onClose = () => this.setState({ mergerDetailsDismissed: true });

    return (
      <Dialog onClose={onClose} aria-labelledby="merger-dialog-title" open={!this.state.mergerDetailsDismissed}>
        <DialogTitle id="merger-dialog-title">
          {chainToMerge} is merging into {survivingChain}!
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="merger-dialog-description">
            {this.renderMergerDetails(this.props.G.merger)}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} color="primary" autoFocus>
            OK
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  renderFinalScores() {
    const { scores } = this.props.ctx.gameover;
    const { players } = this.props.gameArgs;
    const renderScore = (score: Score) => {
      return (
        <div>
          {players[score.id].name}: {score.money}
        </div>
      );
    };
    return (
      <div className={css.MarginTopBottom}>
        <div className={css.MarginTopBottom}>
          <b>Scores</b>
        </div>
        <div>{scores.map(renderScore)}</div>
      </div>
    );
  }

  maybeRenderPriceCard() {
    const onClose = () => this.setState({ showPriceCard: false });

    return (
      <Dialog onClose={onClose} aria-labelledby="merger-dialog-title" open={this.state.showPriceCard}>
        <DialogTitle id="merger-dialog-title">Stock Price and Bonus by Number of Stock</DialogTitle>
        <DialogContent>
          <StockGuide></StockGuide>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} color="primary" autoFocus>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  maybeRenderGameOverDetails() {
    if (!this.props.ctx.gameover) {
      return;
    }

    const onClose = () => this.setState({ gameOverDetailsDismissed: true });

    const { declaredBy, finalMergers } = this.props.ctx.gameover;
    const declaredByName = this.props.gameArgs.players[declaredBy].name;

    return (
      <Dialog onClose={onClose} aria-labelledby="game-over-title" open={!this.state.gameOverDetailsDismissed}>
        <DialogTitle id="game-over-title">{this.winnerMessage()}</DialogTitle>
        <DialogContent>
          <DialogContentText id="game-over-description">
            <div>{declaredByName} has declared the game over.</div>
            <div>{this.renderFinalScores()}</div>
            <div className={css.MarginTopBottom}>
              <div>
                <b>Final payouts</b>
              </div>
              {finalMergers.map((merger) => this.renderMergerDetails(merger))}
            </div>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} color="primary" autoFocus>
            OK
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  render() {
    // console.log('rendering with props', this.props);
    // console.log('rendering with state', this.state);
    // console.log('activePlayers', this.props.ctx.activePlayers);
    return (
      <GameLayout allowWiderScreen={true} gameArgs={this.props.gameArgs}>
        <div className={`${css.Mergers} ${css.MergersContainer}`}>
          {this.renderPlayers()}
          {this.renderAvailableStocks()}
          {this.renderLastMove()}
          <HotelGrid
            hotels={this.props.G.hotels}
            lastPlacedHotel={this.props.G.lastPlacedHotel}
            playOrder={this.props.ctx.playOrder}
            activePlayers={this.props.ctx.activePlayers}
            playerID={this.props.playerID}
            onHotelClicked={this.props.moves.placeHotel}
          ></HotelGrid>
          {this.renderActions()}
          {this.renderPlayerStatus()}
          {this.maybeRenderMergerDetails()}
          {this.maybeRenderGameOverDetails()}
          {this.maybeRenderPriceCard()}
        </div>
      </GameLayout>
    );
  }
}
