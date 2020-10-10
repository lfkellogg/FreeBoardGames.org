import * as React from 'react';
import Button from '@material-ui/core/Button';
import DialogTitle from '@material-ui/core/DialogTitle';
import Dialog from '@material-ui/core/Dialog';
import TextField from '@material-ui/core/TextField';
import StarIcon from '@material-ui/icons/Star';
import { IGameArgs } from 'gamesShared/definitions/game';
import { GameLayout } from 'gamesShared/components/fbg/GameLayout';
import { Ctx } from 'boardgame.io';
import { Chain, Hotel, IG } from './types';
import { fillStockMap, isUnplayable, majorityBonus, minorityBonus, priceOfStock, sizeOfChain } from './utils';
import css from './Board.css';
import { DialogActions, DialogContent, DialogContentText } from '@material-ui/core';

interface IBoardProps {
  G: IG;
  ctx: Ctx;
  moves: any;
  playerID: string;
  gameArgs?: IGameArgs;
}

interface IBoardState {
  stocksToBuy: Record<Chain, string>;
  mergerDetailsDismissed: boolean;
  stocksToSwap?: number;
  stocksToSell?: number;
  hoveredHotel?: string;
}

// TODO:
//  - show card w/ prices and bonuses
//  - animations
//  - fix layout on small screens
//  - add validation to swap/sell stock
export class Board extends React.Component<IBoardProps, IBoardState> {
  constructor(props) {
    super(props);
    this.renderHotel = this.renderHotel.bind(this);
    this.renderHotelRow = this.renderHotelRow.bind(this);
    this.renderHotelInRack = this.renderHotelInRack.bind(this);
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
    };
  }

  componentDidUpdate(prevProps) {
    if (this.props.G.chainToMerge !== prevProps.G.chainToMerge) {
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

  getClassName(hotel: Hotel) {
    if (!hotel.hasBeenPlaced) {
      return hotel.drawnByPlayer === this.playerID() ? css.InRack : css.Empty;
    }

    if (!hotel.chain) {
      return css.Unclaimed;
    }

    return css[hotel.chain];
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

  renderHotel(chainTiles: {}, hotel: Hotel) {
    const isHovered = this.state.hoveredHotel === hotel.id;
    const placingHotel =
      this.props.ctx.activePlayers && this.props.ctx.activePlayers[this.playerIndex()] === 'placeHotelStage';
    const hoverClass = placingHotel && isHovered ? css.Hover : '';
    const isLastPlaced = this.props.G.lastPlacedHotel === hotel.id;
    const lastPlacedLabel = isLastPlaced ? <StarIcon style={{ fontSize: '1.25em' }}></StarIcon> : '';
    return (
      <td key={hotel.id}>
        <div
          className={`${css.Hotel} ${this.getClassName(hotel)} ${hoverClass}`}
          onClick={() => this.props.moves.placeHotel(hotel.id)}
          onMouseEnter={() => this.setState({ hoveredHotel: hotel.id })}
          onMouseLeave={() => this.setState({ hoveredHotel: undefined })}
        >
          <div className={css.LabelContainer}>{lastPlacedLabel || chainTiles[hotel.id]}</div>
        </div>
      </td>
    );
  }

  renderHotelRow(chainTiles: {}, row: Hotel[], i: number) {
    return (
      <tr key={`hotel-row-${i}`} className={css.HotelRow}>
        <td key={`row-header-${i}`}>
          <div className={css.Label}>{['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'][i]}</div>
        </td>
        {row.map(this.renderHotel.bind(this, chainTiles))}
      </tr>
    );
  }

  renderColumnHeaders() {
    const headers = [];
    // empty header for the top left corner
    headers.push(<td key="header-corner" className={css.Label}></td>);
    for (let i = 0; i < 12; i++) {
      headers.push(
        <td key={`header-${i + 1}`} className={css.Label}>
          {i + 1}
        </td>,
      );
    }
    return <tr>{headers}</tr>;
  }

  renderBoard() {
    const chainTiles = {};
    for (const key of Object.keys(Chain)) {
      const chain = Chain[key];
      const firstHotel = this.props.G.hotels
        .flat()
        .find((h) => h.chain === chain && h.id !== this.props.G.lastPlacedHotel);
      if (firstHotel) {
        chainTiles[firstHotel.id] = chain[0]; // first letter of chain
      }
    }
    return (
      <div className={css.Board}>
        <table>
          <tbody>
            {this.renderColumnHeaders()}
            {this.props.G.hotels.map(this.renderHotelRow.bind(this, chainTiles))}
          </tbody>
        </table>
      </div>
    );
  }

  renderHotelInRack(hotel: Hotel) {
    const hoverClass = this.state.hoveredHotel === hotel.id ? css.Hover : '';
    return (
      <div key={`hotel-in-rack-${hotel.id}`} className={`${css.InRackWrapper} ${hoverClass}`}>
        <div
          className={`${css.Hotel} ${this.getClassName(hotel)} ${hoverClass}`}
          onClick={() => this.props.moves.placeHotel(hotel.id)}
          onMouseEnter={() => this.setState({ hoveredHotel: hotel.id })}
          onMouseLeave={() => this.setState({ hoveredHotel: undefined })}
        >
          {hotel.id}
        </div>
      </div>
    );
  }

  renderStockLabel(chain: Chain, onClick?: () => void) {
    return (
      <div
        key={`stock-label-${chain}`}
        className={`${css.Hotel} ${css[chain]} ${css.PlayerStockLabel} ${onClick ? css.Clickable : ''}`}
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
          if (this.props.ctx.currentPlayer === `${player.playerID}`) {
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
      </div>
    );
  }

  renderAvailableStock(chain: Chain) {
    const stockPrice = priceOfStock(chain, this.props.G.hotels);
    return (
      <div key={`available-stock-${chain}`} className={css.AvailableStockAndPrice}>
        {this.renderStock(chain, this.props.G.availableStocks[chain])}
        {stockPrice === undefined ? '--' : `$${stockPrice}`}
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
    const chainSizes = this.props.G.mergingChains.map((c) => ({ chain: c, size: sizeOfChain(c, this.props.G.hotels) }));
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
        <div className={css.RowLabel}>{`Do you want to exchange any ${this.props.G.chainToMerge} stock?`}</div>
        <div className={css.SwapSellEntry}>
          <div className={css.SwapSellLabel}>Swap</div>
          <TextField
            className={css.BuyStockInput}
            placeholder="#"
            value={this.state.stocksToSwap || ''}
            onChange={(e) => {
              let n = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
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
              let n = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
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

  renderActions() {
    let content;
    if (this.props.ctx.gameover) {
      const { winner, winners, scores } = this.props.ctx.gameover;
      let message: string;
      if (winner) {
        message = `${this.props.gameArgs.players[winner].name} wins! `;
      } else {
        message = `${winners.map((id) => this.props.gameArgs.players[id].name).join(' & ')} tied! `;
      }
      message += `Scores: ${scores.map((s) => `${this.props.gameArgs.players[s.id].name} - $${s.money}`).join(', ')}`;
      content = <div>{message}</div>;
    } else if (this.props.ctx.phase === 'buildingPhase') {
      const stage = this.props.ctx.activePlayers[this.playerIndex()];
      //console.log('stage: ', stage);
      switch (stage) {
        case 'placeHotelStage':
          const hasPlayableHotel = !!this.playerState().hotels.find((h) => !isUnplayable(this.props.G, h));
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

  maybeRenderMergerDetails() {
    if (this.props.ctx.phase !== 'mergerPhase') {
      return;
    }

    const { chainToMerge, survivingChain } = this.props.G;

    const onClose = () => this.setState({ mergerDetailsDismissed: true });

    const renderStockCount = (player) => {
      const name = this.props.gameArgs.players[player.id].name;
      return (
        <div>
          {name} has {player.stocks[chainToMerge]}
        </div>
      );
    };

    return (
      <Dialog onClose={onClose} aria-labelledby="merger-dialog-title" open={!this.state.mergerDetailsDismissed}>
        <DialogTitle id="merger-dialog-title">
          {chainToMerge} is merging into {survivingChain}!
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="merger-dialog-description">
            <div>The following players have {chainToMerge} stock:</div>
            {Object.values(this.props.G.players)
              .filter((p) => !!p.stocks[chainToMerge])
              .sort((a, b) => b.stocks[chainToMerge] - a.stocks[chainToMerge])
              .map(renderStockCount)}
            <div>Majority bonus: ${majorityBonus(this.props.G, chainToMerge)}</div>
            <div>Minority bonus: ${minorityBonus(this.props.G, chainToMerge)}</div>
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
        <div className={css.MergersLayout}>
          {this.renderPlayers()}
          {this.renderAvailableStocks()}
          {this.renderLastMove()}
          {this.renderBoard()}
          {this.renderActions()}
          {this.renderPlayerStatus()}
          {this.maybeRenderMergerDetails()}
        </div>
      </GameLayout>
    );
  }
}