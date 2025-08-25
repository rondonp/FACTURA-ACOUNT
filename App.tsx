
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Client, Invoice, InvoiceItem, InventoryItem, Expense, AppSettings, Service, ServiceItem } from './types';
import { ICONS } from './constants';

// Declare global variables from CDN scripts
declare var jspdf: any;
declare var html2canvas: any;

// UTILITY FUNCTIONS
const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
const formatCurrency = (amount: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(amount);
const generateId = () => Math.random().toString(36).substr(2, 9);


// CUSTOM HOOK for LocalStorage
function useLocalStorage<T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [storedValue, setStoredValue] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(error);
            return initialValue;
        }
    });

    const setValue = (value: T | ((val: T) => T)) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.error(error);
        }
    };

    return [storedValue, setValue];
}

// PDF Generation Helper
const generatePdf = async (elementId: string, fileName: string) => {
    const input = document.getElementById(elementId);
    if (!input) {
        alert('Elemento para imprimir no encontrado.');
        return;
    }
    
    document.body.classList.add('pdf-export-active');
    
    try {
        const canvas = await html2canvas(input, { 
            scale: 2,
            useCORS: true, // Allow loading of cross-origin images (logo, signature)
        });
        const imgData = canvas.toDataURL('image/png');
        
        // Use the jspdf global from the CDN
        const { jsPDF } = jspdf;
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'pt',
            format: 'a4'
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const imgProps= pdf.getImageProperties(imgData);
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        let heightLeft = pdfHeight;
        let position = 0;
        const pageHeight = pdf.internal.pageSize.getHeight();
        
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
        
        while (heightLeft >= 0) {
          position = heightLeft - pdfHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
          heightLeft -= pageHeight;
        }
        
        pdf.save(`${fileName}.pdf`);
    } catch(err) {
        console.error("Error al generar PDF:", err);
        alert("Hubo un error al generar el PDF. Revise la consola para más detalles.");
    } finally {
        document.body.classList.remove('pdf-export-active');
    }
};


// UI Components
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <div className={`bg-white rounded-xl shadow-md p-6 ${className}`}>{children}</div>
);

const Button: React.FC<{ onClick?: () => void; children: React.ReactNode; className?: string; type?: 'button' | 'submit' }> = ({ onClick, children, className, type = 'button' }) => (
    <button type={type} onClick={onClick} className={`flex items-center justify-center px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition-colors duration-200 ${className}`}>
        {children}
    </button>
);

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
    <input {...props} className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${props.className}`} />
);

const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => (
    <textarea {...props} className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${props.className}`} />
);

const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
    <select {...props} className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${props.className}`}>
        {props.children}
    </select>
);

const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode, size?: 'max-w-2xl' | 'max-w-4xl' }> = ({ isOpen, onClose, title, children, size = 'max-w-2xl' }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
            <div className={`bg-white rounded-xl shadow-2xl w-full m-4 max-h-[90vh] flex flex-col ${size}`}>
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold text-gray-800">{title}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-3xl leading-none">&times;</button>
                </div>
                <div className="p-6 overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
};

// Main App Component
export default function App() {
    // State Management
    const [currentPage, setCurrentPage] = useState('dashboard');
    
    const [clients, setClients] = useLocalStorage<Client[]>('clients', []);
    const [invoices, setInvoices] = useLocalStorage<Invoice[]>('invoices', []);
    const [inventory, setInventory] = useLocalStorage<InventoryItem[]>('inventory', []);
    const [expenses, setExpenses] = useLocalStorage<Expense[]>('expenses', []);
    const [services, setServices] = useLocalStorage<Service[]>('services', []);
    const [settings, setSettings] = useLocalStorage<AppSettings>('settings', {
        businessInfo: { name: 'Tu Negocio HVAC', address: 'Tu Dirección', phone: 'Tu Teléfono', email: 'tu@email.com', taxId: 'Tu RNC', logo: null, signature: null },
        invoiceSettings: { template: 'default', accentColor: '#3B82F6' }
    });

    // Reusable Forms
    const ExpenseForm = ({ expense, onSave, onCancel }: { expense: Expense | null; onSave: (expense: Expense) => void; onCancel: () => void; }) => {
        const [formData, setFormData] = useState(expense || { id: '', description: '', amount: 0, date: new Date().toISOString().split('T')[0], category: 'Materiales' });
        
        const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
             const { name, value, type } = e.target;
             setFormData({ ...formData, [name]: type === 'number' ? parseFloat(value) || 0 : value });
        };

        const handleSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            onSave({ ...formData, id: expense?.id || '' } as Expense);
        };

        return (
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input name="description" placeholder="Descripción del gasto" value={formData.description} onChange={handleChange} required />
                <Input name="amount" type="number" step="0.01" placeholder="Monto" value={formData.amount} onChange={handleChange} required />
                <Input name="date" type="date" value={formData.date} onChange={handleChange} required />
                <Select name="category" value={formData.category} onChange={handleChange}>
                    <option>Materiales</option>
                    <option>Combustible</option>
                    <option>Herramientas</option>
                    <option>Marketing</option>
                    <option>Otro</option>
                </Select>
                <div className="flex justify-end space-x-4 pt-4">
                    <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancelar</button>
                    <Button type="submit">{expense ? 'Guardar Cambios' : 'Añadir Gasto'}</Button>
                </div>
            </form>
        );
    };

    // Page Components
    const PageComponent = () => {
        switch (currentPage) {
            case 'dashboard':
                return <DashboardPage />;
            case 'clients':
                return <ClientsPage />;
            case 'invoices':
                return <InvoicesPage />;
            case 'inventory':
                 return <InventoryPage />;
            case 'expenses':
                 return <ExpensesPage />;
            case 'reports':
                return <ReportsPage />;
            case 'settings':
                return <SettingsPage />;
            default:
                return <DashboardPage />;
        }
    };

    // Sub-components (Pages & Forms)

    const DashboardPage = () => {
        const upcomingMaintenance = useMemo(() => {
            const now = new Date();
            const fifteenDaysFromNow = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
            return invoices
                .filter(inv => inv.nextMaintenanceDate && new Date(inv.nextMaintenanceDate) <= fifteenDaysFromNow && new Date(inv.nextMaintenanceDate) >= now)
                .map(inv => clients.find(c => c.id === inv.clientId))
                .filter((c): c is Client => !!c)
                .reduce((unique, item) => unique.find(u => u.id === item.id) ? unique : [...unique, item], [] as Client[]);
        }, [invoices, clients]);

        const monthlyData = useMemo(() => {
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            const income = invoices
                .filter(inv => inv.status === 'Pagada')
                .filter(inv => {
                    const issueDate = new Date(inv.issueDate);
                    return issueDate.getMonth() === currentMonth && issueDate.getFullYear() === currentYear;
                })
                .reduce((sum, inv) => sum + inv.items.reduce((itemSum, item) => itemSum + item.quantity * item.unitPrice, 0), 0);

            const totalExpenses = expenses
                 .filter(exp => {
                    const expDate = new Date(exp.date);
                    return expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear;
                })
                .reduce((sum, exp) => sum + exp.amount, 0);

            return { income, totalExpenses };
        }, [invoices, expenses]);
        
        const monthlyProfit = monthlyData.income - monthlyData.totalExpenses;

        return (
            <div className="space-y-8">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">Resumen Financiero del Mes</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card>
                            <h3 className="text-lg font-semibold text-gray-500">Ingresos</h3>
                            <p className="text-4xl font-bold text-green-600">{formatCurrency(monthlyData.income)}</p>
                        </Card>
                        <Card>
                            <h3 className="text-lg font-semibold text-gray-500">Gastos</h3>
                            <p className="text-4xl font-bold text-red-600">{formatCurrency(monthlyData.totalExpenses)}</p>
                        </Card>
                        <Card>
                            <h3 className="text-lg font-semibold text-gray-500">Ganancia Neta</h3>
                            <p className={`text-4xl font-bold ${monthlyProfit >= 0 ? 'text-blue-600' : 'text-orange-500'}`}>{formatCurrency(monthlyProfit)}</p>
                        </Card>
                    </div>
                </div>

                <div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">Resumen Operativo</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                            <h3 className="text-lg font-semibold text-gray-500">Total Clientes</h3>
                            <p className="text-4xl font-bold text-gray-800">{clients.length}</p>
                        </Card>
                        <Card>
                            <h3 className="text-lg font-semibold text-gray-500">Mantenimiento Próximo</h3>
                            <p className="text-4xl font-bold text-blue-600">{upcomingMaintenance.length}</p>
                            <p className="text-sm text-gray-400">En los próximos 15 días</p>
                        </Card>
                    </div>
                </div>
            </div>
        );
    };

    const ClientsPage = () => {
        const [isModalOpen, setIsModalOpen] = useState(false);
        const [editingClient, setEditingClient] = useState<Client | null>(null);

        const handleAddClient = () => {
            setEditingClient(null);
            setIsModalOpen(true);
        };

        const handleEditClient = (client: Client) => {
            setEditingClient(client);
            setIsModalOpen(true);
        };
        
        const handleDeleteClient = (clientId: string) => {
            if(window.confirm('¿Está seguro que desea eliminar este cliente? Esta acción no se puede deshacer.')){
                setClients(prev => prev.filter(c => c.id !== clientId));
                // Optionally delete related invoices
            }
        };

        const handleSaveClient = (client: Client) => {
            if (editingClient) {
                setClients(prev => prev.map(c => c.id === client.id ? client : c));
            } else {
                setClients(prev => [...prev, { ...client, id: generateId(), createdAt: new Date().toISOString() }]);
            }
            setIsModalOpen(false);
        };

        const ClientForm = ({ client, onSave, onCancel }: { client: Client | null; onSave: (client: Client) => void; onCancel: () => void; }) => {
            const [formData, setFormData] = useState<Omit<Client, 'id' | 'createdAt' > & {id?: string, createdAt?: string}>(client || { name: '', address: '', phone: '', email: '', type: 'Residencial' });
            
            const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
                setFormData({ ...formData, [e.target.name]: e.target.value });
            };

            const handleSubmit = (e: React.FormEvent) => {
                e.preventDefault();
                onSave(formData as Client);
            };

            return (
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input name="name" placeholder="Nombre completo" value={formData.name} onChange={handleChange} required />
                    <Input name="address" placeholder="Dirección" value={formData.address} onChange={handleChange} />
                    <Input name="phone" type="tel" placeholder="Teléfono" value={formData.phone} onChange={handleChange} />
                    <Input name="email" type="email" placeholder="Correo electrónico" value={formData.email} onChange={handleChange} />
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Cliente</label>
                        <Select name="type" value={formData.type} onChange={handleChange}>
                            <option value="Residencial">Residencial</option>
                            <option value="Comercial">Comercial</option>
                        </Select>
                    </div>
                    <div className="flex justify-end space-x-4 pt-4">
                        <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancelar</button>
                        <Button type="submit">{client ? 'Guardar Cambios' : 'Crear Cliente'}</Button>
                    </div>
                </form>
            );
        };

        return (
            <Card>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">Clientes</h2>
                    <Button onClick={handleAddClient}>{ICONS.plus} Nuevo Cliente</Button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50 border-b">
                                <th className="p-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Nombre</th>
                                <th className="p-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Tipo</th>
                                <th className="p-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Teléfono</th>
                                <th className="p-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {clients.map(client => (
                                <tr key={client.id} className="border-b hover:bg-gray-50">
                                    <td className="p-3 font-medium">{client.name}</td>
                                    <td className="p-3">{client.type}</td>
                                    <td className="p-3">{client.phone}</td>
                                    <td className="p-3 flex space-x-2">
                                        <button onClick={() => handleEditClient(client)} className="text-blue-600 hover:text-blue-800">{ICONS.edit}</button>
                                        <button onClick={() => handleDeleteClient(client.id)} className="text-red-600 hover:text-red-800">{ICONS.trash}</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}>
                    <ClientForm client={editingClient} onSave={handleSaveClient} onCancel={() => setIsModalOpen(false)} />
                </Modal>
            </Card>
        );
    };
    
    const InventoryPage = () => {
        const [activeTab, setActiveTab] = useState<'items' | 'services'>('items');

        const TabButton = ({ isActive, onClick, children }: { isActive: boolean, onClick: () => void, children: React.ReactNode }) => (
            <button
                onClick={onClick}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg focus:outline-none ${isActive ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
                {children}
            </button>
        );

        return (
            <Card>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">Inventario y Servicios</h2>
                </div>
                <div className="border-b mb-6">
                    <TabButton isActive={activeTab === 'items'} onClick={() => setActiveTab('items')}>Artículos</TabButton>
                    <TabButton isActive={activeTab === 'services'} onClick={() => setActiveTab('services')}>Servicios / Kits</TabButton>
                </div>
                <div>
                    {activeTab === 'items' && <InventoryItemsManager />}
                    {activeTab === 'services' && <ServicesManager />}
                </div>
            </Card>
        );
    };

    const InventoryItemsManager = () => {
        const [isModalOpen, setIsModalOpen] = useState(false);
        const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

        const handleAddItem = () => { setEditingItem(null); setIsModalOpen(true); };
        const handleEditItem = (item: InventoryItem) => { setEditingItem(item); setIsModalOpen(true); };

        const handleDeleteItem = (itemId: string) => {
            if (window.confirm('¿Está seguro de que desea eliminar este artículo del inventario?')) {
                setInventory(prev => prev.filter(item => item.id !== itemId));
            }
        };

        const handleSaveItem = (item: InventoryItem) => {
            if (editingItem) {
                setInventory(prev => prev.map(i => i.id === item.id ? item : i));
            } else {
                setInventory(prev => [...prev, { ...item, id: generateId() }]);
            }
            setIsModalOpen(false);
        };

        const ItemForm = ({ item, onSave, onCancel }: { item: InventoryItem | null; onSave: (item: InventoryItem) => void; onCancel: () => void; }) => {
            const [formData, setFormData] = useState(item || { name: '', description: '', quantity: 0, unitPrice: 0 });
            const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                const { name, value, type } = e.target;
                setFormData({ ...formData, [name]: type === 'number' ? parseFloat(value) : value });
            };
            const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave({ ...formData, id: item?.id || '' }); };

            return (
                 <form onSubmit={handleSubmit} className="space-y-4">
                    <Input name="name" placeholder="Nombre del artículo" value={formData.name} onChange={handleChange} required />
                    <Textarea name="description" placeholder="Descripción" value={formData.description} onChange={handleChange} />
                    <div className="grid grid-cols-2 gap-4">
                        <Input name="quantity" type="number" placeholder="Cantidad" value={formData.quantity} onChange={handleChange} required />
                        <Input name="unitPrice" type="number" step="0.01" placeholder="Precio unitario" value={formData.unitPrice} onChange={handleChange} required />
                    </div>
                    <div className="flex justify-end space-x-4 pt-4">
                        <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancelar</button>
                        <Button type="submit">{item ? 'Guardar Cambios' : 'Añadir Artículo'}</Button>
                    </div>
                </form>
            );
        };

        return (
            <div>
                <div className="flex justify-end mb-4">
                    <Button onClick={handleAddItem}>{ICONS.plus} Nuevo Artículo</Button>
                </div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50 border-b">
                                <th className="p-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Artículo</th>
                                <th className="p-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Descripción</th>
                                <th className="p-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Cantidad</th>
                                <th className="p-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Precio</th>
                                <th className="p-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {inventory.map(item => (
                                <tr key={item.id} className="border-b hover:bg-gray-50">
                                    <td className="p-3 font-medium">{item.name}</td>
                                    <td className="p-3 text-sm text-gray-600">{item.description}</td>
                                    <td className="p-3">{item.quantity}</td>
                                    <td className="p-3">{formatCurrency(item.unitPrice)}</td>
                                    <td className="p-3 flex space-x-2">
                                        <button onClick={() => handleEditItem(item)} className="text-blue-600 hover:text-blue-800">{ICONS.edit}</button>
                                        <button onClick={() => handleDeleteItem(item.id)} className="text-red-600 hover:text-red-800">{ICONS.trash}</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                 <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Editar Artículo' : 'Nuevo Artículo de Inventario'}>
                    <ItemForm item={editingItem} onSave={handleSaveItem} onCancel={() => setIsModalOpen(false)} />
                </Modal>
            </div>
        );
    };

    const ServicesManager = () => {
        const [isModalOpen, setIsModalOpen] = useState(false);
        const [editingService, setEditingService] = useState<Service | null>(null);

        const handleAddService = () => { setEditingService(null); setIsModalOpen(true); };
        const handleEditService = (service: Service) => { setEditingService(service); setIsModalOpen(true); };

        const handleDeleteService = (serviceId: string) => {
            if (window.confirm('¿Está seguro de que desea eliminar este servicio?')) {
                setServices(prev => prev.filter(s => s.id !== serviceId));
            }
        };

        const handleSaveService = (service: Service) => {
            if (editingService) {
                setServices(prev => prev.map(s => s.id === service.id ? service : s));
            } else {
                setServices(prev => [...prev, { ...service, id: generateId() }]);
            }
            setIsModalOpen(false);
        };

        const ServiceForm = ({ service, onSave, onCancel }: { service: Service | null, onSave: (service: Service) => void, onCancel: () => void }) => {
            const [formData, setFormData] = useState(service || { name: '', description: '', items: [], laborCost: 0, totalPrice: 0 });

            const handleItemQuantityChange = (itemId: string, quantity: number) => {
                const existingItem = formData.items.find(i => i.inventoryItemId === itemId);
                let newItems;
                if (existingItem) {
                    if (quantity > 0) {
                        newItems = formData.items.map(i => i.inventoryItemId === itemId ? { ...i, quantity } : i);
                    } else {
                        newItems = formData.items.filter(i => i.inventoryItemId !== itemId);
                    }
                } else if (quantity > 0) {
                    newItems = [...formData.items, { inventoryItemId: itemId, quantity }];
                } else {
                    newItems = formData.items;
                }
                setFormData({ ...formData, items: newItems });
            };
            
            const handleSubmit = (e: React.FormEvent) => {
                e.preventDefault();
                const materialsCost = formData.items.reduce<number>((total, serviceItem) => {
                    const inventoryItem = inventory.find(i => i.id === serviceItem.inventoryItemId);
                    return total + (inventoryItem ? inventoryItem.unitPrice * serviceItem.quantity : 0);
                }, 0);
                const totalPrice = materialsCost + formData.laborCost;
                onSave({ ...formData, id: service?.id || '', totalPrice });
            };
            
            const materialsCost = useMemo(() => formData.items.reduce<number>((total, serviceItem) => {
                const inventoryItem = inventory.find(i => i.id === serviceItem.inventoryItemId);
                return total + (inventoryItem ? inventoryItem.unitPrice * serviceItem.quantity : 0);
            }, 0), [formData.items, inventory]);


            return (
                <form onSubmit={handleSubmit} className="space-y-6">
                    <Input name="name" placeholder="Nombre del Servicio (ej. Mantenimiento Preventivo)" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                    <Textarea name="description" placeholder="Descripción del servicio" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                    
                    <div>
                        <h3 className="font-semibold text-gray-700 mb-2">Materiales a utilizar</h3>
                        <div className="max-h-60 overflow-y-auto border rounded-lg p-2 space-y-2">
                            {inventory.map(item => (
                                <div key={item.id} className="grid grid-cols-3 gap-4 items-center">
                                    <label htmlFor={`item-${item.id}`} className="col-span-2">{item.name} ({formatCurrency(item.unitPrice)})</label>
                                    <Input 
                                        type="number" 
                                        id={`item-${item.id}`} 
                                        min="0"
                                        placeholder="Cant."
                                        value={formData.items.find(i => i.inventoryItemId === item.id)?.quantity || ''}
                                        onChange={e => handleItemQuantityChange(item.id, parseInt(e.target.value, 10) || 0)}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                       <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Costo de Mano de Obra</label>
                            <Input type="number" step="0.01" name="laborCost" placeholder="Mano de Obra" value={formData.laborCost} onChange={e => setFormData({...formData, laborCost: parseFloat(e.target.value) || 0})} required />
                       </div>
                       <div className="text-right pt-6">
                            <p className="text-sm text-gray-600">Costo Materiales: {formatCurrency(materialsCost)}</p>
                            <p className="text-lg font-bold">Precio Total Servicio: {formatCurrency(materialsCost + formData.laborCost)}</p>
                       </div>
                    </div>

                    <div className="flex justify-end space-x-4 pt-4">
                        <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancelar</button>
                        <Button type="submit">{service ? 'Guardar Cambios' : 'Crear Servicio'}</Button>
                    </div>
                </form>
            );
        };

        return (
            <div>
                <div className="flex justify-end mb-4">
                    <Button onClick={handleAddService}>{ICONS.plus} Nuevo Servicio</Button>
                </div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50 border-b">
                                <th className="p-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Servicio</th>
                                <th className="p-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Precio Total</th>
                                <th className="p-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {services.map(s => (
                                <tr key={s.id} className="border-b hover:bg-gray-50">
                                    <td className="p-3 font-medium">{s.name}</td>
                                    <td className="p-3">{formatCurrency(s.totalPrice)}</td>
                                    <td className="p-3 flex space-x-2">
                                        <button onClick={() => handleEditService(s)} className="text-blue-600 hover:text-blue-800">{ICONS.edit}</button>
                                        <button onClick={() => handleDeleteService(s.id)} className="text-red-600 hover:text-red-800">{ICONS.trash}</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingService ? 'Editar Servicio' : 'Nuevo Servicio / Kit'} size="max-w-4xl">
                    <ServiceForm service={editingService} onSave={handleSaveService} onCancel={() => setIsModalOpen(false)} />
                </Modal>
            </div>
        );
    };

    const ExpensesPage = () => {
        const [isModalOpen, setIsModalOpen] = useState(false);
        const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

        const handleAddExpense = () => {
            setEditingExpense(null);
            setIsModalOpen(true);
        };

        const handleEditExpense = (expense: Expense) => {
            setEditingExpense(expense);
            setIsModalOpen(true);
        };
        
        const handleDeleteExpense = (expenseId: string) => {
            if(window.confirm('¿Está seguro que desea eliminar este gasto?')){
                setExpenses(prev => prev.filter(e => e.id !== expenseId));
            }
        };

        const handleSaveExpense = (expense: Expense) => {
            if (editingExpense) {
                setExpenses(prev => prev.map(e => e.id === expense.id ? expense : e));
            } else {
                setExpenses(prev => [...prev, { ...expense, id: generateId() }]);
            }
            setIsModalOpen(false);
        };
        
        return (
            <Card>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">Registro de Gastos</h2>
                    <Button onClick={handleAddExpense}>{ICONS.plus} Nuevo Gasto</Button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50 border-b">
                                <th className="p-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Fecha</th>
                                <th className="p-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Descripción</th>
                                <th className="p-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Categoría</th>
                                <th className="p-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Monto</th>
                                <th className="p-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(expense => (
                                <tr key={expense.id} className="border-b hover:bg-gray-50">
                                    <td className="p-3">{formatDate(expense.date)}</td>
                                    <td className="p-3 font-medium">{expense.description}</td>
                                    <td className="p-3">{expense.category}</td>
                                    <td className="p-3 text-right">{formatCurrency(expense.amount)}</td>
                                    <td className="p-3 flex justify-center space-x-2">
                                        <button onClick={() => handleEditExpense(expense)} className="text-blue-600 hover:text-blue-800">{ICONS.edit}</button>
                                        <button onClick={() => handleDeleteExpense(expense.id)} className="text-red-600 hover:text-red-800">{ICONS.trash}</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                 <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingExpense ? 'Editar Gasto' : 'Nuevo Gasto'}>
                    <ExpenseForm expense={editingExpense} onSave={handleSaveExpense} onCancel={() => setIsModalOpen(false)} />
                </Modal>
            </Card>
        );
    };

    const InvoicesPage = () => {
        const [view, setView] = useState<'list' | 'form' | 'preview'>('list');
        const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

        const handleNewInvoice = () => {
            setSelectedInvoice(null);
            setView('form');
        };

        const handleEditInvoice = (invoice: Invoice) => {
            setSelectedInvoice(invoice);
            setView('form');
        };
        
        const handleDeleteInvoice = (invoiceId: string) => {
            if(window.confirm('¿Está seguro que desea eliminar esta factura?')) {
                setInvoices(prev => prev.filter(inv => inv.id !== invoiceId));
            }
        };

        const handleSaveInvoice = (invoice: Invoice) => {
            if (selectedInvoice) {
                setInvoices(prev => prev.map(i => i.id === invoice.id ? invoice : i));
            } else {
                const newInvoiceNumber = `INV-${(invoices.length + 1).toString().padStart(4, '0')}`;
                setInvoices(prev => [...prev, { ...invoice, id: generateId(), invoiceNumber: newInvoiceNumber }]);
            }
            setView('list');
        };
        
        const handlePreviewInvoice = (invoice: Invoice) => {
            setSelectedInvoice(invoice);
            setView('preview');
        };

        if (view === 'form') {
            return <InvoiceForm invoice={selectedInvoice} onSave={handleSaveInvoice} onCancel={() => setView('list')} clients={clients} services={services}/>
        }
        
        if (view === 'preview' && selectedInvoice) {
            const client = clients.find(c => c.id === selectedInvoice.clientId);
            if (!client) return <div>Cliente no encontrado</div>;
            return <InvoicePreview invoice={selectedInvoice} client={client} settings={settings} onBack={() => setView('list')} />
        }

        return (
            <Card>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">Facturas</h2>
                    <Button onClick={handleNewInvoice}>{ICONS.plus} Nueva Factura</Button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                         <thead>
                            <tr className="bg-gray-50 border-b">
                                <th className="p-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">N° Factura</th>
                                <th className="p-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Cliente</th>
                                <th className="p-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Fecha</th>
                                <th className="p-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Total</th>
                                <th className="p-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Estado</th>
                                <th className="p-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoices.map(invoice => {
                                const client = clients.find(c => c.id === invoice.clientId);
                                const total = invoice.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
                                const statusColor = {
                                    'Borrador': 'bg-gray-200 text-gray-800',
                                    'Enviada': 'bg-yellow-200 text-yellow-800',
                                    'Pagada': 'bg-green-200 text-green-800',
                                    'Vencida': 'bg-red-200 text-red-800'
                                }[invoice.status];
                                return (
                                <tr key={invoice.id} className="border-b hover:bg-gray-50">
                                    <td className="p-3 font-medium text-blue-600 cursor-pointer" onClick={() => handlePreviewInvoice(invoice)}>{invoice.invoiceNumber}</td>
                                    <td className="p-3">{client?.name || 'N/A'}</td>
                                    <td className="p-3">{formatDate(invoice.issueDate)}</td>
                                    <td className="p-3">{formatCurrency(total)}</td>
                                    <td className="p-3"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusColor}`}>{invoice.status}</span></td>
                                    <td className="p-3 flex space-x-2">
                                        <button onClick={() => handleEditInvoice(invoice)} className="text-blue-600 hover:text-blue-800">{ICONS.edit}</button>
                                        <button onClick={() => handleDeleteInvoice(invoice.id)} className="text-red-600 hover:text-red-800">{ICONS.trash}</button>
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>
        );
    };
    
    const InvoiceForm = ({ invoice, onSave, onCancel, clients, services }: { invoice: Invoice | null, onSave: (invoice: Invoice) => void, onCancel: () => void, clients: Client[], services: Service[] }) => {
        const [formData, setFormData] = useState<Omit<Invoice, 'id' | 'invoiceNumber'>>(
            invoice || {
                clientId: '',
                issueDate: new Date().toISOString().split('T')[0],
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                items: [{ id: generateId(), description: '', quantity: 1, unitPrice: 0, isMaintenance: false, isNewEquipment: false }],
                status: 'Borrador',
                notes: '',
            }
        );
        const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);

        const handleClientChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
            setFormData({...formData, clientId: e.target.value});
        };

        const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
            const { name, value } = e.target;
            setFormData({ ...formData, [name]: value });
        };

        const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
            const newItems = [...formData.items];
            if (field === 'isMaintenance' || field === 'isNewEquipment') {
                (newItems[index] as any)[field] = (value as HTMLInputElement).checked;
            } else {
                 (newItems[index] as any)[field] = value;
            }
            setFormData({ ...formData, items: newItems });
        };

        const handleAddItem = () => {
            setFormData({ ...formData, items: [...formData.items, { id: generateId(), description: '', quantity: 1, unitPrice: 0, isMaintenance: false, isNewEquipment: false }] });
        };

        const handleAddService = (service: Service) => {
            const newItem: InvoiceItem = {
                id: generateId(),
                description: service.name,
                quantity: 1,
                unitPrice: service.totalPrice,
                isMaintenance: service.name.toLowerCase().includes('mantenimiento'),
                isNewEquipment: false,
            };
            setFormData({ ...formData, items: [...formData.items, newItem]});
            setIsServiceModalOpen(false);
        };

        const handleRemoveItem = (index: number) => {
            const newItems = formData.items.filter((_, i) => i !== index);
            setFormData({ ...formData, items: newItems });
        };
        
        const handleSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            const client = clients.find(c => c.id === formData.clientId);
            if(!client) {
                alert('Por favor, seleccione un cliente.');
                return;
            }
            
            let finalData = { ...formData };
            let notes = finalData.notes || '';

            const hasMaintenance = finalData.items.some(item => item.isMaintenance);
            if(hasMaintenance) {
                const issue = new Date(finalData.issueDate);
                issue.setMonth(issue.getMonth() + 6);
                finalData.nextMaintenanceDate = issue.toISOString().split('T')[0];
            } else {
                finalData.nextMaintenanceDate = undefined;
            }
            
            const hasNewEquipment = finalData.items.some(item => item.isNewEquipment);
            const warrantyText = "Garantía de un año. La garantía solo cubre daños por naturaleza del equipo, no provocados por cortocircuitos.";
            if (hasNewEquipment && !notes.includes(warrantyText)) {
                notes = notes ? `${notes}\n\n${warrantyText}` : warrantyText;
            }

            if (hasNewEquipment) {
                const maintenanceMonths = client.type === 'Comercial' ? 3 : 6;
                const maintenanceText = `Recomendación: Realizar el primer mantenimiento preventivo en ${maintenanceMonths} meses para asegurar el óptimo funcionamiento y la validez de la garantía.`;
                if (!notes.includes(maintenanceText)) {
                    notes = notes ? `${notes}\n\n${maintenanceText}` : maintenanceText;
                }
            }

            finalData.notes = notes;
            onSave({ ...finalData, id: invoice?.id || '', invoiceNumber: invoice?.invoiceNumber || ''});
        };
        
        const subtotal = useMemo(() => formData.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0), [formData.items]);

        return (
            <Card>
                <form onSubmit={handleSubmit}>
                    <h2 className="text-2xl font-bold text-gray-800 mb-6">{invoice ? 'Editar Factura' : 'Nueva Factura'} {invoice?.invoiceNumber}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                            <Select name="clientId" value={formData.clientId} onChange={handleClientChange} required>
                                <option value="" disabled>Seleccione un cliente</option>
                                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </Select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Emisión</label>
                            <Input type="date" name="issueDate" value={formData.issueDate} onChange={handleInputChange} required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Vencimiento</label>
                            <Input type="date" name="dueDate" value={formData.dueDate} onChange={handleInputChange} required />
                        </div>
                    </div>

                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Artículos de la factura</h3>
                    <div className="space-y-2 mb-4">
                        {formData.items.map((item, index) => (
                            <div key={item.id} className="grid grid-cols-12 gap-2 items-center p-2 border rounded-md bg-gray-50">
                                <div className="col-span-12 md:col-span-5">
                                    <Input placeholder="Descripción" value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} required />
                                </div>
                                <div className="col-span-6 md:col-span-1">
                                    <Input type="number" placeholder="Cant." value={item.quantity} onChange={e => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)} required />
                                </div>
                                <div className="col-span-6 md:col-span-2">
                                    <Input type="number" step="0.01" placeholder="Precio" value={item.unitPrice} onChange={e => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)} required />
                                </div>
                                <div className="col-span-12 md:col-span-2 text-right font-medium">
                                    {formatCurrency(item.quantity * item.unitPrice)}
                                </div>
                                <div className="col-span-12 md:col-span-2 flex justify-end">
                                    <button type="button" onClick={() => handleRemoveItem(index)} className="text-red-500 hover:text-red-700 p-2">{ICONS.trash}</button>
                                </div>
                                <div className="col-span-12 flex items-center gap-4 mt-2">
                                    <label htmlFor={`maint-${item.id}`} className="flex items-center text-sm cursor-pointer">
                                        <input type="checkbox" id={`maint-${item.id}`} checked={!!item.isMaintenance} onChange={e => handleItemChange(index, 'isMaintenance', e.target)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"/>
                                        Mantenimiento
                                    </label>
                                    <label htmlFor={`neweq-${item.id}`} className="flex items-center text-sm cursor-pointer">
                                        <input type="checkbox" id={`neweq-${item.id}`} checked={!!item.isNewEquipment} onChange={e => handleItemChange(index, 'isNewEquipment', e.target)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"/>
                                        Nuevo Equipo (Garantía)
                                    </label>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex space-x-2">
                        <Button type="button" onClick={handleAddItem}>{ICONS.plus} Añadir Artículo</Button>
                        <Button type="button" onClick={() => setIsServiceModalOpen(true)} className="bg-green-600 hover:bg-green-700">{ICONS.plus} Añadir Servicio</Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Notas Adicionales</label>
                            <Textarea name="notes" value={formData.notes || ''} onChange={handleInputChange} rows={4} />
                        </div>
                        <div className="flex flex-col justify-end items-end">
                             <div className="w-full max-w-xs space-y-2">
                                <div className="flex justify-between">
                                    <span className="font-semibold text-gray-700">Subtotal:</span>
                                    <span>{formatCurrency(subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-xl font-bold">
                                    <span style={{color: settings.invoiceSettings.accentColor}}>Total:</span>
                                    <span style={{color: settings.invoiceSettings.accentColor}}>{formatCurrency(subtotal)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end space-x-4 pt-8">
                        <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancelar</button>
                        <Button type="submit">Guardar Factura</Button>
                    </div>
                </form>
                <Modal isOpen={isServiceModalOpen} onClose={() => setIsServiceModalOpen(false)} title="Seleccionar Servicio">
                    <div className="space-y-2">
                        {services.map(service => (
                            <div key={service.id} onClick={() => handleAddService(service)} className="p-3 border rounded-lg hover:bg-gray-100 cursor-pointer flex justify-between">
                                <div>
                                    <p className="font-semibold">{service.name}</p>
                                    <p className="text-sm text-gray-500">{service.description}</p>
                                </div>
                                <p className="font-semibold">{formatCurrency(service.totalPrice)}</p>
                            </div>
                        ))}
                    </div>
                </Modal>
            </Card>
        );
    };

    const ReportsPage = () => {
        // Placeholder for future implementation
        return <Card><h2 className="text-2xl font-bold text-gray-800">Reportes</h2><p>Esta sección está en desarrollo.</p></Card>;
    };
    
    const InvoicePreview = ({ invoice, client, settings, onBack, isPreview=false }: { invoice: Invoice, client: Client, settings: AppSettings, onBack?: () => void, isPreview?: boolean }) => {
        const total = invoice.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
        return (
            <Card>
                {!isPreview && (
                    <div className="flex justify-between items-center mb-6 print:hidden">
                        <button onClick={onBack} className="text-blue-600 hover:underline">
                            &larr; Volver a la lista
                        </button>
                        <Button onClick={() => generatePdf('invoice-preview', `Factura-${invoice.invoiceNumber}`)}>
                            {ICONS.print} Imprimir / Guardar PDF
                        </Button>
                    </div>
                )}
                <div id="invoice-preview" className="bg-white p-8 md:p-12 text-gray-800 text-[10pt] leading-normal font-sans">
                    <style>{`
                        .invoice-table th, .invoice-table td { padding: 8px; }
                        body.pdf-export-active #invoice-preview { border: none !important; }
                    `}</style>
                    <header className="flex justify-between items-start pb-8 border-b-2" style={{ borderColor: settings.invoiceSettings.accentColor }}>
                        <div className="w-2/3">
                            {settings.businessInfo.logo && <img src={settings.businessInfo.logo} alt="Logo" className="max-w-[150px] max-h-[80px] mb-4 object-contain" />}
                            <h1 className="text-xl font-bold text-gray-900">{settings.businessInfo.name}</h1>
                            <p>{settings.businessInfo.address}</p>
                            <p>{settings.businessInfo.phone}</p>
                            <p>{settings.businessInfo.email}</p>
                            <p>RNC: {settings.businessInfo.taxId}</p>
                        </div>
                        <div className="w-1/3 text-right">
                            <h2 className="text-3xl font-bold" style={{ color: settings.invoiceSettings.accentColor }}>FACTURA</h2>
                            <p className="font-semibold">{invoice.invoiceNumber}</p>
                            <p><strong>Fecha Emisión:</strong> {formatDate(invoice.issueDate)}</p>
                            <p><strong>Fecha Vencimiento:</strong> {formatDate(invoice.dueDate)}</p>
                        </div>
                    </header>
                    <section className="py-8">
                        <h3 className="font-semibold mb-2">Facturar a:</h3>
                        <p className="font-bold text-gray-900">{client.name}</p>
                        <p>{client.address}</p>
                        <p>{client.phone}</p>
                        <p>{client.email}</p>
                    </section>
                    <section>
                        <table className="w-full invoice-table text-left mb-8">
                            <thead>
                                <tr className="text-white" style={{ backgroundColor: settings.invoiceSettings.accentColor }}>
                                    <th className="font-semibold rounded-tl-lg">Descripción</th>
                                    <th className="font-semibold text-center">Cantidad</th>
                                    <th className="font-semibold text-right">Precio Unitario</th>
                                    <th className="font-semibold text-right rounded-tr-lg">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoice.items.map((item) => (
                                    <tr key={item.id} className="border-b">
                                        <td>{item.description}</td>
                                        <td className="text-center">{item.quantity}</td>
                                        <td className="text-right">{formatCurrency(item.unitPrice)}</td>
                                        <td className="text-right">{formatCurrency(item.quantity * item.unitPrice)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>
                    <section className="flex justify-end mb-8">
                        <div className="w-full max-w-xs space-y-2">
                            <div className="flex justify-between">
                                <span className="font-semibold">Subtotal:</span>
                                <span>{formatCurrency(total)}</span>
                            </div>
                            <div className="flex justify-between text-xl font-bold border-t-2 pt-2" style={{ borderColor: settings.invoiceSettings.accentColor }}>
                                <span style={{ color: settings.invoiceSettings.accentColor }}>Total:</span>
                                <span style={{ color: settings.invoiceSettings.accentColor }}>{formatCurrency(total)}</span>
                            </div>
                        </div>
                    </section>
                    <footer className="pt-8 border-t">
                        {invoice.notes && (
                             <div className="mb-8">
                                <h4 className="font-semibold mb-2">Notas:</h4>
                                <p className="whitespace-pre-wrap text-xs">{invoice.notes}</p>
                            </div>
                        )}
                        <div className="flex justify-between items-end">
                            <div>
                                <h4 className="font-semibold mb-2">¡Gracias por su negocio!</h4>
                                <p className="text-xs">Por favor, pague su factura antes de la fecha de vencimiento.</p>
                            </div>
                             {settings.businessInfo.signature && (
                                <div className="text-center">
                                    <img src={settings.businessInfo.signature} alt="Firma" className="max-w-[150px] h-auto mx-auto" />
                                    <p className="border-t pt-1 mt-1 text-xs">Firma Autorizada</p>
                                </div>
                             )}
                        </div>
                    </footer>
                </div>
            </Card>
        );
    };

    const SettingsPage = () => {
        const [currentSettings, setCurrentSettings] = useState(settings);

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const { name, value, dataset } = e.target;
            const category = dataset.category as keyof AppSettings;
            if (category) {
                setCurrentSettings(prev => ({
                    ...prev,
                    [category]: {
                        ...(prev[category] as any),
                        [name]: value
                    }
                }));
            }
        };

        const handleFileChange = (file: File | null, category: keyof AppSettings, name: string) => {
            if (file) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setCurrentSettings(prev => ({
                        ...prev,
                        [category]: {
                            ...(prev[category] as any),
                            [name]: reader.result as string
                        }
                    }));
                };
                reader.readAsDataURL(file);
            } else {
                 setCurrentSettings(prev => ({
                    ...prev,
                    [category]: {
                        ...(prev[category] as any),
                        [name]: null
                    }
                }));
            }
        };


        const handleSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            setSettings(currentSettings);
            alert('Configuración guardada!');
        };
        
        return (
            <Card>
                <form onSubmit={handleSubmit} className="space-y-8">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">Información del Negocio</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Input name="name" data-category="businessInfo" placeholder="Nombre del Negocio" value={currentSettings.businessInfo.name} onChange={handleChange} />
                            <Input name="taxId" data-category="businessInfo" placeholder="RNC / ID Fiscal" value={currentSettings.businessInfo.taxId} onChange={handleChange} />
                            <Input name="address" data-category="businessInfo" placeholder="Dirección" value={currentSettings.businessInfo.address} onChange={handleChange} />
                            <Input name="phone" data-category="businessInfo" placeholder="Teléfono" value={currentSettings.businessInfo.phone} onChange={handleChange} />
                            <Input name="email" type="email" data-category="businessInfo" placeholder="Email" value={currentSettings.businessInfo.email} onChange={handleChange} />
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Logo</label>
                                <Input type="file" accept="image/*" onChange={e => handleFileChange(e.target.files?.[0] || null, 'businessInfo', 'logo')} />
                                {currentSettings.businessInfo.logo && <img src={currentSettings.businessInfo.logo} alt="Logo Preview" className="mt-2 max-h-20 border p-1 rounded" />}
                             </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Firma Digital (Imagen)</label>
                                <Input type="file" accept="image/*" onChange={e => handleFileChange(e.target.files?.[0] || null, 'businessInfo', 'signature')} />
                                {currentSettings.businessInfo.signature && <img src={currentSettings.businessInfo.signature} alt="Signature Preview" className="mt-2 max-h-20 border p-1 rounded bg-gray-50" />}
                             </div>
                        </div>
                    </div>
                    
                     <div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">Personalización de Facturas</h2>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Color de Acento</label>
                                <Input type="color" name="accentColor" data-category="invoiceSettings" value={currentSettings.invoiceSettings.accentColor} onChange={handleChange} className="p-1 h-10 w-full block" />
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex justify-end pt-4">
                        <Button type="submit">Guardar Configuración</Button>
                    </div>
                </form>
            </Card>
        );
    };
    
    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: ICONS.dashboard },
        { id: 'clients', label: 'Clientes', icon: ICONS.clients },
        { id: 'invoices', label: 'Facturas', icon: ICONS.invoices },
        { id: 'inventory', label: 'Inventario', icon: ICONS.inventory },
        { id: 'expenses', label: 'Gastos', icon: ICONS.money },
        { id: 'reports', label: 'Reportes', icon: ICONS.reports },
        { id: 'settings', label: 'Configuración', icon: ICONS.settings },
    ];
    
    const NavLink: React.FC<{item: typeof navItems[0]}> = ({ item }) => (
        <a
            href="#"
            onClick={(e) => {
                e.preventDefault();
                setCurrentPage(item.id);
            }}
            className={`flex items-center px-4 py-3 text-gray-200 hover:bg-gray-700 rounded-lg transition-colors duration-200 ${currentPage === item.id ? 'bg-gray-900' : ''}`}
        >
            <span className="mr-3">{item.icon}</span>
            <span>{item.label}</span>
        </a>
    );

    return (
        <div className="flex h-screen bg-gray-100 font-sans">
            <aside className="w-64 bg-gray-800 text-white flex flex-col p-4">
                <div className="text-2xl font-bold mb-8 flex items-center px-2">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mr-2 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                     <span>HVAC Pro</span>
                </div>
                <nav className="flex-1 space-y-2">
                    {navItems.map(item => <NavLink key={item.id} item={item} />)}
                </nav>
            </aside>
            <main className="flex-1 p-4 md:p-8 overflow-y-auto">
                <PageComponent />
            </main>
        </div>
    );
}
