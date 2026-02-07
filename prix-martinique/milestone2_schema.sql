-- Add consumes_bqp to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS consumes_bqp TEXT CHECK (consumes_bqp IN ('yes', 'no', 'partial'));

-- Create bqp_quality_votes table
CREATE TABLE IF NOT EXISTS bqp_quality_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    vote INTEGER CHECK (vote IN (-1, 1)), -- -1 for thumbs down, 1 for thumbs up
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

-- Enable RLS
ALTER TABLE bqp_quality_votes ENABLE ROW LEVEL SECURITY;

-- Policies for bqp_quality_votes
-- Drop existing policies if they exist to avoid errors on rerun
DROP POLICY IF EXISTS "Users can view all votes" ON bqp_quality_votes;
DROP POLICY IF EXISTS "Users can insert their own votes" ON bqp_quality_votes;
DROP POLICY IF EXISTS "Users can update their own votes" ON bqp_quality_votes;
DROP POLICY IF EXISTS "Users can delete their own votes" ON bqp_quality_votes;

CREATE POLICY "Users can view all votes" ON bqp_quality_votes FOR SELECT USING (true);
CREATE POLICY "Users can insert their own votes" ON bqp_quality_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own votes" ON bqp_quality_votes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own votes" ON bqp_quality_votes FOR DELETE USING (auth.uid() = user_id);
