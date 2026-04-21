import os
import uuid
import datetime
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from typing import List, Optional, Dict
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = None

if url and key:
    supabase = create_client(url, key)
else:
    print("WARNING: SUPABASE_URL or SUPABASE_KEY not found in environment variables.")

app = FastAPI(title="Sports Fandom Social Layer")

app.mount("/static", StaticFiles(directory="static"), name="static")

templates = Jinja2Templates(directory="templates")

class CommentReq(BaseModel):
    match_id: str
    user_name: str
    text: str
    parent_id: Optional[str] = None

class ReactionReq(BaseModel):
    match_id: str
    comment_id: str
    emoji: str

class RegisterReq(BaseModel):
    username: str
    password: str
    favorite_teams: List[str] = []

class LoginReq(BaseModel):
    username: str
    password: str

class UpdatePrefReq(BaseModel):
    username: str
    favorite_teams: List[str]

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    teams, matches = [], []
    if supabase:
        try:
            teams_resp = supabase.table("teams").select("*").execute()
            matches_resp = supabase.table("matches").select("*").execute()
            teams = teams_resp.data
            matches = matches_resp.data
        except Exception as e:
            print("Error fetching SSR data from Supabase:", e)
    return templates.TemplateResponse(request=request, name="index.html", context={"teams": teams, "matches": matches})

@app.post("/api/register")
async def register(req: RegisterReq):
    try:
        resp = supabase.table("users").select("id").eq("username", req.username).execute()
        if len(resp.data) > 0:
            return {"status": "error", "message": "Username already taken."}

        new_user = {
            "username": req.username,
            "password_hash": req.password,
            "favorite_team_ids": req.favorite_teams
        }
        res = supabase.table("users").insert(new_user).execute()
        return {"status": "success", "username": req.username, "favorite_team_ids": req.favorite_teams}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/login")
async def login(req: LoginReq):
    try:
        resp = supabase.table("users").select("*").eq("username", req.username).eq("password_hash", req.password).execute()
        if len(resp.data) > 0:
            u = resp.data[0]
            favs = u.get("favorite_team_ids") or []
            return {"status": "success", "username": u["username"], "favorite_team_ids": favs}
        return {"status": "error", "message": "Invalid username or password."}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/update_preferences")
async def update_preferences(req: UpdatePrefReq):
    try:
        supabase.table("users").update({"favorite_team_ids": req.favorite_teams}).eq("username", req.username).execute()
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/matches")
async def get_matches():
    try:
        matches_resp = supabase.table("matches").select("*").execute()
        teams_resp = supabase.table("teams").select("*").execute()
        teams_dict = {t["id"]: t for t in teams_resp.data}
        return {"matches": matches_resp.data, "teams": teams_dict}
    except Exception as e:
        print("Error fetching matches", e)
        return {"matches": [], "teams": {}}

@app.get("/api/chat/{match_id}")
async def get_chat(match_id: str):
    try:
        resp = supabase.table("comments").select("*").eq("match_id", match_id).order("timestamp", desc=False).execute()
        comments = resp.data
        
        comment_map = {c["id"]: c for c in comments}
        for c in comments:
            c["replies"] = []
            if "reactions" not in c or not c["reactions"]:
                c["reactions"] = {}
                
        root_comments = []
        for c in comments:
            if c.get("parent_id"):
                parent = comment_map.get(c["parent_id"])
                if parent:
                    parent["replies"].append(c)
                else:
                    root_comments.append(c)
            else:
                root_comments.append(c)
        return {"comments": root_comments}
    except Exception as e:
        print("Error fetching chat", e)
        return {"comments": []}

@app.post("/api/chat")
async def post_comment(req: CommentReq):
    try:
        new_comment = {
            "id": "c_" + str(uuid.uuid4())[:8],
            "match_id": req.match_id,
            "text": req.text,
            "user_name": req.user_name,
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
            "parent_id": req.parent_id,
            "reactions": {}
        }
        res = supabase.table("comments").insert(new_comment).execute()
        new_comment["replies"] = []
        return {"status": "success", "comment": new_comment}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/react")
async def react_comment(req: ReactionReq):
    try:
        resp = supabase.table("comments").select("reactions").eq("id", req.comment_id).execute()
        if not resp.data:
            return {"status": "error", "message": "Comment not found"}
            
        reactions = resp.data[0].get("reactions") or {}
        reactions[req.emoji] = reactions.get(req.emoji, 0) + 1
        
        supabase.table("comments").update({"reactions": reactions}).eq("id", req.comment_id).execute()
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
