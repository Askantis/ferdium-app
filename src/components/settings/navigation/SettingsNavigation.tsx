import { mdiMagnify } from '@mdi/js';
import { inject, observer } from 'mobx-react';
import { Component, type ReactNode } from 'react';
import {
  type WrappedComponentProps,
  defineMessages,
  injectIntl,
} from 'react-intl';
import { NavLink } from 'react-router-dom';
import type { StoresProps } from '../../../@types/ferdium-components.types';
import {
  LIVE_FERDIUM_API,
  LIVE_FRANZ_API,
  LOCAL_SERVER,
} from '../../../config';
import globalMessages from '../../../i18n/globalMessages';
import Icon from '../../ui/icon';
import { settingsIcons } from '../settingsIcons';

const messages = defineMessages({
  availableServices: {
    id: 'settings.navigation.availableServices',
    defaultMessage: 'Available services',
  },
  favorites: {
    id: 'settings.navigation.favorites',
    defaultMessage: 'Favorites',
  },
  yourServices: {
    id: 'settings.navigation.yourServices',
    defaultMessage: 'Your services',
  },
  yourWorkspaces: {
    id: 'settings.navigation.yourWorkspaces',
    defaultMessage: 'Your workspaces',
  },
  account: {
    id: 'settings.navigation.account',
    defaultMessage: 'Account',
  },
  team: {
    id: 'settings.navigation.team',
    defaultMessage: 'Manage Team',
  },
  releaseNotes: {
    id: 'settings.navigation.releaseNotes',
    defaultMessage: 'Release Notes',
  },
  supportFerdium: {
    id: 'settings.navigation.supportFerdium',
    defaultMessage: 'About Ferdium',
  },
  logout: {
    id: 'settings.navigation.logout',
    defaultMessage: 'Logout',
  },
  exitSession: {
    id: 'settings.navigation.exitSession',
    defaultMessage: 'Exit session',
  },
  search: {
    id: 'settings.navigation.search',
    defaultMessage: 'Search',
  },
  groupServices: {
    id: 'settings.navigation.groupServices',
    defaultMessage: 'Services',
  },
  groupAccount: {
    id: 'settings.navigation.groupAccount',
    defaultMessage: 'Account',
  },
  groupApp: {
    id: 'settings.navigation.groupApp',
    defaultMessage: 'App',
  },
});

interface IProps extends Partial<StoresProps>, WrappedComponentProps {
  serviceCount: number;
  workspaceCount: number;
}

interface IState {
  filter: string;
}

interface NavItem {
  to: string;
  iconKey: string;
  label: string;
  badge?: ReactNode;
  extra?: ReactNode;
}

@inject('stores', 'actions')
@observer
class SettingsNavigation extends Component<IProps, IState> {
  constructor(props: IProps) {
    super(props);
    this.state = { filter: '' };
  }

  handleLogout(): void {
    const isUsingWithoutAccount =
      this.props.stores!.settings.app.server === LOCAL_SERVER;

    // Remove current auth token
    localStorage.removeItem('authToken');

    if (isUsingWithoutAccount) {
      // Reset server back to Ferdium API
      this.props.actions!.settings.update({
        type: 'app',
        data: {
          server: LIVE_FERDIUM_API,
        },
      });
    }
    this.props.stores!.user.isLoggingOut = true;

    this.props.stores!.router.push('/auth/welcome');

    // Reload Ferdium, otherwise many settings won't sync correctly with the server
    // after logging into another account
    window.location.reload();
  }

  renderLink(item: NavItem): ReactNode {
    const icon = settingsIcons[item.iconKey];
    return (
      <NavLink
        key={item.to}
        to={item.to}
        className={({ isActive }) =>
          isActive
            ? 'settings-navigation__link is-active'
            : 'settings-navigation__link'
        }
      >
        <span
          className="settings-navigation__icon"
          style={{ background: icon.color }}
        >
          <Icon icon={icon.glyph} size={0.6} />
        </span>
        <span className="settings-navigation__label">{item.label}</span>
        {item.badge == null ? null : (
          <span className="badge">{item.badge}</span>
        )}
        {item.extra}
      </NavLink>
    );
  }

  renderGroup(label: string, items: NavItem[]): ReactNode {
    const filter = this.state.filter.trim().toLowerCase();
    const visible = items.filter(
      i => !filter || i.label.toLowerCase().includes(filter),
    );
    if (visible.length === 0) {
      return null;
    }
    return (
      <div className="settings-navigation__group" key={label}>
        <div className="settings-navigation__group-label">{label}</div>
        {visible.map(item => this.renderLink(item))}
      </div>
    );
  }

  render() {
    const { serviceCount, workspaceCount, stores, intl } = this.props;
    const isUsingWithoutAccount = stores!.settings.app.server === LOCAL_SERVER;
    const isUsingFranzServer = stores!.settings.app.server === LIVE_FRANZ_API;

    const updateDot =
      stores!.settings.app.automaticUpdates &&
      (stores!.ui.showServicesUpdatedInfoBar ||
        stores!.app.updateStatus === stores!.app.updateStatusTypes.AVAILABLE ||
        stores!.app.updateStatus ===
          stores!.app.updateStatusTypes.DOWNLOADED) ? (
        <span className="update-available">•</span>
      ) : null;

    const servicesGroup: NavItem[] = [
      {
        to: '/settings/favorites',
        iconKey: 'favorites',
        label: intl.formatMessage(messages.favorites),
      },
      {
        to: '/settings/services',
        iconKey: 'services',
        label: intl.formatMessage(messages.yourServices),
        badge: serviceCount,
      },
      {
        to: '/settings/workspaces',
        iconKey: 'workspaces',
        label: intl.formatMessage(messages.yourWorkspaces),
        badge: workspaceCount,
      },
      {
        to: '/settings/recipes',
        iconKey: 'recipes',
        label: intl.formatMessage(messages.availableServices),
      },
    ];

    const accountGroup: NavItem[] = [];
    if (!isUsingWithoutAccount) {
      accountGroup.push({
        to: '/settings/user',
        iconKey: 'account',
        label: intl.formatMessage(messages.account),
      });
    }
    if (isUsingFranzServer) {
      accountGroup.push({
        to: '/settings/team',
        iconKey: 'team',
        label: intl.formatMessage(messages.team),
      });
    }

    const appGroup: NavItem[] = [
      {
        to: '/settings/app',
        iconKey: 'app',
        label: intl.formatMessage(globalMessages.settings),
        extra: updateDot,
      },
      {
        to: '/settings/releasenotes',
        iconKey: 'releasenotes',
        label: intl.formatMessage(messages.releaseNotes),
      },
      {
        to: '/settings/support',
        iconKey: 'support',
        label: intl.formatMessage(messages.supportFerdium),
      },
    ];

    return (
      <div className="settings-navigation">
        <div className="settings-navigation__search-wrap">
          <Icon icon={mdiMagnify} size={0.7} />
          <input
            type="text"
            className="settings-navigation__search"
            placeholder={intl.formatMessage(messages.search)}
            value={this.state.filter}
            onChange={e => this.setState({ filter: e.target.value })}
          />
        </div>

        <div className="settings-navigation__scroll">
          {this.renderGroup(
            intl.formatMessage(messages.groupServices),
            servicesGroup,
          )}
          {this.renderGroup(
            intl.formatMessage(messages.groupAccount),
            accountGroup,
          )}
          {this.renderGroup(intl.formatMessage(messages.groupApp), appGroup)}
        </div>

        <button
          type="button"
          className="settings-navigation__link settings-navigation__logout"
          onClick={this.handleLogout.bind(this)}
        >
          <span
            className="settings-navigation__icon"
            style={{ background: settingsIcons.logout.color }}
          >
            <Icon icon={settingsIcons.logout.glyph} size={0.6} />
          </span>
          <span className="settings-navigation__label">
            {isUsingWithoutAccount
              ? intl.formatMessage(messages.exitSession)
              : intl.formatMessage(messages.logout)}
          </span>
        </button>
      </div>
    );
  }
}

export default injectIntl(SettingsNavigation);
