from typing import TypeVar, Generic
from pydantic import BaseModel

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    data: T | None = None
    error: str | None = None

    @classmethod
    def ok(cls, data: T) -> "ApiResponse[T]":
        return cls(data=data, error=None)

    @classmethod
    def err(cls, message: str) -> "ApiResponse[None]":
        return cls(data=None, error=message)
