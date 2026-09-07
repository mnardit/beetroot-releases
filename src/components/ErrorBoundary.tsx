import { Component, type ReactNode } from "react";
import { IconAlertTriangle } from "@tabler/icons-react";
import { getTranslation } from "../lib/i18n";
import { createLogger } from "../lib/log";
import "../styles/ErrorBoundary.css";

const log = createLogger("error-boundary");

const MAX_RETRIES = 3;

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  retryCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, retryCount: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    log.error("Render error:", error.message, info.componentStack ?? "");
  }

  render() {
    if (this.state.error) {
      const canRetry = this.state.retryCount < MAX_RETRIES;
      return (
        <div className="error-boundary" role="alert">
          <IconAlertTriangle size={20} className="error-boundary__icon" />
          <p className="error-boundary__title">{getTranslation("error.title")}</p>
          <p className="error-boundary__message">{this.state.error.message}</p>
          {canRetry && (
            <button
              className="error-boundary__retry"
              onClick={() => this.setState((s) => ({ error: null, retryCount: s.retryCount + 1 }))}
            >
              {getTranslation("error.retry")}
            </button>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
