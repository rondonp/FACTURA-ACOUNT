export interface Client {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  createdAt: string;
  type: 'Residencial' | 'Comercial';
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  isMaintenance?: boolean;
  isNewEquipment?: boolean;
}

export interface Invoice {
  id:string;
  clientId: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  items: InvoiceItem[];
  notes?: string;
  status: 'Borrador' | 'Enviada' | 'Pagada' | 'Vencida';
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: 'Materiales' | 'Combustible' | 'Herramientas' | 'Marketing' | 'Otro';
}

export interface ServiceItem {
  inventoryItemId: string;
  quantity: number;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  items: ServiceItem[];
  laborCost: number;
  totalPrice: number;
}

export interface AppSettings {
  businessInfo: {
    name: string;
    address: string;
    phone: string;
    email: string;
    taxId: string;
    logo: string | null;
    signature: string | null;
  };
  invoiceSettings: {
    template: 'default' | 'pos' | 'modern' | 'classic' | 'elegant';
    accentColor: string;
  };
}
