import { observable } from 'mobx';
import localStorage from 'mobx-localstorage';

export interface Favorite {
  id: string;
  label: string;
  serviceId: string;
  target: string; // phone / handle / channel — per-service address
}

const STORAGE_KEY = 'favorites';

// Modal visibility (mirrors the quickSwitch feature pattern)
export const state = observable({ isModalVisible: false });

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
