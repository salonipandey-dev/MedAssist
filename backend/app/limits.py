"""Health profile limits shared by the database models and the request schemas.

Kept free of database imports so the schemas and the medication rules can be
loaded and tested without SQLAlchemy.
"""

PROFILE_SECTIONS = ("medicines", "allergies", "conditions")
# not_recorded: the patient has said nothing yet. none: the patient has said
# there is nothing to record. recorded: at least one entry follows.
SECTION_STATES = ("not_recorded", "none", "recorded")
ENTRY_NAME_MAX = 120
ENTRY_NOTE_MAX = 300
ENTRIES_PER_SECTION_MAX = 30
