-- Saudization Radar | secure shared operations schema for Supabase Postgres
-- Deploy only in a company-approved private Supabase project after configuring
-- authentication, verified email, admin membership and approved data handling.
-- IMPORTANT: no PII columns; public GitHub Pages never holds the service-role key.
begin;

create extension if not exists pgcrypto;

create table if not exists public.sradar_orgs (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(trim(name)) between 3 and 100),
 created_at timestamptz not null default now()
);

create table if not exists public.sradar_members (
 org_id uuid not null references public.sradar_orgs(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check (role in ('owner','manager','editor','viewer')),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 primary key (org_id,user_id)
);

-- This function cannot grant access unless a privileged administrator first
-- provisions an org membership. Signing up never automatically grants membership.
create or replace function public.sradar_has_role(p_org uuid,p_roles text[])
returns boolean language sql stable security definer
set search_path = ''
as $$
 select exists (
  select 1 from public.sradar_members m
  where m.org_id=p_org and m.user_id=(select auth.uid())
    and m.active=true and m.role=any(p_roles)
 );
$$;

create table if not exists public.sradar_plans (
 id uuid primary key default gen_random_uuid(),
 org_id uuid not null references public.sradar_orgs(id),
 decision_id text not null check (decision_id ~ '^[a-z0-9-]{2,40}$'),
 archived boolean not null default false,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 unique (org_id,decision_id),
 unique (id,org_id)
);

create table if not exists public.sradar_tasks (
 id uuid primary key default gen_random_uuid(),
 org_id uuid not null,
 plan_id uuid not null,
 step_id text not null check (step_id in ('codes','scope','gap','plan','review')),
 status text not null default 'todo' check (status in ('todo','doing','review','blocked','done')),
 team text not null default 'غير محدد' check (team in ('غير محدد','الخدمات الحكومية','الموارد البشرية','الالتزام','الشؤون القانونية','الإدارة المعنية','المشتريات والخدمات الإدارية')),
 due_on date,
 evidence_checked boolean not null default false,
 version integer not null default 1 check (version>0),
 updated_by uuid not null default auth.uid() references auth.users(id),
 updated_at timestamptz not null default now(),
 unique (plan_id,step_id),
 foreign key (plan_id,org_id) references public.sradar_plans(id,org_id),
 constraint sradar_no_unreviewed_closure check (status<>'done' or (evidence_checked=true and team<>'غير محدد'))
);

create table if not exists public.sradar_approvals (
 id uuid primary key default gen_random_uuid(),
 org_id uuid not null,
 task_id uuid not null references public.sradar_tasks(id),
 task_version integer not null check (task_version>0),
 outcome text not null check (outcome in ('approved','rejected')),
 approved_by uuid not null default auth.uid() references auth.users(id),
 approved_at timestamptz not null default now()
);

create table if not exists public.sradar_audit_events (
 id bigint generated always as identity primary key,
 org_id uuid not null references public.sradar_orgs(id),
 entity_kind text not null check (entity_kind in ('plan','task','approval')),
 entity_id uuid not null,
 event_kind text not null check (event_kind in ('created','changed','archived','approval')),
 actor_id uuid,
 occurred_at timestamptz not null default now(),
 before_state jsonb,
 after_state jsonb
);

create index if not exists sradar_task_org_idx on public.sradar_tasks(org_id,plan_id);
create index if not exists sradar_audit_org_idx on public.sradar_audit_events(org_id,occurred_at desc);
create index if not exists sradar_approval_task_idx on public.sradar_approvals(task_id,task_version,approved_at desc);

-- Enforce immutable tenant/decision ownership and server-authored audit metadata.
create or replace function public.sradar_plan_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
 if tg_op='UPDATE' then
  if new.org_id is distinct from old.org_id or
     new.decision_id is distinct from old.decision_id or
     new.created_by is distinct from old.created_by or
     new.created_at is distinct from old.created_at then
   raise exception 'Plan identity cannot be changed';
  end if;
  if new.archived is distinct from old.archived then
   insert into public.sradar_audit_events(org_id,entity_kind,entity_id,event_kind,actor_id,before_state,after_state)
   values(old.org_id,'plan',old.id,'archived',auth.uid(),jsonb_build_object('archived',old.archived),jsonb_build_object('archived',new.archived));
  end if;
 else
  insert into public.sradar_audit_events(org_id,entity_kind,entity_id,event_kind,actor_id,after_state)
  values(new.org_id,'plan',new.id,'created',auth.uid(),jsonb_build_object('decision_id',new.decision_id));
 end if;
 return new;
end;
$$;

-- AFTER insert is required for the plan log to reference an already-existing plan.
create or replace function public.sradar_plan_audit()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
 insert into public.sradar_audit_events(org_id,entity_kind,entity_id,event_kind,actor_id,before_state,after_state)
 values(new.org_id,'plan',new.id,'created',auth.uid(),null,jsonb_build_object('decision_id',new.decision_id));
 return new;
end;
$$;

-- plan_guard on UPDATE only; creation recorded by AFTER INSERT trigger.
drop trigger if exists sradar_plan_before_update on public.sradar_plans;
create trigger sradar_plan_before_update before update on public.sradar_plans
for each row execute function public.sradar_plan_guard();
drop trigger if exists sradar_plan_after_insert on public.sradar_plans;
create trigger sradar_plan_after_insert after insert on public.sradar_plans
for each row execute function public.sradar_plan_audit();

create or replace function public.sradar_task_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
 if tg_op='UPDATE' then
  if new.id is distinct from old.id or new.org_id is distinct from old.org_id
     or new.plan_id is distinct from old.plan_id or new.step_id is distinct from old.step_id then
   raise exception 'Task identity cannot be changed';
  end if;
  new.version:=old.version+1;
 end if;
 new.updated_by:=auth.uid();
 new.updated_at:=now();
 return new;
end;
$$;

create or replace function public.sradar_task_audit()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
 insert into public.sradar_audit_events(org_id,entity_kind,entity_id,event_kind,actor_id,before_state,after_state)
 values(new.org_id,'task',new.id,case when tg_op='INSERT' then 'created' else 'changed' end,auth.uid(),
  case when tg_op='INSERT' then null else jsonb_build_object('status',old.status,'team',old.team,'due_on',old.due_on,'evidence_checked',old.evidence_checked,'version',old.version) end,
  jsonb_build_object('status',new.status,'team',new.team,'due_on',new.due_on,'evidence_checked',new.evidence_checked,'version',new.version));
 return new;
end;
$$;

drop trigger if exists sradar_task_before_save on public.sradar_tasks;
create trigger sradar_task_before_save before insert or update on public.sradar_tasks
for each row execute function public.sradar_task_guard();
drop trigger if exists sradar_task_after_save on public.sradar_tasks;
create trigger sradar_task_after_save after insert or update on public.sradar_tasks
for each row execute function public.sradar_task_audit();

create or replace function public.sradar_approval_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare match_count integer;
begin
 select count(*) into match_count from public.sradar_tasks t
 where t.id=new.task_id and t.org_id=new.org_id and t.version=new.task_version
   and t.status='done' and t.evidence_checked=true;
 if match_count<>1 then raise exception 'Task is not complete or approval version is stale'; end if;
 new.approved_by:=auth.uid();
 new.approved_at:=now();
 return new;
end;
$$;

create or replace function public.sradar_approval_audit()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
 insert into public.sradar_audit_events(org_id,entity_kind,entity_id,event_kind,actor_id,after_state)
 values(new.org_id,'approval',new.id,'approval',auth.uid(),jsonb_build_object('task_id',new.task_id,'task_version',new.task_version,'outcome',new.outcome));
 return new;
end;
$$;

drop trigger if exists sradar_approval_before_insert on public.sradar_approvals;
create trigger sradar_approval_before_insert before insert on public.sradar_approvals
for each row execute function public.sradar_approval_guard();
drop trigger if exists sradar_approval_after_insert on public.sradar_approvals;
create trigger sradar_approval_after_insert after insert on public.sradar_approvals
for each row execute function public.sradar_approval_audit();

alter table public.sradar_orgs enable row level security;
alter table public.sradar_members enable row level security;
alter table public.sradar_plans enable row level security;
alter table public.sradar_tasks enable row level security;
alter table public.sradar_approvals enable row level security;
alter table public.sradar_audit_events enable row level security;

drop policy if exists sradar_org_read on public.sradar_orgs;
create policy sradar_org_read on public.sradar_orgs for select to authenticated
using (public.sradar_has_role(id,array['owner','manager','editor','viewer']));

drop policy if exists sradar_members_read on public.sradar_members;
create policy sradar_members_read on public.sradar_members for select to authenticated
using (user_id=auth.uid() or public.sradar_has_role(org_id,array['owner','manager']));

drop policy if exists sradar_plans_read on public.sradar_plans;
create policy sradar_plans_read on public.sradar_plans for select to authenticated
using (public.sradar_has_role(org_id,array['owner','manager','editor','viewer']));
drop policy if exists sradar_plans_insert on public.sradar_plans;
create policy sradar_plans_insert on public.sradar_plans for insert to authenticated
with check (created_by=auth.uid() and public.sradar_has_role(org_id,array['owner','manager','editor']));
drop policy if exists sradar_plans_update on public.sradar_plans;
create policy sradar_plans_update on public.sradar_plans for update to authenticated
using (public.sradar_has_role(org_id,array['owner','manager','editor']))
with check (public.sradar_has_role(org_id,array['owner','manager','editor']));

drop policy if exists sradar_tasks_read on public.sradar_tasks;
create policy sradar_tasks_read on public.sradar_tasks for select to authenticated
using (public.sradar_has_role(org_id,array['owner','manager','editor','viewer']));
drop policy if exists sradar_tasks_insert on public.sradar_tasks;
create policy sradar_tasks_insert on public.sradar_tasks for insert to authenticated
with check (public.sradar_has_role(org_id,array['owner','manager','editor']) and updated_by=auth.uid());
drop policy if exists sradar_tasks_update on public.sradar_tasks;
create policy sradar_tasks_update on public.sradar_tasks for update to authenticated
using (public.sradar_has_role(org_id,array['owner','manager','editor']))
with check (public.sradar_has_role(org_id,array['owner','manager','editor']));

drop policy if exists sradar_approvals_read on public.sradar_approvals;
create policy sradar_approvals_read on public.sradar_approvals for select to authenticated
using (public.sradar_has_role(org_id,array['owner','manager','editor','viewer']));
drop policy if exists sradar_approvals_insert on public.sradar_approvals;
create policy sradar_approvals_insert on public.sradar_approvals for insert to authenticated
with check (approved_by=auth.uid() and public.sradar_has_role(org_id,array['owner','manager']));

drop policy if exists sradar_audit_read on public.sradar_audit_events;
create policy sradar_audit_read on public.sradar_audit_events for select to authenticated
using (public.sradar_has_role(org_id,array['owner','manager','editor','viewer']));

-- Explicit grants: anonymous visitors cannot read/write operational data.
revoke all on public.sradar_orgs,public.sradar_members,public.sradar_plans,
 public.sradar_tasks,public.sradar_approvals,public.sradar_audit_events from anon,authenticated;
grant select on public.sradar_orgs,public.sradar_members,public.sradar_plans,public.sradar_tasks,
 public.sradar_approvals,public.sradar_audit_events to authenticated;
grant insert on public.sradar_plans,public.sradar_tasks,public.sradar_approvals to authenticated;
grant update(archived) on public.sradar_plans to authenticated;
grant update(status,team,due_on,evidence_checked) on public.sradar_tasks to authenticated;

revoke all on function public.sradar_has_role(uuid,text[]) from public,anon;
grant execute on function public.sradar_has_role(uuid,text[]) to authenticated;
revoke all on function public.sradar_plan_guard(),public.sradar_plan_audit(),
 public.sradar_task_guard(),public.sradar_task_audit(),
 public.sradar_approval_guard(),public.sradar_approval_audit() from public,anon,authenticated;
commit;

-- Setup: after users have signed up, a privileged administrator must insert
-- one org and membership rows for the approved auth.users UUIDs.
-- Do not publish service_role credentials. Never embed private IDs in GitHub.
-- Approvals remain valid for a task only while its version equals task_version.
