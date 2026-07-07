import { useState, type CSSProperties } from 'react';
import { Building2 } from 'lucide-react';
import type { SigcSaasContext } from '../domain/types';
import { useSigcSaasContext } from '../hooks/useSigcData';
import { sigcService } from '../services/sigcService';

export function useSaasTheme(): { context: SigcSaasContext | null; style: CSSProperties } {
  const { data: context } = useSigcSaasContext();
  const branding = context?.branding;
  const style = {
    '--primary': branding?.primaryColor ?? '#7c3aed',
    '--accent': branding?.accentColor ?? '#f97316',
    '--navy': branding?.sidebarColor ?? '#111827'
  } as CSSProperties;
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
            window.location.assign('/');
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
