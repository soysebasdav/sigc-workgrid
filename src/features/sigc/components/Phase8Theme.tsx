import { useEffect, useState, type CSSProperties } from 'react';
import { Building2 } from 'lucide-react';
import type { SigcSaasContext } from '../domain/types';
import { useSigcSaasContext } from '../hooks/useSigcData';
import { sigcService } from '../services/sigcService';

export function useSaasTheme(): { context: SigcSaasContext | null; style: CSSProperties } {
  const { data: context } = useSigcSaasContext();
  const branding = context?.branding;
  const primary = branding?.primaryColor ?? '#7c3aed';
  const accent = branding?.accentColor ?? '#f97316';
  const sidebar = branding?.sidebarColor ?? '#111827';
  const style = {
    '--primary': primary,
    '--accent': accent,
    '--navy': sidebar,
    '--petrol': `color-mix(in srgb, ${sidebar} 68%, ${primary})`,
    '--primary-dark': `color-mix(in srgb, ${primary} 78%, #000)`,
    '--soft': `color-mix(in srgb, ${primary} 12%, #fff)`,
    '--brand-shadow': `color-mix(in srgb, ${primary} 28%, transparent)`
  } as CSSProperties;

  useEffect(() => {
    const productName = branding?.productName?.trim();
    document.title = productName || 'Orkesta';
  }, [branding?.productName]);

  return { context, style };
}

export function OrganizationSwitcher() {
  const { data: context, isLoading } = useSigcSaasContext();
  const [changing, setChanging] = useState(false);
  if (!context || context.organizations.length <= 1) return null;
  return (
    <label className="phase8-org-switcher" title="Cambiar organización activa">
      <Building2 size={16} />
      <select
        value={context.activeOrganization.id}
        disabled={changing || isLoading}
        onChange={async (event) => {
          setChanging(true);
          try {
            await sigcService.setActiveOrganization(event.target.value);
            window.location.assign('/app');
          } finally {
            setChanging(false);
          }
        }}
      >
        {context.organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
      </select>
    </label>
  );
}

export function WorkspaceBrand({ compact = false }: { compact?: boolean }) {
  const { data: context } = useSigcSaasContext();
  const brand = context?.branding;
  return <>{brand?.logoUrl ? <img className={`phase8-brand-logo ${compact ? 'compact' : ''}`} src={brand.logoUrl} alt={brand.productName} /> : <div className={`brand-mark ${compact ? '' : 'large'}`}>{(brand?.shortName ?? 'S').slice(0, 1).toUpperCase()}</div>}</>;
}
