alter table public.roadtrip_history
add column if not exists is_example boolean not null default false;

create policy "roadtrip_history_update_example"
on public.roadtrip_history
for update
to anon
using (true)
with check (true);
