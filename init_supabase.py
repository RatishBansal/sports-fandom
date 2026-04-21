import psycopg2

conn_str = "postgresql://postgres:IChUTurODyIklQqK@db.abukpakscmflplcccssk.supabase.co:5432/postgres"

def init_db():
    try:
        print("Connecting to Supabase PostgreSQL...")
        conn = psycopg2.connect(conn_str)
        conn.autocommit = True
        c = conn.cursor()
        
        c.execute("""
        CREATE TABLE IF NOT EXISTS public.teams (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            short_name TEXT NOT NULL,
            logo TEXT,
            color TEXT
        );

        CREATE TABLE IF NOT EXISTS public.users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            favorite_team_ids JSONB
        );

        CREATE TABLE IF NOT EXISTS public.matches (
            id TEXT PRIMARY KEY,
            team1_id TEXT REFERENCES public.teams(id),
            team2_id TEXT REFERENCES public.teams(id),
            status TEXT NOT NULL,
            date TEXT NOT NULL,
            result TEXT,
            score_summary TEXT
        );

        CREATE TABLE IF NOT EXISTS public.comments (
            id TEXT PRIMARY KEY,
            match_id TEXT REFERENCES public.matches(id),
            text TEXT NOT NULL,
            user_name TEXT NOT NULL,
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            parent_id TEXT REFERENCES public.comments(id),
            reactions JSONB DEFAULT '{}'::jsonb
        );
        """)
        
        print("Tables created successfully. Now inserting initial data if empty...")
        
        c.execute("SELECT count(*) FROM public.teams")
        if c.fetchone()[0] == 0:
            c.execute("""
            INSERT INTO public.teams (id, name, short_name, logo, color) VALUES
            ('t1', 'Mumbai Indians', 'MI', '🏏', '#004BA0'),
            ('t2', 'Chennai Super Kings', 'CSK', '🦁', '#FFFF3C'),
            ('t3', 'Royal Challengers Bangalore', 'RCB', '👑', '#EC1C24'),
            ('t4', 'Kolkata Knight Riders', 'KKR', '💜', '#3A225D');
            """)
            print("Teams inserted.")
            
        c.execute("SELECT count(*) FROM public.matches")
        if c.fetchone()[0] == 0:
            c.execute("""
            INSERT INTO public.matches (id, team1_id, team2_id, status, date, result, score_summary) VALUES 
            ('m1', 't1', 't2', 'live', 'Today, 7:30 PM', NULL, 'MI: 120/4 (15.2 ov) | CSK: Yet to bat'),
            ('m2', 't3', 't4', 'upcoming', 'Tomorrow, 7:30 PM', NULL, NULL),
            ('m3', 't1', 't3', 'completed', 'Yesterday, 3:30 PM', 'MI won by 15 runs', 'MI: 185/6 | RCB: 170/8');
            """)
            print("Matches inserted.")
            
        print("Initialization completed!")
        
        c.close()
        conn.close()
        
    except Exception as e:
        print("Error initializing DB:", e)

if __name__ == '__main__':
    init_db()
