"""
Database connection and vector type management for TigerDB.
Supports graceful offline operation when database is unavailable (e.g. Render deployments without DB).
"""
import time
from typing import Generator, Optional, Any, List
import psycopg
from psycopg.rows import dict_row
from pgvector.psycopg import register_vector
from tiger_mia.config import TigerDBConfig, DEFAULT_CONFIG

class TigerDBClient:
    def __init__(self, config: Optional[TigerDBConfig] = None):
        self.config = config or DEFAULT_CONFIG
        self.conn_info = (
            f"host={self.config.host} "
            f"port={self.config.port} "
            f"user={self.config.user} "
            f"password={self.config.password} "
            f"dbname={self.config.dbname} "
            f"connect_timeout=2"
        )
        self._is_available: Optional[bool] = None
        self._last_checked: float = 0.0

    def is_connected(self) -> bool:
        """Checks if database is reachable with 30s cache."""
        now = time.time()
        if self._is_available is not None and (now - self._last_checked < 30.0):
            return self._is_available
        try:
            with psycopg.connect(self.conn_info, connect_timeout=2) as conn:
                self._is_available = True
                self._last_checked = now
                return True
        except Exception:
            self._is_available = False
            self._last_checked = now
            return False

    def get_connection(self) -> Optional[psycopg.Connection]:
        """Creates a connection with pgvector registered and dict_row factory. Returns None if DB offline."""
        try:
            conn = psycopg.connect(self.conn_info, row_factory=dict_row, connect_timeout=2)
            try:
                register_vector(conn)
            except Exception:
                pass
            self._is_available = True
            return conn
        except Exception:
            self._is_available = False
            self._last_checked = time.time()
            return None

    def execute(self, query: str, params: Optional[Any] = None) -> List[dict]:
        """Executes a query and returns all result rows as dictionaries. Gracefully returns [] if DB is offline."""
        if not self.is_connected():
            return []
        try:
            conn = self.get_connection()
            if not conn:
                return []
            with conn:
                with conn.cursor() as cur:
                    cur.execute(query, params)
                    if cur.description:
                        return cur.fetchall()
                    conn.commit()
                    return []
        except Exception as e:
            self._is_available = False
            self._last_checked = time.time()
            return []

    def execute_one(self, query: str, params: Optional[Any] = None) -> Optional[dict]:
        """Executes a query and returns a single row as a dictionary. Gracefully returns None if DB is offline."""
        if not self.is_connected():
            return None
        try:
            conn = self.get_connection()
            if not conn:
                return None
            with conn:
                with conn.cursor() as cur:
                    cur.execute(query, params)
                    if cur.description:
                        return cur.fetchone()
                    conn.commit()
                    return None
        except Exception as e:
            self._is_available = False
            self._last_checked = time.time()
            return None

    def execute_batch(self, query: str, params_list: List[Any]) -> None:
        """Executes multiple queries in a transaction. Skips gracefully if DB is offline."""
        if not self.is_connected():
            return
        try:
            conn = self.get_connection()
            if not conn:
                return
            with conn:
                with conn.cursor() as cur:
                    for params in params_list:
                        cur.execute(query, params)
                conn.commit()
        except Exception as e:
            self._is_available = False
            self._last_checked = time.time()

