"""Engine availability/auto-detection endpoint."""

from fastapi import APIRouter

from app.utils.engine_detect import detect_engines

router = APIRouter()


@router.get("/engines", response_model=dict[str, bool])
async def list_engines() -> dict[str, bool]:
    """Report which supported engines are currently installed/configured."""
    return await detect_engines()
