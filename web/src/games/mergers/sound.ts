import CardSound from './media/card.mp3';
import ChimeSound from './media/chime.mp3';
import ClickSound from './media/click.mp3';
import TadaSound from './media/tada.mp3';
import TilesSound from './media/tiles.mp3';
import WhooshSound from './media/whoosh.mp3';

let sounds: Partial<Record<MergersSound, HTMLAudioElement>>;
sounds = {};

export enum MergersSound {
  Card,
  Chime,
  Click,
  Tada,
  Tiles,
  Whoosh,
}

const SoundMapping = {
  [MergersSound.Card]: CardSound,
  [MergersSound.Chime]: ChimeSound,
  [MergersSound.Click]: ClickSound,
  [MergersSound.Tada]: TadaSound,
  [MergersSound.Tiles]: TilesSound,
  [MergersSound.Whoosh]: WhooshSound,
};

const getSound = (soundType: MergersSound) => {
  if (!(soundType in SoundMapping)) {
    return undefined;
  }

  if (!(soundType in sounds)) {
    sounds[soundType] = new Audio(SoundMapping[soundType]);
  }

  return sounds[soundType];
};

export const playSound = (soundType: MergersSound) => {
  const sound = getSound(soundType);
  if (!sound) {
    return;
  }

  // TODO: this doesn't work on Safari - sounds need to be triggered by user interaction
  sound.play();
  sound.play();
};

export const repeatSound = (soundType: MergersSound, times: number) => {
  if (times < 1) {
    return;
  }

  let timesPlayed = 1;
  const sound = getSound(soundType);
  const callback = () => {
    if (timesPlayed < times) {
      timesPlayed++;
      playSound(soundType);
    } else {
      sound.removeEventListener('ended', callback);
    }
  };
  sound.addEventListener('ended', callback);
  sound.play();
};
