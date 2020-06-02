import * as React from 'react';
import { IGameArgs } from '../../components/App/Game/GameBoardWrapper';
import { GameLayout } from '../../components/App/Game/GameLayout';
import { Ctx } from 'boardgame.io';
import { Hotel, IG } from './types';

interface IBoardProps {
  G: IG;
  ctx: Ctx;
  moves: any;
  playerID: string;
  gameArgs?: IGameArgs;
}

export class Board extends React.Component<IBoardProps, {}> {
  constructor(props) {
    super(props);
    this.renderHotel = this.renderHotel.bind(this);
    this.renderHotelRow = this.renderHotelRow.bind(this);
    this.renderHotels = this.renderHotels.bind(this);
  }
  renderHotel(hotel: Hotel) {
    const style = {
      backgroundColor: hotel.hasBeenPlaced ? 'green' : hotel.drawnByPlayer === this.props.ctx.currentPlayer ? 'yellow' : 'white',
      color: 'black',
    };
    return (
      <td
        key={hotel.id}
        style={style}
        onClick={() => this.props.moves.placeHotel(hotel.id)}
      >
        {hotel.id}
      </td>
    );
  }
  renderHotelRow(row: Hotel[], i: number) {
    return (
      <tr key={`hotel-row-${i}`}>
        {row.map(this.renderHotel)}
      </tr>
    );
  }
  renderHotels() {
    return (
      <table>
        <tbody>
          {this.props.G.hotels.map(this.renderHotelRow)}
        </tbody>
      </table>
    );
  }
  render() {
    console.log('rendering with props', this.props);
    console.log('activePlayers', this.props.ctx.activePlayers);
    return (
      <GameLayout
        gameArgs={this.props.gameArgs}>
        { this.renderHotels() }
      </GameLayout>
    );
  }
}