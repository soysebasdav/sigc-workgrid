import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { sigcService } from '../services/sigcService';

export class SigcErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean; message: string }> {
  state = { failed: false, message: '' };
  static getDerivedStateFromError(error: Error) { return { failed: true, message: error.message }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    void sigcService.logClientError({ message: error.message, stack: `${error.stack ?? ''}\n${info.componentStack}`, route: window.location.pathname, severity: 'fatal' });
  }
  render() {
    if (this.state.failed) return <main className="login-workgrid"><section className="login-card card"><AlertTriangle size={32}/><h2>La vista encontró un error</h2><p className="muted">{this.state.message}</p><button className="btn btn-primary" onClick={()=>window.location.reload()}>Recargar aplicación</button></section></main>;
    return this.props.children;
  }
}

export function ClientObservability() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => { void sigcService.logClientError({ message: event.message, stack: event.error?.stack, route: window.location.pathname, severity: 'error', metadata: { filename: event.filename, line: event.lineno, column: event.colno } }); };
    const onRejection = (event: PromiseRejectionEvent) => { const reason = event.reason; void sigcService.logClientError({ message: reason instanceof Error ? reason.message : String(reason), stack: reason instanceof Error ? reason.stack : undefined, route: window.location.pathname, severity: 'error', metadata: { kind: 'unhandledrejection' } }); };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return null;
}
