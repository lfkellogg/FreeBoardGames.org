const std_crib_deck = [
  { id: 'AS', faced: false, rank: 1, img: './media/png/AS.png' },
  { id: '2S', faced: false, rank: 2, img: './media/png/2S.png' },
  { id: '3S', faced: false, rank: 3, img: './media/png/3S.png' },
  { id: '4S', faced: false, rank: 4, img: './media/png/4S.png' },
  { id: '5S', faced: false, rank: 5, img: './media/png/5S.png' },
  { id: '6S', faced: false, rank: 6, img: './media/png/6S.png' },
  { id: '7S', faced: false, rank: 7, img: './media/png/7S.png' },
  { id: '8S', faced: false, rank: 8, img: './media/png/8S.png' },
  { id: '9S', faced: false, rank: 9, img: './media/png/9S.png' },
  { id: '10S', faced: false, rank: 10, img: './media/png/10S.png' },
  { id: 'JS', faced: false, rank: 11, img: './media/png/JS.png' },
  { id: 'QS', faced: false, rank: 12, img: './media/png/QS.png' },
  { id: 'KS', faced: false, rank: 13, img: './media/png/KS.png' },
  { id: 'AC', faced: false, rank: 14, img: './media/png/AC.png' },
  { id: '2C', faced: false, rank: 15, img: './media/png/2C.png' },
  { id: '3C', faced: false, rank: 16, img: './media/png/3C.png' },
  { id: '4C', faced: false, rank: 17, img: './media/png/4C.png' },
  { id: '5C', faced: false, rank: 18, img: './media/png/5C.png' },
  { id: '6C', faced: false, rank: 19, img: './media/png/6C.png' },
  { id: '7C', faced: false, rank: 20, img: './media/png/7C.png' },
  { id: '8C', faced: false, rank: 21, img: './media/png/8C.png' },
  { id: '9C', faced: false, rank: 22, img: './media/png/9C.png' },
  { id: '10C', faced: false, rank: 23, img: './media/png/10C.png' },
  { id: 'JC', faced: false, rank: 24, img: './media/png/JC.png' },
  { id: 'QC', faced: false, rank: 25, img: './media/png/QC.png' },
  { id: 'KC', faced: false, rank: 26, img: './media/png/KC.png' },
  { id: 'AD', faced: false, rank: 27, img: './media/png/AD.png' },
  { id: '2D', faced: false, rank: 28, img: './media/png/2D.png' },
  { id: '3D', faced: false, rank: 29, img: './media/png/3D.png' },
  { id: '4D', faced: false, rank: 30, img: './media/png/4D.png' },
  { id: '5D', faced: false, rank: 31, img: './media/png/5D.png' },
  { id: '6D', faced: false, rank: 32, img: './media/png/6D.png' },
  { id: '7D', faced: false, rank: 33, img: './media/png/7D.png' },
  { id: '8D', faced: false, rank: 34, img: './media/png/8D.png' },
  { id: '9D', faced: false, rank: 35, img: './media/png/9D.png' },
  { id: '10D', faced: false, rank: 36, img: './media/png/10D.png' },
  { id: 'JD', faced: false, rank: 37, img: './media/png/JD.png' },
  { id: 'QD', faced: false, rank: 38, img: './media/png/QD.png' },
  { id: 'KD', faced: false, rank: 39, img: './media/png/KD.png' },
  { id: 'AH', faced: false, rank: 40, img: './media/png/AH.png' },
  { id: '2H', faced: false, rank: 41, img: './media/png/2H.png' },
  { id: '3H', faced: false, rank: 42, img: './media/png/3H.png' },
  { id: '4H', faced: false, rank: 43, img: './media/png/4H.png' },
  { id: '5H', faced: false, rank: 44, img: './media/png/5H.png' },
  { id: '6H', faced: false, rank: 45, img: './media/png/6H.png' },
  { id: '7H', faced: false, rank: 46, img: './media/png/7H.png' },
  { id: '8H', faced: false, rank: 47, img: './media/png/8H.png' },
  { id: '9H', faced: false, rank: 48, img: './media/png/9H.png' },
  { id: '10H', faced: false, rank: 49, img: './media/png/10H.png' },
  { id: 'JH', faced: false, rank: 50, img: './media/png/JH.png' },
  { id: 'QH', faced: false, rank: 51, img: './media/png/QH.png' },
  { id: 'KH', faced: false, rank: 52, img: './media/png/KH.png' },
];

export const dealCribbage = {
  pattern: { players: 2, increment: 1, hand: 6 },
  setup: {
    count: 0,
    deck: [],
    hands: {
      north: { playerId: 'Player 1', private: [], melds: [], tricks: [], played: [] },
      east: { playerId: 'Player 2', private: [], melds: [], tricks: [], played: [] },
      south: { playerId: 'Player 3', private: [], melds: [], tricks: [], played: [] },
      west: { playerId: 'Player 4', private: [], melds: [], tricks: [], played: [] },
    },
    stock: [],
  },
  fresh: std_crib_deck,
  turn: false,
};