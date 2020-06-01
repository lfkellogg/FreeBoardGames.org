const Thumbnail = require('./media/thumbnail.png?lqip-colors');
import { GameMode } from 'gamesShared/definitions/mode';
import { IGameDef, IGameStatus } from 'gamesShared/definitions/game';
import instructions from './instructions.md';

export const mergersGameDef: IGameDef = {
  code: 'mergers',
  name: 'Mergers',
  imageURL: Thumbnail,
  modes: [{ mode: GameMode.LocalFriend }, { mode: GameMode.OnlineFriend }],
  minPlayers: 2, // TODO: implement 2 player mode
  maxPlayers: 6,
  description: 'Similar to Acquire',
  descriptionTag: `Build hotel chains and dominate the market!`,
  instructions: {
    videoId: 'AVoUPu5O1os',
    text: instructions,
  },
  status: IGameStatus.IN_DEVELOPMENT,
  config: () => import('./config'),
};

export default mergersGameDef;