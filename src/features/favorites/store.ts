import { makeAutoObservable } from 'mobx';
import localStorage from 'mobx-localstorage';

export interface Favorite {
  id: string;
  label: string;
  serviceId: string;
  target: string; // phone / handle / channel — per-service address
}

const STORAGE_KEY = 'favorites';

export const getFavorites = (): Favorite[] =>
  (localStorage.getItem(STORAGE_KEY) as Favorite[] | null) || [];

const save = (favorites: Favorite[]): void => {
  localStorage.setItem(STORAGE_KEY, favorites);
};

export const addFavorite = (favorite: Omit<Favorite, 'id'>): void => {
  const id = `fav-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
  save([...getFavorites(), { ...favorite, id }]);
};

export const removeFavorite = (id: string): void => {
  save(getFavorites().filter(favorite => favorite.id !== id));
};

// In-memory UI state for "favorites mode" (the pinned Favorites tab). Not persisted.
// When active, the service ribbon shows the Favorites tab selected, the content area
// shows our FavoritesPanel on the left, and the selected favorite's service webview
// (WhatsApp) is force-revealed on the right with its own chat list hidden.
class FavoritesModeStore {
  isActive = false;

  // The service whose webview is shown on the right (the selected favorite's service).
  targetServiceId: string | null = null;

  // The favorite currently selected in the panel.
  selectedFavoriteId: string | null = null;

  // True while the target chat is (re)loading — drives the masking overlay.
  isLoading = false;

  constructor() {
    makeAutoObservable(this);
  }

  setActive(value: boolean): void {
    this.isActive = value;
  }

  setSelection(favoriteId: string, serviceId: string): void {
    this.selectedFavoriteId = favoriteId;
    this.targetServiceId = serviceId;
  }

  setLoading(value: boolean): void {
    this.isLoading = value;
  }
}

export const favoritesMode = new FavoritesModeStore();
