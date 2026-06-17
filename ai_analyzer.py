import anthropic
import json
import re
from sqlalchemy.orm import Session
from database import Processo
from sqlalchemy import func


client = anthropic.Anthropic()
MODEL = "claude-opus-4-5"


def extract_processo_data(text: str, tipo_documento: str) -> dict:
    """Usa IA para extrair dados estruturados de um documento processual."""

    prompt = f"""Você é um especialista em direito previdenciário brasileiro, com foco em auxílio-acidente (Art. 86 da Lei 8.213/91).

Analise o seguinte documento jurídico ({tipo_documento}) e extraia as informações abaixo em formato JSON.
Se uma informação não estiver presente, retorne null para aquele campo.

DOCUMENTO:
{text[:8000]}

Extraia e retorne APENAS um JSON válido com esta estrutura:
{{
  "numero_processo": "número do processo ou null",
  "cid_principal": "código CID principal (ex: S52.0) ou null",
  "cid_secundario": "código CID secundário ou null",
  "descricao_cid": "descrição da lesão/doença em português",
  "resultado": "procedente | improcedente | parcialmente_procedente | null (apenas para sentenças)",
  "estado": "sigla do estado (ex: SP, RS) ou null",
  "cidade": "nome da cidade ou null",
  "vara": "nome/número da vara ou null",
  "juiz": "nome do juiz ou null",
  "tipo_acidente": "acidente de trabalho | doença ocupacional | acidente de trajeto | outro | null",
  "parte_corpo": "parte do corpo afetada ou null",
  "profissao": "profissão/cargo do segurado ou null",
  "idade_segurado": número inteiro ou null,
  "grau_incapacidade": "parcial | total | null",
  "data_acidente": "data no formato DD/MM/AAAA ou null",
  "resumo": "resumo de 2-3 frases do caso"
}}

Retorne APENAS o JSON, sem explicações adicionais."""

    message = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}]
    )

    response_text = message.content[0].text.strip()

    # Extrai JSON da resposta
    json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
    if json_match:
        return json.loads(json_match.group())
    return {}


def analisar_novo_caso(ficha: dict, db: Session) -> dict:
    """Analisa um novo caso com base nos dados históricos e retorna parecer com % de êxito."""

    # Busca dados históricos relevantes
    total_processos = db.query(func.count(Processo.id)).scalar()

    # Taxa geral de sucesso
    procedentes = db.query(func.count(Processo.id)).filter(
        Processo.resultado == "procedente",
        Processo.tipo_documento == "sentenca"
    ).scalar()
    improcedentes = db.query(func.count(Processo.id)).filter(
        Processo.resultado == "improcedente",
        Processo.tipo_documento == "sentenca"
    ).scalar()
    total_sentencas = procedentes + improcedentes

    # Taxa por CID
    cid_stats = {}
    if ficha.get("cid_principal"):
        cid_proc = db.query(func.count(Processo.id)).filter(
            Processo.cid_principal == ficha["cid_principal"],
            Processo.resultado == "procedente",
            Processo.tipo_documento == "sentenca"
        ).scalar()
        cid_total = db.query(func.count(Processo.id)).filter(
            Processo.cid_principal == ficha["cid_principal"],
            Processo.tipo_documento == "sentenca"
        ).scalar()
        cid_stats = {"procedentes": cid_proc, "total": cid_total}

    # Taxa por estado
    estado_stats = {}
    if ficha.get("estado"):
        est_proc = db.query(func.count(Processo.id)).filter(
            Processo.estado == ficha["estado"],
            Processo.resultado == "procedente",
            Processo.tipo_documento == "sentenca"
        ).scalar()
        est_total = db.query(func.count(Processo.id)).filter(
            Processo.estado == ficha["estado"],
            Processo.tipo_documento == "sentenca"
        ).scalar()
        estado_stats = {"procedentes": est_proc, "total": est_total}

    contexto_historico = f"""
DADOS HISTÓRICOS DA BASE (total: {total_processos} documentos, {total_sentencas} sentenças):
- Taxa geral de procedência: {f'{procedentes}/{total_sentencas} ({round(procedentes/total_sentencas*100)}%)' if total_sentencas > 0 else 'sem dados suficientes'}
- CID {ficha.get('cid_principal', 'N/A')}: {f"{cid_stats.get('procedentes', 0)}/{cid_stats.get('total', 0)} sentenças procedentes" if cid_stats.get('total', 0) > 0 else 'sem dados para este CID'}
- Estado {ficha.get('estado', 'N/A')}: {f"{estado_stats.get('procedentes', 0)}/{estado_stats.get('total', 0)} sentenças procedentes" if estado_stats.get('total', 0) > 0 else 'sem dados para este estado'}
"""

    prompt = f"""Você é um especialista sênior em direito previdenciário brasileiro, com foco em auxílio-acidente (Art. 86 da Lei 8.213/91).

{contexto_historico}

NOVO CASO PARA ANÁLISE:
- Nome: {ficha.get('nome_cliente', 'N/A')}
- CID Principal: {ficha.get('cid_principal', 'N/A')} - {ficha.get('descricao_cid', 'N/A')}
- Tipo de Acidente: {ficha.get('tipo_acidente', 'N/A')}
- Parte do Corpo: {ficha.get('parte_corpo', 'N/A')}
- Profissão: {ficha.get('profissao', 'N/A')}
- Idade: {ficha.get('idade', 'N/A')}
- Grau de Incapacidade: {ficha.get('grau_incapacidade', 'N/A')}
- Estado/Cidade: {ficha.get('estado', 'N/A')} / {ficha.get('cidade', 'N/A')}
- Tempo de Afastamento: {ficha.get('tempo_afastamento', 'N/A')}
- Informações Adicionais: {ficha.get('informacoes_adicionais', 'N/A')}

Com base nos dados históricos e no seu conhecimento jurídico sobre auxílio-acidente, faça uma análise completa.

Retorne APENAS um JSON válido:
{{
  "percentual_exito": número de 0 a 100 (sua estimativa de êxito),
  "classificacao": "ALTO (>70%) | MÉDIO (40-70%) | BAIXO (<40%)",
  "parecer": "parecer jurídico detalhado em 3-4 parágrafos explicando a análise",
  "fatores_favoraveis": ["fator 1", "fator 2", ...],
  "fatores_desfavoraveis": ["fator 1", "fator 2", ...],
  "recomendacao": "recomendação final ao advogado"
}}"""

    message = client.messages.create(
        model=MODEL,
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}]
    )

    response_text = message.content[0].text.strip()
    json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
    if json_match:
        return json.loads(json_match.group())

    return {
        "percentual_exito": 50,
        "classificacao": "MÉDIO",
        "parecer": response_text,
        "fatores_favoraveis": [],
        "fatores_desfavoraveis": [],
        "recomendacao": "Consulte um especialista para análise mais detalhada."
    }


def get_dashboard_insights(db: Session) -> str:
    """Gera insights de texto para o dashboard."""
    total = db.query(func.count(Processo.id)).scalar()
    if total == 0:
        return "Base ainda vazia. Faça o upload de processos para gerar insights."

    procedentes = db.query(func.count(Processo.id)).filter(
        Processo.resultado == "procedente",
        Processo.tipo_documento == "sentenca"
    ).scalar()
    total_sent = db.query(func.count(Processo.id)).filter(
        Processo.tipo_documento == "sentenca"
    ).scalar()

    prompt = f"""Com base nestes dados de uma base de processos de auxílio-acidente:
- Total de documentos: {total}
- Sentenças procedentes: {procedentes}/{total_sent}

Gere 2-3 frases de insight executivo em português para um advogado previdenciarista. Seja objetivo e direto."""

    message = client.messages.create(
        model=MODEL,
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}]
    )
    return message.content[0].text.strip()
