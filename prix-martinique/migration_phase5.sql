-- Add city to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS city TEXT;

-- Create price_likes table for "Community Thank You"
CREATE TABLE IF NOT EXISTS price_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    price_id UUID NOT NULL REFERENCES prices(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(price_id, user_id) -- One like per user per price
);

-- Enable RLS
ALTER TABLE price_likes ENABLE ROW LEVEL SECURITY;

-- Policies for price_likes
CREATE POLICY "Anyone can view likes" ON price_likes
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can like prices" ON price_likes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own likes" ON price_likes
    FOR DELETE USING (auth.uid() = user_id);
