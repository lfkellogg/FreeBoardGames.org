import { Chain } from './types';
import { isPermanentlyUnplayable } from './utils';

const UNMERGEABLE_SIZE_OF_ONE = 0;

describe('utils', () => {
  describe('isPermanentlyUnplayable', () => {
    it('returns true if it would merge two unmergeable chains', () => {
      const G = {
        hotels: [
          [
            { id: '1-A', hasBeenPlaced: true, chain: Chain.Tower },
            { id: '2-A' }, // playing this tile would merge 1-A and 3-A
            { id: '3-A', hasBeenPlaced: true, chain: Chain.Continental },
          ],
        ],
      };
      expect(isPermanentlyUnplayable(G, { id: '2-A' }, UNMERGEABLE_SIZE_OF_ONE)).toBe(true);
    });

    it('returns false if it would bring two new tiles into an unmergeable chain', () => {
      const G = {
        hotels: [
          [
            { id: '1-A', hasBeenPlaced: true, chain: Chain.Tower },
            { id: '2-A' }, // playing this tile would add it, and 3-A, to Tower
            { id: '3-A', hasBeenPlaced: true },
          ],
        ],
      };
      expect(isPermanentlyUnplayable(G, { id: '2-A' }, UNMERGEABLE_SIZE_OF_ONE)).toBe(false);
    });

    it('returns false if it touches two of the same unmergeable chain, plus one', () => {
      const G = {
        hotels: [
          [
            { id: '1-A', hasBeenPlaced: true, chain: Chain.Tower },
            { id: '2-A' }, // playing this tile would add it, and 2-B, to Tower
            { id: '3-A', hasBeenPlaced: true, chain: Chain.Tower },
          ],
          [{ id: '1-B' }, { id: '2-B', hasBeenPlaced: true }, { id: '3-B' }],
        ],
      };
      expect(isPermanentlyUnplayable(G, { id: '2-A' }, UNMERGEABLE_SIZE_OF_ONE)).toBe(false);
    });
  });
});
