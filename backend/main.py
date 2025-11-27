from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import SessionLocal, engine
from models import Base, User
from auth import hash_password, verify_password, create_token

Base.metadata.create_all(bind=engine)

app = FastAPI()

# Allow your Vercel frontend
origins = [
    "https://haylinguav2.vercel.app",
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.post("/signup")
def signup(email: str, password: str, db: Session = Depends(get_db)):
    exists = db.query(User).filter(User.email == email).first()
    if exists:
        raise HTTPException(status_code=400, detail="Email already exists")

    user = User(email=email, password_hash=hash_password(password))
    db.add(user)
    db.commit()
    db.refresh(user)

    return {"message": "User created"}


@app.post("/login")
def login(email: str, password: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=400, detail="Invalid credentials")

    token = create_token(user.id)

    return {"token": token}
