import React from 'react';
import StarIcon from '@material-ui/icons/Star';
import ClearIcon from '@material-ui/icons/Clear';

import { Chain, Hotel } from '../types';
import css from './HotelGrid.css';

interface HotelGridProps {
  hotels: Hotel[][];
  lastPlacedHotel?: string;
  playOrder: string[];
  activePlayers: {};
  playerID: string;
  onHotelClicked: (id: string) => void;
}

interface HotelGridState {
  hoveredHotel?: string;
}

export class HotelGrid extends React.Component<HotelGridProps, HotelGridState> {
  constructor(props) {
    super(props);
    this.state = {};
  }

  hotelClass(hotel: Hotel) {
    if (hotel.hasBeenPlaced) {
      return hotel.chain ? css[hotel.chain] : css.Unclaimed;
    } else if (hotel.hasBeenRemoved) {
      return css.Removed;
    } else if (hotel.drawnByPlayer === this.props.playerID) {
      return css.InRack;
    } else {
      return css.Empty;
    }
  }

  renderHotel(chainTiles: {}, hotel: Hotel) {
    const isHovered = this.state.hoveredHotel === hotel.id;
    const playerIndex = this.props.playOrder.indexOf(this.props.playerID);
    const placingHotel = this.props.activePlayers && this.props.activePlayers[playerIndex] === 'placeHotelStage';
    const hoverClass = placingHotel && isHovered ? css.Hover : '';
    const isLastPlaced = this.props.lastPlacedHotel === hotel.id;
    const lastPlacedLabel = isLastPlaced ? <StarIcon></StarIcon> : '';
    const removedLabel = hotel.hasBeenRemoved ? <ClearIcon></ClearIcon> : '';
    return (
      <td key={hotel.id}>
        <div
          className={`${css.Hotel} ${this.hotelClass(hotel)} ${hoverClass}`}
          onClick={() => this.props.onHotelClicked(hotel.id)}
          onMouseEnter={() => this.setState({ hoveredHotel: hotel.id })}
          onMouseLeave={() => this.setState({ hoveredHotel: undefined })}
        >
          {lastPlacedLabel || removedLabel || chainTiles[hotel.id]}
        </div>
      </td>
    );
  }

  renderHotelRow(chainTiles: {}, row: Hotel[], i: number) {
    return (
      <tr key={`hotel-row-${i}`}>
        <td key={`row-header-${i}`}>
          <div className={css.GridLabel}>{['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'][i]}</div>
        </td>
        {row.map(this.renderHotel.bind(this, chainTiles))}
      </tr>
    );
  }

  renderColumnHeaders() {
    const headers = [];
    // empty header for the top left corner
    headers.push(<td key="header-corner" className={css.GridLabel}></td>);
    for (let i = 0; i < 12; i++) {
      headers.push(
        <td key={`header-${i + 1}`} className={css.GridLabel}>
          {i + 1}
        </td>,
      );
    }
    return <tr>{headers}</tr>;
  }

  render() {
    const chainTiles = {};
    for (const key of Object.keys(Chain)) {
      const chain = Chain[key];
      const firstHotel = this.props.hotels.flat().find((h) => h.chain === chain && h.id !== this.props.lastPlacedHotel);
      if (firstHotel) {
        chainTiles[firstHotel.id] = chain[0]; // first letter of chain
      }
    }
    return (
      <div className={css.HotelGrid}>
        <table>
          <tbody>
            {this.renderColumnHeaders()}
            {this.props.hotels.map(this.renderHotelRow.bind(this, chainTiles))}
          </tbody>
        </table>
      </div>
    );
  }
}
