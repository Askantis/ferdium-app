import { join } from 'node:path';

export const asarPath = (dir: string = '') => {
  return dir.replace('app.asar', 'app.asar.unpacked');
};

// Replacing app.asar is not beautiful but unfortunately necessary
export const asarRecipesPath = (...segments: string[]) => {
  return join(asarPath(join(__dirname, '..', 'recipes')), ...[segments].flat());
};

// Bundled third-party assets copied into build/vendor at build time.
export const asarVendorPath = (...segments: string[]) => {
  return join(asarPath(join(__dirname, '..', 'vendor')), ...[segments].flat());
};
