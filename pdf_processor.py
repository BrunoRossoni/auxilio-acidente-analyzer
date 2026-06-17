import pdfplumber
import re


def extract_text_from_pdf(file_path: str) -> str:
    text = ""
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
    except Exception as e:
        raise Exception(f"Erro ao processar PDF: {str(e)}")
    return text.strip()


def detect_document_type(text: str, filename: str) -> str:
    text_lower = text.lower()
    filename_lower = filename.lower()

    if any(w in filename_lower for w in ["sentenca", "sentença", "acórdão", "acordao"]):
        return "sentenca"
    if any(w in filename_lower for w in ["laudo", "pericia", "perícia"]):
        return "laudo"
    if any(w in filename_lower for w in ["inicial", "petição", "peticao"]):
        return "inicial"

    if any(w in text_lower for w in ["julgo procedente", "julgo improcedente", "ante o exposto", "dispositivo", "pelo exposto"]):
        return "sentenca"
    if any(w in text_lower for w in ["laudo pericial", "perito médico", "nexo técnico", "capacidade laborativa", "nexo causal"]):
        return "laudo"
    if any(w in text_lower for w in ["vem respeitosamente", "requer a vossa", "dos fatos", "do direito", "vem, respeitosamente"]):
        return "inicial"

    return "outro"


def extract_cid_codes(text: str) -> list:
    pattern = r'\b[A-Z]\d{2}(?:\.\d{1,2})?\b'
    return list(set(re.findall(pattern, text)))


def extract_process_number(text: str) -> str:
    patterns = [
        r'\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}',
        r'\d{7}-\d{2}\.\d{4}\.\d\.\d{3}\.\d{4}',
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(0).strip()
    return None


# Mapeamento de CIDs conhecidos
CID_DESCRICOES = {
    "S": "Traumatismo / Lesão",
    "M": "Doenças osteomusculares",
    "G": "Doenças do sistema nervoso",
    "T": "Traumatismos e envenenamentos",
    "J": "Doenças respiratórias",
    "H": "Doenças dos olhos/ouvidos",
    "F": "Transtornos mentais",
    "Z": "Fatores de saúde",
    "L": "Doenças da pele",
    "N": "Doenças urogenitais",
}


def get_descricao_cid(cid: str) -> str:
    if not cid:
        return None
    prefixo = cid[0].upper()
    return CID_DESCRICOES.get(prefixo, f"CID {cid}")


def extract_resultado(text: str) -> str:
    text_lower = text.lower()
    if re.search(r'julgo\s+parcialmente\s+procedente', text_lower):
        return "parcialmente_procedente"
    if re.search(r'julgo\s+procedente|pedido\s+procedente|ação\s+procedente', text_lower):
        return "procedente"
    if re.search(r'julgo\s+improcedente|pedido\s+improcedente|ação\s+improcedente', text_lower):
        return "improcedente"
    return None


def extract_estado_cidade(text: str) -> dict:
    result = {"estado": None, "cidade": None}
    estados = {
        "AC": "Acre", "AL": "Alagoas", "AP": "Amapá", "AM": "Amazonas",
        "BA": "Bahia", "CE": "Ceará", "DF": "Distrito Federal", "ES": "Espírito Santo",
        "GO": "Goiás", "MA": "Maranhão", "MT": "Mato Grosso", "MS": "Mato Grosso do Sul",
        "MG": "Minas Gerais", "PA": "Pará", "PB": "Paraíba", "PR": "Paraná",
        "PE": "Pernambuco", "PI": "Piauí", "RJ": "Rio de Janeiro", "RN": "Rio Grande do Norte",
        "RS": "Rio Grande do Sul", "RO": "Rondônia", "RR": "Roraima", "SC": "Santa Catarina",
        "SP": "São Paulo", "SE": "Sergipe", "TO": "Tocantins"
    }
    # Busca padrão "Comarca de Cidade - SP" ou "Vara de ... de Cidade/SP"
    match = re.search(r'comarca\s+de\s+([A-ZÀ-Ú][a-zà-ú\s]+?)[\s\-/]+([A-Z]{2})\b', text, re.IGNORECASE)
    if match:
        result["cidade"] = match.group(1).strip().title()
        result["estado"] = match.group(2).upper()
        return result

    # Busca por "Cidade/UF"
    match = re.search(r'([A-ZÀ-Ú][a-zà-ú\s]{3,30})/([A-Z]{2})\b', text)
    if match and match.group(2) in estados:
        result["cidade"] = match.group(1).strip().title()
        result["estado"] = match.group(2)
        return result

    # Só estado
    for sigla in estados:
        if re.search(r'\b' + sigla + r'\b', text):
            result["estado"] = sigla
            break

    return result


def extract_tipo_acidente(text: str) -> str:
    text_lower = text.lower()
    if any(p in text_lower for p in ["acidente de trajeto", "acidente de percurso"]):
        return "acidente de trajeto"
    if any(p in text_lower for p in ["doença ocupacional", "doença profissional", "doença do trabalho"]):
        return "doença ocupacional"
    if any(p in text_lower for p in ["acidente de trabalho", "acidente típico", "acidente laboral"]):
        return "acidente de trabalho"
    return None


def extract_parte_corpo(text: str) -> str:
    partes = {
        "coluna": ["coluna", "lombar", "cervical", "dorsal", "vértebra", "disco intervertebral"],
        "membro superior direito": ["membro superior direito", "ombro direito", "cotovelo direito", "punho direito", "mão direita"],
        "membro superior esquerdo": ["membro superior esquerdo", "ombro esquerdo", "cotovelo esquerdo", "punho esquerdo", "mão esquerda"],
        "membro inferior direito": ["membro inferior direito", "joelho direito", "tornozelo direito", "pé direito", "quadril direito"],
        "membro inferior esquerdo": ["membro inferior esquerdo", "joelho esquerdo", "tornozelo esquerdo", "pé esquerdo", "quadril esquerdo"],
        "mãos": ["mão", "dedo", "dedos", "falange"],
        "cabeça": ["cabeça", "crânio", "face", "olho", "ouvido"],
        "tórax": ["tórax", "costela", "pulmão", "coração"],
    }
    text_lower = text.lower()
    for parte, termos in partes.items():
        if any(t in text_lower for t in termos):
            return parte
    return None


def extract_profissao(text: str) -> str:
    profissoes = [
        "motorista", "operador", "auxiliar", "técnico", "enfermeiro", "pedreiro",
        "eletricista", "mecânico", "soldador", "metalúrgico", "carpinteiro",
        "servente", "vigilante", "segurança", "cozinheiro", "garçom",
        "faxineiro", "doméstica", "trabalhador rural", "agricultor", "comerciário",
        "bancário", "professor", "médico", "enfermeira", "gari", "coletador"
    ]
    text_lower = text.lower()
    for p in profissoes:
        if p in text_lower:
            return p.title()
    return None


def extract_grau_incapacidade(text: str) -> str:
    text_lower = text.lower()
    if any(p in text_lower for p in ["incapacidade total", "totalmente incapaz", "incapaz para qualquer"]):
        return "total"
    if any(p in text_lower for p in ["incapacidade parcial", "parcialmente incapaz", "redução da capacidade"]):
        return "parcial"
    return None


def extract_all(text: str, filename: str) -> dict:
    """Extrai todos os dados relevantes de um documento sem usar IA."""
    tipo = detect_document_type(text, filename)
    cids = extract_cid_codes(text)
    cid_principal = cids[0] if cids else None
    cid_secundario = cids[1] if len(cids) > 1 else None
    loc = extract_estado_cidade(text)

    return {
        "tipo_documento": tipo,
        "numero_processo": extract_process_number(text),
        "cid_principal": cid_principal,
        "cid_secundario": cid_secundario,
        "descricao_cid": get_descricao_cid(cid_principal),
        "resultado": extract_resultado(text) if tipo == "sentenca" else None,
        "estado": loc["estado"],
        "cidade": loc["cidade"],
        "tipo_acidente": extract_tipo_acidente(text),
        "parte_corpo": extract_parte_corpo(text),
        "profissao": extract_profissao(text),
        "grau_incapacidade": extract_grau_incapacidade(text),
    }
