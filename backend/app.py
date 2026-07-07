"""
Voyage 後端（Cloud Run / FastAPI）
- 吐出前端 index.html（跟 NTPU AI 一樣，前後端同一個容器）
- /api/gemini：伺服器端代理 Gemini，金鑰只在伺服器（環境變數 / Secret Manager）
  只有帶著有效 Firebase 登入 token 的請求才會被處理
Firebase 只當資料庫（Firestore）+ 登入（Auth），由前端 SDK 直接使用。
"""
import os
import json

import httpx
import firebase_admin
from firebase_admin import auth as fb_auth
from fastapi import FastAPI, Request, HTTPException, Header
from fastapi.responses import FileResponse, JSONResponse

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
)

# 用預設憑證初始化（Cloud Run 會自動帶專案），只用來驗證前端傳來的登入 token
firebase_admin.initialize_app()

app = FastAPI(title="Voyage backend")

INDEX_PATH = os.path.join(os.path.dirname(__file__), "index.html")


@app.get("/healthz")
def healthz():
    return {"ok": True}


@app.get("/")
def index():
    return FileResponse(INDEX_PATH)


@app.post("/api/gemini")
async def gemini(request: Request, authorization: str = Header(default="")):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="server-not-configured")

    # 驗證呼叫者是已登入的使用者
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="unauthorized")
    token = authorization[len("Bearer "):]
    try:
        fb_auth.verify_id_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="unauthorized")

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


# 其餘路徑一律回前端（單頁應用）
@app.get("/{full_path:path}")
def spa(full_path: str):
    return FileResponse(INDEX_PATH)
