"""
Voyage 後端（Cloud Run / FastAPI）
- 吐出前端 index.html（跟 NTPU AI 一樣，前後端同一個容器）
- /api/gemini：伺服器端代理 Gemini，金鑰只在伺服器（環境變數 / Secret Manager）
  只有帶著有效 Firebase 登入 token 的請求才會被處理
Firebase 只當資料庫（Firestore）+ 登入（Auth），由前端 SDK 直接使用。
"""
import os
import json
import secrets
from urllib.parse import urlencode
from datetime import datetime, timedelta, timezone

import httpx
import firebase_admin
from firebase_admin import auth as fb_auth
from firebase_admin import firestore as fb_firestore
from fastapi import FastAPI, Request, HTTPException, Header
from fastapi.responses import FileResponse, JSONResponse, HTMLResponse

# .strip() 很重要：secret 若被 PowerShell 管線帶入結尾換行(\r\n)，
# 直接拼進 URL 會讓 httpx 丟 InvalidURL
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash").strip()
GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
)

GCAL_CLIENT_ID = os.environ.get("GCAL_CLIENT_ID", "").strip()
GCAL_CLIENT_SECRET = os.environ.get("GCAL_CLIENT_SECRET", "").strip()
GCAL_REDIRECT_URI = os.environ.get("GCAL_REDIRECT_URI", "").strip()
GCAL_SCOPE = "https://www.googleapis.com/auth/calendar.events"

# 用預設憑證初始化（Cloud Run 會自動帶專案），只用來驗證前端傳來的登入 token
firebase_admin.initialize_app()
db = fb_firestore.client()

app = FastAPI(title="Voyage backend")

INDEX_PATH = os.path.join(os.path.dirname(__file__), "index.html")


@app.get("/healthz")
def healthz():
    return {"ok": True}


@app.get("/")
def index():
    return FileResponse(INDEX_PATH)


def require_uid(authorization: str) -> str:
    """驗證 Bearer token，回傳呼叫者的 uid；失敗就丟 401。"""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="unauthorized")
    token = authorization[len("Bearer "):]
    try:
        decoded = fb_auth.verify_id_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="unauthorized")
    return decoded["uid"]


@app.post("/api/gemini")
async def gemini(request: Request, authorization: str = Header(default="")):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="server-not-configured")
    require_uid(authorization)

    body = await request.json()
    system = body.get("system")
    user = body.get("user")
    image = body.get("image")
    schema = body.get("schema")

    parts = []
    if image:
        parts.append(
            {"inline_data": {"mime_type": image.get("mimeType"), "data": image.get("data")}}
        )
    parts.append({"text": user})

    payload = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": schema,
            "temperature": 0.3,
        },
    }

    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(f"{GEMINI_URL}?key={GEMINI_API_KEY}", json=payload)

    if r.status_code != 200:
        # 把 Gemini 的狀態碼透傳給前端，讓 fnErr 能正確判斷（429 額度、404 模型等）
        raise HTTPException(status_code=r.status_code, detail="gemini-error")

    j = r.json()
    candidates = j.get("candidates") or []
    parts_out = (candidates[0].get("content", {}).get("parts", []) if candidates else [])
    text = "".join(p.get("text", "") for p in parts_out)
    try:
        return JSONResponse(json.loads(text))
    except Exception:
        raise HTTPException(status_code=502, detail="bad-ai-response")


# ===== Google Calendar（OAuth 串接） =====
# refresh token 只存在 Firestore 的 google_tokens/{uid}，這個 collection 的
# security rules 對 client 一律 deny，只有這裡的 Admin SDK 能讀寫。
OAUTH_STATE_TTL = timedelta(minutes=10)


def _gcal_configured() -> bool:
    return bool(GCAL_CLIENT_ID and GCAL_CLIENT_SECRET and GCAL_REDIRECT_URI)


@app.post("/api/google/connect-url")
async def google_connect_url(authorization: str = Header(default="")):
    if not _gcal_configured():
        raise HTTPException(status_code=500, detail="server-not-configured")
    uid = require_uid(authorization)

    nonce = secrets.token_urlsafe(24)
    db.collection("oauth_states").document(nonce).set({
        "uid": uid,
        "createdAt": fb_firestore.SERVER_TIMESTAMP,
    })

    params = {
        "client_id": GCAL_CLIENT_ID,
        "redirect_uri": GCAL_REDIRECT_URI,
        "response_type": "code",
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
        "scope": GCAL_SCOPE,
        "state": nonce,
    }
    return {"url": "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)}


def _gcal_popup_response(ok: bool) -> HTMLResponse:
    msg = "gcal-connected" if ok else "gcal-error"
    html = f"""<!doctype html><html><body>
<script>
  if (window.opener) {{ window.opener.postMessage({{type:'{msg}'}}, window.location.origin); }}
  window.close();
</script>
{'已連結，這個視窗可以關閉。' if ok else '連結失敗，請關閉這個視窗再試一次。'}
</body></html>"""
    return HTMLResponse(html)


@app.get("/api/google/callback")
async def google_callback(code: str = "", state: str = ""):
    if not _gcal_configured() or not code or not state:
        return _gcal_popup_response(False)

    state_ref = db.collection("oauth_states").document(state)
    snap = state_ref.get()
    if not snap.exists:
        return _gcal_popup_response(False)
    state_data = snap.to_dict() or {}
    state_ref.delete()

    created_at = state_data.get("createdAt")
    if created_at and (datetime.now(timezone.utc) - created_at) > OAUTH_STATE_TTL:
        return _gcal_popup_response(False)
    uid = state_data.get("uid")
    if not uid:
        return _gcal_popup_response(False)

    async with httpx.AsyncClient(timeout=30) as client:
        token_r = await client.post("https://oauth2.googleapis.com/token", data={
            "code": code,
            "client_id": GCAL_CLIENT_ID,
            "client_secret": GCAL_CLIENT_SECRET,
            "redirect_uri": GCAL_REDIRECT_URI,
            "grant_type": "authorization_code",
        })
        if token_r.status_code != 200:
            return _gcal_popup_response(False)
        tokens = token_r.json()
        refresh_token = tokens.get("refresh_token")
        access_token = tokens.get("access_token")
        if not refresh_token:
            # 使用者之前已同意過、這次沒拿到新的 refresh_token；沿用舊的（若有）
            existing = db.collection("google_tokens").document(uid).get()
            if existing.exists:
                refresh_token = (existing.to_dict() or {}).get("refreshToken")
        if not refresh_token or not access_token:
            return _gcal_popup_response(False)

        email = ""
        if access_token:
            info_r = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if info_r.status_code == 200:
                email = info_r.json().get("email", "")

    db.collection("google_tokens").document(uid).set({
        "refreshToken": refresh_token,
        "email": email,
        "connectedAt": fb_firestore.SERVER_TIMESTAMP,
    })
    return _gcal_popup_response(True)


@app.get("/api/google/status")
async def google_status(authorization: str = Header(default="")):
    uid = require_uid(authorization)
    snap = db.collection("google_tokens").document(uid).get()
    if not snap.exists:
        return {"connected": False, "email": None}
    return {"connected": True, "email": (snap.to_dict() or {}).get("email")}


@app.post("/api/google/disconnect")
async def google_disconnect(authorization: str = Header(default="")):
    uid = require_uid(authorization)
    ref = db.collection("google_tokens").document(uid)
    snap = ref.get()
    if snap.exists:
        refresh_token = (snap.to_dict() or {}).get("refreshToken")
        if refresh_token:
            async with httpx.AsyncClient(timeout=15) as client:
                try:
                    await client.post("https://oauth2.googleapis.com/revoke", data={"token": refresh_token})
                except Exception:
                    pass
        ref.delete()
    return {"ok": True}


async def _gcal_access_token(uid: str) -> str:
    snap = db.collection("google_tokens").document(uid).get()
    if not snap.exists:
        raise HTTPException(status_code=409, detail="gcal-not-connected")
    refresh_token = (snap.to_dict() or {}).get("refreshToken")
    if not refresh_token:
        raise HTTPException(status_code=409, detail="gcal-not-connected")
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post("https://oauth2.googleapis.com/token", data={
            "client_id": GCAL_CLIENT_ID,
            "client_secret": GCAL_CLIENT_SECRET,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        })
    if r.status_code != 200:
        raise HTTPException(status_code=409, detail="gcal-not-connected")
    return r.json()["access_token"]


def _gcal_event_body(item: dict) -> dict:
    day = item.get("day", "")
    time_s = (item.get("time") or "").strip()
    title = (item.get("title") or "").strip() or "行程"
    note = (item.get("note") or "").strip()
    place = (item.get("map") or "").strip()

    body = {"summary": title}
    desc_lines = [l for l in [note, place if place.startswith("http") else ""] if l]
    if desc_lines:
        body["description"] = "\n".join(desc_lines)
    if place and not place.startswith("http"):
        body["location"] = place

    if time_s:
        start_dt = datetime.strptime(f"{day} {time_s}", "%Y-%m-%d %H:%M")
        end_dt = start_dt + timedelta(minutes=90)
        body["start"] = {"dateTime": start_dt.strftime("%Y-%m-%dT%H:%M:%S"), "timeZone": "Asia/Taipei"}
        body["end"] = {"dateTime": end_dt.strftime("%Y-%m-%dT%H:%M:%S"), "timeZone": "Asia/Taipei"}
    else:
        start_d = datetime.strptime(day, "%Y-%m-%d")
        end_d = start_d + timedelta(days=1)
        body["start"] = {"date": start_d.strftime("%Y-%m-%d")}
        body["end"] = {"date": end_d.strftime("%Y-%m-%d")}
    return body


@app.post("/api/google/events")
async def google_events(request: Request, authorization: str = Header(default="")):
    if not _gcal_configured():
        raise HTTPException(status_code=500, detail="server-not-configured")
    uid = require_uid(authorization)
    body = await request.json()
    items = body.get("items") or []
    if not items:
        return {"results": []}

    access_token = await _gcal_access_token(uid)
    headers = {"Authorization": f"Bearer {access_token}"}
    base = "https://www.googleapis.com/calendar/v3/calendars/primary/events"

    results = []
    async with httpx.AsyncClient(timeout=30) as client:
        for item in items:
            try:
                event_body = _gcal_event_body(item)
            except Exception:
                continue
            existing_id = item.get("gcalEventId")
            if existing_id:
                r = await client.patch(f"{base}/{existing_id}", json=event_body, headers=headers)
            else:
                r = await client.post(base, json=event_body, headers=headers)
            if r.status_code not in (200, 201):
                continue
            j = r.json()
            results.append({"id": item.get("id"), "gcalEventId": j.get("id"), "htmlLink": j.get("htmlLink")})

    return {"results": results}


# 其餘路徑一律回前端（單頁應用）
@app.get("/{full_path:path}")
def spa(full_path: str):
    return FileResponse(INDEX_PATH)
