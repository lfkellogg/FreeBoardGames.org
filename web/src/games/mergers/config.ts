import { IGameConfig } from '../index';
import { MergersGame } from './game';
import { Board } from './board';

const config: IGameConfig = {
  bgioGame: MergersGame,
  bgioBoard: Board,
  debug: true,
};

export default config;