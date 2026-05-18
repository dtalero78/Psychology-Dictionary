from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.instrument import Instrument
from ..schemas.instruments import InstrumentOut, InstrumentDetail
from ..schemas.common import ApiResponse
from ..dependencies import get_current_user

router = APIRouter(prefix="/instruments", tags=["instruments"])


@router.get("", response_model=ApiResponse[list[InstrumentOut]])
def list_instruments(
    construct: str | None = Query(None),
    search: str | None = Query(None),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Instrument)
    if construct:
        q = q.filter(Instrument.construct.ilike(f"%{construct}%"))
    if search:
        q = q.filter(
            Instrument.name.ilike(f"%{search}%") |
            Instrument.abbreviation.ilike(f"%{search}%")
        )
    instruments = q.order_by(Instrument.name).all()
    return ApiResponse.ok([InstrumentOut.model_validate(i) for i in instruments])


@router.get("/{instrument_id}", response_model=ApiResponse[InstrumentDetail])
def get_instrument(instrument_id: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    instrument = db.get(Instrument, instrument_id)
    if not instrument:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Instrument not found")
    return ApiResponse.ok(InstrumentDetail.model_validate(instrument))
