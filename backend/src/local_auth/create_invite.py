"""Make an invite link from the command line, e.g. for the very first admin.

Sign-up is invite-only, and only admins can invite, so the first admin needs
another way in. Run this inside the backend container:

    docker exec backend-dev python -m src.local_auth.create_invite you@school.edu --role admin

It prints a single-use link (valid 7 days). Open it, choose a password, done.
Set FRONTEND_URL if the app isn't at http://localhost:8080.
"""

import argparse
import os

from src.local_auth import service, store

CLI_INVITER = {"auth0_sub": "cli"}


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a CORA invite link.")
    parser.add_argument("email")
    parser.add_argument("--role", choices=service.INVITABLE_ROLES, default="student")
    args = parser.parse_args()

    store.ensure_auth_tables()
    created, skipped = service.invite([args.email], args.role, CLI_INVITER)
    if skipped:
        print(f"{args.email} already has an account. Use an admin reset link instead.")
        return
    base = os.getenv("FRONTEND_URL", "http://localhost:8080").rstrip("/")
    invite = created[0]
    print(f"Invite for {invite['email']} ({invite['role']}), expires {invite['expires_at']}:")
    print(f"{base}/join/{invite['token']}")


if __name__ == "__main__":
    main()
