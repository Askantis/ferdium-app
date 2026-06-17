import { inject, observer } from 'mobx-react';
import { Component, type ReactElement } from 'react';
import withStyles, { type WithStylesProps } from 'react-jss';
import type { StoresProps } from '../../@types/ferdium-components.types';
import Modal from '../../components/ui/Modal';
import { H1 } from '../../components/ui/headline';
import {
  type Favorite,
  addFavorite,
  getFavorites,
  removeFavorite,
  state as ModalState,
} from './store';
import { hasDeepLink, sendToFavorite } from './send';

const styles = (theme: any) => ({
  modal: {
    width: '80%',
    maxWidth: 620,
    background: theme.styleTypes.primary.contrast,
    paddingTop: 20,
  },
  headline: { fontSize: 22, marginBottom: 16 },
  list: { maxHeight: '40vh', overflowY: 'auto', marginBottom: 16 },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 12px',
    borderRadius: 12,
    cursor: 'pointer',
    marginBottom: 6,
    border: '1px solid var(--ak-border-soft)',
  },
  rowActive: {
    background: 'var(--ak-accent-gradient)',
    color: 'var(--ak-on-accent)',
    border: '1px solid transparent',
  },
  icon: { width: 32, height: 32, objectFit: 'contain', borderRadius: 8 },
  grow: { flex: 1, minWidth: 0 },
  sub: { fontSize: 12, opacity: 0.7 },
  remove: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 18,
    color: 'inherit',
    opacity: 0.6,
  },
  compose: { display: 'flex', gap: 8, marginBottom: 20 },
  sendBtn: {
    background: 'var(--ak-accent-gradient)',
    color: 'var(--ak-on-accent)',
    border: 'none',
    borderRadius: 10,
    padding: '0 18px',
    cursor: 'pointer',
    fontWeight: 500,
  },
  addForm: {
    borderTop: '1px solid var(--ak-border-soft)',
    paddingTop: 16,
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  },
  addTitle: {
    fontSize: 13,
    opacity: 0.7,
    gridColumn: '1 / -1',
    marginBottom: 4,
  },
  input: {
    height: 38,
    borderRadius: 10,
    border: '1px solid var(--ak-border-soft)',
    padding: '0 12px',
    background: 'transparent',
    color: 'inherit',
  },
  addBtn: {
    gridColumn: '1 / -1',
    height: 38,
    borderRadius: 10,
    border: '1px solid var(--ak-accent)',
    background: 'transparent',
    color: 'var(--ak-accent)',
    cursor: 'pointer',
    fontWeight: 500,
  },
  hint: { fontSize: 11, opacity: 0.6, marginTop: 8, gridColumn: '1 / -1' },
  empty: { opacity: 0.6, fontSize: 13, padding: '8px 0' },
});

interface IProps
  extends WithStylesProps<typeof styles>,
    Partial<StoresProps> {}

interface IState {
  label: string;
  serviceId: string;
  target: string;
  selectedId: string;
  message: string;
}

@inject('stores', 'actions')
@observer
class FavoritesModal extends Component<IProps, IState> {
  constructor(props: IProps) {
    super(props);
    this.state = {
      label: '',
      serviceId: '',
      target: '',
      selectedId: '',
      message: '',
    };
  }

  close = (): void => {
    ModalState.isModalVisible = false;
  };

  serviceName(serviceId: string): string {
    const service = this.props.stores!.services.one(serviceId);
    return service ? service.name : 'Unknown service';
  }

  serviceIcon(serviceId: string): string | undefined {
    const service = this.props.stores!.services.one(serviceId);
    return service?.icon;
  }

  handleAdd = (): void => {
    const { label, serviceId, target } = this.state;
    if (!label || !serviceId || !target) {
      return;
    }
    addFavorite({ label, serviceId, target });
    this.setState({ label: '', target: '' });
  };

  handleSend = (): void => {
    const favorite = getFavorites().find(f => f.id === this.state.selectedId);
    if (!favorite) {
      return;
    }
    sendToFavorite(
      this.props.stores,
      this.props.actions,
      favorite,
      this.state.message,
    );
    this.setState({ message: '' });
    this.close();
  };

  render(): ReactElement {
    const { classes } = this.props;
    const { isModalVisible } = ModalState;
    const favorites = getFavorites();
    const services = this.props.stores!.services.allDisplayed;
    const selected = favorites.find(f => f.id === this.state.selectedId);

    return (
      <Modal
        isOpen={isModalVisible}
        className={`${classes.modal} favorites`}
        shouldCloseOnOverlayClick
        close={this.close}
      >
        <H1 className={classes.headline}>Favorites</H1>

        <div className={classes.list}>
          {favorites.length === 0 ? (
            <div className={classes.empty}>
              No favorites yet — pin a contact below to message them quickly.
            </div>
          ) : (
            favorites.map((favorite: Favorite) => (
              // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
              <div
                key={favorite.id}
                className={`${classes.row} ${
                  this.state.selectedId === favorite.id ? classes.rowActive : ''
                }`}
                onClick={() => this.setState({ selectedId: favorite.id })}
              >
                {this.serviceIcon(favorite.serviceId) ? (
                  <img
                    src={this.serviceIcon(favorite.serviceId)}
                    className={classes.icon}
                    alt=""
                  />
                ) : null}
                <div className={classes.grow}>
                  <div>{favorite.label}</div>
                  <div className={classes.sub}>
                    {this.serviceName(favorite.serviceId)} · {favorite.target}
                  </div>
                </div>
                <button
                  type="button"
                  className={classes.remove}
                  aria-label="Remove favorite"
                  onClick={e => {
                    e.stopPropagation();
                    removeFavorite(favorite.id);
                    if (this.state.selectedId === favorite.id) {
                      this.setState({ selectedId: '' });
                    }
                  }}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>

        {selected ? (
          <div className={classes.compose}>
            <input
              className={classes.input}
              style={{ flex: 1 }}
              placeholder={`Message ${selected.label}…`}
              value={this.state.message}
              onChange={e => this.setState({ message: e.target.value })}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  this.handleSend();
                }
              }}
            />
            <button
              type="button"
              className={classes.sendBtn}
              onClick={this.handleSend}
            >
              Send
            </button>
          </div>
        ) : null}

        <div className={classes.addForm}>
          <div className={classes.addTitle}>Add a favorite</div>
          <input
            className={classes.input}
            placeholder="Label (e.g. Mum)"
            value={this.state.label}
            onChange={e => this.setState({ label: e.target.value })}
          />
          <select
            className={classes.input}
            value={this.state.serviceId}
            onChange={e => this.setState({ serviceId: e.target.value })}
          >
            <option value="">Select a service…</option>
            {services.map(service => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
          <input
            className={classes.input}
            style={{ gridColumn: '1 / -1' }}
            placeholder="Target (phone with country code, @handle, …)"
            value={this.state.target}
            onChange={e => this.setState({ target: e.target.value })}
          />
          <button
            type="button"
            className={classes.addBtn}
            onClick={this.handleAdd}
          >
            Add favorite
          </button>
          <div className={classes.hint}>
            {this.state.serviceId && !hasDeepLink(
              this.props.stores!.services.one(this.state.serviceId)?.recipe?.id,
            )
              ? 'Note: this service has no deep link yet — Send will just open it. WhatsApp pre-fills the chat.'
              : 'Experimental: Send opens the service and pre-fills the chat where supported (e.g. WhatsApp).'}
          </div>
        </div>
      </Modal>
    );
  }
}

export default withStyles(styles, { injectTheme: true })(FavoritesModal);
