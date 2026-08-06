from fastapi import FastAPI
from backend.logging_config import logger
from backend.config import settings
from backend.db.base import Base
from backend.db.session import engine
from backend.routes.alerts import router as alerts_router, ws_router
from backend.routes.events import router as events_router
from backend.routes.agent_routes import router as agents_router, root_agent_router
from backend.routes.admin_routes import router as admin_router
from backend.routes.auth_routes import router as auth_router, org_router
from backend.routes.notifications import router as notifications_router

# Initialize SQL tables
Base.metadata.create_all(bind=engine)
logger.info("Database tables initialized successfully.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    debug=settings.DEBUG,
)

logger.info("Starting CipherWatch FastAPI Application (v{})", settings.VERSION)

app.include_router(events_router)
app.include_router(alerts_router)
app.include_router(agents_router)
app.include_router(root_agent_router)
app.include_router(admin_router)
app.include_router(auth_router)
app.include_router(org_router)
app.include_router(ws_router)
app.include_router(notifications_router)



@app.get("/api/health")
def health_check():
    """Health check endpoint returning application status."""
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, log_config=None, reload=True)

