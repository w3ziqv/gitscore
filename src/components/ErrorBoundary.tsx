import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors so a failing view never blanks the whole app.
 * The fallback reuses the shell's .error-banner styling.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render(): ReactNode {
    if (this.state.error !== null) {
      return (
        <div className="error-banner" role="alert">
          <span className="error-text">VIEW ERROR — {this.state.error.message}</span>
        </div>
      );
    }
    return this.props.children;
  }
}
