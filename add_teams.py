import psycopg2

conn_str = "postgresql://postgres:IChUTurODyIklQqK@db.abukpakscmflplcccssk.supabase.co:5432/postgres"

def add_more_teams():
    try:
        conn = psycopg2.connect(conn_str)
        conn.autocommit = True
        c = conn.cursor()
        
        # Additional 6 teams to make 10 total
        more_teams = [
            ('t5', 'Sunrisers Hyderabad', 'SRH', '🦅', '#FF822A'),
            ('t6', 'Delhi Capitals', 'DC', '🐅', '#004C93'),
            ('t7', 'Punjab Kings', 'PBKS', '🦁', '#ED1B24'),
            ('t8', 'Rajasthan Royals', 'RR', '👑', '#EA1A85'),
            ('t9', 'Lucknow Super Giants', 'LSG', '🏏', '#001C60'),
            ('t10', 'Gujarat Titans', 'GT', '⚓', '#1B2133')
        ]
        
        # ON CONFLICT DO NOTHING to ensure we don't crash if they exist
        c.executemany("""
            INSERT INTO public.teams (id, name, short_name, logo, color) 
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING
        """, more_teams)
        
        # Add some upcoming matches for the new teams
        more_matches = [
            ('m4', 't5', 't6', 'upcoming', 'Next Sunday, 3:30 PM', None, None),
            ('m5', 't8', 't10', 'upcoming', 'Next Sunday, 7:30 PM', None, None),
            ('m6', 't9', 't7', 'upcoming', 'Monday, 7:30 PM', None, None)
        ]
        
        try:
            c.executemany("""
                INSERT INTO public.matches (id, team1_id, team2_id, status, date, result, score_summary) 
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
            """, more_matches)
        except Exception as ignored:
            pass
            
        print("Successfully added 6 more teams to Supabase.")
        
        c.close()
        conn.close()
        
    except Exception as e:
        print("Error adding teams to DB:", e)

if __name__ == '__main__':
    add_more_teams()
