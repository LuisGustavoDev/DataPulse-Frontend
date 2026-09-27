import type { BatchStatus, TxStatus } from "@datapulse/contracts";
import type { Tone } from "@/components/ui/badge";

export const BATCH_STATUS: Record<BatchStatus, { label: string; tone: Tone; description: string }> = {
  AWAITING_UPLOAD: { label: "Aguardando envio", tone: "neutral", description: "O arquivo ainda está sendo enviado." },
  QUEUED: { label: "Na fila", tone: "info", description: "Aguardando um worker livre." },
  PROCESSING: { label: "Processando", tone: "info", description: "Lendo e validando as linhas." },
  CONSOLIDATING: { label: "Consolidando", tone: "info", description: "Gravando as transações e os totais." },
  SUCCEEDED: { label: "Concluído", tone: "success", description: "Todas as linhas foram importadas." },
  PARTIAL: { label: "Parcial", tone: "success", description: "Importado com até 5% de linhas inválidas." },
  FAILED_VALIDATION: { label: "Reprovado", tone: "danger", description: "Mais de 5% das linhas são inválidas." },
  FAILED_TECHNICAL: { label: "Falha técnica", tone: "danger", description: "O processamento falhou depois das tentativas automáticas." },
  REJECTED_SCHEMA: { label: "Arquivo recusado", tone: "danger", description: "Cabeçalho, formato ou tamanho inválido." },
  REJECTED_DUPLICATE: { label: "Duplicado", tone: "warning", description: "Este arquivo já foi importado." },
  ABANDONED: { label: "Abandonado", tone: "neutral", description: "O envio não foi concluído." },
  DELETING: { label: "Excluindo", tone: "warning", description: "Apagando os dados do lote." },
  DELETED: { label: "Excluído", tone: "neutral", description: "Os dados do lote foram apagados." },
};

/** status_reason e reason_code dos eventos. */
export const REASON_LABEL: Record<string, string> = {
  ERROR_RATE_EXCEEDED: "Mais de 5% das linhas têm erro. Corrija o arquivo e envie de novo.",
  EMPTY_FILE: "O arquivo só tem o cabeçalho, sem nenhuma linha de dados.",
  OBJECT_EXPIRED: "O arquivo original já expirou no armazenamento. Envie de novo.",
  FILE_TOO_LARGE: "O arquivo passa de 1 GiB.",
  SCHEMA_MISMATCH: "O cabeçalho do CSV não confere com o esperado.",
  DELIMITER_UNDETECTED: "Não foi possível detectar o separador (vírgula ou ponto e vírgula).",
  UNSUPPORTED_FORMAT: "O arquivo não é um CSV de texto (compactado ou binário).",
  DUPLICATE_FILE: "Um arquivo idêntico já foi importado.",
};

export const reasonLabel = (code: string | null | undefined) => (code ? (REASON_LABEL[code] ?? code) : null);

/** Códigos de erro por linha (§5.3). */
export const ROW_ERROR_LABEL: Record<string, string> = {
  INVALID_DATE_FORMAT: "Data em formato inválido",
  DATE_OUT_OF_RANGE: "Data fora do intervalo permitido",
  INVALID_AMOUNT: "Valor inválido",
  AMOUNT_OUT_OF_RANGE: "Valor fora do limite",
  INVALID_CLIENT_ID: "cliente_id inválido",
  INVALID_PRODUCT_ID: "produto_id inválido",
  INVALID_STATUS: "Status desconhecido",
  COLUMN_COUNT_MISMATCH: "Número de colunas diferente do cabeçalho",
  MISSING_REQUIRED_FIELD: "Campo obrigatório vazio",
  INVALID_ENCODING: "Caractere inválido no encoding",
  MALFORMED_QUOTES: "Aspas malformadas",
  ROW_TOO_LONG: "Linha maior que 8 KiB",
};

export const rowErrorLabel = (code: string) => ROW_ERROR_LABEL[code] ?? code;

export const TX_STATUS_LABEL: Record<TxStatus, string> = {
  aprovada: "Aprovada",
  pendente: "Pendente",
  cancelada: "Cancelada",
  estornada: "Estornada",
};
