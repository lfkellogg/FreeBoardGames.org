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
import { Chain, IG, Merger, Player, Score } from './types';
import { priceOfStockBySize, sizeOfChain } from './utils';
import { PlayerActions } from './components/PlayerActions';
import { MergerDetails } from './components/MergerDetails';
import { MergersDialog } from './components/MergersDialog';

export interface BoardProps {
  G: IG;
  ctx: Ctx;
  moves: any;
  playerID: string;
  gameArgs?: IGameArgs;
}

export interface BoardState {
  mergerDetailsDismissed: boolean;
  gameOverDetailsDismissed: boolean;
  showPriceCard: boolean;
}

// TODOs
// Must do:
//  - add instructions & image
//  - more test coverage of main board
//  - generate coverage report
//
// Nice to have:
//  - test what happens around unplayable tiles (e.g. if all tiles are unplayable)
//  - test drawHotels()
//  - animations
//  - sounds
//  - fix layout on small screens
//  - add validation to swap/sell stock
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

  playerID(): string {
    return this.props.playerID;
  }

  playerIndex(id: string = this.playerID()): number {
    return this.props.ctx.playOrder.indexOf(id);
  }

  playerState(id: string = this.playerID()): Player {
    return this.props.G.players[id];
  }

  playerName(id: string = this.playerID()): string {
    if (!this.props.gameArgs) {
      return `Player ${id}`;
    }
    return this.props.gameArgs.players[this.playerIndex(id)].name;
  }

  playerPhase(): string {
    return this.props.ctx.currentPlayer === this.playerID() && this.props.ctx.phase;
  }

  playerStage(): string {
    return this.props.ctx.activePlayers && this.props.ctx.activePlayers[this.playerIndex()];
  }

  winnerMessage(): string {
    const { winner, winners } = this.props.ctx.gameover;
    if (winner) {
      return `${this.playerName(winner)} wins!`;
    } else {
      return `${winners.map((id) => this.playerName(id)).join(' & ')} tied!`;
    }
  }

  gameOverMessage(): string | undefined {
    if (!this.props.ctx.gameover) {
      return;
    }

    const { scores } = this.props.ctx.gameover;
    const scoresMessage = scores.map((s) => `${this.playerName(s.id)}: $${s.money}`).join(', ');
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
    if (!this.props.gameArgs) {
      return null;
    }

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
          const elementId = `player-label-${player.playerID}`;
          return (
            <div id={elementId} key={elementId} className={`${css.Player} ${turnClass}`}>
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
    const elementId = `available-stock-${chain}`;
    return (
      <div id={elementId} key={elementId} className={css.AvailableStockAndPrice}>
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
      <div id="player-status" className={css.WrapRow}>
        <div className={css.MarginRight}>You have:</div>
        <span className={css.PlayerMoney}>${player.money}</span>
        {Object.keys(Chain).map((key) => this.renderStock(Chain[key], player.stocks[Chain[key]], true))}
      </div>
    );
  }

  renderLastMove() {
    let message: string;
    message = this.props.G.lastMove;
    for (const p of this.props.gameArgs?.players || []) {
      message = message.replace(new RegExp(`Player ${p.playerID}`, 'g'), p.name);
    }
    return (
      <div id="last-move" className={css.WrapRow}>
        <div className={css.MarginRight}>Last move:</div>
        <div>{message}</div>
      </div>
    );
  }

  onCloseMergerDetails() {
    this.setState({ mergerDetailsDismissed: true });
  }

  maybeRenderMergerDetails() {
    if (this.props.ctx.phase !== 'mergerPhase' || this.state.mergerDetailsDismissed) {
      return;
    }

    const { chainToMerge, survivingChain } = this.props.G.merger;

    return (
      <MergersDialog
        dialogId="merger-details-dialog"
        title={`${chainToMerge} is merging into ${survivingChain}!`}
        onClose={() => this.onCloseMergerDetails()}
        closeButtonText="OK"
      >
        <MergerDetails
          merger={this.props.G.merger}
          playOrder={this.props.ctx.playOrder}
          playerIdToNameFn={(id: string) => this.playerName(id)}
        />
      </MergersDialog>
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
    const renderScore = (score: Score) => (
      <p key={`score-${score.id}`}>
        {this.playerName(score.id)}: ${score.money}
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
    const mergerDetails = finalMergers.map((merger) => {
      return (
        <MergerDetails
          key={`final-merger-details-${merger.chainToMerge}`}
          merger={merger}
          playOrder={this.props.ctx.playOrder}
          playerIdToNameFn={(id) => this.playerName(id)}
        />
      );
    });

    return (
      <div className={css.MarginTopBottom}>
        <Typography variant="h6">Final payouts</Typography>
        {mergerDetails}
      </div>
    );
  }

  maybeRenderGameOverDetails() {
    if (!this.props.ctx.gameover) {
      return;
    }

    const onClose = () => this.setState({ gameOverDetailsDismissed: true });

    const { declaredBy, finalMergers } = this.props.ctx.gameover;

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
          <Typography variant="body1">{this.playerName(declaredBy)} has declared the game over.</Typography>
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
            isPlacingHotel={this.playerStage() === 'placeHotelStage'}
            playerID={this.props.playerID}
            onHotelClicked={this.props.moves.placeHotel}
          />
          <PlayerActions
            hotels={this.props.G.hotels}
            players={this.props.G.players}
            availableStocks={this.props.G.availableStocks}
            merger={this.props.G.merger}
            moves={this.props.moves}
            playerID={this.props.playerID}
            playerIndex={this.playerIndex()}
            playerPhase={this.playerPhase()}
            playerStage={this.playerStage()}
            gameOverMessage={this.gameOverMessage()}
          />
          {this.renderPlayerStatus()}
          {this.maybeRenderMergerDetails()}
          {this.maybeRenderGameOverDetails()}
          {this.maybeRenderPriceCard()}
        </div>
      </GameLayout>
    );
  }
}
