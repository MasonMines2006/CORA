"""Password hashing and the password rules.

We never store a password, only an argon2id hash of it. argon2id is the current
OWASP recommendation: it is deliberately slow and memory-hungry, so someone who
steals the database can't cheaply try billions of guesses. The library adds a
random salt to every hash, so two people with the same password get different
hashes.
"""

from typing import Optional

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

MIN_LENGTH = 12
# An upper bound stops someone tying up the server by sending huge "passwords"
# that each take a long time to hash.
MAX_LENGTH = 128

# The library's defaults (64 MiB memory, 3 passes) meet OWASP's argon2id guidance.
_hasher = PasswordHasher()

# A short list of the most common passwords that pass the length rule. A full
# breached-password check (e.g. Have I Been Pwned) can come later.
COMMON_PASSWORDS = frozenset(
    {
        "password1234", "password12345", "password123456", "123456789012", "1234567890123",
        "qwertyuiop12", "qwertyuiopas", "iloveyou1234", "letmein12345", "welcome12345",
        "passwordpassword", "abcdefghijkl", "abc123abc123", "111111111111", "000000000000",
        "adminadmin12", "administrator", "changeme1234", "football1234", "baseball1234",
        "trustno1trustno1", "monkey123456", "dragon123456", "sunshine1234", "princess1234",
        "nuclearpower", "reactor12345",
    }
)


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(stored_hash: Optional[str], password: str) -> bool:
    """True only if `password` matches `stored_hash`. Never raises."""
    if not stored_hash:
        return False
    try:
        return _hasher.verify(stored_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def burn_time_like_a_real_check(password: str) -> None:
    """Spend about as long as a real password check, then forget the result.

    Used when the email has no account. Without it, "no such user" answers
    noticeably faster than "wrong password", which tells an attacker which
    emails are registered.
    """
    verify_password(_DUMMY_HASH, password)


_DUMMY_HASH = _hasher.hash("this is not anyone's password")


def password_problems(password: str, email: str) -> list[str]:
    """Plain-language reasons this password is not allowed. Empty means it's fine."""
    problems = []
    if len(password) < MIN_LENGTH:
        problems.append(f"Use at least {MIN_LENGTH} characters.")
    if len(password) > MAX_LENGTH:
        problems.append(f"Use at most {MAX_LENGTH} characters.")
    if password.lower() in COMMON_PASSWORDS:
        problems.append("That password is too common. Pick something less guessable.")
    if email and password.strip().lower() == email.strip().lower():
        problems.append("Don't use your email address as your password.")
    return problems
