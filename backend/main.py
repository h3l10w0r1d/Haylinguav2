# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import Base, engine
from db_utils import seed_alphabet_lessons
from routes import router as api_router

app = FastAPI()

# be generous during development – avoids CORS hell
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],           # or ["http://localhost:5173", "https://haylinguav2.vercel.app"]
    allow_credentials=False,       # keep False if using "*"
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    # create tables
    Base.metadata.create_all(bind=engine)
    # seed sample alphabet lessons
    seed_alphabet_lessons()


# all API routes live in routes.py
app.include_router(api_router)
