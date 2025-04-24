
from sqlalchemy import Column, String, Text
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Plan(Base):
    __tablename__ = 'plans'

    id = Column(String, primary_key=True)
    short_name = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    summary_of_benefits = Column(Text)
    summary_of_benefits_url = Column(Text)
    compressed_summary = Column(Text)

    def __repr__(self):
        return f"<Plan(short_name='{self.short_name}', full_name='{self.full_name}')>"
