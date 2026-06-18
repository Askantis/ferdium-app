import { inject, observer } from 'mobx-react';
import { Component, type ReactElement } from 'react';
import withStyles, { type WithStylesProps } from 'react-jss';
import type { StoresProps } from '../../@types/ferdium-components.types';
import { H1 } from '../../components/ui/headline';
import { hasDeepLink, sendToFavorite } from './send';
import {
  type Favorite,
  addFavorite,
  getFavorites,
  removeFavorite,
} from './store';

const styles = () => ({
  // Single block wrapper. The global reset sets `div { height: 100% }`, which
  // stretches every nested div to the (definite-height) settings body — so we
  // force height:auto here and on descendant divs to restore natural flow.
  wrap: { maxWidth: 560, height: 'auto', '& div': { height: 'auto' } },
  intro: { fontSize: 13, opacity: 0.75, margin: '0 0 16px' },
  list: { margin: '0 0 8px' },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 14px',
    borderRadius: 12,
    cursor: 'pointer',
    margin: '0 0 8px',
    border: '1px solid var(--ak-border-soft)',
  },
  rowActive: {
    background: 'var(--ak-accent-gradient)',
    color: 'var(--ak-on-accent)',
    border: '1px solid transparent',
  },
  icon: { width: 34, height: 34, objectFit: 'contain', borderRadius: 8 },
  grow: { flex: 1, minWidth: 0 },
  sub: { fontSize: 12, opacity: 0.7 },
  remove: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 20,
    color: 'inherit',
    opacity: 0.6,
  },
  compose: { display: 'flex', gap: 8, margin: '0 0 20px' },
  sendBtn: {
    background: 'var(--ak-accent-gradient)',
    color: 'var(--ak-on-accent)',
    border: 'none',
    borderRadius: 10,
    padding: '0 20px',
    cursor: 'pointer',
    fontWeight: 500,
  },
  addTitle: { fontSize: 16, fontWeight: 500, margin: '16px 0 12px' },
  addRow: {
    display: 'flex',
    gap: 10,
    margin: '0 0 10px',
    '& > *': { flex: 1, minWidth: 0 },
  },
  field: {
    display: 'block',
    width: '100%',
    height: 40,
    borderRadius: 10,
    border: '1px solid var(--ak-border-soft)',
    padding: '0 12px',
    background: 'transparent',
    color: 'inherit',
    margin: '0 0 10px',
    boxSizing: 'border-box',
  },
  inRow: { margin: 0 },
  addBtn: {
    display: 'block',
    width: '100%',
    height: 40,
    borderRadius: 10,
    border: '1px solid var(--ak-accent)',
    background: 'transparent',
    color: 'var(--ak-accent)',
    cursor: 'pointer',
    fontWeight: 500,
    margin: 0,
  },
  hint: { fontSize: 11, opacity: 0.6, margin: '8px 0 0' },
  empty: { opacity: 0.6, fontSize: 13, padding: '8px 0' },
});

interface IProps extends WithStylesProps<typeof styles>, Partial<StoresProps> {}

interface IState {
  label: string;
  serviceId: string;
  target: string;
  selectedId: string;
  message: string;
}

@inject('stores', 'actions')
@observer
class FavoritesScreen extends Component<IProps, IState> {
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

  serviceName(serviceId: string): string {
    const service = this.props.stores!.services.one(serviceId);
    return service ? service.name : 'Unknown service';
  }

  serviceIcon(serviceId: string): string | undefined {
    return this.props.stores!.services.one(serviceId)?.icon;
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
  };

  render(): ReactElement {
    const { classes } = this.props;
    const favorites = getFavorites();
    const services = this.props.stores!.services.allDisplayed;
    const selected = favorites.find(f => f.id === this.state.selectedId);

    return (
      <div className="settings__main">
        <div className="settings__header">
          <H1>Favorites</H1>
        </div>
        <div className="settings__body" style={{ overflowY: 'auto' }}>
          <div className={classes.wrap}>
            <div className={classes.intro}>
              Pin the people you message most. Type below and Sophie routes it
              to the right service (pre-filling the chat where supported).
            </div>

            <div className={classes.list}>
              {favorites.length === 0 ? (
                <div className={classes.empty}>
                  No favorites yet — add one below.
                </div>
              ) : (
                favorites.map((favorite: Favorite) => (
                  // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
                  <div
                    key={favorite.id}
                    className={`${classes.row} ${
                      this.state.selectedId === favorite.id
                        ? classes.rowActive
                        : ''
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
                        {this.serviceName(favorite.serviceId)} ·{' '}
                        {favorite.target}
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
                  className={`${classes.field} ${classes.inRow}`}
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

            <div className={classes.addTitle}>Add a favorite</div>
            <div className={classes.addRow}>
              <input
                className={`${classes.field} ${classes.inRow}`}
                placeholder="Label (e.g. Mum)"
                value={this.state.label}
                onChange={e => this.setState({ label: e.target.value })}
              />
              <select
                className={`${classes.field} ${classes.inRow}`}
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
            </div>
            <input
              className={classes.field}
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
              {this.state.serviceId &&
              !hasDeepLink(
                this.props.stores!.services.one(this.state.serviceId)?.recipe
                  ?.id,
              )
                ? 'Note: this service has no deep link yet — Send just opens it. WhatsApp pre-fills the chat.'
                : 'Experimental: Send opens the service and pre-fills the chat where supported (e.g. WhatsApp).'}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default withStyles(styles, { injectTheme: true })(FavoritesScreen);
