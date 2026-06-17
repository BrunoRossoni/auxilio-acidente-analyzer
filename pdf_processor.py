import pdfplumber
import re
from pathlib import Path


def extract_text_from_pdf(file_path: str) -> str:
    """Extrai todo o texto de um arquivo PDF."""
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
    """Detecta automaticamente o tipo de documento."""
    text_lower = text.lower()
    filename_lower = filename.lower()

    if any(word in filename_lower for word in ["sentenca", "sentença", "acórdão", "acordao"]):
        return "sentenca"
    if any(word in filename_lower for word in ["laudo", "pericia", "perícia"]):
        return "laudo"
    if any(word in filename_lower for word in ["inicial", "petição", "peticao"]):
        return "inicial"

    if any(word in text_lower for word in ["julgo procedente", "julgo improcedente", "dispositivo", "ante o exposto"]):
        return "sentenca"
    if any(word in text_lower for word in ["laudo pericial", "perito", "nexo técnico", "capacidade laborativa"]):
        return "laudo"
    if any(word in text_lower for word in ["vem respeitosamente", "requer a vossa", "dos fatos", "do direito"]):
        return "inicial"

    return "outro"


def extract_cid_codes(text: str) -> list:
    """Extrai códigos CID do texto."""
    pattern = r'\b[A-Z]\d{2}(?:\.\d{1,2})?\b'
    codes = re.findall(pattern, text)
    return list(set(codes))


def extract_process_number(text: str) -> str:
    """Extrai número do processo."""
    patterns = [
        r'\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}',
        r'\d{7}-\d{2}\.\d{4}\.\d\.\d{3}\.\d{4}',
        r'Processo\s*(?:n[°oº.]?\s*)?([\d\.\-/]+)',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(0).strip()
    return None
