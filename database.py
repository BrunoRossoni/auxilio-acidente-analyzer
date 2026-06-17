from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

import os

_db_url = os.getenv("DATABASE_URL", "sqlite:///./auxilio_acidente.db")

# Render fornece postgres://, SQLAlchemy precisa de postgresql://
if _db_url.startswith("postgres://"):
    _db_url = _db_url.replace("postgres://", "postgresql://", 1)

# Usa pg8000 (pure Python) para PostgreSQL, sem conflitos de SSL
if _db_url.startswith("postgresql://"):
    # Remove ?sslmode da URL — pg8000 não aceita via query string
    if "?" in _db_url:
        _db_url = _db_url.split("?")[0]
    _db_url = _db_url.replace("postgresql://", "postgresql+pg8000://", 1)
    _kwargs = {"ssl_context": True}
else:
    _kwargs = {"check_same_thread": False}

DATABASE_URL = _db_url
engine = create_engine(DATABASE_URL, connect_args=_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Processo(Base):
    __tablename__ = "processos"

    id = Column(Integer, primary_key=True, index=True)
    numero_processo = Column(String, nullable=True)
    tipo_documento = Column(String)  # inicial, laudo, sentenca
    texto_extraido = Column(Text)
    cid_principal = Column(String, nullable=True)
    cid_secundario = Column(String, nullable=True)
    descricao_cid = Column(String, nullable=True)
    resultado = Column(String, nullable=True)  # procedente, improcedente, parcialmente_procedente
    regiao = Column(String, nullable=True)
    estado = Column(String, nullable=True)
    cidade = Column(String, nullable=True)
    vara = Column(String, nullable=True)
    juiz = Column(String, nullable=True)
    tipo_acidente = Column(String, nullable=True)
    parte_corpo = Column(String, nullable=True)
    profissao = Column(String, nullable=True)
    idade_segurado = Column(Integer, nullable=True)
    grau_incapacidade = Column(String, nullable=True)
    data_acidente = Column(String, nullable=True)
    nome_arquivo = Column(String)
    processado_em = Column(DateTime, default=datetime.utcnow)
    resumo_ia = Column(Text, nullable=True)


class FichaAnalise(Base):
    __tablename__ = "fichas_analise"

    id = Column(Integer, primary_key=True, index=True)
    nome_cliente = Column(String)
    cid_principal = Column(String)
    descricao_cid = Column(String, nullable=True)
    tipo_acidente = Column(String)
    parte_corpo = Column(String, nullable=True)
    profissao = Column(String, nullable=True)
    idade = Column(Integer, nullable=True)
    grau_incapacidade = Column(String, nullable=True)
    estado = Column(String, nullable=True)
    cidade = Column(String, nullable=True)
    tempo_afastamento = Column(String, nullable=True)
    informacoes_adicionais = Column(Text, nullable=True)
    percentual_exito = Column(Float, nullable=True)
    parecer = Column(Text, nullable=True)
    fatores_favoraveis = Column(Text, nullable=True)
    fatores_desfavoraveis = Column(Text, nullable=True)
    criado_em = Column(DateTime, default=datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
