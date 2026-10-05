"""
Configuration parameters for TigerDB Memory Intelligence Agent (MIA).
Based on parameters specified in arXiv:2604.04503v4.
"""
import os
from dataclasses import dataclass

@dataclass
class TigerDBConfig:
    # Database Connection (supports standard Render DATABASE_URL or TIGERDB_* vars)
    host: str = "localhost"
    port: int = 5432
    user: str = "postgres"
    password: str = "password"
    dbname: str = "postgres"

    def __post_init__(self):
        db_url = os.getenv("DATABASE_URL")
        if db_url:
            from urllib.parse import urlparse
            parsed = urlparse(db_url)
            self.host = parsed.hostname or self.host
            self.port = parsed.port or self.port
            self.user = parsed.username or self.user
            self.password = parsed.password or self.password
            self.dbname = (parsed.path.lstrip("/") or self.dbname) if parsed.path else self.dbname
        else:
            self.host = os.getenv("TIGERDB_HOST", self.host)
            self.port = int(os.getenv("TIGERDB_PORT", str(self.port)))
            self.user = os.getenv("TIGERDB_USER", self.user)
            self.password = os.getenv("TIGERDB_PASSWORD", self.password)
            self.dbname = os.getenv("TIGERDB_NAME", self.dbname)

    # Embedding Settings
    embedding_dim: int = 384  # Default: 384 (all-MiniLM-L6-v2) or 768 (sup-simcse-bert-base-uncased)
    embedding_model_name: str = "sentence-transformers/all-MiniLM-L6-v2"
    use_transformer_model: bool = False  # Set to True to load HuggingFace model; False uses fast deterministic projection

    # Multimodal Semantic Similarity Weights (Section 10, Eq. 9)
    # Sim_i = alpha_q * sim_q + alpha_c * sim_c
    alpha_q: float = 0.8  # Question similarity weight
    alpha_c: float = 0.2  # Caption similarity weight

    # Hybrid Retrieval Weights (Section 10, Eq. 11)
    # Score(m_i) = lambda_s * Sim_norm + lambda_v * Val + lambda_f * Freq
    lambda_s: float = 0.7  # Semantic similarity weight
    lambda_v: float = 0.3  # Value reward weight: s_i / (u_i + 1)
    lambda_f: float = 0.3  # Frequency reward weight: 1 / (u_i + 1)

    # Experience Consolidation Thresholds
    knowledge_replacement_threshold: float = 0.92  # High semantic similarity replacement threshold
    top_k_retrieval: int = 3  # Number of positive & negative paradigms to retrieve

    # Planner & Executor Rules
    max_reflection_turns: int = 1  # Reflect-Replan triggers at most once per paper specifications
    max_executor_steps: int = 8    # Max tool steps per ReAct rollout

DEFAULT_CONFIG = TigerDBConfig()
