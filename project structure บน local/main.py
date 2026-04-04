# backend/main.py
# ============================================================
#  Entry point — FastAPI + MCP mounted
# ============================================================

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="WMS API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # local dev เท่านั้น
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check
@app.get("/health")
async def health():
    return {"status": "ok", "service": "WMS API"}

# WMS Routes (จาก 02_fastapi_endpoints.py)
# from routers import orders, inventory, returns, pms
# app.include_router(orders.router, prefix="/api")
# app.include_router(inventory.router, prefix="/api")

# Mount MCP Server — Claude เชื่อมที่ /mcp
from mcp_server import mcp_app
app.mount("/mcp", mcp_app)

# ============================================================
# รัน: uvicorn main:app --reload --port 8000
# ============================================================
