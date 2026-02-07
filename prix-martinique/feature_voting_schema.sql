-- Feature Requests and Voting Schema for Milestone 3

-- Status enum for feature requests
CREATE TYPE feature_request_status AS ENUM ('under_review', 'planned', 'in_progress', 'completed', 'rejected');

-- Feature Requests table
CREATE TABLE feature_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT, -- e.g., 'UI', 'Data', 'Scanner', 'Community'
    status feature_request_status DEFAULT 'under_review',
    admin_comment TEXT
);

-- Feature Votes table (to track unique votes)
CREATE TABLE feature_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    feature_id UUID REFERENCES feature_requests(id) ON DELETE CASCADE,
    vote_type INTEGER CHECK (vote_type IN (1, -1)), -- 1 for upvote, -1 for downvote
    UNIQUE(user_id, feature_id)
);

-- Enable RLS
ALTER TABLE feature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_votes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for feature_requests
CREATE POLICY "Public feature requests are viewable by everyone" 
ON feature_requests FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create feature requests" 
ON feature_requests FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own feature requests" 
ON feature_requests FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can update all feature requests" 
ON feature_requests FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- RLS Policies for feature_votes
CREATE POLICY "Votes are viewable by everyone" 
ON feature_votes FOR SELECT USING (true);

CREATE POLICY "Authenticated users can vote" 
ON feature_votes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can change their vote" 
ON feature_votes FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can remove their vote" 
ON feature_votes FOR DELETE USING (auth.uid() = user_id);

-- Cumulative vote count view/function for performance (optional but helpful)
CREATE VIEW feature_request_stats AS
SELECT 
    f.id,
    f.title,
    f.status,
    COALESCE(SUM(v.vote_type), 0) as net_votes,
    COUNT(v.id) FILTER (WHERE v.vote_type = 1) as upvotes,
    COUNT(v.id) FILTER (WHERE v.vote_type = -1) as downvotes
FROM feature_requests f
LEFT JOIN feature_votes v ON f.id = v.feature_id
GROUP BY f.id;
