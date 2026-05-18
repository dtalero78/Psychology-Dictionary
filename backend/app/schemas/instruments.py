from pydantic import BaseModel
from typing import Any


class InstrumentOut(BaseModel):
    id: str
    name: str
    abbreviation: str | None
    construct: str
    description: str | None
    num_items: int
    response_format: str | None
    is_validated: bool
    apa_ref: str | None

    model_config = {"from_attributes": True}


class InstrumentDetail(InstrumentOut):
    items_json: list[Any]
    scoring_json: dict[str, Any]
