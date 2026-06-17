import { state as ModalState } from './store';

export { default as Component } from './Component';

const debug = require('../../preload-safe-debug')('Ferdium:feature:favorites');

export default function initialize() {
  debug('Initialize favorites feature');

  window['ferdium'].features.favorites = {
    state: ModalState,
    showModal: (): void => {
      ModalState.isModalVisible = true;
    },
  };
}
