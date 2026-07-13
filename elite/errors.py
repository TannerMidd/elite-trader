"""The base type for errors whose message is written for the player.

API routes echo error text back to the UI. Marking a message user-facing is an
explicit act: routes send only `user_message` to a client and replace anything
else with a generic line, so an unexpected exception (whose text may carry
internal details) can never leak into a response (CWE-209)."""


class UserFacingError(Exception):
    def __init__(self, message="Something went wrong; check the app log."):
        super().__init__(message)
        self.user_message = str(message)


class ValidationError(UserFacingError, ValueError):
    """Rejected commander input, phrased for the player. Subclasses ValueError
    so callers that pre-date the split keep catching it as one."""


class NotFoundError(UserFacingError, KeyError):
    """A player-referenced record that does not exist (KeyError-compatible)."""
