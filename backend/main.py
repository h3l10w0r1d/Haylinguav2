from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import router as api_router
from db_utils import seed_alphabet_lessons


app = FastAPI(title="Haylingua API")

# CORS settings – update this list if you add more frontends
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://haylingua-frontend.onrender.com",
    "https://haylinguav2.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    """Run once on app startup.

    We seed the alphabet lessons if they are missing. There are debug prints
    so you can see this in the Render logs.
    """
    print("[main] FastAPI startup…")
    try:
        seed_alphabet_lessons()
        print("[main] seed_alphabet_lessons() completed successfully")
    except Exception as e:
        # This will show full traceback in logs, which is what we want for now
        import traceback

        print("[main] ERROR while seeding lessons:", e)
        traceback.print_exc()


@app.get("/health")
async def health_check():
    return {"status": "ok"}


# Mount all API routes under the main app
app.include_router(api_router)
