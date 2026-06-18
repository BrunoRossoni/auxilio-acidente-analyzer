import os
import shutil
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
import uvicorn
from dotenv import load_dotenv

load_dotenv()

from database import init_db, get_db, Processo, FichaAnalise
from pdf_processor import extract_text_from_pdf, extract_all
from ai_analyzer import analisar_novo_caso

app = FastAPI(title="Analisador de Auxílio-Acidente")

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

_startup_error = None


@app.on_event("startup")
def startup_event():
    global _startup_error
    try:
        init_db()
        print("Banco de dados inicializado com sucesso.")
    except Exception as e:
        _startup_error = str(e)
        print(f"ERRO ao inicializar banco: {e}")


@app.get("/health")
def health():
    return {"status": "ok", "db_error": _startup_error}


@app.get("/")
def read_root():
    return FileResponse("static/index.html")


# ─── UPLOAD E PROCESSAMENTO DE PDFs ────────────────────────────────────────────

@app.post("/api/upload")
async def upload_pdf(
    file: UploadFile = File(...),
    tipo_documento: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Apenas arquivos PDF são aceitos.")

    file_path = UPLOAD_DIR / Path(file.filename).name
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        texto = extract_text_from_pdf(str(file_path))
        if not texto:
            raise HTTPException(status_code=400, detail="Não foi possível extrair texto do PDF. Verifique se não é um PDF escaneado.")

        dados = extract_all(texto, file.filename)
        tipo = tipo_documento or dados.get("tipo_documento", "outro")

        processo = Processo(
            numero_processo=dados.get("numero_processo"),
            tipo_documento=tipo,
            texto_extraido=texto[:10000],
            cid_principal=dados.get("cid_principal"),
            cid_secundario=dados.get("cid_secundario"),
            descricao_cid=dados.get("descricao_cid"),
            resultado=dados.get("resultado"),
            estado=dados.get("estado"),
            cidade=dados.get("cidade"),
            tipo_acidente=dados.get("tipo_acidente"),
            parte_corpo=dados.get("parte_corpo"),
            profissao=dados.get("profissao"),
            grau_incapacidade=dados.get("grau_incapacidade"),
            nome_arquivo=file.filename,
        )
        db.add(processo)
        db.commit()
        db.refresh(processo)

        return {
            "sucesso": True,
            "id": processo.id,
            "tipo_detectado": tipo,
            "cid_principal": dados.get("cid_principal"),
            "resultado": dados.get("resultado"),
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/upload-lote")
async def upload_lote(
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    resultados = []
    for file in files:
        if not file.filename.endswith(".pdf"):
            resultados.append({"arquivo": file.filename, "erro": "Não é PDF"})
            continue
        try:
            file_path = UPLOAD_DIR / Path(file.filename).name
            with open(file_path, "wb") as f:
                shutil.copyfileobj(file.file, f)

            texto = extract_text_from_pdf(str(file_path))
            if not texto:
                resultados.append({"arquivo": file.filename, "erro": "Sem texto extraível"})
                continue

            dados = extract_all(texto, file.filename)
            tipo = dados.get("tipo_documento", "outro")

            processo = Processo(
                numero_processo=dados.get("numero_processo"),
                tipo_documento=tipo,
                texto_extraido=texto[:10000],
                cid_principal=dados.get("cid_principal"),
                cid_secundario=dados.get("cid_secundario"),
                descricao_cid=dados.get("descricao_cid"),
                resultado=dados.get("resultado"),
                estado=dados.get("estado"),
                cidade=dados.get("cidade"),
                tipo_acidente=dados.get("tipo_acidente"),
                parte_corpo=dados.get("parte_corpo"),
                profissao=dados.get("profissao"),
                grau_incapacidade=dados.get("grau_incapacidade"),
                nome_arquivo=file.filename,
            )
            db.add(processo)
            db.commit()
            resultados.append({"arquivo": file.filename, "sucesso": True, "tipo": tipo, "cid": dados.get("cid_principal")})

        except Exception as e:
            resultados.append({"arquivo": file.filename, "erro": str(e)})

    return {"resultados": resultados, "total": len(resultados), "sucesso": sum(1 for r in resultados if r.get("sucesso"))}


# ─── DASHBOARD ─────────────────────────────────────────────────────────────────

@app.get("/api/dashboard")
def get_dashboard(db: Session = Depends(get_db)):
    try:
        total_docs = db.query(func.count(Processo.id)).scalar() or 0
        total_sentencas = db.query(func.count(Processo.id)).filter(Processo.tipo_documento == "sentenca").scalar() or 0
        total_laudos = db.query(func.count(Processo.id)).filter(Processo.tipo_documento == "laudo").scalar() or 0
        total_iniciais = db.query(func.count(Processo.id)).filter(Processo.tipo_documento == "inicial").scalar() or 0

        procedentes = db.query(func.count(Processo.id)).filter(
            Processo.resultado == "procedente", Processo.tipo_documento == "sentenca"
        ).scalar() or 0
        improcedentes = db.query(func.count(Processo.id)).filter(
            Processo.resultado == "improcedente", Processo.tipo_documento == "sentenca"
        ).scalar() or 0

        taxa_geral = round(procedentes / total_sentencas * 100, 1) if total_sentencas > 0 else 0

        # Top CIDs — contagem separada por resultado para evitar CASE
        cid_rows = db.query(
            Processo.cid_principal,
            Processo.descricao_cid,
            func.count(Processo.id).label("total"),
        ).filter(
            Processo.cid_principal != None,
            Processo.tipo_documento == "sentenca"
        ).group_by(Processo.cid_principal, Processo.descricao_cid).order_by(func.count(Processo.id).desc()).limit(10).all()

        top_cids = []
        for row in cid_rows:
            proc = db.query(func.count(Processo.id)).filter(
                Processo.tipo_documento == "sentenca",
                Processo.cid_principal == row.cid_principal,
                Processo.resultado == "procedente"
            ).scalar() or 0
            top_cids.append({
                "cid": row.cid_principal,
                "descricao": row.descricao_cid or "Sem descrição",
                "total": row.total,
                "procedentes": proc,
                "taxa": round(proc / row.total * 100, 1) if row.total > 0 else 0
            })

        # Por estado
        est_rows = db.query(
            Processo.estado,
            func.count(Processo.id).label("total"),
        ).filter(
            Processo.estado != None,
            Processo.tipo_documento == "sentenca"
        ).group_by(Processo.estado).order_by(func.count(Processo.id).desc()).limit(10).all()

        por_estado = []
        for row in est_rows:
            proc = db.query(func.count(Processo.id)).filter(
                Processo.tipo_documento == "sentenca",
                Processo.estado == row.estado,
                Processo.resultado == "procedente"
            ).scalar() or 0
            por_estado.append({
                "estado": row.estado,
                "total": row.total,
                "procedentes": proc,
                "taxa": round(proc / row.total * 100, 1) if row.total > 0 else 0
            })

        # Por tipo de acidente
        tipo_rows = db.query(
            Processo.tipo_acidente,
            func.count(Processo.id).label("total"),
        ).filter(
            Processo.tipo_acidente != None,
            Processo.tipo_documento == "sentenca"
        ).group_by(Processo.tipo_acidente).all()

        por_tipo = []
        for row in tipo_rows:
            proc = db.query(func.count(Processo.id)).filter(
                Processo.tipo_documento == "sentenca",
                Processo.tipo_acidente == row.tipo_acidente,
                Processo.resultado == "procedente"
            ).scalar() or 0
            por_tipo.append({
                "tipo": row.tipo_acidente,
                "total": row.total,
                "procedentes": proc,
                "taxa": round(proc / row.total * 100, 1) if row.total > 0 else 0
            })

        return {
            "resumo": {
                "total_documentos": total_docs,
                "total_sentencas": total_sentencas,
                "total_laudos": total_laudos,
                "total_iniciais": total_iniciais,
                "procedentes": procedentes,
                "improcedentes": improcedentes,
                "taxa_geral": taxa_geral,
            },
            "top_cids": top_cids,
            "por_estado": por_estado,
            "por_tipo_acidente": por_tipo,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro dashboard: {type(e).__name__}: {str(e)}")


# ─── ANÁLISE DE NOVO CASO ───────────────────────────────────────────────────────

@app.post("/api/analisar")
async def analisar_caso(
    nome_cliente: str = Form(...),
    cid_principal: str = Form(...),
    descricao_cid: Optional[str] = Form(None),
    tipo_acidente: str = Form(...),
    parte_corpo: Optional[str] = Form(None),
    profissao: Optional[str] = Form(None),
    idade: Optional[int] = Form(None),
    grau_incapacidade: Optional[str] = Form(None),
    estado: Optional[str] = Form(None),
    cidade: Optional[str] = Form(None),
    tempo_afastamento: Optional[str] = Form(None),
    informacoes_adicionais: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    ficha = {
        "nome_cliente": nome_cliente,
        "cid_principal": cid_principal.upper(),
        "descricao_cid": descricao_cid,
        "tipo_acidente": tipo_acidente,
        "parte_corpo": parte_corpo,
        "profissao": profissao,
        "idade": idade,
        "grau_incapacidade": grau_incapacidade,
        "estado": estado.upper() if estado else None,
        "cidade": cidade,
        "tempo_afastamento": tempo_afastamento,
        "informacoes_adicionais": informacoes_adicionais,
    }

    resultado = analisar_novo_caso(ficha, db)

    ficha_db = FichaAnalise(
        nome_cliente=nome_cliente,
        cid_principal=cid_principal.upper(),
        descricao_cid=descricao_cid,
        tipo_acidente=tipo_acidente,
        parte_corpo=parte_corpo,
        profissao=profissao,
        idade=idade,
        grau_incapacidade=grau_incapacidade,
        estado=estado.upper() if estado else None,
        cidade=cidade,
        tempo_afastamento=tempo_afastamento,
        informacoes_adicionais=informacoes_adicionais,
        percentual_exito=resultado.get("percentual_exito"),
        parecer=resultado.get("parecer"),
        fatores_favoraveis=str(resultado.get("fatores_favoraveis", [])),
        fatores_desfavoraveis=str(resultado.get("fatores_desfavoraveis", [])),
    )
    db.add(ficha_db)
    db.commit()

    return resultado


# ─── LISTAGEM DE PROCESSOS ──────────────────────────────────────────────────────

@app.get("/api/processos")
def listar_processos(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    processos = db.query(Processo).order_by(Processo.processado_em.desc()).offset(skip).limit(limit).all()
    total = db.query(func.count(Processo.id)).scalar()
    return {
        "total": total,
        "processos": [
            {
                "id": p.id,
                "numero_processo": p.numero_processo,
                "tipo_documento": p.tipo_documento,
                "cid_principal": p.cid_principal,
                "descricao_cid": p.descricao_cid,
                "resultado": p.resultado,
                "estado": p.estado,
                "cidade": p.cidade,
                "tipo_acidente": p.tipo_acidente,
                "nome_arquivo": p.nome_arquivo,
                "processado_em": p.processado_em.isoformat() if p.processado_em else None,
                "resumo_ia": p.resumo_ia,
            }
            for p in processos
        ]
    }


@app.get("/api/analises")
def listar_analises(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    fichas = db.query(FichaAnalise).order_by(FichaAnalise.criado_em.desc()).offset(skip).limit(limit).all()
    total = db.query(func.count(FichaAnalise.id)).scalar()
    return {
        "total": total,
        "analises": [
            {
                "id": f.id,
                "nome_cliente": f.nome_cliente,
                "cid_principal": f.cid_principal,
                "tipo_acidente": f.tipo_acidente,
                "estado": f.estado,
                "percentual_exito": f.percentual_exito,
                "parecer": f.parecer,
                "fatores_favoraveis": f.fatores_favoraveis,
                "fatores_desfavoraveis": f.fatores_desfavoraveis,
                "criado_em": f.criado_em.isoformat() if f.criado_em else None,
            }
            for f in fichas
        ]
    }


@app.delete("/api/processos/{processo_id}")
def deletar_processo(processo_id: int, db: Session = Depends(get_db)):
    processo = db.query(Processo).filter(Processo.id == processo_id).first()
    if not processo:
        raise HTTPException(status_code=404, detail="Processo não encontrado")
    db.delete(processo)
    db.commit()
    return {"sucesso": True}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
