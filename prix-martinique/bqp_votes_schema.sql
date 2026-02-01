-- Community Voting Schema for BQP Associations

-- 1. Create Votes Table
create table if not exists bqp_votes (
  id uuid primary key default uuid_generate_v4(),
  association_id uuid references product_bqp_associations(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  vote_type integer not null check (vote_type in (1, -1)), -- 1 for Upvote (Confirm), -1 for Downvote (Report Incorrect)
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,

  -- Ensure one vote per user per association
  unique(association_id, user_id)
);

-- 2. Enable RLS
alter table bqp_votes enable row level security;

-- Policies
-- Anyone can read votes (to show "12 people confirmed this")
create policy "Votes are public" on bqp_votes
  for select using (true);

-- Authenticated users can vote
create policy "Users can vote" on bqp_votes
  for insert with check (auth.uid() = user_id);

-- Users can change their own vote
create policy "Users can update own vote" on bqp_votes
  for update using (auth.uid() = user_id);

-- Users can remove their vote
create policy "Users can delete own vote" on bqp_votes
  for delete using (auth.uid() = user_id);


-- 3. Trigger to Auto-Update Vote Counts
-- Function to recalculate the score (sum of votes)
create or replace function update_bqp_votes_count()
returns trigger as $$
begin
  -- Update the parent association table
  -- We calculate the net score (Upvotes - Downvotes) or just count of confirmations?
  -- Let's stick to simple "Count of Upvotes - Count of Downvotes" for now.
  
  update product_bqp_associations
  set votes_count = (
    select coalesce(sum(vote_type), 0)
    from bqp_votes
    where association_id = coalesce(new.association_id, old.association_id)
  )
  where id = coalesce(new.association_id, old.association_id);
  
  return new;
end;
$$ language plpgsql security definer;

-- Trigger on Insert/Update/Delete
drop trigger if exists on_vote_change on bqp_votes;
create trigger on_vote_change
after insert or update or delete on bqp_votes
for each row execute function update_bqp_votes_count();
