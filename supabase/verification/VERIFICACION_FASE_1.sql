-- Consultas de verificación posteriores a la instalación.
select id,name,slug,is_active from public.organizations where slug in ('seguridad-atlas','grupo-nova','vigia-integral') order by slug;
select o.name,sp.name plan,os.status,os.current_period_end from public.organization_subscriptions os join public.organizations o on o.id=os.organization_id join public.saas_plans sp on sp.id=os.plan_id where o.slug in ('seguridad-atlas','grupo-nova','vigia-integral') order by o.name;
select p.email,pa.role_code,pa.permissions,pa.is_active from public.platform_admins pa join public.profiles p on p.id=pa.user_id;
select o.name,count(om.id) usuarios from public.organizations o left join public.organization_members om on om.organization_id=o.id where o.slug in ('seguridad-atlas','grupo-nova','vigia-integral') group by o.name order by o.name;
select count(*) eventos_auditoria_global from public.platform_audit_events;
select status,count(*) from public.organization_backup_jobs group by status order by status;
select status,count(*) from public.support_tickets group by status order by status;
