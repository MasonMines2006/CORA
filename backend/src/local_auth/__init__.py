"""CORA's own email + password sign-in (replaces Auth0).

- passwords.py  hashing (argon2id) and the password rules
- tokens.py     CORA's signed session tokens (JWT) and one-time link tokens
- rate_limit.py a small in-memory limiter for the login and sign-up routes
- store.py      Postgres: users, invite/reset links, the open-enrollment switch
- service.py    the rules (lockout, enrollment, invites, resets), no HTTP
- router.py     the HTTP routes: /auth/* for everyone, /admin/* for admins
"""
