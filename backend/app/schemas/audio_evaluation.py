from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


Confidence = Literal["HIGH", "MEDIUM", "LOW", "UNKNOWN"]
BuyingIntent = Literal["VERY_LOW", "LOW", "MEDIUM", "HIGH", "VERY_HIGH", "UNKNOWN"]
LeadStage = Literal[
    "NEW_LEAD",
    "CONTACTED",
    "QUALIFICATION",
    "DISCOVERY",
    "SOLUTION_PRESENTATION",
    "PROPOSAL",
    "NEGOTIATION",
    "DECISION_PENDING",
    "WON",
    "LOST",
    "UNKNOWN",
]
ImplementationStatus = Literal[
    "IMPLEMENTED",
    "PARTIALLY_IMPLEMENTED",
    "NOT_IMPLEMENTED",
    "NOT_APPLICABLE",
    "UNKNOWN",
]
Priority = Literal["CRITICAL", "HIGH", "MEDIUM", "LOW"]
ConversionAction = Literal[
    "CALL",
    "FOLLOW_UP",
    "SEND_PROPOSAL",
    "SCHEDULE_MEETING",
    "REQUEST_INFORMATION",
    "HANDLE_OBJECTION",
    "DEMO",
    "NEGOTIATE",
    "CLOSE",
    "NURTURE",
    "DISQUALIFY",
    "UNKNOWN",
]


class EvidenceItem(BaseModel):
    text: str = Field(min_length=1, max_length=1000)
    confidence: Confidence = "MEDIUM"


class ScoreItem(BaseModel):
    score: int = Field(ge=0)
    max_score: int = Field(ge=1)
    assessment: str = Field(min_length=1, max_length=2000)
    evidence: list[EvidenceItem] = Field(default_factory=list, max_length=20)
    confidence: Confidence = "MEDIUM"

    @model_validator(mode="after")
    def validate_score_range(self):
        if self.score > self.max_score:
            raise ValueError("score cannot exceed max_score")
        return self


SCORE_MAXIMUMS = {
    "opening": 5,
    "rapport": 5,
    "discovery": 10,
    "question_quality": 5,
    "active_listening": 5,
    "problem_identification": 5,
    "qualification": 10,
    "presentation": 5,
    "value_proposition": 5,
    "personalization": 5,
    "objection_handling": 10,
    "trust_building": 5,
    "price_handling": 5,
    "urgency": 5,
    "closing": 10,
    "next_step": 5,
}


class SalespersonAnalysis(BaseModel):
    opening: ScoreItem
    rapport: ScoreItem
    discovery: ScoreItem
    question_quality: ScoreItem
    active_listening: ScoreItem
    problem_identification: ScoreItem
    qualification: ScoreItem
    presentation: ScoreItem
    value_proposition: ScoreItem
    personalization: ScoreItem
    objection_handling: ScoreItem
    trust_building: ScoreItem
    price_handling: ScoreItem
    urgency: ScoreItem
    closing: ScoreItem
    next_step: ScoreItem

    @model_validator(mode="after")
    def validate_maximums_and_total(self):
        values = self.model_dump()
        for name, expected_max in SCORE_MAXIMUMS.items():
            if values[name]["max_score"] != expected_max:
                raise ValueError(
                    f"{name}.max_score must be {expected_max}"
                )
        total = sum(values[name]["score"] for name in SCORE_MAXIMUMS)
        if total > 100:
            raise ValueError("salesperson category scores cannot exceed 100")
        return self

    def total_score(self) -> int:
        values = self.model_dump()
        return sum(values[name]["score"] for name in SCORE_MAXIMUMS)


class CustomerAnalysis(BaseModel):
    problems: list[str] = Field(default_factory=list, max_length=30)
    goals: list[str] = Field(default_factory=list, max_length=30)
    requirements: list[str] = Field(default_factory=list, max_length=30)
    concerns: list[str] = Field(default_factory=list, max_length=30)
    objections: list[str] = Field(default_factory=list, max_length=30)
    budget: str = "unknown"
    timeline: str = "unknown"
    decision_maker: str = "unknown"
    competitors: list[str] = Field(default_factory=list, max_length=20)
    buying_signals: list[str] = Field(default_factory=list, max_length=30)
    risk_signals: list[str] = Field(default_factory=list, max_length=30)
    engagement: str = "unknown"
    commitment: str = "unknown"
    requested_next_action: str = "unknown"
    buying_intent: BuyingIntent = "UNKNOWN"


class ObjectionAnalysis(BaseModel):
    objection: str = Field(min_length=1, max_length=1000)
    root_cause: str = Field(min_length=1, max_length=1000)
    salesperson_response: str = Field(min_length=1, max_length=1500)
    response_quality: str = Field(min_length=1, max_length=1000)
    missed_opportunity: str = Field(min_length=1, max_length=1000)
    recommended_response: str = Field(min_length=1, max_length=1500)
    confidence: Confidence = "MEDIUM"


class ConversionRisk(BaseModel):
    risk: str = Field(min_length=1, max_length=500)
    evidence: list[EvidenceItem] = Field(default_factory=list, max_length=10)
    severity: Priority
    recommended_action: str = Field(min_length=1, max_length=1500)


class SalesProcessCompliance(BaseModel):
    status: str = Field(min_length=1, max_length=100)
    violations: list[str] = Field(default_factory=list, max_length=30)
    evidence: list[EvidenceItem] = Field(default_factory=list, max_length=20)


class PreviousRecommendation(BaseModel):
    recommendation: str = Field(min_length=1, max_length=1500)
    applicability: str = Field(min_length=1, max_length=500)
    implementation_status: ImplementationStatus
    behavior_change: str = Field(min_length=1, max_length=1000)
    performance_change: str = Field(min_length=1, max_length=1000)
    business_impact: str = Field(min_length=1, max_length=1000)
    confidence: Confidence = "UNKNOWN"


class BehavioralImprovement(BaseModel):
    area: str = Field(min_length=1, max_length=500)
    previous_behavior: str = Field(min_length=1, max_length=1000)
    current_behavior: str = Field(min_length=1, max_length=1000)
    conclusion: str = Field(min_length=1, max_length=1500)
    confidence: Confidence = "UNKNOWN"


class NewRecommendation(BaseModel):
    problem: str = Field(min_length=1, max_length=1000)
    evidence: list[EvidenceItem] = Field(default_factory=list, max_length=10)
    action: str = Field(min_length=1, max_length=1500)
    priority: Priority
    success_criteria: str = Field(min_length=1, max_length=1000)
    when_to_apply: str = Field(min_length=1, max_length=1000)


class ConversionStrategy(BaseModel):
    recommended_action: ConversionAction
    reason: str = Field(min_length=1, max_length=1500)


class AudioEvaluationResult(BaseModel):
    """
    Final structured AI evaluation contract.

    Historical/coaching fields are intentionally empty/UNKNOWN until
    historical CRM context is supplied to the evaluator.
    """

    model_config = ConfigDict()
    
    client_name: str = Field(default="Unknown", max_length=200)
    is_new_conversation: bool
    performance_score: int = Field(ge=0, le=100)
    summary: str = Field(min_length=1, max_length=5000)

    salesperson_analysis: SalespersonAnalysis
    customer_analysis: CustomerAnalysis
    lead_stage: LeadStage = "UNKNOWN"
    objections: list[ObjectionAnalysis] = Field(default_factory=list, max_length=30)
    conversion_risks: list[ConversionRisk] = Field(default_factory=list, max_length=30)
    sales_process_compliance: SalesProcessCompliance

    previous_recommendations: list[PreviousRecommendation] = Field(
        default_factory=list, max_length=30
    )
    behavioral_improvement: list[BehavioralImprovement] = Field(
        default_factory=list, max_length=30
    )
    new_recommendations: list[NewRecommendation] = Field(
        default_factory=list, max_length=20
    )
    next_call_plan: list[str] = Field(default_factory=list, max_length=5)
    conversion_strategy: ConversionStrategy
    manager_insight: str = Field(min_length=1, max_length=3000)
    confidence: Confidence = "UNKNOWN"

    @model_validator(mode="after")
    def validate_total_score(self):
        calculated = self.salesperson_analysis.total_score()
        if calculated != self.performance_score:
            raise ValueError(
                f"performance_score must equal the sum of salesperson category scores ({calculated})"
            )
        return self

    @model_validator(mode="after")
    def clean_client_name(self):
        self.client_name = self.client_name.strip() or "Unknown"
        return self


class AudioEvaluationRecord(BaseModel):
    id: UUID
    audio_id: UUID
    status: str
    processing_attempts: int
    error_message: Optional[str] = None
    client_name: str
    is_new_conversation: Optional[bool] = None
    performance_score: Optional[int] = None
    summary: Optional[str] = None
    model_name: Optional[str] = None
    analysis: dict = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime
