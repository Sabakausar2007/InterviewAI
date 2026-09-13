"""
auth_routes.py
Signup, login, profile, settings, change password endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
from auth import hash_password, verify_password, create_access_token, get_current_user, get_current_admin

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", response_model=schemas.TokenResponse)
def signup(data: schemas.SignupRequest, db: Session = Depends(get_db)):
    if data.password != data.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match.")

    existing = db.query(models.User).filter(models.User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    user = models.User(
        full_name=data.full_name,
        email=data.email,
        password_hash=hash_password(data.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    perf = models.Performance(user_id=user.id)
    db.add(perf)
    db.commit()

    token = create_access_token({"sub": str(user.id), "type": "user"})
    return {
        "access_token": token,
        "user": {"id": user.id, "full_name": user.full_name, "email": user.email},
    }


@router.post("/login", response_model=schemas.TokenResponse)
def login(data: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == data.email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = create_access_token({"sub": str(user.id), "type": "user"})
    return {
        "access_token": token,
        "user": {"id": user.id, "full_name": user.full_name, "email": user.email},
    }


@router.post("/admin-login", response_model=schemas.TokenResponse)
def admin_login(data: schemas.LoginRequest, db: Session = Depends(get_db)):
    """Admins log in with the same users table, but must have is_admin=True."""
    user = db.query(models.User).filter(models.User.email == data.email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid admin credentials.")
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="This account does not have admin access.")

    token = create_access_token({"sub": str(user.id), "type": "admin"})
    return {
        "access_token": token,
        "user": {"id": user.id, "full_name": user.full_name, "email": user.email, "role": "admin"},
    }


@router.get("/me")
def get_me(current_user: models.User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "education": current_user.education,
        "skills": current_user.skills,
        "target_role": current_user.target_role,
        "theme": current_user.theme,
        "default_interview_type": current_user.default_interview_type,
        "default_difficulty": current_user.default_difficulty,
        "is_admin": current_user.is_admin,
    }


@router.put("/profile")
def update_profile(
    data: schemas.ProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if data.full_name is not None:
        current_user.full_name = data.full_name
    if data.education is not None:
        current_user.education = data.education
    if data.skills is not None:
        current_user.skills = data.skills
    if data.target_role is not None:
        current_user.target_role = data.target_role
    db.commit()
    return {"message": "Profile updated successfully."}


@router.put("/settings")
def update_settings(
    data: schemas.SettingsUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if data.theme is not None:
        current_user.theme = data.theme
    if data.default_interview_type is not None:
        current_user.default_interview_type = data.default_interview_type
    if data.default_difficulty is not None:
        current_user.default_difficulty = data.default_difficulty
    db.commit()
    return {"message": "Settings updated successfully."}


@router.put("/change-password")
def change_password(
    data: schemas.ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    current_user.password_hash = hash_password(data.new_password)
    db.commit()
    return {"message": "Password changed successfully."}
