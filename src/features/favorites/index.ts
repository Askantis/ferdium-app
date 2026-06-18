// Favorites: a Settings screen (Component.tsx) manages the list; the pinned
// Favorites ribbon tab enters "favorites mode" (FavoritesPanel on the left +
// the real WhatsApp chat on the right). initFavorites() wires up the mode
// controller (reactions + injection); it's called from FeaturesStore.
export { default as Component } from './Component';
export { default as FavoritesPanel } from './FavoritesPanel';
export {
  type Favorite,
  addFavorite,
  favoritesMode,
  getFavorites,
  removeFavorite,
} from './store';
export {
  default as initFavorites,
  enterFavorites,
  exitFavorites,
  selectFavorite,
} from './controller';
