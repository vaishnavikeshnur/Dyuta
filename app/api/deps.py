from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_token
from app.models.models import User

bearer = HTTPBearer(auto_error=False)

def current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db)
):
    if not credentials:
        raise HTTPException(status_code=401, detail="Please log in.")
    try:
        payload = decode_token(credentials.credentials)
        uid = int(payload.get("sub"))
    except (JWTError, TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired session.")
    user = db.get(User, uid)
    if not user:
        raise HTTPException(status_code=401, detail="User not found.")
    return user
