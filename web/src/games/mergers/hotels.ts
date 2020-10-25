import { Chain, Hotel } from './types';

const ROW_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
const DEFAULT_NUM_ROWS = ROW_LETTERS.length;
const DEFAULT_NUM_COLUMNS = 9;

export default class Hotels {
  hotels: Hotel[][];

  constructor(hotels: Hotel[][]) {
    this.hotels = hotels;
  }

  static buildGrid(rows: number = DEFAULT_NUM_ROWS, columns: number = DEFAULT_NUM_COLUMNS): Hotel[][] {
    if (rows > DEFAULT_NUM_ROWS) {
      throw new Error(`Cannot build hotel grid with more than ${DEFAULT_NUM_ROWS} rows`);
    }

    const hotels: Hotel[][] = [];
    for (let r = 0; r < rows; r++) {
      hotels.push([]);
      for (let c = 0; c < columns; c++) {
        hotels[r].push({
          id: `${c + 1}-${ROW_LETTERS[r]}`,
          hasBeenPlaced: false,
        });
      }
    }
    return hotels;
  }

  hotelGrid(): Hotel[][] {
    return this.hotels;
  }

  allHotels(): Hotel[] {
    return this.hotels.flat();
  }

  topLeftMostHotel(): Hotel {
    // relies on initial sort order
    const list = this.allHotels();
    list.sort((a, b) => this.getColumn(a) - this.getColumn(b));
    list.sort((a, b) => this.getRow(a) - this.getRow(b));
    return list.find((h) => h.hasBeenPlaced);
  }

  isHotel(hotel: Hotel | string): hotel is Hotel {
    if ((hotel as Hotel).id) {
      return true;
    }
    return false;
  }

  getRow(hotel: Hotel | string): number {
    const id: string = this.isHotel(hotel) ? hotel.id : hotel;
    return ROW_LETTERS.indexOf(id.split('-')[1]);
  }

  getColumn(hotel: Hotel | string): number {
    const id: string = this.isHotel(hotel) ? hotel.id : hotel;
    return Number(id.split('-')[0]) - 1; // -1 because columns are 0-based
  }

  getHotel(id: string): Hotel {
    return this.hotels[this.getRow(id)][this.getColumn(id)];
  }

  mergeHotel(id: string, hotel: Hotel) {
    Object.assign(this.hotels[this.getRow(id)][this.getColumn(id)], hotel);
  }

  adjacentHotels(hotel: Hotel): Hotel[] {
    const r = this.getRow(hotel);
    const c = this.getColumn(hotel);
    return this.hotels
      .flat()
      .filter((h) => h.hasBeenPlaced)
      .filter((h) => {
        const upOrDown = Math.abs(this.getRow(h) - r) === 1 && this.getColumn(h) === c;
        const leftOrRight = Math.abs(this.getColumn(h) - c) === 1 && this.getRow(h) === r;
        return upOrDown || leftOrRight;
      });
  }

  playerHotels(playerID: string) {
    return this.hotels.flat().filter((h) => {
      return h.drawnByPlayer === playerID && !h.hasBeenPlaced && !h.hasBeenRemoved;
    });
  }

  sizeOfChain(chain: Chain): number {
    return this.hotels.flat().filter((h) => h.chain === chain).length;
  }

  priceOfStock(chain: Chain): number | undefined {
    return this.priceOfStockBySize(chain, this.sizeOfChain(chain));
  }

  priceOfStockBySize(chain: Chain, size: number): number | undefined {
    if (size === 0) {
      return undefined;
    }

    let basePrice: number;
    if (size < 6) {
      basePrice = size * 100;
    } else if (size < 11) {
      basePrice = 600;
    } else if (size < 21) {
      basePrice = 700;
    } else if (size < 31) {
      basePrice = 800;
    } else if (size < 41) {
      basePrice = 900;
    } else {
      basePrice = 1000;
    }

    if ([Chain.Worldwide, Chain.American, Chain.Festival].includes(chain)) {
      return basePrice + 100;
    } else if ([Chain.Continental, Chain.Imperial].includes(chain)) {
      return basePrice + 200;
    } else {
      return basePrice;
    }
  }

  majorityBonus(chain: Chain): number {
    return this.priceOfStock(chain) * 10;
  }

  minorityBonus(chain: Chain): number {
    return this.priceOfStock(chain) * 5;
  }

  isUnplayable(hotel: Hotel) {
    if (hotel.hasBeenPlaced) {
      return false;
    }

    return this.isPermanentlyUnplayable(hotel) || this.isTemporarilyUnplayable(hotel);
  }

  // a hotel is unplayable if it would merge two unmergeable chains
  isPermanentlyUnplayable(hotel: Hotel, maxMergeableSize: number = 10) {
    const adjacentChains = new Set(
      this.adjacentHotels(hotel)
        .map((h) => h.chain)
        .filter((c) => !!c),
    );
    const unmergeableChains = Array.from(adjacentChains).filter((c) => {
      return this.sizeOfChain(c) > maxMergeableSize;
    });
    return unmergeableChains.length > 1;
  }

  // a hotel is unplayable if it would form a new chain, but they are all on the board
  isTemporarilyUnplayable(hotel: Hotel) {
    const chainsOnBoard: Chain[] = Object.keys(Chain)
      .map((key) => Chain[key])
      .filter((chain) => !!this.hotels.flat().find((h) => h.chain === chain));
    if (chainsOnBoard.length === 7) {
      const adjacent = this.adjacentHotels(hotel);
      return adjacent.length > 0 && adjacent.filter((h) => !!h.chain).length === 0;
    }
    return false;
  }
}
