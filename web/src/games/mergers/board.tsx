import * as React from 'react';
import Typography from '@material-ui/core/Typography/Typography';
import { IGameArgs } from 'gamesShared/definitions/game';
import { GameLayout } from 'gamesShared/components/fbg/GameLayout';
import { Ctx } from 'boardgame.io';

import css from './Board.module.css';
import { HotelGrid } from './components/HotelGrid';
import { IG, Merger, Move, Score } from './types';
import { PlayerActions } from './components/PlayerActions';
import { MergerDetails } from './components/MergerDetails';
import { MergersDialog } from './components/MergersDialog';
import { Hotels } from './hotels';
import { MergersSound, playSound, repeatSound } from './sound';
import { MergersGameStatus } from './components/MergersGameStatus';
import { createMuiTheme, ThemeProvider } from '@material-ui/core';
import { IOptionsItems } from 'gamesShared/components/fbg/GameDarkSublayout';

export interface BoardProps {
  G: IG;
  ctx: Ctx;
  moves: any;
  playerID: string;
  gameArgs?: IGameArgs;
}

export interface BoardState {
  openingDrawSoundPlayed: boolean;
  mergerDetailsDismissed: boolean;
  gameOverDetailsDismissed: boolean;
  soundEnabled: boolean;
}

// TODOs:
//  - animations
//  - add validation to swap/sell stock
//  - highlight players with stock during a merger
//  - countdown at the end
export class Board extends React.Component<BoardProps, BoardState> {
  constructor(props) {
    super(props);
    this.state = {
      openingDrawSoundPlayed: false,
      mergerDetailsDismissed: false,
      gameOverDetailsDismissed: false,
      soundEnabled: true,
    };
  }

  componentDidMount() {
    // When mounting, if the opening draw just happened (which it normally will), then force the
    // sound to play
    if (this.props.G.lastMove?.move === Move.OpeningDraw && !this.state.openingDrawSoundPlayed) {
      this.setState({ openingDrawSoundPlayed: true });
      this.playSounds(this.props, true);
    }
  }

  componentDidUpdate(prevProps) {
    if (this.props.G.merger?.chainToMerge !== prevProps.G.merger?.chainToMerge) {
      // reset the merger dialog dismissed state
      this.setState({ mergerDetailsDismissed: false });
    }
    this.playSounds(prevProps);
  }

  getOptionsMenuItems(): IOptionsItems[] {
    return [
      {
        onClick: () => this.setState((state) => ({ soundEnabled: !state.soundEnabled })),
        text: `${this.state.soundEnabled ? 'Disable' : 'Enable'} sound`,
      },
    ];
  }

  playSounds(prevProps: BoardProps, forceMoveSound?: boolean): void {
    if (!this.state.soundEnabled) {
      return;
    }

    // new merger sound
    const chainToMerge = this.props.G.merger?.chainToMerge;
    const prevChainToMerge = prevProps.G.merger?.chainToMerge;
    if (!!chainToMerge && chainToMerge !== prevChainToMerge) {
      playSound(MergersSound.Tada);
      return;
    }

    // game over sound
    const gameOver = this.props.ctx.gameover;
    const prevGameOver = prevProps.ctx.gameover;
    if (!!gameOver && !prevGameOver) {
      playSound(MergersSound.Tada);
      return;
    }

    // your turn sound
    const currentPlayer = this.props.ctx.currentPlayer;
    const prevCurrentPlayer = prevProps.ctx.currentPlayer;
    const yourTurn = currentPlayer === this.props.playerID;
    const playerChanged = currentPlayer !== prevCurrentPlayer;
    if (!!yourTurn && playerChanged) {
      playSound(MergersSound.Chime);
    }

    // moves
    const lastMove = this.props.G.lastMove?.move;
    const prevLastMove = prevProps.G.lastMove?.move;
    const moveChanged = lastMove !== prevLastMove;
    if (!!lastMove && (moveChanged || playerChanged || forceMoveSound)) {
      switch (lastMove) {
        case Move.PlaceHotel:
        case Move.ChooseNewChain:
          playSound(MergersSound.Click);
          return;
        case Move.BuyStock:
        case Move.ExchangeStock:
          playSound(MergersSound.Card);
          return;
        case Move.OpeningDraw:
          const numPlayers = this.props.gameArgs?.players?.length || 0;
          repeatSound(MergersSound.Click, numPlayers);
          return;
        case Move.DrawHotels:
          playSound(MergersSound.Tiles);
          return;
        case Move.PlaceNoHotel:
        case Move.BuyNoStock:
        case Move.ExchangeNoStock:
          playSound(MergersSound.Whoosh);
          return;
        default:
          break;
      }
    }
  }

  playerID(): string {
    return this.props.playerID;
  }

  playerIndex(id: string = this.playerID()): number {
    return this.props.ctx.playOrder.indexOf(id);
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

  maybeRenderMergerDetails() {
    if (this.props.ctx.phase !== 'mergerPhase' || this.state.mergerDetailsDismissed) {
      return;
    }

    const { chainToMerge, survivingChain } = this.props.G.merger;

    return (
      <MergersDialog
        dialogId="merger-details-dialog"
        title={`${chainToMerge} is merging into ${survivingChain}!`}
        onClose={() => this.setState({ mergerDetailsDismissed: true })}
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

  maybeRenderGameOverDetails() {
    if (!this.props.ctx.gameover || this.state.gameOverDetailsDismissed) {
      return;
    }

    return (
      <MergersDialog
        dialogId="game-over-dialog"
        title={this.winnerMessage()}
        onClose={() => this.setState({ gameOverDetailsDismissed: true })}
        closeButtonText="OK"
      >
        <Typography variant="body1">
          {this.playerName(this.props.ctx.gameover.declaredBy)} has declared the game over.
        </Typography>
        {this.renderFinalScores()}
        {this.renderFinalPayouts(this.props.ctx.gameover.finalMergers)}
      </MergersDialog>
    );
  }

  render() {
    const hotels = new Hotels(this.props.G.hotels);
    return (
      <GameLayout
        optionsMenuItems={() => this.getOptionsMenuItems()}
        allowWiderScreen={true}
        gameArgs={this.props.gameArgs}
      >
        <ThemeProvider theme={createMuiTheme({ palette: { type: 'dark' } })}>
          <MergersGameStatus
            hotels={hotels}
            player={this.props.G.players[this.playerID()]}
            availableStocks={this.props.G.availableStocks}
            lastMove={this.props.G.lastMove}
            currentPlayer={!this.props.ctx.gameover && this.props.ctx.currentPlayer}
            players={this.props.gameArgs?.players}
          >
            <HotelGrid
              hotels={hotels}
              lastPlacedHotel={this.props.G.lastPlacedHotel}
              isPlacingHotel={this.playerStage() === 'placeHotelStage'}
              playerID={this.props.playerID}
              onHotelClicked={this.props.moves.placeHotel}
            />
            <PlayerActions
              hotels={hotels}
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
          </MergersGameStatus>
          {this.maybeRenderMergerDetails()}
          {this.maybeRenderGameOverDetails()}
        </ThemeProvider>
      </GameLayout>
    );
  }
}
