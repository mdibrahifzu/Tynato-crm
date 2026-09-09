import os

AUDIO_BUCKET = os.getenv("AUDIO_STORAGE_BUCKET", "audio-files")
AUDIO_MAX_FILE_SIZE_MB = int(os.getenv("AUDIO_MAX_FILE_SIZE_MB", "25"))
AUDIO_MAX_FILE_SIZE_BYTES = AUDIO_MAX_FILE_SIZE_MB * 1024 * 1024
AUDIO_MAX_UPLOADS_PER_DAY = int(os.getenv("AUDIO_MAX_UPLOADS_PER_DAY", "10"))
AUDIO_MAX_CONCURRENT_PROCESSING = int(os.getenv("AUDIO_MAX_CONCURRENT_PROCESSING", "2"))
AUDIO_MAX_PROCESSING_ATTEMPTS = int(os.getenv("AUDIO_MAX_PROCESSING_ATTEMPTS", "2"))
AUDIO_MAX_FILENAME_LENGTH = int(os.getenv("AUDIO_MAX_FILENAME_LENGTH", "180"))

# Keep this allowlist aligned with the Supabase Storage bucket created in Phase 1.
ALLOWED_AUDIO_TYPES = {
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/mp4": ".m4a",
    "audio/x-m4a": ".m4a",
    "audio/aac": ".aac",
    "audio/ogg": ".ogg",
    "audio/flac": ".flac",
    "audio/webm": ".webm",
}
ALLOWED_AUDIO_EXTENSIONS = set(ALLOWED_AUDIO_TYPES.values())


def normalize_mime_type(value: str | None) -> str:
    return (value or "").split(";", 1)[0].strip().lower()
