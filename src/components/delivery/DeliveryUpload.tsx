import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Upload,
  Camera,
  FileText,
  CheckCircle,
  AlertTriangle,
  Edit,
  Save,
  X,
  Plus,
  Trash2
} from 'lucide-react';
import { apiService } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

// ##########################################################################
// ########### NOVAS INTERFACES UNIFICADAS (COPIADAS DA SUA ï¿½LTIMA MENSAGEM)
// ##########################################################################
interface DeliverySummary {
  nfNumber: string;
  clientName: string;
  clientCnpj: string;
  deliveryAddress: string;
  merchandiseValue: string;
  volume: string;
  weight: string;
  issueDate: string;
  dueDate: string;
  observations: string;
}

interface InvoiceParty {
  razao_social: string;
  cnpj_cpf: string;
  endereco: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone: string;
  inscricao_estadual: string;
}

interface InvoiceValues {
  valor_total_nota: string;
  valor_total_produtos: string;
  valor_frete: string;
  outras_despesas: string;
  desconto: string;
  valor_seguro: string;
  valor_ipi: string;
  valor_icms: string;
  valor_total_tributos: string;
}

interface InvoiceVolumes {
  quantidade: string;
  especie: string;
  marca: string;
  numero: string;
  peso_bruto: string;
  peso_liquido: string;
}

interface InvoiceImpostos {
  base_calculo_icms: string;
  valor_icms: string;
  valor_total_tributos: string;
  valor_icms_st: string;
  valor_ipi: string;
}

interface InvoiceDuplicata {
  identificador: string;
  valor: string;
  data_vencimento: string;
  raw?: Record<string, unknown> | null;
}

interface InvoiceItem {
  codigo_prod: string;
  descricao: string;
  quantidade: string;
  unidade: string;
  valor_unitario: string;
  valor_total: string;
  ncm?: string;
  cfop?: string;
  raw?: Record<string, unknown> | null;
}

interface StructuredInvoiceData {
  nf_data: {
    numero: string;
    serie: string;
    chave: string;
    data_emissao: string;
    data_saida: string;
    protocolo_autorizacao: string;
  };
  remetente: InvoiceParty;
  destinatario: InvoiceParty;
  valores: InvoiceValues;
  transportadora: InvoiceParty;
  volumes: InvoiceVolumes;
  impostos: InvoiceImpostos;
  duplicatas: InvoiceDuplicata[];
  itens_de_linha: InvoiceItem[];
  informacoes_complementares: string;
  status: string;
  raw_text: string;
  raw_fields: Record<string, string[]>;
  document_ai_confidence: number | null;
  document_ai_entities: Array<Record<string, unknown>>;
}

interface DeliveryUploadInitialData {
  summary?: Partial<DeliverySummary>;
  structured?: Partial<StructuredInvoiceData>;
  supplier_name?: string;
  supplier_tax_id?: string;
  supplier_address?: string;
  supplier_phone?: string;
  supplier_website?: string;
  supplier_registration?: string;
  receiver_name?: string;
  receiver_tax_id?: string;
  receiver_address?: string;
  receiver_phone?: string;
  invoice_date?: string;
  nro?: string;
  serie?: string;
  chave?: string;
  total_amount?: string;
  vat_amount?: string;
  freight_amount?: string;
  line_item?: any[];
}

interface Driver {
  id: string;
  name: string;
  userId?: string;
}

const ALLOWED_FILE_EXTENSIONS = ['.xml', '.pdf', '.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];

interface DeliveryUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  initialData?: DeliveryUploadInitialData; 
  // Propriedade adicionada para controlar a exibiï¿½ï¿½o do seletor de motorista.
  allowDriverSelection?: boolean;
}

// ##########################################################################
// ##########################################################################
// ##########################################################################

type StructuredSectionKey = 'nf_data' | 'remetente' | 'destinatario' | 'valores' | 'transportadora' | 'volumes' | 'impostos';

type DocumentAIParsedPayload = {
  extractedData?: Record<string, unknown>;
  entities?: Array<Record<string, unknown>>;
  rawText?: string;
  rawFields?: Record<string, string[]>;
  confidence?: number;
  detail?: DocumentAIParsedPayload;
};

// ## Funï¿½ï¿½es Auxiliares
const createEmptyStructuredData = (): StructuredInvoiceData => ({
  nf_data: {
    numero: '',
    serie: '',
    chave: '',
    data_emissao: '',
    data_saida: '',
    protocolo_autorizacao: ''
  },
  remetente: {
    razao_social: '',
    cnpj_cpf: '',
    endereco: '',
    municipio: '',
    uf: '',
    cep: '',
    telefone: '',
    inscricao_estadual: ''
  },
  destinatario: {
    razao_social: '',
    cnpj_cpf: '',
    endereco: '',
    municipio: '',
    uf: '',
    cep: '',
    telefone: '',
    inscricao_estadual: ''
  },
  valores: {
    valor_total_nota: '',
    valor_total_produtos: '',
    valor_frete: '',
    outras_despesas: '',
    desconto: '',
    valor_seguro: '',
    valor_ipi: '',
    valor_icms: '',
    valor_total_tributos: ''
  },
  transportadora: {
    razao_social: '',
    cnpj_cpf: '',
    endereco: '',
    municipio: '',
    uf: '',
    cep: '',
    telefone: '',
    inscricao_estadual: ''
  },
  volumes: {
    quantidade: '',
    especie: '',
    marca: '',
    numero: '',
    peso_bruto: '',
    peso_liquido: ''
  },
  impostos: {
    base_calculo_icms: '',
    valor_icms: '',
    valor_total_tributos: '',
    valor_icms_st: '',
    valor_ipi: ''
  },
  duplicatas: [],
  itens_de_linha: [],
  informacoes_complementares: '',
  status: 'PENDENTE',
  raw_text: '',
  raw_fields: {},
  document_ai_confidence: null,
  document_ai_entities: []
});

const normalizeString = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return Number.isFinite(value) ? value.toString() : '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return '';
};

const digitsOnly = (value: unknown): string => normalizeString(value).replace(/\D/g, '');

const formatCurrencyValue = (value: string): string => {
  if (!value) return '';
  const numeric = value
    .replace(/[^\d.,-]/g, '')
    .replace(/\.(?=\d{3}(?:\.|,))/g, '')
    .replace(',', '.');
  const parsed = parseFloat(numeric);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : normalizeString(value);
};

const formatTaxId = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return digits || value;
};

const normalizeDateValue = (value: unknown): string => {
  if (!value) return '';
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString().split('T')[0];
  }
  const asString = normalizeString(value);
  if (!asString) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(asString)) {
    return asString;
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(asString)) {
    const [day, month, year] = asString.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  const timestamp = Date.parse(asString);
  return Number.isNaN(timestamp) ? asString : new Date(timestamp).toISOString().split('T')[0];
};

const sanitizeDocumentNumber = (value: string): string => value.replace(/\D/g, '');

const takeFirstFromRaw = (rawFields: Record<string, string[]>, ...labels: string[]): string => {
  for (const label of labels) {
    const bucket = rawFields?.[label];
    if (bucket && bucket.length) {
      const match = bucket.find((entry) => normalizeString(entry));
      if (match) return normalizeString(match);
    }
  }
  return '';
};

const parseDuplicatasFromText = (text: string): InvoiceDuplicata[] => {
  if (!text) return [];
  const results: InvoiceDuplicata[] = [];
  const regex = /Duplicata\s*(\d+)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const slice = text.slice(match.index);
    const valueMatch = slice.match(/([\d.,]+)/);
    const dateMatch = slice.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (valueMatch && dateMatch) {
      results.push({
        identificador: match[1].padStart(3, '0'),
        valor: formatCurrencyValue(valueMatch[1]),
        data_vencimento: normalizeDateValue(dateMatch[1]),
        raw: { source: slice.split('\n')[0] }
      });
    }
  }
  return results;
};

const buildItemsFromRawFields = (rawFields: Record<string, string[]>): InvoiceItem[] => {
  const codes = rawFields['line_item/product_code'] ?? [];
  const descriptions = rawFields['line_item/description'] ?? [];
  const fallback = rawFields['line_item'] ?? [];
  const quantities = rawFields['line_item/quantity'] ?? [];
  const units = rawFields['line_item/unit'] ?? [];
  const unitPrices = rawFields['line_item/unit_price'] ?? [];
  const totals = rawFields['line_item/amount'] ?? rawFields['line_item/total'] ?? [];
  const ncmValues = rawFields['line_item/ncm'] ?? [];
  const cfopValues = rawFields['line_item/cfop'] ?? [];

  const max = Math.max(
    codes.length,
    descriptions.length,
    fallback.length,
    quantities.length,
    units.length,
    unitPrices.length,
    totals.length,
    ncmValues.length,
    cfopValues.length
  );

  const items: InvoiceItem[] = [];

  for (let index = 0; index < max; index++) {
    const codigo = normalizeString(codes[index]);
    const descricao = normalizeString(descriptions[index] ?? fallback[index]);
    const quantidade = normalizeString(quantities[index]);
    const unidade = normalizeString(units[index]);
    const valorUnitario = normalizeString(unitPrices[index]);
    const valorTotal = normalizeString(totals[index]);
    const ncm = normalizeString(ncmValues[index]);
    const cfop = normalizeString(cfopValues[index]);

    if (!codigo && !descricao) continue;

    items.push({
      codigo_prod: codigo,
      descricao,
      quantidade,
      unidade,
      valor_unitario: valorUnitario,
      valor_total: valorTotal,
      ncm: ncm || undefined,
      cfop: cfop || undefined,
      raw: {
        product_code: codes[index] ?? null,
        description: descriptions[index] ?? fallback[index] ?? null,
        quantity: quantities[index] ?? null,
        unit: units[index] ?? null,
        unit_price: unitPrices[index] ?? null,
        amount: totals[index] ?? null
      }
    });
  }

  return items;
};

const calculateDueDate = (issueDate: string): string => {
  if (!issueDate) return '';
  const d = new Date(issueDate);
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0];
};

// Funï¿½ï¿½o unificada para construir o estado inicial
const buildInitialState = (initialData?: DeliveryUploadInitialData): StructuredInvoiceData => {
  const base = createEmptyStructuredData();

  if (!initialData) return base;

  // Mapeamento de initialData antiga para a nova estrutura
  if (initialData.structured) {
    Object.assign(base, initialData.structured);
  }
  if (initialData.summary) {
    base.nf_data.numero = initialData.summary.nfNumber || base.nf_data.numero;
    base.destinatario.razao_social = initialData.summary.clientName || base.destinatario.razao_social;
    base.destinatario.cnpj_cpf = initialData.summary.clientCnpj || base.destinatario.cnpj_cpf;
    base.destinatario.endereco = initialData.summary.deliveryAddress || base.destinatario.endereco;
    base.valores.valor_total_nota = initialData.summary.merchandiseValue || base.valores.valor_total_nota;
    base.valores.valor_total_produtos = initialData.summary.merchandiseValue || base.valores.valor_total_produtos;
    base.volumes.quantidade = initialData.summary.volume || base.volumes.quantidade;
    base.volumes.peso_bruto = initialData.summary.weight || base.volumes.peso_bruto;
    base.nf_data.data_emissao = initialData.summary.issueDate || base.nf_data.data_emissao;
    // O dueDate ï¿½ calculado ou preenchido pelo Document AI, nï¿½o ï¿½ um campo direto na NF_Data
  }

  // Mapeamento de campos soltos para a nova estrutura // Corrigido
  base.nf_data.serie = initialData.serie || base.nf_data.serie;
  base.nf_data.chave = initialData.chave || base.nf_data.chave;
  base.valores.valor_frete = initialData.freight_amount || base.valores.valor_frete;

  return base;
};


// ##########################################################################
// ########################### COMPONENTE PRINCIPAL ###########################
// ##########################################################################

export const DeliveryUpload: React.FC<DeliveryUploadProps> = ({
  open,
  onOpenChange,
  onSuccess,
  initialData, 
  allowDriverSelection = false // Valor padrï¿½o ï¿½ false
}) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const { user } = useAuth();

  const [structuredData, setStructuredData] = useState<StructuredInvoiceData>(
    () => buildInitialState(initialData)
  );
  const [step, setStep] = useState<'upload' | 'form'>('upload');
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(true);
  const [isSefazValid, setIsSefazValid] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriverUserId, setSelectedDriverUserId] = useState<string | undefined>(undefined);

  const formatDateForInput = (value: string): string => {
    if (!value) return '';
    const normalized = normalizeDateValue(value);
    return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '';
  };

  useEffect(() => {
    // Busca a lista de motoristas se a seleção for permitida e o modal estiver aberto.
    if (allowDriverSelection && open) {
      const fetchDrivers = async () => {
        try {
          const response = await apiService.getDrivers({ status: 'active' });
          if (response.success && Array.isArray(response.data)) {
            const normalizedDrivers: Driver[] = (response.data as Array<Record<string, unknown>>)
              .map((rawDriver) => {
                const driverData = (rawDriver ?? {}) as Record<string, unknown>;
                const idCandidate = driverData['id'] ?? driverData['driver_id'] ?? driverData['user_id'] ?? driverData['userId'];
                const userIdCandidate = driverData['user_id'] ?? driverData['userId'] ?? idCandidate;
                const nameCandidate = driverData['name'] ?? driverData['full_name'] ?? driverData['username'] ?? driverData['email'];

                const id = idCandidate != null ? String(idCandidate) : '';
                const name = nameCandidate != null ? String(nameCandidate) : 'Motorista';
                const userId = userIdCandidate != null ? String(userIdCandidate) : undefined;

                return { id, name, userId } as Driver;
              })
              .filter((driver) => driver.id.length > 0);

            setDrivers(normalizedDrivers);
          }
        } catch (error) {
          console.error('Erro ao buscar motoristas:', error);
        }
      };

      fetchDrivers();
    }
  }, [allowDriverSelection, open]);

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  useEffect(() => {
    if (initialData) {
      setStructuredData(buildInitialState(initialData));
    }
  }, [JSON.stringify(initialData)]);

  const updateStructuredField = <K extends StructuredSectionKey, F extends keyof StructuredInvoiceData[K]>(
    section: K,
    field: F,
    value: string
  ) => {
    setStructuredData(prev => ({
      ...prev,
      [section]: {
        ...(prev[section] as Record<string, string>),
        [field]: value
      } as StructuredInvoiceData[K]
    }));
  };

  const updateDuplicataField = (index: number, key: keyof InvoiceDuplicata, value: string) => {
    setStructuredData(prev => {
      const duplicates = prev.duplicatas.slice();
      duplicates[index] = { ...duplicates[index], [key]: value };
      return { ...prev, duplicatas: duplicates };
    });
  };

  const addDuplicata = () => {
    setStructuredData(prev => ({
      ...prev,
      duplicatas: [
        ...prev.duplicatas,
        {
          identificador: `PARCELA-${String(prev.duplicatas.length + 1).padStart(2, '0')}`,
          valor: '',
          data_vencimento: '',
          raw: null
        }
      ]
    }));
  };

  const removeDuplicata = (index: number) => {
    setStructuredData(prev => ({
      ...prev,
      duplicatas: prev.duplicatas.filter((_, i) => i !== index)
    }));
  };

  const updateItemField = (index: number, key: keyof InvoiceItem, value: string) => {
    setStructuredData(prev => {
      const items = prev.itens_de_linha.slice();
      items[index] = { ...items[index], [key]: value };
      return { ...prev, itens_de_linha: items };
    });
  };

  const addItem = () => {
    setStructuredData(prev => ({
      ...prev,
      itens_de_linha: [
        ...prev.itens_de_linha,
        {
          codigo_prod: '',
          descricao: '',
          quantidade: '',
          unidade: '',
          valor_unitario: '',
          valor_total: '',
          raw: null
        }
      ]
    }));
  };

  const removeItem = (index: number) => {
    setStructuredData(prev => ({
      ...prev,
      itens_de_linha: prev.itens_de_linha.filter((_, i) => i !== index)
    }));
  };

  // ##########################################################################
// ########### NOVAS FUNï¿½ï¿½ES DE EXTRAï¿½ï¿½O DE TEXTO BRUTO
// ##########################################################################

// Funï¿½ï¿½o auxiliar para extrair dados do texto bruto usando regex
// Adicione esta nova funï¿½ï¿½o auxiliar ao seu componente
const extractFieldsFromRawText = (text: string): Record<string, string> => {
  if (!text) return {};
  const extracted: Record<string, string> = {};

  const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
  const digits = (s: string) => s.replace(/\D/g, '');
  const find = (regex: RegExp): string => {
    const match = text.match(regex);
    return match && match[1] ? clean(match[1]) : '';
  };

  // Mapeamento corrigido com base nos rï¿½tulos fornecidos
  extracted.nf_numero = find(/N[rï¿½o]\.?\s*[:\-\s]*(\d+)/i);
  extracted.nf_serie = find(/S[eï¿½]rie[:\-\s]*(\d+)/i);
  extracted.chave_acesso = find(/Chave de Acesso\s*([\d\s]{44})/i);
  extracted.data_emissao = find(/Data de Emiss[ï¿½a]o\s*(\d{2}\/\d{2}\/\d{4})/i);
  extracted.data_saida = find(/Dt\. Sa[ï¿½i]da\/Entrada\s*(\d{2}\/\d{2}\/\d{4})/i);
  extracted.protocolo_autorizacao = find(/Protocolo de autoriza[ï¿½c][ï¿½a]o de uso\s*(\d+)/i);
  
  // Remetente
  extracted.remetente_razao_social = find(/Raz[ï¿½a]o Social\s*([^\n\r]+)/i);
  extracted.remetente_cnpj = digits(find(/CNPJ\s*([\d.\-/\s]{14,})/i));
  extracted.remetente_endereco = find(/Remetente\s*Endere[ï¿½c]o\s*([^\n\r]+)/i);
  extracted.remetente_municipio = find(/Remetente\s*Munic[ï¿½i]pio\s*([^\n\r]+)/i);
  extracted.remetente_uf = find(/Remetente\s*UF\s*([A-Z]{2})/i);
  extracted.remetente_cep = find(/Remetente\s*CEP\s*([\d]{5}\-?[\d]{3})/i);
  extracted.remetente_telefone = find(/Remetente\s*Fone[:\-\s]*([\d\s\-\(\)]+)/i);

  // Destinatï¿½rio
  extracted.destinatario_razao_social = find(/Destinat[ï¿½a]rio \/ Remetente\s*Nome \/ Raz[ï¿½a]o Social\s*([^\n\r]+)/i);
  extracted.destinatario_cnpj = digits(find(/Destinat[ï¿½a]rio \/ Remetente\s*CNPJ\/CPF\s*([\d.\-/\s]{14,})/i));
  extracted.destinatario_endereco = find(/Destinat[ï¿½a]rio \/ Remetente\s*Endere[ï¿½c]o\s*([^\n\r]+)/i);
  extracted.destinatario_municipio = find(/Destinat[ï¿½a]rio \/ Remetente\s*Munic[ï¿½i]pio\s*([^\n\r]+)/i);
  extracted.destinatario_uf = find(/Destinat[ï¿½a]rio \/ Remetente\s*UF\s*([A-Z]{2})/i);
  extracted.destinatario_cep = find(/Destinat[ï¿½a]rio \/ Remetente\s*CEP\s*([\d]{5}\-?[\d]{3})/i);
  extracted.destinatario_telefone = find(/Destinat[ï¿½a]rio \/ Remetente\s*Fone\/Fax\s*([\d\s\-\(\)]+)/i);
  
  extracted.total_nota = find(/Valor Total da Nota\s*([\d.,]+)/i);
  extracted.valor_frete = find(/Valor do Frete\s*([\d.,]+)/i);
  extracted.peso_bruto = find(/Peso Bruto\s*([\d.,]+)/i);
  extracted.peso_liquido = find(/Peso Lï¿½quido\s*([\d.,]+)/i);
  extracted.volumes_quantidade = find(/Quantidade de Volume\(s\)\s*([\d\.,]+)/i);

  return extracted;
};

const handleDocumentAIData = (input: DocumentAIParsedPayload) => {
  const detail = input?.detail ?? input ?? {};
  const rawText = detail.rawText ?? input.rawText ?? '';
  const entities = Array.isArray(detail.entities) ? detail.entities : (Array.isArray(input.entities) ? input.entities : []);
  const rawFields = (detail.rawFields ?? input.rawFields ?? {}) as Record<string, string[]>;
  const confidence = typeof detail.confidence === 'number' ? detail.confidence : (typeof input.confidence === 'number' ? input.confidence : null);

  console.log('Texto extraído do PDF:', rawText);
  if (rawFields && Object.keys(rawFields).length) {
    console.log('Rótulos Document AI recebidos:', rawFields);
  }
  
  const rawTextData = extractFieldsFromRawText(rawText); 

  const newStructuredData = createEmptyStructuredData();
  newStructuredData.raw_text = rawText;
  newStructuredData.raw_fields = rawFields;
  newStructuredData.document_ai_confidence = confidence;
  newStructuredData.document_ai_entities = entities as Array<Record<string, unknown>>;
  
  // Mapeamento simplificado dos dados recebidos do backend
  const data = (detail.extractedData || {}) as Record<string, string>;

  const rawNfNumber = takeFirstFromRaw(rawFields, 'nro', 'numero nf', 'numero', 'invoice_number', 'invoice_id', 'document_number');
  const rawAccessKey = takeFirstFromRaw(rawFields, 'chave', 'chave de acesso', 'chave_acesso', 'chave nfe', 'chave_nfe', 'nfe key', 'nfe_key', 'access key');
  const rawClientName = takeFirstFromRaw(rawFields, 'receiver_name', 'nome do cliente', 'cliente', 'customer_name', 'destinatario');
  const rawProductValue = takeFirstFromRaw(rawFields, 'total_amount', 'valor_total_produtos', 'valor total produtos', 'subtotal');
  const rawInvoiceTotal = takeFirstFromRaw(rawFields, 'valor_total_nota', 'valor nota', 'amount_due', 'grand_total');
  const rawIssueDate = takeFirstFromRaw(rawFields, 'invoice_date', 'issue_date', 'data_emissao', 'emissao', 'data de emissao');
  const rawDepartureDate = takeFirstFromRaw(
    rawFields,
    'saida',
    'data_saida',
    'data saida',
    'data de saida',
    'data de saida/entrada',
    'saida/entrada',
    'ship_date',
    'shipment_date'
  );

  const nfNumber = normalizeString(data.nro ?? data.nfNumber ?? rawNfNumber ?? '');
  const chave = normalizeString(data.chave ?? data.nfeKey ?? rawAccessKey ?? '');
  const clientName = (data.receiver_name ?? data.clientName ?? rawClientName ?? '').trim();
  const productValue = data.total_amount ?? data.productValue ?? data.invoiceTotalValue ?? rawProductValue ?? '';
  const invoiceTotalValue = data.invoiceTotalValue ?? data.total_amount ?? data.productValue ?? rawInvoiceTotal ?? '';
  const issueDate = data.invoice_date ?? data.issueDate ?? rawIssueDate ?? '';
  const departureDate = data.saida ?? data.departureDate ?? rawDepartureDate ?? '';

  newStructuredData.nf_data.numero = nfNumber;
  newStructuredData.nf_data.chave = chave;
  newStructuredData.destinatario.razao_social = clientName;
  newStructuredData.valores.valor_total_produtos = productValue;
  newStructuredData.valores.valor_total_nota = invoiceTotalValue;
  newStructuredData.nf_data.data_emissao = normalizeDateValue(issueDate);
  newStructuredData.nf_data.data_saida = normalizeDateValue(departureDate);

  // Preenche o valor total da nota com o valor dos produtos se o primeiro estiver vazio
  if (!newStructuredData.valores.valor_total_nota && newStructuredData.valores.valor_total_produtos) {
    newStructuredData.valores.valor_total_nota = newStructuredData.valores.valor_total_produtos;
  }

  setStructuredData(newStructuredData);
  setIsSefazValid(true);
  setIsEditing(true);
  setStep('form');

  toast({
    title: 'Dados recebidos do Document AI',
    description: 'Os dados foram preenchidos automaticamente. Verifique e ajuste se necessário.'
  });
};

  const processDocumentWithAI = async (file: File) => {
    try {
      setLoading(true);
      const response = await apiService.smartProcessDocument(file);
      console.log('Resposta completa do Document AI:', response);

      if (response.success && response.data) {
        const { extractedData, entities, rawText, rawFields, confidence } = response.data;
        handleDocumentAIData({
          extractedData,
          entities: Array.isArray(entities) ? entities : (entities ? [entities] : []),
          rawText,
          rawFields: rawFields || {},
          confidence: typeof confidence === 'number' ? confidence : undefined
        });

        toast({
          title: 'Documento processado com sucesso',
          description: 'Os dados foram extraídos automaticamente. Verifique e ajuste se necessário.'
        });
      } else {
        setIsSefazValid(false);
        toast({
          title: 'Erro ao processar documento',
          
          variant: 'destructive'
        });
        setStep('form'); // Mantenha no formulÃ¡rio para preenchimento manual
      }
    } catch (error) {
      setIsSefazValid(false);
      console.error('Erro ao processar documento com Document AI:', error);
      toast({
        title: 'Erro ao processar documento',
        description: 'Ocorreu um erro ao enviar o documento para análise.',
        variant: 'destructive'
      });
      setStep('form'); // Mantenha no formulÃ¡rio para preenchimento manual
    } finally {
      setLoading(false);
    }
  };

  const validateSefazDocument = async (file: File): Promise<boolean> => {
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

    if (fileExtension !== '.xml') {
      return true;
    }

    const textContent = await file.text();
    const sefazIndicators = ['<infNFe', '<emit>', '<dest>', '<det>', 'xmlns="http://www.portalfiscal.inf.br/nfe"'];
    const isSefaz = sefazIndicators.some((indicator) => textContent.includes(indicator));
    if (!isSefaz) {
      toast({
        title: 'Documento invÃ¡lido',
        description: 'O arquivo XML não parece ser um documento SEFAZ válido',
        variant: 'destructive'
      });
      return false;
    }

    return true;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  if (!ALLOWED_FILE_EXTENSIONS.includes(fileExtension)) {
    toast({
      title: 'Arquivo não suportado',
      description: 'Envie um XML, PDF ou imagem (JPG, PNG, WEBP, HEIC).',
      variant: 'destructive'
    });
    e.target.value = '';
    setUploadedFile(null);
    return;
  }

  if (fileExtension === '.xml') {
    const isValid = await validateSefazDocument(file);
    if (!isValid) {
      e.target.value = '';
      setUploadedFile(null);
      return;
    }
  }

  setUploadedFile(file);
  await processDocumentWithAI(file);
};

  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;    
    setUploadedFile(file);
    await processDocumentWithAI(file);
  };

  const isMobileDevice = () => {
    if (typeof navigator === 'undefined') return false;
    return /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(navigator.userAgent);
  };

  const openCamera = async () => {
    if (isMobileDevice()) {
      cameraInputRef.current?.click();
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast({
        title: 'Câmera indisponível',
        description: 'Nao foi possivel acessar a camera automaticamente. Selecione a foto manualmente.',
        variant: 'destructive'
      });
      cameraInputRef.current?.click();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.playsInline = true;
      await video.play();

      await new Promise<void>((resolve) => {
        if (video.readyState >= 2) {
          resolve();
          return;
        }
        const onCanPlay = () => {
          video.removeEventListener('canplay', onCanPlay);
          resolve();
        };
        video.addEventListener('canplay', onCanPlay);
      });

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
      if (blob) {
        const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
        setUploadedFile(file);
        await processDocumentWithAI(file);
      }

      stream.getTracks().forEach((track) => track.stop());
    } catch (error) {
       // Correção: Trata erros de permissão de forma mais específica
      if (error instanceof Error && (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError')) { 
        console.warn('Acesso à câmera negado pelo usuário ou navegador.');
        toast({
          title: 'Acesso à câmera negado',
          description: 'Por favor, use a opção "Selecionar Arquivo" para enviar a foto.',
          variant: 'default'
        });
      } else {
        console.error('Erro ao acessar camera', error);
        toast({
          title: 'Erro na câmera',
          description: 'Não foi possível acessar a câmera. Tente enviar a foto manualmente.',
          variant: 'destructive'
        });
      }
      cameraInputRef.current?.click();
    }
  };


const handleSaveDelivery = async () => {
  try {
    setLoading(true);

    // Validação no frontend antes de enviar
    const requiredFields = [
      { value: structuredData.nf_data.numero, label: 'Número da NF' },
      { value: structuredData.destinatario.razao_social, label: 'Nome do Cliente' },
      { value: structuredData.nf_data.data_emissao, label: 'Data de emissão' },
      { value: structuredData.nf_data.data_saida, label: 'Data de saída' },
      { value: structuredData.valores.valor_total_produtos, label: 'Valor total da entrega' },
      { value: structuredData.valores.valor_total_nota, label: 'Valor total da nota' },
    ];
    const missingFields = requiredFields.filter(({ value }) => !normalizeString(value));
    if (missingFields.length > 0) {
      toast({
        title: 'Campos obrigatórios',
        description: `Preencha: ${missingFields.map(({ label }) => label).join(', ')}.`,
        variant: 'destructive'
      });
      setLoading(false);
      return;
    }

    // Usa driver_id do backend quando o usuario autenticado for motorista.
    const fallbackDriverUserId = user?.id ? String(user.id) : (user?.user_id ? String(user.user_id) : undefined);
    const driverIdForPayload = allowDriverSelection
      ? selectedDriverUserId
      : (user?.user_type === 'DRIVER' || user?.user_type === 'MOTORISTA' ? fallbackDriverUserId : undefined);

    if (allowDriverSelection && !driverIdForPayload) {
      toast({ title: 'Motorista não selecionado', description: 'Por favor, atribua a entrega a um motorista.', variant: 'destructive' });
      setLoading(false);
      return;
    }

    const summaryPayload = {
      nf_number: normalizeString(structuredData.nf_data.numero),
      nfe_key: sanitizeDocumentNumber(structuredData.nf_data.chave),
      client_name: normalizeString(structuredData.destinatario.razao_social),
      delivery_address: normalizeString(structuredData.destinatario.endereco),
      emission_date: normalizeDateValue(structuredData.nf_data.data_emissao),
      departure_date: normalizeDateValue(structuredData.nf_data.data_saida),
      // CORREÇÃO: Adiciona a data esperada da entrega para o filtro do dashboard funcionar.
      delivery_date_expected: normalizeDateValue(structuredData.nf_data.data_saida),
      merchandise_value: normalizeString(structuredData.valores.valor_total_produtos),
      invoice_total_value: normalizeString(structuredData.valores.valor_total_nota),
    };

    // Garante que um arquivo foi selecionado antes do envio
    if (!uploadedFile) {
      toast({
        title: 'Documento obrigatório',
        description: 'Selecione um XML ou PDF da NF antes de salvar a entrega.',
        variant: 'destructive'
      });
      setLoading(false);
      return;
    }

    const payload = {
      structured: structuredData,
      summary: summaryPayload,
      isSefazValid,
      driver_id: driverIdForPayload,
      file: uploadedFile,
    };

    console.log('Payload a ser enviado para a API:', payload);

    const response = await apiService.createDelivery(payload);
    if (response.success) {
      toast({
        title: 'Entrega cadastrada!',
        description: 'A entrega foi registrada com sucesso'
      });
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    }
  } catch (error) {
    console.error('Erro ao salvar entrega', error);
    toast({
      title: 'Erro ao salvar',
      description: (error as Error).message || 'Não foi possível salvar a entrega. Tente novamente.',
      variant: 'destructive'
    });
  } finally {
    setLoading(false);
  }
};


  const resetForm = () => {
    setStep('upload');
    setLoading(false);
    setIsEditing(true);
    setIsSefazValid(false);
    setUploadedFile(null);
    setStructuredData(createEmptyStructuredData());
    setSelectedDriverUserId(undefined);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-4xl md:max-w-5xl lg:max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Cadastrar Nova Entrega
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-muted-foreground mb-6">
                Escolha como deseja adicionar o documento da entrega.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => fileInputRef.current?.click()}> 
                <CardContent className="flex flex-col items-center justify-center p-6 space-y-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                    <Upload className="h-8 w-8 text-primary" />
                  </div>
                  <div className="text-center">
                    <h3 className="font-semibold">Selecionar Arquivo</h3>
                    <p className="text-sm text-muted-foreground mt-1">XML, PDF ou Foto (extração automática)</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={openCamera}>
                <CardContent className="flex flex-col items-center justify-center p-6 space-y-4">
                  <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center">
                    <Camera className="h-8 w-8 text-secondary" />
                  </div>
                  <div className="text-center">
                    <h3 className="font-semibold">Tirar Foto</h3>
                    <p className="text-sm text-muted-foreground mt-1">Fotografar documento (OCR automático)</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xml,.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,image/*"
              onChange={handleFileUpload}
              style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
            />

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleCameraCapture}
              style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
            />

            {loading && (
              <div className="text-center">
                <p className="text-muted-foreground">Processando documento...</p>
              </div>
            )}
          </div>
        )}

        {step === 'form' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/50">
              {isSefazValid ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium">Documento SEFAZ válido - Dados extraídos automaticamente</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <span className="text-sm font-medium">Preenchimento manual necessário</span>
                </>
              )}
            </div>

            {allowDriverSelection && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">Atribuir a Motorista</h3> 
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedDriverUserId || ''}
                  onChange={(e) => setSelectedDriverUserId(e.target.value || undefined)} // Corrigido: isEditing removido
                  disabled={!isEditing || drivers.length === 0}
                >
                  <option value="" disabled>Selecione um motorista</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.userId ?? driver.id}>
                      {driver.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">Dados da Nota</h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label>Número da NF</Label>
                  <Input value={structuredData.nf_data.numero} onChange={(e) => updateStructuredField('nf_data', 'numero', e.target.value)} disabled={!isEditing} /> 
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">Dados do Cliente</h3>
              <div className="space-y-2">
                <Label>Nome do Cliente</Label>
                <Input value={structuredData.destinatario.razao_social} onChange={(e) => updateStructuredField('destinatario', 'razao_social', e.target.value)} disabled={!isEditing} /> 
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">Datas da Nota</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data de emissão</Label>
                  <Input type="date" value={formatDateForInput(structuredData.nf_data.data_emissao)} onChange={(e) => updateStructuredField('nf_data', 'data_emissao', e.target.value)} disabled={!isEditing} /> 
                </div>
                <div className="space-y-2">
                  <Label>Data de saída</Label>
                  <Input type="date" value={formatDateForInput(structuredData.nf_data.data_saida)} onChange={(e) => updateStructuredField('nf_data', 'data_saida', e.target.value)} disabled={!isEditing} /> 
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">Valores da Nota</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor total da entrega</Label>
                  <Input value={structuredData.valores.valor_total_produtos} onChange={(e) => updateStructuredField('valores', 'valor_total_produtos', e.target.value)} disabled={!isEditing} /> 
                </div>
                <div className="space-y-2">
                  <Label>Valor total da nota</Label>
                  <Input value={structuredData.valores.valor_total_nota} onChange={(e) => updateStructuredField('valores', 'valor_total_nota', e.target.value)} disabled={!isEditing} /> 
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setStep('upload')} className="flex-1">
                <X className="h-4 w-4 mr-2" />
                Voltar
              </Button>

              <Button onClick={handleSaveDelivery} disabled={loading} className="flex-1">
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Salvando...' : 'Salvar Entrega'}
              </Button>
            </div>
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
};
