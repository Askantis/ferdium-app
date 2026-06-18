import { mdiClose } from '@mdi/js';
import { observer } from 'mobx-react';
import { Component, type PropsWithChildren, type ReactElement } from 'react';
import {
  type WrappedComponentProps,
  defineMessages,
  injectIntl,
} from 'react-intl';
import { Outlet, useLocation } from 'react-router-dom';
import { isEscapeKeyPress } from '../../jsUtils';
import Appear from '../ui/effects/Appear';
import Icon from '../ui/icon';
import ErrorBoundary from '../util/ErrorBoundary';

const messages = defineMessages({
  closeSettings: {
    id: 'settings.app.closeSettings',
    defaultMessage: 'Close settings',
  },
});

interface IProps extends WrappedComponentProps {
  navigation: ReactElement;
  closeSettings: () => void;
}

// Wrap only the Outlet so a thrown error in a settings screen doesn't take
// down the navigation too. Keying by pathname remounts (resets) the boundary
// on navigation, so the user can always click away from an error screen.
function SettingsOutlet(): ReactElement {
  const location = useLocation();
  return (
    <ErrorBoundary key={location.pathname}>
      <Outlet />
    </ErrorBoundary>
  );
}

@observer
class SettingsLayout extends Component<PropsWithChildren<IProps>> {
  constructor(props: IProps) {
    super(props);

    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  componentDidMount(): void {
    document.addEventListener('keydown', this.handleKeyDown, false);
  }

  componentWillUnmount(): void {
    document.removeEventListener('keydown', this.handleKeyDown, false);
  }

  handleKeyDown(e: KeyboardEvent): void {
    if (isEscapeKeyPress(e.key)) {
      this.props.closeSettings();
    }
  }

  render(): ReactElement {
    const { navigation, closeSettings, intl } = this.props;

    return (
      <Appear transitionName="fadeIn-fast">
        <div className="settings-wrapper">
          <button
            type="button"
            className="settings-wrapper__action"
            onClick={closeSettings}
            aria-label={intl.formatMessage(messages.closeSettings)}
          />
          <div className="settings franz-form">
            {navigation}
            <SettingsOutlet />
            <button
              type="button"
              className="settings__close"
              onClick={closeSettings}
              aria-label={intl.formatMessage(messages.closeSettings)}
            >
              <Icon icon={mdiClose} size={1.35} />
            </button>
          </div>
        </div>
      </Appear>
    );
  }
}

export default injectIntl(SettingsLayout);
