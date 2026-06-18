// Favorites send-routing (experimental).
// v1: open the target service and, where the service supports a deep link,
// navigate straight to the conversation with the message pre-filled so the
// user can review and hit enter. Auto-send is intentionally left out for now.
import type { Favorite } from './store';

const digitsOnly = (value: string): string =>
  (value || '').replaceAll(/\D/g, '');

// Returns a deep link that opens the conversation (with text pre-filled where
// the service supports it), or null if the service has no usable deep link.
export const buildDeepLink = (
  recipeId: string,
  target: string,
  text: string,
): string | null => {
  const encoded = encodeURIComponent(text || '');
  switch (recipeId) {
    case 'whatsapp': {
      return `https://web.whatsapp.com/send?phone=${digitsOnly(target)}&text=${encoded}`;
    }
    case 'telegram': {
      return `https://web.telegram.org/a/#${encodeURIComponent(target)}`;
    }
    default: {
      return null;
    }
  }
};

export const hasDeepLink = (recipeId: string): boolean =>
  buildDeepLink(recipeId, 'x', '') !== null;

// Best-effort: make the service active (wakes + shows it) and, when possible,
// open the conversation with the message pre-filled.
export const sendToFavorite = (
  stores: any,
  actions: any,
  favorite: Favorite,
  text: string,
): boolean => {
  const service = stores?.services?.one(favorite.serviceId);
  if (!service) {
    return false;
  }

  actions.service.setActive({ serviceId: service.id });

  const url = buildDeepLink(service.recipe?.id, favorite.target, text);
  if (url && service.webview) {
    try {
      service.webview.loadURL(url);
    } catch {
      // webview not ready / load rejected — service is still brought to front
    }
  }
  return true;
};

// Open the favorite's conversation in its (real) service webview — used by the
// Favorites quick-access drawer. Same path as sendToFavorite but with no text:
// the deep link just opens the chat, and the user interacts natively (incl. media).
export const openFavorite = (
  stores: any,
  actions: any,
  favorite: Favorite,
): boolean => sendToFavorite(stores, actions, favorite, '');
