"""
Análise estatística de casos de auxílio-acidente.
Sem dependência de IA externa — usa os dados históricos do banco.
"""
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from database import Processo


def extract_processo_data(text: str, tipo_documento: str) -> dict:
    """Extração baseada em padrões de texto — sem API."""
    from pdf_processor import extract_all
    return extract_all(text, "")


def _taxa(procedentes, total) -> float:
    return round(procedentes / total * 100, 1) if total > 0 else None


def analisar_novo_caso(ficha: dict, db: Session) -> dict:
    """Calcula percentual de êxito com base em estatísticas reais do banco."""

    fatores_favoraveis = []
    fatores_desfavoraveis = []
    pesos = []

    # ── Taxa geral ────────────────────────────────────────────────────────────
    total_sent = db.query(func.count(Processo.id)).filter(
        Processo.tipo_documento == "sentenca"
    ).scalar() or 0

    proc_geral = db.query(func.count(Processo.id)).filter(
        Processo.tipo_documento == "sentenca",
        Processo.resultado == "procedente"
    ).scalar() or 0

    taxa_geral = _taxa(proc_geral, total_sent)

    if total_sent < 10:
        # Base insuficiente — usa referência doutrinária
        base_estimada = 55.0
        fatores_favoraveis.append("Auxílio-acidente tem boa receptividade na jurisprudência nacional")
        parecer_base = (
            "A base de dados ainda está sendo alimentada (menos de 10 sentenças cadastradas). "
            "A análise abaixo se baseia em critérios jurídicos e doutrinários, "
            "e será mais precisa à medida que mais processos forem inseridos."
        )
    else:
        base_estimada = taxa_geral
        parecer_base = f"Base histórica com {total_sent} sentenças — taxa geral de procedência: {taxa_geral}%."

    pesos.append((base_estimada, 1.0))

    # ── Fator CID ─────────────────────────────────────────────────────────────
    cid = (ficha.get("cid_principal") or "").upper()
    if cid:
        total_cid = db.query(func.count(Processo.id)).filter(
            Processo.tipo_documento == "sentenca",
            Processo.cid_principal == cid
        ).scalar() or 0
        proc_cid = db.query(func.count(Processo.id)).filter(
            Processo.tipo_documento == "sentenca",
            Processo.cid_principal == cid,
            Processo.resultado == "procedente"
        ).scalar() or 0

        taxa_cid = _taxa(proc_cid, total_cid)
        if taxa_cid is not None:
            pesos.append((taxa_cid, 2.0))
            if taxa_cid >= 60:
                fatores_favoraveis.append(f"CID {cid} tem alta taxa de procedência na sua base ({taxa_cid}% em {total_cid} casos)")
            elif taxa_cid < 40:
                fatores_desfavoraveis.append(f"CID {cid} tem taxa de procedência baixa na sua base ({taxa_cid}% em {total_cid} casos)")
            else:
                fatores_favoraveis.append(f"CID {cid} encontrado em {total_cid} casos na base com {taxa_cid}% de procedência")
        else:
            # CID não encontrado na base — análise pelo grupo
            grupo_cid = cid[0] if cid else None
            grupos_favoraveis = ["S", "M", "T", "G"]
            grupos_desfavoraveis = ["F", "Z"]
            if grupo_cid in grupos_favoraveis:
                fatores_favoraveis.append(f"CID {cid} pertence ao grupo de lesões/traumas ({grupo_cid}xx) — favorável para auxílio-acidente")
                pesos.append((62.0, 1.5))
            elif grupo_cid in grupos_desfavoraveis:
                fatores_desfavoraveis.append(f"CID {cid} pode ter nexo causal mais difícil de comprovar")
                pesos.append((40.0, 1.5))
            else:
                fatores_favoraveis.append(f"CID {cid} ainda sem histórico suficiente na base")

    # ── Fator Estado ──────────────────────────────────────────────────────────
    estado = (ficha.get("estado") or "").upper()
    if estado:
        total_est = db.query(func.count(Processo.id)).filter(
            Processo.tipo_documento == "sentenca",
            Processo.estado == estado
        ).scalar() or 0
        proc_est = db.query(func.count(Processo.id)).filter(
            Processo.tipo_documento == "sentenca",
            Processo.estado == estado,
            Processo.resultado == "procedente"
        ).scalar() or 0
        taxa_est = _taxa(proc_est, total_est)
        if taxa_est is not None:
            pesos.append((taxa_est, 1.0))
            if taxa_est >= 60:
                fatores_favoraveis.append(f"Estado {estado} tem boa taxa de procedência na sua base ({taxa_est}% em {total_est} casos)")
            elif taxa_est < 35:
                fatores_desfavoraveis.append(f"Estado {estado} apresenta taxa mais baixa ({taxa_est}% em {total_est} casos)")

    # ── Fator Tipo de Acidente ────────────────────────────────────────────────
    tipo_ac = (ficha.get("tipo_acidente") or "").lower()
    if tipo_ac:
        total_tipo = db.query(func.count(Processo.id)).filter(
            Processo.tipo_documento == "sentenca",
            Processo.tipo_acidente == tipo_ac
        ).scalar() or 0
        proc_tipo = db.query(func.count(Processo.id)).filter(
            Processo.tipo_documento == "sentenca",
            Processo.tipo_acidente == tipo_ac,
            Processo.resultado == "procedente"
        ).scalar() or 0
        taxa_tipo = _taxa(proc_tipo, total_tipo)
        if taxa_tipo is not None:
            pesos.append((taxa_tipo, 1.0))
            if taxa_tipo >= 60:
                fatores_favoraveis.append(f"Tipo '{tipo_ac}' tem boa procedência na base ({taxa_tipo}%)")

    # ── Fator Grau de Incapacidade ────────────────────────────────────────────
    grau = (ficha.get("grau_incapacidade") or "").lower()
    if grau == "parcial":
        pesos.append((65.0, 0.5))
        fatores_favoraveis.append("Incapacidade parcial é o requisito típico do auxílio-acidente (Art. 86 da Lei 8.213/91)")
    elif grau == "total":
        fatores_desfavoraveis.append("Incapacidade total pode indicar aposentadoria por invalidez em vez de auxílio-acidente")
        pesos.append((40.0, 0.5))

    # ── Fator Tempo de Afastamento ────────────────────────────────────────────
    tempo = ficha.get("tempo_afastamento") or ""
    if tempo:
        fatores_favoraveis.append(f"Afastamento registrado ({tempo}) demonstra sequela funcional")

    # ── Cálculo final ponderado ────────────────────────────────────────────────
    if pesos:
        soma_pesos = sum(p for _, p in pesos)
        percentual = sum(v * p for v, p in pesos) / soma_pesos
    else:
        percentual = base_estimada

    percentual = max(10.0, min(95.0, round(percentual, 1)))

    if percentual >= 65:
        classificacao = "ALTO (>65%)"
    elif percentual >= 40:
        classificacao = "MÉDIO (40–65%)"
    else:
        classificacao = "BAIXO (<40%)"

    if not fatores_desfavoraveis:
        fatores_desfavoraveis.append("Sem fatores negativos identificados com os dados fornecidos")

    # ── Parecer ───────────────────────────────────────────────────────────────
    nome = ficha.get("nome_cliente", "o segurado")
    parecer = (
        f"{parecer_base}\n\n"
        f"Para o caso de {nome} (CID: {cid or 'não informado'}, "
        f"{tipo_ac or 'tipo não informado'}, {estado or 'estado não informado'}), "
        f"a análise estatística indica {percentual}% de probabilidade de êxito.\n\n"
        f"O auxílio-acidente (Art. 86 da Lei 8.213/91) é devido quando o segurado sofre "
        f"acidente de qualquer natureza e fica com sequela que reduza permanentemente "
        f"sua capacidade laborativa. A análise considera os fatores abaixo."
    )

    recomendacao = (
        "ACEITAR O CASO" if percentual >= 60
        else "AVALIAR COM CAUTELA — solicite laudos complementares" if percentual >= 40
        else "TRIAGEM RECOMENDADA — verifique nexo causal e documentação médica antes de aceitar"
    )

    return {
        "percentual_exito": percentual,
        "classificacao": classificacao,
        "parecer": parecer,
        "fatores_favoraveis": fatores_favoraveis,
        "fatores_desfavoraveis": fatores_desfavoraveis,
        "recomendacao": recomendacao,
    }


def get_dashboard_insights(db: Session) -> str:
    return ""
