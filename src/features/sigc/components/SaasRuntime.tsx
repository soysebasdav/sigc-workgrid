import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { dataMode } from '../../../lib/supabaseClient';
import { sigcService } from '../services/sigcService';

const ERROR_DEDUPE_WINDOW_MS = 60_000;
const recentErrorFingerprints = new Map<string, number>();

function cleanOldFingerprints(now: number): void {
  for (const [fingerprint, seenAt] of recentErrorFingerprints) {
    if (now - seenAt > ERROR_DEDUPE_WINDOW_MS) recentErrorFingerprints.delete(fingerprint);
  }
}

function errorFingerprint(message: string, route: string, kind: string): string {
  return `${kind}|${route}|${message.trim().slice(0, 500)}`;
}

function reportClientError(input: {
  message: string;
  stack?: string;
  route: string;
  severity: 'warning' | 'error' | 'fatal';
  kind: string;
  metadata?: Record<string, unknown>;
}): void {
  const now = Date.now();
  cleanOldFingerprints(now);
  const fingerprint = errorFingerprint(input.message, input.route, input.kind);
  const previous = recentErrorFingerprints.get(fingerprint);
  if (previous && now - previous < ERROR_DEDUPE_WINDOW_MS) return;
  recentErrorFingerprints.set(fingerprint, now);

  void sigcService.logClientError({
    message: input.message,
    stack: input.stack,
    route: input.route,
    severity: input.severity,
    metadata: {
      kind: input.kind,
      fingerprint,
      dataMode,
      appVersion: import.meta.env.VITE_APP_VERSION ?? null,
      userAgent: navigator.userAgent,
      online: navigator.onLine,
      ...input.metadata
    }
  });
}

export class SigcErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean; message: string }> {
  state = { failed: false, message: '' };

  static getDerivedStateFromError(error: Error) {
    return { failed: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportClientError({
      message: error.message,
      stack: `${error.stack ?? ''}\n${info.componentStack}`,
      route: window.location.pathname,
      severity: 'fatal',
      kind: 'react-error-boundary'
    });
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="login-workgrid">
          <section className="login-card card">
            <AlertTriangle size={32}/>
            <h2>La vista encontró un error</h2>
            <p className="muted">{this.state.message}</p>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>Recargar aplicación</button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

export function ClientObservability() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      reportClientError({
        message: event.message,
        stack: event.error?.stack,
        route: window.location.pathname,
        severity: 'error',
        kind: 'window-error',
        metadata: { filename: event.filename, line: event.lineno, column: event.colno }
      });
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      reportClientError({
        message: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
        route: window.location.pathname,
        severity: 'error',
        kind: 'unhandled-rejection'
      });
    };

    const onOffline = () => {
      reportClientError({
        message: 'El navegador perdió conectividad de red.',
        route: window.location.pathname,
        severity: 'warning',
        kind: 'network-offline'
      });
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('offline', onOffline);
    };
  }, []);
  return null;
}
