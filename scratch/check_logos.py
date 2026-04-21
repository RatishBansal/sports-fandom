import psycopg2
import sys

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

conn_str = "postgresql://postgres:IChUTurODyIklQqK@db.abukpakscmflplcccssk.supabase.co:5432/postgres"

def check_logos():
    try:
        conn = psycopg2.connect(conn_str)
        c = conn.cursor()
        c.execute("SELECT id, name, logo FROM public.teams")
        teams = c.fetchall()
        for t in teams:
            logo = t[2]
            is_path = logo.startswith('/')
            print(f"ID: {t[0]}, Name: {t[1]}, Logo: {logo}, IsPath: {is_path}")
        c.close()
        conn.close()
    except Exception as e:
        print("Error:", e)

if __name__ == '__main__':
    check_logos()
