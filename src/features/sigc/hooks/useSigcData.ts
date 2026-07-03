import { useEffect, useState } from 'react';
import type { SigcCase, SigcCatalogs, SigcDataSource } from '../domain/types';
import { sigcService } from '../services/sigcService';

type AsyncState<T> = {
  data: T;
  isLoading: boolean;
  source: SigcDataSource;
  warning: string | null;
  error: string | null;
};

export function useSigcCases(): AsyncState<SigcCase[]> {
  const [state, setState] = useState<AsyncState<SigcCase[]>>({ data: [], isLoading: true, source: 'demo', warning: null, error: null });

  useEffect(() => {
    let active = true;
    void sigcService.listCases()
      .then((result) => {
        if (active) setState({ data: result.data, isLoading: false, source: result.source, warning: result.warning ?? null, error: null });
      })
      .catch((error: unknown) => {
        if (active) setState((current) => ({ ...current, isLoading: false, error: error instanceof Error ? error.message : 'No fue posible cargar los casos.' }));
      });
    return () => { active = false; };
  }, []);

  return state;
}

export function useSigcCase(identifier: string | undefined): AsyncState<SigcCase | null> {
  const [state, setState] = useState<AsyncState<SigcCase | null>>({ data: null, isLoading: true, source: 'demo', warning: null, error: null });

  useEffect(() => {
    let active = true;
    if (!identifier) {
      setState({ data: null, isLoading: false, source: 'demo', warning: null, error: 'No se recibió un identificador de caso.' });
      return () => { active = false; };
    }

    setState((current) => ({ ...current, isLoading: true, error: null }));
    void sigcService.getCase(identifier)
      .then((result) => {
        if (active) setState({ data: result.data, isLoading: false, source: result.source, warning: result.warning ?? null, error: null });
      })
      .catch((error: unknown) => {
        if (active) setState((current) => ({ ...current, isLoading: false, error: error instanceof Error ? error.message : 'No fue posible cargar el caso.' }));
      });
    return () => { active = false; };
  }, [identifier]);

  return state;
}

export function useSigcCatalogs(): AsyncState<SigcCatalogs | null> {
  const [state, setState] = useState<AsyncState<SigcCatalogs | null>>({ data: null, isLoading: true, source: 'demo', warning: null, error: null });

  useEffect(() => {
    let active = true;
    void sigcService.getCatalogs()
      .then((result) => {
        if (active) setState({ data: result.data, isLoading: false, source: result.source, warning: result.warning ?? null, error: null });
      })
      .catch((error: unknown) => {
        if (active) setState((current) => ({ ...current, isLoading: false, error: error instanceof Error ? error.message : 'No fue posible cargar la configuración SIGC.' }));
      });
    return () => { active = false; };
  }, []);

  return state;
}
