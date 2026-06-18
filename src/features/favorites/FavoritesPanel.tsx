import { mdiCog, mdiPlus, mdiStar } from '@mdi/js';
import { inject, observer } from 'mobx-react';
import { Component, type ReactElement } from 'react';
import withStyles, { type WithStylesProps } from 'react-jss';
import type { StoresProps } from '../../@types/ferdium-components.types';
import Icon from '../../components/ui/icon';
import { selectFavorite } from './controller';
import { favoritesMode, getFavorites } from './store';

const PANEL_WIDTH = 270;

const styles = {
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: PANEL_WIDTH,
    height: '100%',
    zIndex: 120,
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--ak-surface-recessed)',
    borderRight: '1px solid var(--ak-border-soft)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    flexShrink: 0,
    padding: '0 10px 0 18px',
  },
  title: {
    fontSize: 17,
    fontWeight: 700,
    letterSpacing: '-0.2px',
  },
  manage: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30,
    borderRadius: 'var(--ak-radius)',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: 'inherit',
    opacity: 0.6,
    '& svg': { fill: 'currentColor' },
    '&:hover': { opacity: 1, background: 'var(--ak-surface-tab-hover)' },
  },
  list: {
    flex: 1,
    minHeight: 0,
    height: 'auto',
    overflowY: 'auto',
    padding: '4px 8px 12px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 11,
    width: '100%',
    height: 52,
    padding: '0 10px',
    margin: '2px 0',
    border: 'none',
    borderRadius: 'var(--ak-radius-card)',
    background: 'transparent',
    cursor: 'pointer',
    textAlign: 'left',
    color: 'inherit',
    '&:hover': { background: 'var(--ak-surface-tab-hover)' },
    '&.is-active': {
      background: 'var(--ak-accent-gradient)',
      color: 'var(--ak-on-accent)',
      boxShadow: 'var(--ak-elevation)',
    },
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    flexShrink: 0,
    objectFit: 'cover',
    background: 'var(--ak-surface-tab)',
  },
  avatarFallback: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 15,
    fontWeight: 600,
    textTransform: 'uppercase',
    color: 'var(--ak-accent)',
  },
  rowText: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    flex: 1,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  rowSub: {
    fontSize: 12,
    opacity: 0.6,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    height: '100%',
    padding: '0 24px',
    gap: 14,
  },
  emptyIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
    borderRadius: 16,
    background: 'var(--ak-accent-gradient)',
    boxShadow: 'var(--ak-elevation)',
    '& svg': { fill: '#fff' },
  },
  emptyText: { fontSize: 13, opacity: 0.7 },
  addButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 'var(--ak-radius)',
    border: 'none',
    background: 'var(--ak-accent)',
    color: 'var(--ak-on-accent)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    '& svg': { fill: 'currentColor' },
  },
} as const;

interface IProps extends WithStylesProps<typeof styles>, Partial<StoresProps> {}

@inject('stores', 'actions')
@observer
class FavoritesPanel extends Component<IProps> {
  openManage(): void {
    this.props.actions!.ui.openSettings({ path: 'favorites' });
  }

  render(): ReactElement | null {
    if (!favoritesMode.isActive) {
      return null;
    }

    const { classes } = this.props;
    const favorites = getFavorites();

    return (
      <div className={`${classes.panel} favorites-panel`}>
        <div className={classes.header}>
          <span className={classes.title}>Favorites</span>
          <button
            type="button"
            className={classes.manage}
            onClick={() => this.openManage()}
            title="Manage favorites"
          >
            <Icon icon={mdiCog} size={0.85} />
          </button>
        </div>

        {favorites.length === 0 ? (
          <div className={classes.list}>
            <div className={classes.empty}>
              <span className={classes.emptyIcon}>
                <Icon icon={mdiStar} size={1.3} />
              </span>
              <span className={classes.emptyText}>
                No favorites yet. Pin the people you message most for one-click
                access.
              </span>
              <button
                type="button"
                className={classes.addButton}
                onClick={() => this.openManage()}
              >
                <Icon icon={mdiPlus} size={0.8} />
                Add favorites
              </button>
            </div>
          </div>
        ) : (
          <div className={classes.list}>
            {favorites.map(favorite => {
              const service = this.props.stores!.services.one(
                favorite.serviceId,
              );
              const icon = service?.icon;
              const subtitle = service?.name ?? favorite.target;
              const isActive = favoritesMode.selectedFavoriteId === favorite.id;
              return (
                <button
                  type="button"
                  key={favorite.id}
                  className={`${classes.row} ${isActive ? 'is-active' : ''}`}
                  onClick={() => selectFavorite(favorite)}
                >
                  {icon ? (
                    <img className={classes.avatar} src={icon} alt="" />
                  ) : (
                    <span
                      className={`${classes.avatar} ${classes.avatarFallback}`}
                    >
                      {favorite.label.charAt(0)}
                    </span>
                  )}
                  <span className={classes.rowText}>
                    <span className={classes.rowLabel}>{favorite.label}</span>
                    <span className={classes.rowSub}>{subtitle}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }
}

export default withStyles(styles)(FavoritesPanel);
