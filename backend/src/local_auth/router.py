"""HTTP routes for CORA's own sign-in.

/auth/*   anyone (sign in, register, invite and reset links, own password)
/admin/*  admins only (users, invites, reset links, the open-enrollment switch)

Routes are plain `def`, not `async def`: they do blocking Postgres work and
password hashing, and FastAPI runs plain `def` routes on a thread pool so they
don't stall every other request.
"""

import logging
from typing import Annotated, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field

from src.auth import get_current_user, require_role
from src.local_auth import service, store
from src.local_auth.rate_limit import SlidingWindowLimiter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])
admin_router = APIRouter(prefix="/admin", tags=["admin users"])

ADMIN_ROLES = ["admin", "test_full"]
GENERIC_LOGIN_ERROR = "Email or password is incorrect"
LINK_ERROR = "This link is invalid, already used, or expired. Ask an admin for a new one."
TOO_MANY = "Too many attempts. Wait a few minutes and try again."

# Generous per-address budgets; the per-account lockout is the main defence.
_login_limiter = SlidingWindowLimiter(max_events=30, window_seconds=15 * 60)
_signup_limiter = SlidingWindowLimiter(max_events=20, window_seconds=60 * 60)

# Deliberately simple: real validation is "can they receive the invite?".
EmailField = Field(min_length=3, max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PasswordField = Field(min_length=1, max_length=1024)
NameField = Field(min_length=1, max_length=120)


def _client_key(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _limit(limiter: SlidingWindowLimiter, request: Request) -> None:
    if not limiter.allow(_client_key(request)):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=TOO_MANY)


def _weak(problems: list[str]) -> HTTPException:
    return HTTPException(status_code=422, detail={"message": "Choose a stronger password.", "problems": problems})


# --- request bodies --------------------------------------------------------------

class LoginRequest(BaseModel):
    email: str = EmailField
    password: str = PasswordField
    keep_signed_in: bool = False


class RegisterRequest(BaseModel):
    email: str = EmailField
    name: str = NameField
    password: str = PasswordField


class AcceptInviteRequest(BaseModel):
    name: str = NameField
    password: str = PasswordField


class SetPasswordRequest(BaseModel):
    password: str = PasswordField


class ChangePasswordRequest(BaseModel):
    current_password: str = PasswordField
    new_password: str = PasswordField


class InviteRequest(BaseModel):
    # Each email is checked on its own, and one request can invite up to a class of 200.
    emails: list[Annotated[str, EmailField]] = Field(min_length=1, max_length=200)
    role: Literal["student", "ta", "admin"] = "student"


class UpdateUserRequest(BaseModel):
    role: Optional[Literal["student", "ta", "admin"]] = None
    is_active: Optional[bool] = None


class EnrollmentRequest(BaseModel):
    open_enrollment: bool


# --- /auth ---------------------------------------------------------------------

@router.get("/config")
def auth_config():
    """What the sign-in page should show."""
    return {"open_enrollment": store.get_open_enrollment(), "sso_enabled": False}


@router.post("/login")
def login(body: LoginRequest, request: Request):
    _limit(_login_limiter, request)
    try:
        user = service.login(body.email, body.password)
    except service.LoginFailed:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=GENERIC_LOGIN_ERROR)
    return service.session_for(user, body.keep_signed_in)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout():
    """Nothing to do on the server: the browser forgets its token. Kept for a stable API."""
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me")
def me(user=Depends(get_current_user)):
    return {"id": user.get("user_id"), "email": user.get("email"), "name": user.get("name"), "role": user.get("role")}


@router.post("/register")
def register(body: RegisterRequest, request: Request):
    _limit(_signup_limiter, request)
    try:
        user = service.register(body.email, body.name, body.password)
    except service.RegistrationClosed:
        raise HTTPException(status_code=403, detail="CORA is invite-only right now. Ask your instructor for an invite link.")
    except service.WeakPassword as exc:
        raise _weak(exc.problems)
    except store.EmailTaken:
        raise HTTPException(status_code=409, detail="That email already has an account. Sign in, or ask an admin for a reset link.")
    return service.session_for(user)


@router.get("/invites/{token}")
def preview_invite(token: str):
    try:
        link = service.preview_link("invite", token)
    except service.LinkInvalid:
        raise HTTPException(status_code=404, detail=LINK_ERROR)
    return {"email": link["email"], "role": link["role"], "invited_by": link["created_by"], "expires_at": link["expires_at"].isoformat()}


@router.post("/invites/{token}/accept")
def accept_invite(token: str, body: AcceptInviteRequest, request: Request):
    _limit(_signup_limiter, request)
    try:
        user = service.accept_invite(token, body.name, body.password)
    except service.LinkInvalid:
        raise HTTPException(status_code=404, detail=LINK_ERROR)
    except service.WeakPassword as exc:
        raise _weak(exc.problems)
    except store.EmailTaken:
        raise HTTPException(status_code=409, detail="That email already has an account. Sign in instead.")
    return service.session_for(user)


@router.get("/reset/{token}")
def preview_reset(token: str):
    try:
        link = service.preview_link("reset", token)
    except service.LinkInvalid:
        raise HTTPException(status_code=404, detail=LINK_ERROR)
    return {"email": link["email"], "issued_by": link["created_by"], "expires_at": link["expires_at"].isoformat()}


@router.post("/reset/{token}", status_code=status.HTTP_204_NO_CONTENT)
def complete_reset(token: str, body: SetPasswordRequest, request: Request):
    _limit(_signup_limiter, request)
    try:
        service.complete_reset(token, body.password)
    except service.LinkInvalid:
        raise HTTPException(status_code=404, detail=LINK_ERROR)
    except service.WeakPassword as exc:
        raise _weak(exc.problems)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/password")
def change_password(body: ChangePasswordRequest, user=Depends(get_current_user)):
    if not user.get("user_id"):
        raise HTTPException(status_code=400, detail="This account doesn't use a CORA password.")
    try:
        updated = service.change_password(user["user_id"], body.current_password, body.new_password)
    except service.WrongCurrentPassword:
        raise HTTPException(status_code=400, detail="Your current password is incorrect.")
    except service.WeakPassword as exc:
        raise _weak(exc.problems)
    # The old token stopped working when the password changed; hand back a new one.
    return service.session_for(updated)


# --- /admin --------------------------------------------------------------------

def _admin_view(user: dict) -> dict:
    subject = user["subject"] or ""
    method = "password" if subject.startswith(store.LOCAL_SUBJECT_PREFIX) else subject.split("|", 1)[0]
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "status": "active" if user["is_active"] else "deactivated",
        "sign_in_method": method,
        "last_login": user["last_login"].isoformat() if user["last_login"] else None,
        "created_at": user["created_at"].isoformat() if user["created_at"] else None,
    }


@admin_router.get("/users")
def admin_list_users(admin=Depends(require_role(ADMIN_ROLES))):
    return {"users": [_admin_view(user) for user in store.list_users()]}


@admin_router.patch("/users/{user_id}")
def admin_update_user(user_id: int, body: UpdateUserRequest, admin=Depends(require_role(ADMIN_ROLES))):
    try:
        user = service.update_user(user_id, admin, body.role, body.is_active)
    except service.NotAllowed:
        raise HTTPException(status_code=400, detail="You can't change your own role or deactivate your own account.")
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return _admin_view(user)


@admin_router.post("/users/{user_id}/reset-link")
def admin_reset_link(user_id: int, admin=Depends(require_role(ADMIN_ROLES))):
    try:
        return service.issue_reset_link(user_id, admin)
    except service.LinkInvalid:
        raise HTTPException(status_code=404, detail="No CORA password account with that id")


@admin_router.get("/invites")
def admin_list_invites(admin=Depends(require_role(ADMIN_ROLES))):
    invites = [
        {"email": link["email"], "role": link["role"], "invited_by": link["created_by"],
         "expires_at": link["expires_at"].isoformat()}
        for link in store.list_pending_invites()
    ]
    return {"invites": invites}


@admin_router.post("/invites")
def admin_create_invites(body: InviteRequest, admin=Depends(require_role(ADMIN_ROLES))):
    created, skipped = service.invite(body.emails, body.role, admin)
    logger.info("Admin %s created %d invite(s), skipped %d", admin.get("auth0_sub"), len(created), len(skipped))
    return {"invites": created, "skipped": skipped}


@admin_router.get("/settings/enrollment")
def admin_get_enrollment(admin=Depends(require_role(ADMIN_ROLES))):
    return {"open_enrollment": store.get_open_enrollment()}


@admin_router.put("/settings/enrollment")
def admin_set_enrollment(body: EnrollmentRequest, admin=Depends(require_role(ADMIN_ROLES))):
    store.set_open_enrollment(body.open_enrollment)
    logger.warning("Admin %s set open enrollment to %s", admin.get("auth0_sub"), body.open_enrollment)
    return {"open_enrollment": body.open_enrollment}
