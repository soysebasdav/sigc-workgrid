import type { CaseTypeFieldDefinition } from '../domain/types';

type DynamicValues = Record<string, unknown>;

export function normalizeCaseTypeFieldOptions(options: unknown): Array<{ value: string; label: string }> {
  if (!Array.isArray(options)) return [];
  return options.map((option) => {
    if (typeof option === 'string') return { value: option, label: option };
    if (option && typeof option === 'object') {
      const item = option as Record<string, unknown>;
      const value = String(item.value ?? item.label ?? '');
      return { value, label: String(item.label ?? value) };
    }
    return { value: String(option ?? ''), label: String(option ?? '') };
  }).filter((option) => option.value);
}

export function filterDynamicValues(definitions: CaseTypeFieldDefinition[], values: DynamicValues): DynamicValues {
  const allowed = new Set(definitions.filter((field) => field.isActive).map((field) => field.fieldKey));
  return Object.fromEntries(Object.entries(values).filter(([key]) => allowed.has(key)));
}

function stringValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return '';
}

export function DynamicCaseFields({
  definitions,
  values,
  onChange,
  className = ''
}: {
  definitions: CaseTypeFieldDefinition[];
  values: DynamicValues;
  onChange: (values: DynamicValues) => void;
  className?: string;
}) {
  const active = [...definitions].filter((field) => field.isActive).sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
  if (!active.length) return null;

  function setValue(key: string, value: unknown) {
    onChange({ ...values, [key]: value });
  }

  return (
    <section className={`dynamic-case-fields ${className}`.trim()}>
      <div className="dynamic-case-fields-head">
        <div><strong>Información adicional</strong><span>Estos campos dependen del tipo de caso seleccionado.</span></div>
      </div>
      <div className="dynamic-case-fields-grid">
        {active.map((field) => {
          const requiredMark = field.isRequired ? ' *' : '';
          const shared = {
            id: `dynamic-${field.fieldKey}`,
            name: field.fieldKey,
            required: field.isRequired,
            'aria-describedby': field.helpText ? `dynamic-help-${field.fieldKey}` : undefined
          };
          return (
            <label className={`field-label dynamic-field dynamic-${field.inputType}${field.inputType === 'textarea' ? ' wide' : ''}`} key={field.id ?? field.fieldKey}>
              <span>{field.label}{requiredMark}</span>
              {field.inputType === 'textarea' ? (
                <textarea {...shared} className="field textarea compact" placeholder={field.placeholder ?? undefined} value={stringValue(values[field.fieldKey])} onChange={(event) => setValue(field.fieldKey, event.target.value)} />
              ) : field.inputType === 'select' ? (
                <select {...shared} className="field" value={stringValue(values[field.fieldKey])} onChange={(event) => setValue(field.fieldKey, event.target.value)}>
                  <option value="">Selecciona una opción</option>
                  {field.options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                </select>
              ) : field.inputType === 'boolean' ? (
                <span className="dynamic-boolean-control">
                  <input {...shared} type="checkbox" checked={Boolean(values[field.fieldKey])} onChange={(event) => setValue(field.fieldKey, event.target.checked)} />
                  <span>{Boolean(values[field.fieldKey]) ? 'Sí' : 'No'}</span>
                </span>
              ) : (
                <input
                  {...shared}
                  className="field"
                  type={field.inputType === 'datetime' ? 'datetime-local' : field.inputType}
                  placeholder={field.placeholder ?? undefined}
                  value={stringValue(values[field.fieldKey])}
                  onChange={(event) => setValue(field.fieldKey, field.inputType === 'number' && event.target.value !== '' ? Number(event.target.value) : event.target.value)}
                />
              )}
              {field.helpText ? <small id={`dynamic-help-${field.fieldKey}`}>{field.helpText}</small> : null}
            </label>
          );
        })}
      </div>
    </section>
  );
}
