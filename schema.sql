-- Create pets table
create table public.pets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text default '',
  note text default '',
  color text not null,
  scale_x numeric not null,
  scale_y numeric not null,
  scale_z numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.pets enable row level security;

-- RLS Policies
create policy "Users can view their own pets" 
  on public.pets for select 
  using (auth.uid() = user_id);

create policy "Users can insert their own pets" 
  on public.pets for insert 
  with check (auth.uid() = user_id);

create policy "Users can update their own pets" 
  on public.pets for update 
  using (auth.uid() = user_id);

create policy "Users can delete their own pets" 
  on public.pets for delete 
  using (auth.uid() = user_id);
