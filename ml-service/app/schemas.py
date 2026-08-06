from pydantic import BaseModel, Field, field_validator


class StatBlock(BaseModel):
    mean: float
    stddev: float = Field(ge=0)
    min: float
    max: float


class BehaviorFeatures(BaseModel):
    sessionId: str
    keystrokeCount: int = Field(ge=0)
    holdTime: StatBlock
    flightTime: StatBlock
    focusLossCount: int = Field(ge=0)
    pasteCount: int = Field(ge=0)

    @field_validator("sessionId")
    @classmethod
    def session_id_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("sessionId must not be blank")
        return v


class AnomalyResponse(BaseModel):
    anomaly_score: float | None
    is_anomaly: bool
    threshold: float | None
    baseline_ready: bool
    samples_collected: int
    message: str
