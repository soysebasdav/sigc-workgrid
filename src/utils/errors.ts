export type AppErrorLike = {
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
  error_description?: unknown;
  status?: unknown;
  statusCode?: unknown;
};

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function getErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const value = error as AppErrorLike;
  return clean(value.code) || clean(value.statusCode) || clean(value.status) || undefined;
}

export function getRawErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.trim();
  if (typeof error === 'string') return error.trim();
  if (!error || typeof error !== 'object') return '';

  const value = error as AppErrorLike;
  return clean(value.message) || clean(value.error_description) || clean(value.details) || '';
}

export function isMissingRpcError(error: unknown, functionName?: string): boolean {
  const code = getErrorCode(error)?.toUpperCase();
  const text = [getRawErrorMessage(error), clean((error as AppErrorLike | null)?.details), clean((error as AppErrorLike | null)?.hint)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const missing = code === 'PGRST202' || code === '42883' || /could not find the function|function .* does not exist|schema cache/i.test(text);
  return missing && (!functionName || text.includes(functionName.toLowerCase()));
}

export function appErrorMessage(error: unknown, fallback = 'No fue posible completar la operación.'): string {
  const raw = getRawErrorMessage(error);
  const code = getErrorCode(error);
  const value = error && typeof error === 'object' ? error as AppErrorLike : null;
  const details = clean(value?.details);
  const hint = clean(value?.hint);
  const searchable = `${raw} ${details} ${hint}`.toLowerCase();

  let message = raw || fallback;

  if (/row-level security|violates row-level security|permission denied|not authorized|unauthorized/.test(searchable) || code === '42501') {
    message = 'Tu usuario no tiene permiso para completar esta acción en la organización activa.';
  } else if (/duplicate key|already exists|ya existe/.test(searchable) || code === '23505') {
    message = 'Ya existe un registro con estos datos. Revisa el correo, código, nombre o identificador utilizado.';
  } else if (/foreign key|violates foreign key/.test(searchable) || code === '23503') {
    message = 'Uno de los datos seleccionados ya no existe o no pertenece a la organización activa. Actualiza la página y vuelve a seleccionarlo.';
  } else if (/invalid input syntax for type uuid|invalid uuid/.test(searchable) || code === '22P02') {
    message = 'La operación contiene un identificador inválido. Actualiza los catálogos y vuelve a seleccionar área, responsable, rol o tipo de caso.';
  } else if (/could not find the function|function .* does not exist|schema cache/.test(searchable) || code === 'PGRST202' || code === '42883') {
    message = 'La función requerida no está disponible en Supabase o todavía no se actualizó la caché del esquema.';
  } else if (/jwt|session|refresh token|not authenticated/.test(searchable) || code === '401') {
    message = 'La sesión venció o no pudo validarse. Inicia sesión nuevamente y repite la operación.';
  }

  const diagnostic = [code ? `Código ${code}` : '', details && details !== raw ? details : '', hint].filter(Boolean).join(' · ');
  return diagnostic ? `${message} (${diagnostic})` : message;
}
