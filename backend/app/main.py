from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text


from app.database import engine
from app.routes.search import router as search_router
from app.routes.leads import router as leads_router
from app.routes.dashboard import router as dashboard_router
from app.routes.export import router as export_router
from app.routes.search_history import router as search_history_router
from app.routes.users import router as users_router
from app.routes.lead_status import router as lead_status_router



app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search_router)
app.include_router(leads_router)
app.include_router(dashboard_router)
app.include_router(export_router)
app.include_router(search_history_router)
app.include_router(users_router)
app.include_router(lead_status_router)

@app.get("/")
def root():
    return {
        "message": "Tynato CRM API Running"
    }

@app.get("/db-test")
def db_test():

    with engine.connect() as conn:

        result = conn.execute(
            text("SELECT NOW()")
        )

        return {
            "status": "connected",
            "time": str(result.scalar())
        }