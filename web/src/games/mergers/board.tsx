import * as React from 'react';
import { IGameArgs } from '../../components/App/Game/GameBoardWrapper';
import { GameLayout } from '../../components/App/Game/GameLayout';
import { Ctx } from 'boardgame.io';
import { Chain, Hotel, IG } from './types';
import css from './Board.css';

interface IBoardProps {
  G: IG;
  ctx: Ctx;
  moves: any;
  playerID: string;
  gameArgs?: IGameArgs;
}

interface IBoardState {
  hoveredHotel?: string;
}

export class Board extends React.Component<IBoardProps, IBoardState> {
  constructor(props) {
    super(props);
    this.renderHotel = this.renderHotel.bind(this);
    this.renderHotelRow = this.renderHotelRow.bind(this);
    this.renderBoard = this.renderBoard.bind(this);
    this.renderHotelInRack = this.renderHotelInRack.bind(this);
    this.state = {};
  }
  getClassName(hotel: Hotel) {
    if (!hotel.hasBeenPlaced) {
      return hotel.drawnByPlayer === this.props.ctx.currentPlayer ? css.InRack : css.Empty;
    }

    if (!hotel.chain) {
      return css.Unclaimed;
    }

    return css[hotel.chain];
  }
  renderHotel(chainTiles: {}, hotel: Hotel, i: number) {
    const hoverClass = this.state.hoveredHotel === hotel.id ? css.Hover : '';
    return (
      <td key={hotel.id}>
        <div
          className={`${css.Hotel} ${this.getClassName(hotel)} ${hoverClass}`}
          onClick={() => this.props.moves.placeHotel(hotel.id)}
          onMouseEnter={() => this.setState({ hoveredHotel: hotel.id })}
          onMouseLeave={() => this.setState({ hoveredHotel: undefined })}
        >
          <div className={`${css.LabelContainer}`}>
            {chainTiles[hotel.id]}
          </div>
        </div>
      </td>
    );
  }
  renderHotelRow(chainTiles: {}, row: Hotel[], i: number) {
    return (
      <tr key={`hotel-row-${i}`}>
        <td key={`row-header-${i}`}>
          <div className={css.Label}>
            {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'][i]}
          </div>
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
      headers.push(<td key={`header-${i+1}`}className={css.Label}>{i + 1}</td>);
    }
    return <tr>{headers}</tr>;
  }
  renderBoard() {
    const chainTiles = {};
    Object.keys(Chain).forEach(key => {
      const chain = Chain[key];
      const firstHotel = this.props.G.hotels.flat().find(h => h.chain === chain);
      if (firstHotel) {
        chainTiles[firstHotel.id] = chain[0]; // first letter of chain
      }
    });
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
      <div
        key={`hotel-in-rack-${hotel.id}`}
        className={`${css.InRackWrapper} ${hoverClass}`}>
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
  renderStock(chain: Chain, count: number) {
    return (
      <div key={`stock-count-${chain}`} className={css.PlayerStock}>
        <div className={`${css.Hotel} ${css[chain]} ${css.PlayerStockLabel}`}>{chain[0]}</div>
        <div className={css.PlayerStockCount}>{`= ${count}`}</div>
      </div>
    );
  }
  renderPlayerStatus() {
    // TODO: will this be set in multiplayer mode?
    console.log('playerID', this.props.playerID);
    const playerID = '0'; // this.props.playerID;
    const player = this.props.G.players[playerID];
    return (
      <div className={css.PlayerStatus}>
        <div className={css.Rack}>
          {player.hotels.map(this.renderHotelInRack)}
        </div>
        <div className={css.PlayerStocks}>
          <div>Your stocks:</div>
          {
            Object.keys(player.stocks)
              .filter(key => player.stocks[key] > 0)
              .map(key => this.renderStock(Chain[key], player.stocks[Chain[key]]))
          }
        </div>
        <div className={css.PlayerMoney}>
          Your money: ${player.money}
        </div>
      </div>
    );
  }
  render() {
    console.log('rendering with props', this.props);
    console.log('rendering with state', this.state);
    console.log('activePlayers', this.props.ctx.activePlayers);
    return (
      <GameLayout
        allowWiderScreen={true}
        gameArgs={this.props.gameArgs}>
        <div className={css.MergersLayout}>
          { this.renderBoard() }
          { this.renderPlayerStatus() }
        </div>
      </GameLayout>
    );
  }
}