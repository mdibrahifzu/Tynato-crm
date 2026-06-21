from pydantic import BaseModel

class SearchRequest(BaseModel):
    query: str
    user_email: str