import * as React from 'react';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import Typography from '@material-ui/core/Typography/Typography';
import { IGameArgs } from 'gamesShared/definitions/game';
import { GameLayout } from 'gamesShared/components/fbg/GameLayout';
import { Ctx } from 'boardgame.io';

import css from './Board.css';
import { HotelGrid } from './components/HotelGrid';
import { StockLabel } from './components/StockLabel';
import { StockGuide } from './components/StockGuide';
import { Chain, IG, Merger, Score } from './types';
import { priceOfStockBySize, sizeOfChain } from './utils';
import { PlayerActions } from './components/PlayerActions';

interface BoardProps {
  G: IG;
  ctx: Ctx;
  moves: any;
  playerID: string;
  gameArgs?: IGameArgs;
}

interface BoardState {
  mergerDetailsDismissed: boolean;
  gameOverDetailsDismissed: boolean;
  showPriceCard: boolean;
}

// TODO:
//  - refactor out utils methods to only require specific input from G, ctx
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

  winnerMessage() {
    const { winner, winners } = this.props.ctx.gameover;
    if (winner) {
      return `${this.props.gameArgs.players[winner].name} wins!`;
    } else {
      return `${winners.map((id) => this.props.gameArgs.players[id].name).join(' & ')} tied!`;
    }
  }

  gameOverMessage(): string | undefined {
    if (!this.props.ctx.gameover) {
      return;
    }

    const { scores } = this.props.ctx.gameover;
    const { players } = this.props.gameArgs;
    const scoresMessage = scores.map((s) => `${players[s.id].name}: $${s.money}`).join(', ');
    return `${this.winnerMessage()} Scores: ${scoresMessage}`;
  }

  renderStock(chain: Chain, count: number, hideEmpty?: boolean) {
    const hiddenClass = hideEmpty && count === 0 ? css.HiddenStock : '';
    return (
      <div key={`stock-count-${chain}`} className={`${css.PlayerStock} ${hiddenClass}`}>
        <StockLabel chain={chain}></StockLabel>
        <div className={css.PlayerStockCount}>{`/${count}`}</div>
      </div>
    );
  }

  renderPlayers() {
    return (
      <div className={css.WrapRow}>
        <div className={css.MarginRight}>Current turn:</div>
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
        <div className={css.MarginRight}>Available stocks:</div>
        {Object.keys(Chain).map((key) => this.renderAvailableStock(Chain[key]))}
      </div>
    );
  }

  renderPlayerStatus() {
    const player = this.playerState();
    return (
      <div className={css.WrapRow}>
        <div className={css.MarginRight}>You have:</div>
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
        <div className={css.MarginRight}>Last move:</div>
        <div>{message}</div>
      </div>
    );
  }

  renderMergerDetails(merger: Merger) {
    const { bonuses, chainToMerge, stockCounts } = merger;
    const chainSize = sizeOfChain(chainToMerge, this.props.G.hotels);

    const renderStockCount = (player) => {
      const name = this.props.gameArgs.players[player.id].name;
      return (
        <p className={css.MarginLeft} key={`count-${chainToMerge}-${player.id}`}>
          {name} has {stockCounts[player.id]}
        </p>
      );
    };

    const renderBonus = (playerID) => {
      const name = this.props.gameArgs.players[playerID].name;
      const bonus = bonuses[playerID];
      return (
        <p className={css.MarginLeft} key={`bonus-${chainToMerge}-${playerID}`}>
          {name} gets ${bonus}
        </p>
      );
    };

    return (
      <Typography component="div" variant="body1" className={css.MarginBottom} key={`merger-${chainToMerge}`}>
        <p>The following players have {chainToMerge} stock:</p>
        {Object.values(this.props.G.players)
          .filter((p) => !!stockCounts[p.id])
          .sort((a, b) => stockCounts[b.id] - stockCounts[a.id])
          .map(renderStockCount)}
        <p>With {chainSize} hotels, the bonuses are:</p>
        {Object.keys(bonuses)
          .sort((a, b) => bonuses[b] - bonuses[a])
          .map(renderBonus)}
      </Typography>
    );
  }

  maybeRenderMergerDetails() {
    if (this.props.ctx.phase !== 'mergerPhase') {
      return;
    }

    const { chainToMerge, survivingChain } = this.props.G.merger;

    const onClose = () => this.setState({ mergerDetailsDismissed: true });

    return (
      <Dialog
        className={css.Mergers}
        onClose={onClose}
        aria-labelledby="merger-dialog-title"
        open={!this.state.mergerDetailsDismissed}
      >
        <DialogTitle id="merger-dialog-title">
          {chainToMerge} is merging into {survivingChain}!
        </DialogTitle>
        <DialogContent>{this.renderMergerDetails(this.props.G.merger)}</DialogContent>
        <DialogActions>
          <Button onClick={onClose} color="primary" autoFocus>
            OK
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  maybeRenderPriceCard() {
    const onClose = () => this.setState({ showPriceCard: false });

    return (
      <Dialog
        className={css.Mergers}
        onClose={onClose}
        aria-labelledby="merger-dialog-title"
        open={this.state.showPriceCard}
      >
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

  renderFinalScores() {
    const { scores } = this.props.ctx.gameover;
    const { players } = this.props.gameArgs;
    const renderScore = (score: Score) => (
      <p key={`score-${score.id}`}>
        {players[score.id].name}: ${score.money}
      </p>
    );
    return (
      <div className={css.MarginTopBottom}>
        <Typography variant="h6">Scores</Typography>
        <Typography variant="body1" component="div">
          {scores.map(renderScore)}
        </Typography>
      </div>
    );
  }

  renderFinalPayouts(finalMergers: Merger[]) {
    return (
      <div className={css.MarginTopBottom}>
        <Typography variant="h6">Final payouts</Typography>
        {finalMergers.map((merger) => this.renderMergerDetails(merger))}
      </div>
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
      <Dialog
        className={css.Mergers}
        onClose={onClose}
        aria-labelledby="game-over-title"
        open={!this.state.gameOverDetailsDismissed}
      >
        <DialogTitle disableTypography id="game-over-title">
          <Typography variant="h4">{this.winnerMessage()}</Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1">{declaredByName} has declared the game over.</Typography>
          {this.renderFinalScores()}
          {this.renderFinalPayouts(finalMergers)}
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
          <PlayerActions
            G={this.props.G}
            ctx={this.props.ctx}
            gameArgs={this.props.gameArgs}
            moves={this.props.moves}
            playerID={this.props.playerID}
            gameOverMessage={this.gameOverMessage()}
          ></PlayerActions>
          {this.renderPlayerStatus()}
          {this.maybeRenderMergerDetails()}
          {this.maybeRenderGameOverDetails()}
          {this.maybeRenderPriceCard()}
        </div>
      </GameLayout>
    );
  }
}
