import {
  mdiAccount,
  mdiAccountGroup,
  mdiApps,
  mdiBullhornVariant,
  mdiCog,
  mdiInformation,
  mdiLogout,
  mdiStar,
  mdiViewGrid,
  mdiViewGridPlus,
} from '@mdi/js';

export interface SettingsIconDef {
  glyph: string;
  color: string;
}

// Single source of truth for the macOS-style settings icon tiles — consumed by
// both the sidebar navigation and the per-screen content headers.
export const settingsIcons: Record<string, SettingsIconDef> = {
  recipes: { glyph: mdiViewGridPlus, color: '#3478f6' },
  favorites: { glyph: mdiStar, color: '#e0567e' },
  services: { glyph: mdiApps, color: '#8e5bf0' },
  workspaces: { glyph: mdiViewGrid, color: '#1f9e86' },
  account: { glyph: mdiAccount, color: '#5a6cea' },
  team: { glyph: mdiAccountGroup, color: '#f0883e' },
  app: { glyph: mdiCog, color: '#8a8f98' },
  releasenotes: { glyph: mdiBullhornVariant, color: '#f2b33d' },
  support: { glyph: mdiInformation, color: '#4aa3df' },
  logout: { glyph: mdiLogout, color: '#e2504b' },
};
