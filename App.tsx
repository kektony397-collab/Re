import React, { useState, useEffect, useContext, createContext, useRef, useCallback } from 'react';
import { HashRouter, Routes, Route, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import type { Receipt, Settings, Expense } from './types';
import { saveAuthCredentials, getAuthCredentials, getAllReceipts, addReceipt, getSettings, saveSettings, getAllExpenses, addExpense } from './db';
import { translations } from './constants';
import { generateReceiptPdf, exportReceiptsToPdf, exportReceiptsToExcel, formatDate, exportExpensesToPdf } from './utils';
import { FiMenu, FiX, FiGrid, FiFileText, FiPlusSquare, FiTrendingUp, FiSettings, FiLogOut, FiSun, FiMoon, FiSearch, FiChevronDown, FiUpload, FiEdit2, FiSave, FiTrash2, FiPrinter, FiPlus } from 'react-icons/fi';
import SignatureCanvas from 'react-signature-canvas';
import { useForm, SubmitHandler } from 'react-hook-form';

// --- CONTEXTS & HOOKS ---
type Language = 'en' | 'gu';
const LanguageContext = createContext<{ language: Language; setLanguage: (lang: Language) => void; t: (key: string) => string; }>({ language: 'en', setLanguage: () => {}, t: (key: string) => key });
const useLanguage = () => useContext(LanguageContext);

type Theme = 'default' | 'ocean' | 'forest' | 'sunset';
const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void; }>({ theme: 'default', setTheme: () => {} });
const useTheme = () => useContext(ThemeContext);

const AuthContext = createContext<{ isAuthenticated: boolean; login: (user: string, pass: string) => Promise<boolean>; logout: () => void; }>({ isAuthenticated: false, login: async () => false, logout: () => {} });
const useAuth = () => useContext(AuthContext);

const SettingsContext = createContext<{ settings: Settings | null, loadSettings: () => Promise<void> }>({ settings: null, loadSettings: async () => {} });
const useSettings = () => useContext(SettingsContext);

// --- HASHING UTILITY ---
async function sha256(message: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}


// --- PROVIDERS ---
const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setThemeState] = useState<Theme>('default');

    useEffect(() => {
        const savedTheme = localStorage.getItem('app-theme') as Theme | null;
        if (savedTheme) {
            setThemeState(savedTheme);
        }
    }, []);

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
        localStorage.setItem('app-theme', newTheme);
    };

    useEffect(() => {
        const newClassName = theme === 'default' ? '' : `theme-${theme}`;
        document.documentElement.className = newClassName;
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('gu');
  const t = useCallback((key: string): string => {
    return translations[language][key as keyof typeof translations.en] || key;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    
    useEffect(() => {
        const checkAuth = async () => {
            const storedAuth = sessionStorage.getItem('isAuthenticated');
            if (storedAuth === 'true') {
                setIsAuthenticated(true);
            }
            const credentials = await getAuthCredentials('admin');
            if (!credentials) {
                const defaultPasswordHash = await sha256('google');
                await saveAuthCredentials('admin', defaultPasswordHash); 
            }
        };
        checkAuth();
    }, []);

    const login = async (user: string, pass: string): Promise<boolean> => {
        if (user === 'admin') {
            const credentials = await getAuthCredentials('admin');
            if(credentials) {
                const passHash = await sha256(pass);
                if (passHash === credentials.passwordHash) {
                    setIsAuthenticated(true);
                    sessionStorage.setItem('isAuthenticated', 'true');
                    return true;
                }
            }
        }
        return false;
    };

    const logout = () => {
        setIsAuthenticated(false);
        sessionStorage.removeItem('isAuthenticated');
    };

    return <AuthContext.Provider value={{ isAuthenticated, login, logout }}>{children}</AuthContext.Provider>;
};

const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<Settings | null>(null);

    const loadSettings = async () => {
        let currentSettings = await getSettings();
        if (!currentSettings) {
            const defaultSettings = {
                adminName: "Admin",
                blockNumber: "Society Office",
                signatureType: 'typed' as 'typed',
                typedSignature: "For Neelkanth Society",
                drawnSignature: "",
                uploadedSignature: ""
            };
            await saveSettings(defaultSettings);
            currentSettings = { ...defaultSettings, id: 1 };
        }
        setSettings(currentSettings);
    };

    useEffect(() => {
        loadSettings();
    }, []);

    return (
        <SettingsContext.Provider value={{ settings, loadSettings }}>
            {children}
        </SettingsContext.Provider>
    );
};


// --- LAYOUT COMPONENTS ---
const Sidebar: React.FC<{ isOpen: boolean, setIsOpen: (isOpen: boolean) => void }> = ({ isOpen, setIsOpen }) => {
    const { t } = useLanguage();
    const { logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const navLinks = [
        { path: '/', icon: FiGrid, label: t('dashboard') },
        { path: '/receipts', icon: FiFileText, label: t('receipts') },
        { path: '/new-receipt', icon: FiPlusSquare, label: t('newReceipt') },
        { path: '/expenses', icon: FiTrendingUp, label: t('expenses') },
        { path: '/settings', icon: FiSettings, label: t('settings') },
    ];
    
    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <>
            <div className={`fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsOpen(false)}></div>
            <aside className={`fixed top-0 left-0 h-full bg-slate-800 text-white w-64 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out md:translate-x-0 md:relative md:flex-shrink-0 z-40`}>
                <div className={`p-4 flex justify-between items-center border-b border-slate-700 ${t('language') === 'gu' ? 'font-gujarati' : ''}`}>
                    <h1 className="text-xl font-bold text-primary">Neelkanth</h1>
                    <button onClick={() => setIsOpen(false)} className="md:hidden text-2xl"><FiX /></button>
                </div>
                <nav className="mt-4">
                    <ul>
                        {navLinks.map(link => (
                            <li key={link.path}>
                                <Link to={link.path} onClick={() => setIsOpen(false)} className={`flex items-center py-3 px-4 my-1 transition-colors duration-200 hover:bg-slate-700 ${location.pathname === link.path ? 'bg-primary-dark text-white' : ''} ${t('language') === 'gu' ? 'font-gujarati' : ''}`}>
                                    <link.icon className="mr-3"/>
                                    <span>{link.label}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>
                <div className="absolute bottom-0 w-full p-4 border-t border-slate-700">
                    <button onClick={handleLogout} className={`flex items-center w-full py-2 px-4 rounded transition-colors duration-200 hover:bg-red-500 ${t('language') === 'gu' ? 'font-gujarati' : ''}`}>
                        <FiLogOut className="mr-3" />
                        <span>{t('logout')}</span>
                    </button>
                </div>
            </aside>
        </>
    );
};

const Header: React.FC<{ onMenuClick: () => void }> = ({ onMenuClick }) => {
    const { language, setLanguage, t } = useLanguage();
    const { theme, setTheme } = useTheme();

    return (
        <header className="bg-white dark:bg-slate-800 shadow-md p-4 flex justify-between items-center">
            <button onClick={onMenuClick} className="text-slate-600 dark:text-slate-300 text-2xl md:hidden">
                <FiMenu />
            </button>
            <div className="text-lg font-semibold text-slate-800 dark:text-white md:ml-0 ml-4">
                {/* Could display page title here */}
            </div>
            <div className="flex items-center space-x-4">
                 <div className="relative">
                    <select
                      value={theme}
                      onChange={(e) => setTheme(e.target.value as Theme)}
                      className="bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white rounded-md py-1 pl-3 pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="default">Default</option>
                      <option value="ocean">Ocean</option>
                      <option value="forest">Forest</option>
                      <option value="sunset">Sunset</option>
                    </select>
                    <FiChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 dark:text-slate-400" />
                  </div>
                 <div className="relative">
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value as Language)}
                      className="bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white rounded-md py-1 pl-3 pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="en">English</option>
                      <option value="gu">ગુજરાતી</option>
                    </select>
                    <FiChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 dark:text-slate-400" />
                  </div>
            </div>
        </header>
    );
};

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const { t } = useLanguage();

    return (
        <div className={`flex h-screen bg-slate-100 dark:bg-slate-900 ${t('language') === 'gu' ? 'font-gujarati' : ''}`}>
            <Sidebar isOpen={isSidebarOpen} setIsOpen={setSidebarOpen} />
            <div className="flex-1 flex flex-col overflow-hidden">
                <Header onMenuClick={() => setSidebarOpen(true)} />
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-100 dark:bg-slate-900 p-6">
                    {children}
                </main>
                <footer className="text-center p-2 text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800">
                    {t('createdBy')}
                </footer>
            </div>
        </div>
    );
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAuthenticated } = useAuth();
    const location = useLocation();

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <>{children}</>;
};

// --- UI COMPONENTS ---
const Card: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className }) => {
    return <div className={`bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 ${className}`}>{children}</div>;
};

// --- PAGES ---

const LoginPage: React.FC = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [username, setUsername] = useState('admin');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { t } = useLanguage();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const success = await login(username, password);
        if (success) {
            navigate('/');
        } else {
            setError('Invalid credentials');
        }
    };
    
    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-200 dark:bg-slate-900">
            <Card className="w-full max-w-sm">
                <h2 className={`text-2xl font-bold text-center text-slate-700 dark:text-white mb-6 ${t('language') === 'gu' ? 'font-gujarati' : ''}`}>{t('login')}</h2>
                <form onSubmit={handleLogin}>
                    <div className="mb-4">
                        <label className="block text-slate-600 dark:text-slate-300 mb-2">{t('username')}</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            readOnly
                            className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary cursor-not-allowed"
                        />
                    </div>
                    <div className="mb-6">
                        <label className="block text-slate-600 dark:text-slate-300 mb-2">{t('password')}</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-white border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                    {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}
                    <button type="submit" className="w-full bg-primary-dark text-white py-2 rounded-md hover:bg-primary transition-colors">
                        {t('login')}
                    </button>
                </form>
            </Card>
        </div>
    );
};

const DashboardPage: React.FC = () => {
    const { t } = useLanguage();
    const [receipts, setReceipts] = useState<Receipt[]>([]);
    
    useEffect(() => {
        const fetchReceipts = async () => {
            const data = await getAllReceipts();
            setReceipts(data);
        };
        fetchReceipts();
    }, []);

    const totalAmount = receipts.reduce((sum, receipt) => sum + receipt.amount, 0);

    return (
        <div>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-6">{t('dashboard')}</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-300">{t('totalReceipts')}</h3>
                    <p className="text-4xl font-bold text-primary mt-2">{receipts.length}</p>
                </Card>
                <Card>
                    <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-300">{t('totalAmount')}</h3>
                    <p className="text-4xl font-bold text-green-500 mt-2">₹{totalAmount.toLocaleString('en-IN')}</p>
                </Card>
            </div>
        </div>
    );
};

const ReceiptsListPage: React.FC = () => {
    const { t } = useLanguage();
    const [receipts, setReceipts] = useState<Receipt[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
    const { settings } = useSettings();

    useEffect(() => {
        loadReceipts();
    }, []);

    const loadReceipts = async () => {
        const data = await getAllReceipts();
        setReceipts(data.sort((a, b) => b.id - a.id));
    };

    const filteredReceipts = receipts.filter(r => 
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.receiptNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.blockNumber.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const totalAmount = filteredReceipts.reduce((sum, r) => sum + r.amount, 0);

    return (
        <>
        <Card>
            <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('receipts')}</h2>
                <div className="relative w-full md:w-auto">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder={t('search')}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full md:w-64 pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>
            </div>
            <div className="flex justify-end gap-2 mb-4">
                 <button onClick={() => exportReceiptsToPdf(filteredReceipts, t)} className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition flex items-center gap-2 text-sm"><FiPrinter/>{t('downloadPdf')}</button>
                 <button onClick={() => exportReceiptsToExcel(filteredReceipts, t)} className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition flex items-center gap-2 text-sm"><FiFileText/>{t('downloadExcel')}</button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        <tr>
                            <th className="p-3">{t('receiptNo')}</th>
                            <th className="p-3">{t('residentName')}</th>
                            <th className="p-3">{t('blockNo')}</th>
                            <th className="p-3">{t('date')}</th>
                            <th className="p-3 text-right">{t('amount')}</th>
                            <th className="p-3 text-center">{t('actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredReceipts.map(receipt => (
                            <tr key={receipt.id} className="border-b dark:border-slate-700">
                                <td className="p-3 text-slate-800 dark:text-white">{receipt.receiptNumber}</td>
                                <td className="p-3 text-slate-800 dark:text-white">{receipt.name}</td>
                                <td className="p-3 text-slate-500 dark:text-slate-400">{receipt.blockNumber}</td>
                                <td className="p-3 text-slate-500 dark:text-slate-400">{receipt.date}</td>
                                <td className="p-3 text-right text-green-600 font-semibold dark:text-green-400">₹{receipt.amount.toFixed(2)}</td>
                                <td className="p-3 text-center">
                                    <button onClick={() => setSelectedReceipt(receipt)} className="text-primary hover:text-primary-dark">{t('view')}</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="font-bold bg-slate-100 dark:bg-slate-700">
                            <td colSpan={4} className="p-3 text-right text-slate-800 dark:text-white">{t('totalAmount')}</td>
                            <td className="p-3 text-right text-slate-800 dark:text-white">₹{totalAmount.toFixed(2)}</td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            {selectedReceipt && <ReceiptModal receipt={selectedReceipt} settings={settings} onClose={() => setSelectedReceipt(null)} />}
        </Card>
         <Link to="/new-receipt" title={t('newReceipt')} className="md:hidden fixed bottom-6 right-6 bg-primary-dark text-white p-4 rounded-full shadow-lg hover:bg-primary transition-transform duration-200 ease-in-out hover:scale-110 flex items-center justify-center">
           <FiPlus size={24} />
        </Link>
        </>
    );
};

type ReceiptFormData = Omit<Receipt, 'id' | 'receiptNumber'>;

const NewReceiptPage: React.FC = () => {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const { register, handleSubmit, formState: { errors }, watch } = useForm<ReceiptFormData>({
        defaultValues: {
            date: formatDate(new Date()),
            paymentMethod: 'Cash',
        }
    });
    const [receiptCount, setReceiptCount] = useState(0);

    useEffect(() => {
        const fetchLastReceipt = async () => {
            const receipts = await getAllReceipts();
            setReceiptCount(receipts.length);
        };
        fetchLastReceipt();
    }, []);

    const receiptNumber = `NSM-${String(receiptCount + 1).padStart(4, '0')}`;
    
    const onSubmit: SubmitHandler<ReceiptFormData> = async (data) => {
        const newReceipt: Omit<Receipt, 'id'> = {
            ...data,
            receiptNumber,
            amount: Number(data.amount)
        };
        await addReceipt(newReceipt);
        navigate('/receipts');
    };

    return (
        <Card>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">{t('createReceipt')}</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                    <label className="block text-slate-600 dark:text-slate-300 mb-2">{t('receiptNo')}</label>
                    <input type="text" value={receiptNumber} readOnly className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white border border-slate-300 dark:border-slate-600 rounded-md"/>
                </div>
                <div>
                    <label className="block text-slate-600 dark:text-slate-300 mb-2">{t('residentName')}</label>
                    <input {...register('name', { required: true })} className="w-full px-3 py-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-white border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" />
                    {errors.name && <p className="text-red-500 text-sm mt-1">Name is required</p>}
                </div>
                <div>
                    <label className="block text-slate-600 dark:text-slate-300 mb-2">{t('blockNo')}</label>
                    <input {...register('blockNumber', { required: true })} className="w-full px-3 py-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-white border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" />
                    {errors.blockNumber && <p className="text-red-500 text-sm mt-1">Block number is required</p>}
                </div>
                <div>
                    <label className="block text-slate-600 dark:text-slate-300 mb-2">{t('date')}</label>
                    <input type="date" {...register('date', { required: true })} className="w-full px-3 py-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-white border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                    <label className="block text-slate-600 dark:text-slate-300 mb-2">{t('amount')}</label>
                    <input type="number" {...register('amount', { required: true, min: 1 })} className="w-full px-3 py-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-white border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" />
                    {errors.amount && <p className="text-red-500 text-sm mt-1">A valid amount is required</p>}
                </div>
                <div>
                    <label className="block text-slate-600 dark:text-slate-300 mb-2">{t('forMonth')}</label>
                    <input type="month" {...register('forMonth', { required: true })} className="w-full px-3 py-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-white border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                    <label className="block text-slate-600 dark:text-slate-300 mb-2">{t('paymentMethod')}</label>
                    <select {...register('paymentMethod')} className="w-full px-3 py-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-white border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary">
                        <option>Cash</option>
                        <option>Cheque</option>
                        <option>Online</option>
                    </select>
                </div>
                <div className="md:col-span-2 flex justify-end gap-4">
                    <button type="button" onClick={() => navigate('/receipts')} className="px-6 py-2 bg-slate-200 dark:bg-slate-600 rounded-md hover:bg-slate-300 dark:hover:bg-slate-500 transition">{t('cancel')}</button>
                    <button type="submit" className="px-6 py-2 bg-primary-dark text-white rounded-md hover:bg-primary transition">{t('save')}</button>
                </div>
            </form>
        </Card>
    );
};

const ExpensesPage: React.FC = () => {
    const { t } = useLanguage();
    const { register, handleSubmit, reset, formState: { errors } } = useForm<Omit<Expense, 'id'>>();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [mode, setMode] = useState<'add' | 'subtract'>('add');

    useEffect(() => {
        loadExpenses();
    }, []);

    const loadExpenses = async () => {
        const data = await getAllExpenses();
        setExpenses(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    };

    const onSubmit: SubmitHandler<Omit<Expense, 'id'>> = async (data) => {
        const amount = mode === 'add' ? Number(data.amount) : -Number(data.amount);
        await addExpense({ ...data, amount });
        reset({description: '', amount: 0, date: ''});
        loadExpenses();
    };
    
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
                <Card>
                    <h2 className="text-xl font-bold mb-4">{mode === 'add' ? 'Add Income' : 'Add Expense'}</h2>
                     <div className="flex bg-slate-200 dark:bg-slate-700 rounded-lg p-1 mb-4">
                        <button onClick={() => setMode('add')} className={`w-1/2 py-2 rounded-md transition ${mode === 'add' ? 'bg-green-500 text-white' : 'text-slate-600 dark:text-slate-300'}`}>Income (+)</button>
                        <button onClick={() => setMode('subtract')} className={`w-1/2 py-2 rounded-md transition ${mode === 'subtract' ? 'bg-red-500 text-white' : 'text-slate-600 dark:text-slate-300'}`}>Expense (-)</button>
                    </div>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div>
                            <label>Date</label>
                            <input type="date" {...register('date', {required: true})} className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-700 border rounded-md" />
                        </div>
                        <div>
                            <label>Description</label>
                            <input {...register('description', {required: true})} className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-700 border rounded-md" />
                        </div>
                        <div>
                            <label>Amount</label>
                            <input type="number" {...register('amount', {required: true, min: 0.01})} className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-700 border rounded-md" />
                        </div>
                        <button type="submit" className="w-full py-2 bg-primary-dark text-white rounded-md hover:bg-primary">{mode === 'add' ? 'Add Income' : 'Add Expense'}</button>
                    </form>
                </Card>
            </div>
            <div className="lg:col-span-2">
                <Card>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold">Transaction History</h2>
                        <button onClick={() => exportExpensesToPdf(expenses, t)} className="bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600 transition flex items-center gap-2 text-sm"><FiPrinter/> Export PDF</button>
                    </div>
                    <div className="overflow-auto max-h-[60vh]">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b dark:border-slate-700">
                                    <th className="p-2">Date</th>
                                    <th className="p-2">Description</th>
                                    <th className="p-2 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {expenses.map(e => (
                                    <tr key={e.id} className="border-b dark:border-slate-700">
                                        <td className="p-2">{e.date}</td>
                                        <td className="p-2">{e.description}</td>
                                        <td className={`p-2 text-right font-semibold ${e.amount >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            {e.amount >= 0 ? `+₹${e.amount.toFixed(2)}` : `-₹${Math.abs(e.amount).toFixed(2)}`}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-4 pt-4 border-t dark:border-slate-700 flex justify-between font-bold text-lg">
                        <span>Net Balance:</span>
                        <span className={`${totalExpenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>₹{totalExpenses.toFixed(2)}</span>
                    </div>
                </Card>
            </div>
        </div>
    );
};


const SettingsPage: React.FC = () => {
    const { t } = useLanguage();
    const { settings, loadSettings } = useSettings();
    const { register, handleSubmit, watch, setValue } = useForm<Settings>();
    const sigPad = useRef<SignatureCanvas | null>(null);

    useEffect(() => {
        if (settings) {
            setValue('adminName', settings.adminName);
            setValue('blockNumber', settings.blockNumber);
            setValue('signatureType', settings.signatureType);
            setValue('typedSignature', settings.typedSignature);
        }
    }, [settings, setValue]);

    const signatureType = watch('signatureType', settings?.signatureType);

    const onSubmit: SubmitHandler<Settings> = async (data) => {
        const drawnSignature = sigPad.current && !sigPad.current.isEmpty() ? sigPad.current.toDataURL('image/png') : settings?.drawnSignature || '';
        const settingsToSave = {
            ...data,
            drawnSignature,
            uploadedSignature: settings?.uploadedSignature || ''
        };
        await saveSettings(settingsToSave);
        await loadSettings();
        alert('Settings saved!');
    };
    
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const uploadedSignature = event.target?.result as string;
                if(settings) {
                   const settingsToSave = {...settings, uploadedSignature};
                   await saveSettings(settingsToSave);
                   await loadSettings();
                   alert('Signature uploaded!');
                }
            };
            reader.readAsDataURL(file);
        }
    };
    
    if (!settings) return <div>Loading...</div>;

    return (
        <div className="space-y-6">
            <form onSubmit={handleSubmit(onSubmit)}>
                <Card>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">{t('settings')}</h2>
                    <div className="space-y-8">
                        {/* Admin Profile */}
                        <div>
                            <h3 className="text-lg font-semibold border-b pb-2 mb-4">{t('adminProfile')}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('adminName')}</label>
                                    <input {...register('adminName')} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border rounded-md"/>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('blockNo')}</label>
                                    <input {...register('blockNumber')} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border rounded-md"/>
                                </div>
                            </div>
                        </div>

                        {/* Signature */}
                        <div>
                            <h3 className="text-lg font-semibold border-b pb-2 mb-4">{t('signature')}</h3>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('signatureType')}</label>
                                <select {...register('signatureType')} className="w-full md:w-1/3 px-3 py-2 bg-white dark:bg-slate-700 border rounded-md">
                                    <option value="typed">{t('typed')}</option>
                                    <option value="drawn">{t('drawn')}</option>
                                    <option value="uploaded">{t('upload')}</option>
                                </select>
                            </div>
                            <div className="mt-4">
                                {signatureType === 'typed' && (
                                    <input {...register('typedSignature')} placeholder="Enter name for signature" className="mt-1 block w-full md:w-1/3 px-3 py-2 bg-white dark:bg-slate-700 border rounded-md"/>
                                )}
                                {signatureType === 'drawn' && (
                                    <div className="border rounded-md">
                                        <SignatureCanvas ref={sigPad} canvasProps={{ className: 'w-full h-48' }} />
                                        <button type="button" onClick={() => sigPad.current?.clear()} className="text-sm p-2 bg-slate-200 dark:bg-slate-600 w-full">{t('clear')}</button>
                                    </div>
                                )}
                                {signatureType === 'uploaded' && (
                                    <div>
                                        <input type="file" accept="image/*" onChange={handleFileUpload} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary-dark hover:file:bg-primary/20"/>
                                        {settings.uploadedSignature && <img src={settings.uploadedSignature} alt="Signature" className="mt-4 border max-h-24"/>}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="mt-8 flex justify-end">
                        <button type="submit" className="px-6 py-2 bg-primary-dark text-white rounded-md hover:bg-primary">{t('save')}</button>
                    </div>
                </Card>
            </form>
            <ChangePasswordForm />
        </div>
    );
};

const ChangePasswordForm = () => {
    const { t } = useLanguage();
    const { register, handleSubmit, formState: { errors }, watch, reset } = useForm();
    const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

    const onSubmit = async (data: any) => {
        setMessage(null);
        const credentials = await getAuthCredentials('admin');
        if (credentials) {
            const currentPassHash = await sha256(data.currentPassword);
            if (currentPassHash !== credentials.passwordHash) {
                setMessage({ type: 'error', text: 'Current password is not correct.' });
                return;
            }

            const newPassHash = await sha256(data.newPassword);
            await saveAuthCredentials('admin', newPassHash);
            setMessage({ type: 'success', text: 'Password updated successfully!' });
            reset();
        }
    };

    return (
        <Card>
            <h3 className="text-lg font-semibold border-b pb-2 mb-4">{t('changePassword')}</h3>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('currentPassword')}</label>
                    <input type="password" {...register('currentPassword', { required: 'Current password is required' })} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border rounded-md"/>
                    {errors.currentPassword && <p className="text-red-500 text-sm mt-1">{errors.currentPassword.message as string}</p>}
                </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('newPassword')}</label>
                    <input type="password" {...register('newPassword', { required: 'New password is required', minLength: { value: 6, message: 'Password must be at least 6 characters' } })} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border rounded-md"/>
                    {errors.newPassword && <p className="text-red-500 text-sm mt-1">{errors.newPassword.message as string}</p>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('confirmNewPassword')}</label>
                    <input type="password" {...register('confirmNewPassword', { required: true, validate: value => value === watch('newPassword') || 'Passwords do not match' })} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border rounded-md"/>
                    {errors.confirmNewPassword && <p className="text-red-500 text-sm mt-1">{errors.confirmNewPassword.message as string}</p>}
                </div>
                {message && <p className={`${message.type === 'success' ? 'text-green-500' : 'text-red-500'} text-sm`}>{message.text}</p>}
                <div className="flex justify-end">
                    <button type="submit" className="px-6 py-2 bg-primary-dark text-white rounded-md hover:bg-primary">{t('updatePassword')}</button>
                </div>
            </form>
        </Card>
    );
};

const ReceiptModal: React.FC<{ receipt: Receipt, settings: Settings | null, onClose: () => void }> = ({ receipt, settings, onClose }) => {
    const { t } = useLanguage();
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center">
                    <h3 className="text-lg font-bold">{t('receipt')} #{receipt.receiptNumber}</h3>
                    <div className="flex gap-2">
                         <button onClick={() => generateReceiptPdf(receipt, settings, t)} className="bg-primary-dark text-white px-4 py-2 rounded-lg hover:bg-primary transition flex items-center gap-2 text-sm"><FiPrinter/>{t('downloadPdf')}</button>
                         <button onClick={onClose} className="text-2xl text-slate-500 hover:text-slate-800 dark:hover:text-white"><FiX /></button>
                    </div>
                </div>
                <div className="p-2 overflow-y-auto">
                    <ReceiptTemplate receipt={receipt} settings={settings} />
                </div>
            </div>
        </div>
    );
};

// This component is used for both display and PDF generation
const ReceiptTemplate: React.FC<{ receipt: Receipt, settings: Settings | null }> = ({ receipt, settings }) => {
    const { t } = useLanguage();
    
    let signatureContent;
    if (settings) {
        switch (settings.signatureType) {
            case 'drawn':
                signatureContent = <img src={settings.drawnSignature} alt="signature" className="h-12 mx-auto"/>;
                break;
            case 'uploaded':
                signatureContent = <img src={settings.uploadedSignature} alt="signature" className="h-12 mx-auto"/>;
                break;
            case 'typed':
            default:
                signatureContent = <p className="font-semibold text-lg" style={{fontFamily: "'Brush Script MT', cursive"}}>{settings.typedSignature}</p>;
        }
    }
    
    return (
        <div id="receipt-template" className="bg-white p-6 text-black w-[800px] mx-auto border-2 border-black">
             <div className="text-center pb-4">
                 <h1 className="text-4xl font-bold text-primary-dark font-gujarati">{t('name')}</h1>
                 <h2 className="text-xl font-gujarati">{t('subName')}</h2>
                 <p className="text-sm font-gujarati">{t('address')}</p>
                 <p className="text-sm font-semibold mt-1 font-gujarati">{t('regNo')}</p>
             </div>
             <div className="border-t-2 border-b-2 border-black border-dashed flex justify-between items-center my-4 py-2">
                 <p className="font-bold text-lg font-gujarati">રસીદ / RECEIPT</p>
                 <div className="text-right">
                    <p><span className="font-bold">No:</span> {receipt.receiptNumber}</p>
                    <p><span className="font-bold">Date:</span> {receipt.date}</p>
                 </div>
             </div>
             <div className="mt-6 text-lg space-y-3 font-gujarati">
                <div className="flex items-baseline">
                    <span className="w-48">Received from:</span>
                    <span className="font-bold border-b border-dotted border-black flex-1">{receipt.name}</span>
                </div>
                 <div className="flex items-baseline">
                    <span className="w-48">Block No:</span>
                    <span className="font-bold border-b border-dotted border-black flex-1">{receipt.blockNumber}</span>
                </div>
                <div className="flex items-baseline">
                    <span className="w-48">For the month of:</span>
                    <span className="font-bold border-b border-dotted border-black flex-1">{receipt.forMonth}</span>
                </div>
                <div className="flex items-baseline">
                    <span className="w-48">Payment Method:</span>
                    <span className="font-bold border-b border-dotted border-black flex-1">{receipt.paymentMethod}</span>
                </div>
             </div>

             <div className="mt-8 flex justify-between items-end">
                <div className="text-xs text-slate-500">
                     <p>{t('softcopyNotice')}</p>
                 </div>
                <div className="border-2 border-black px-4 py-2">
                    <p className="text-2xl font-bold text-center">₹{receipt.amount.toFixed(2)}</p>
                </div>
             </div>
             
             <div className="flex justify-between items-end mt-12 pt-8">
                 <div className="text-center">
                    <p className="border-t border-black pt-1 mt-1 font-bold">Receiver's Sign</p>
                 </div>
                 <div className="text-center">
                    {signatureContent}
                    <p className="border-t border-black pt-1 mt-1 font-bold">Authorised Signatory</p>
                 </div>
             </div>
        </div>
    );
};

// --- MAIN APP ---
const App: React.FC = () => {
  return (
    <AuthProvider>
        <SettingsProvider>
            <LanguageProvider>
              <ThemeProvider>
                <HashRouter>
                    <Routes>
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/*" element={
                            <ProtectedRoute>
                                <MainLayout>
                                    <Routes>
                                        <Route index element={<DashboardPage />} />
                                        <Route path="/receipts" element={<ReceiptsListPage />} />
                                        <Route path="/new-receipt" element={<NewReceiptPage />} />
                                        <Route path="/expenses" element={<ExpensesPage />} />
                                        <Route path="/settings" element={<SettingsPage />} />
                                    </Routes>
                                </MainLayout>
                            </ProtectedRoute>
                        } />
                    </Routes>
                </HashRouter>
              </ThemeProvider>
            </LanguageProvider>
        </SettingsProvider>
    </AuthProvider>
  );
};

export default App;