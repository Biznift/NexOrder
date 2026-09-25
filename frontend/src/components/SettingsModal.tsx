import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Key,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Copy,
  Check,
  Store,
  Upload,
  Image as ImageIcon,
  Bot,
  Truck,
  Shield,
  ExternalLink,
  Database,
  Download,
} from 'lucide-react';
import {
  SteadfastStatusInfo,
  BrandingConfig,
  OpenRouterStatusInfo,
  AllCouriersStatus,
  PathaoConfig,
  RedxConfig,
  CarrybeeConfig,
} from '../types/order';
import {
  saveSteadfastConfig,
  testSteadfastConnection,
  saveBranding,
  getOpenRouterConfig,
  saveOpenRouterConfig,
  testOpenRouterConnection,
  fetchCouriersStatus,
  savePathaoConfig,
  testPathaoConnection,
  saveRedxConfig,
  testRedxConnection,
  saveCarrybeeConfig,
  testCarrybeeConnection,
} from '../api';
import { downloadUserBackup, restoreUserBackup } from '@/saas/backup';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  statusInfo: SteadfastStatusInfo | null;
  onSteadfastUpdated: (status: SteadfastStatusInfo) => void;
  branding: BrandingConfig;
  onBrandingUpdated: (branding: BrandingConfig) => void;
  initialTab?: 'branding' | 'steadfast' | 'couriers' | 'openrouter' | 'backup';
  onDataRestored?: () => void;
  /** Account owners only — Super Admin uses System settings for full SaaS backup */
  canUseUserBackup?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  statusInfo,
  onSteadfastUpdated,
  branding,
  onBrandingUpdated,
  initialTab = 'branding',
  onDataRestored,
  canUseUserBackup = false,
}) => {
  const resolveTab = (
    tab: SettingsModalProps['initialTab']
  ): 'branding' | 'couriers' | 'openrouter' | 'backup' => {
    const resolved = tab === 'steadfast' ? 'couriers' : (tab as any) || 'branding';
    if (resolved === 'backup' && !canUseUserBackup) return 'branding';
    return resolved;
  };

  const [activeTab, setActiveTab] = useState<'branding' | 'couriers' | 'openrouter' | 'backup'>(
    resolveTab(initialTab)
  );

  // Sub-tab inside Couriers
  const [selectedCourier, setSelectedCourier] = useState<'steadfast' | 'pathao' | 'redx' | 'carrybee'>('steadfast');

  // All Couriers Status
  const [couriersStatus, setCouriersStatus] = useState<AllCouriersStatus | null>(null);

  // --- Branding State ---
  const [pageName, setPageName] = useState(branding.pageName || 'Rifa Baby Shop');
  const [pageLogo, setPageLogo] = useState(branding.pageLogo || '');
  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [brandingSuccess, setBrandingSuccess] = useState(false);
  const [brandingError, setBrandingError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // --- Steadfast State ---
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [steadfastBaseUrl, setSteadfastBaseUrl] = useState(
    statusInfo?.baseUrl || 'https://portal.steadfast.com.bd/api/v1'
  );
  const [isSavingSteadfast, setIsSavingSteadfast] = useState(false);
  const [isTestingSteadfast, setIsTestingSteadfast] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; testedUrl?: string } | null>(null);
  const [steadfastError, setSteadfastError] = useState<string | null>(null);
  const [steadfastSuccess, setSteadfastSuccess] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // --- Pathao State ---
  const [pathaoBaseUrl, setPathaoBaseUrl] = useState('https://api-hermes.pathao.com');
  const [pathaoClientId, setPathaoClientId] = useState('');
  const [pathaoClientSecret, setPathaoClientSecret] = useState('');
  const [pathaoUsername, setPathaoUsername] = useState('');
  const [pathaoPassword, setPathaoPassword] = useState('');
  const [isSavingPathao, setIsSavingPathao] = useState(false);
  const [isTestingPathao, setIsTestingPathao] = useState(false);
  const [pathaoTestResult, setPathaoTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [pathaoSuccess, setPathaoSuccess] = useState(false);

  // --- RedX State ---
  const [redxBaseUrl, setRedxBaseUrl] = useState('https://openapi.redx.com.bd/v1.0.0-beta');
  const [redxApiToken, setRedxApiToken] = useState('');
  const [isSavingRedx, setIsSavingRedx] = useState(false);
  const [isTestingRedx, setIsTestingRedx] = useState(false);
  const [redxTestResult, setRedxTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [redxSuccess, setRedxSuccess] = useState(false);

  // --- CarryBee State ---
  const [carrybeeBaseUrl, setCarrybeeBaseUrl] = useState('https://api.carrybee.com');
  const [carrybeeApiKey, setCarrybeeApiKey] = useState('');
  const [carrybeeSecretKey, setCarrybeeSecretKey] = useState('');
  const [isSavingCarrybee, setIsSavingCarrybee] = useState(false);
  const [isTestingCarrybee, setIsTestingCarrybee] = useState(false);
  const [carrybeeTestResult, setCarrybeeTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [carrybeeSuccess, setCarrybeeSuccess] = useState(false);

  // --- OpenRouter State ---
  const [openRouterStatus, setOpenRouterStatus] = useState<OpenRouterStatusInfo | null>(null);
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [openRouterModel, setOpenRouterModel] = useState('openai/gpt-4o-mini');
  const [isSavingOpenRouter, setIsSavingOpenRouter] = useState(false);
  const [isTestingOpenRouter, setIsTestingOpenRouter] = useState(false);
  const [openRouterTestResult, setOpenRouterTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [openRouterError, setOpenRouterError] = useState<string | null>(null);
  const [openRouterSuccess, setOpenRouterSuccess] = useState(false);

  // --- Backup / Restore State ---
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupMessage, setBackupMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );
  const backupFileRef = useRef<HTMLInputElement | null>(null);

  const webhookUrl = `${window.location.origin}/api/steadfast/webhook`;

  // Sync props & load courier status
  const refreshCouriers = () => {
    fetchCouriersStatus()
      .then((data) => {
        setCouriersStatus(data);
        if (data.steadfast.baseUrl) setSteadfastBaseUrl(data.steadfast.baseUrl);
        if (data.pathao.baseUrl) setPathaoBaseUrl(data.pathao.baseUrl);
        if (data.redx.baseUrl) setRedxBaseUrl(data.redx.baseUrl);
        if (data.carrybee.baseUrl) setCarrybeeBaseUrl(data.carrybee.baseUrl);
      })
      .catch((err) => console.error('Failed to load couriers status:', err));
  };

  // Only apply the requested tab when the modal opens — never while the user is navigating tabs.
  // (App refreshes branding every 10s; including branding here used to yank the tab back.)
  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(resolveTab(initialTab));
    refreshCouriers();
    getOpenRouterConfig()
      .then((data) => {
        setOpenRouterStatus(data);
        if (data.model) setOpenRouterModel(data.model);
      })
      .catch((err) => console.error('Failed to load OpenRouter config:', err));
  }, [isOpen, initialTab]);

  // Sync branding fields from props without resetting the active settings tab
  useEffect(() => {
    if (!isOpen) return;
    setPageName(branding.pageName || 'Rifa Baby Shop');
    setPageLogo(branding.pageLogo || '');
  }, [isOpen, branding.pageName, branding.pageLogo]);

  // Image Upload Handler
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setBrandingError('Please select a valid image file (PNG, JPG, SVG, WebP).');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setBrandingError('Image size exceeds 2MB limit.');
      return;
    }

    setBrandingError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 200;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/png');
          setPageLogo(dataUrl);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pageName.trim()) {
      setBrandingError('Shop / Page Name cannot be empty.');
      return;
    }

    setIsSavingBranding(true);
    setBrandingError(null);
    setBrandingSuccess(false);

    try {
      const updated = await saveBranding(pageName.trim(), pageLogo);
      onBrandingUpdated(updated);
      setBrandingSuccess(true);
      setTimeout(() => setBrandingSuccess(false), 3000);
    } catch (err: any) {
      setBrandingError(err.message || 'Failed to save branding.');
    } finally {
      setIsSavingBranding(false);
    }
  };

  // --- Save Steadfast ---
  const handleSaveSteadfast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || !secretKey.trim()) {
      setSteadfastError('Both API Key and Secret Key are required.');
      return;
    }

    setIsSavingSteadfast(true);
    setSteadfastError(null);
    setSteadfastSuccess(false);

    try {
      const updated = await saveSteadfastConfig(
        apiKey.trim(),
        secretKey.trim(),
        steadfastBaseUrl.trim() || undefined
      );
      onSteadfastUpdated(updated);
      setSteadfastSuccess(true);
      setApiKey('');
      setSecretKey('');
      refreshCouriers();
      setTimeout(() => setSteadfastSuccess(false), 3000);
    } catch (err: any) {
      setSteadfastError(err.message || 'Failed to save Steadfast credentials.');
    } finally {
      setIsSavingSteadfast(false);
    }
  };

  const handleTestSteadfast = async () => {
    setIsTestingSteadfast(true);
    setTestResult(null);
    setSteadfastError(null);

    try {
      const result = await testSteadfastConnection(
        apiKey.trim() || undefined,
        secretKey.trim() || undefined,
        steadfastBaseUrl.trim() || undefined
      );
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Connection failed' });
    } finally {
      setIsTestingSteadfast(false);
    }
  };

  // --- Save & Test Pathao ---
  const handleSavePathao = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPathao(true);
    setPathaoSuccess(false);
    try {
      await savePathaoConfig({
        baseUrl: pathaoBaseUrl.trim(),
        clientId: pathaoClientId.trim(),
        clientSecret: pathaoClientSecret.trim(),
        username: pathaoUsername.trim(),
        password: pathaoPassword.trim(),
      });
      setPathaoSuccess(true);
      refreshCouriers();
      setTimeout(() => setPathaoSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to save Pathao configuration');
    } finally {
      setIsSavingPathao(false);
    }
  };

  const handleTestPathao = async () => {
    setIsTestingPathao(true);
    setPathaoTestResult(null);
    try {
      const res = await testPathaoConnection({
        baseUrl: pathaoBaseUrl.trim(),
        clientId: pathaoClientId.trim(),
        clientSecret: pathaoClientSecret.trim(),
        username: pathaoUsername.trim(),
        password: pathaoPassword.trim(),
      });
      setPathaoTestResult(res);
    } catch (err: any) {
      setPathaoTestResult({ success: false, message: err.message });
    } finally {
      setIsTestingPathao(false);
    }
  };

  // --- Save & Test RedX ---
  const handleSaveRedx = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingRedx(true);
    setRedxSuccess(false);
    try {
      await saveRedxConfig({
        baseUrl: redxBaseUrl.trim(),
        apiToken: redxApiToken.trim(),
      });
      setRedxSuccess(true);
      refreshCouriers();
      setTimeout(() => setRedxSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to save RedX configuration');
    } finally {
      setIsSavingRedx(false);
    }
  };

  const handleTestRedx = async () => {
    setIsTestingRedx(true);
    setRedxTestResult(null);
    try {
      const res = await testRedxConnection({
        baseUrl: redxBaseUrl.trim(),
        apiToken: redxApiToken.trim(),
      });
      setRedxTestResult(res);
    } catch (err: any) {
      setRedxTestResult({ success: false, message: err.message });
    } finally {
      setIsTestingRedx(false);
    }
  };

  // --- Save & Test CarryBee ---
  const handleSaveCarrybee = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingCarrybee(true);
    setCarrybeeSuccess(false);
    try {
      await saveCarrybeeConfig({
        baseUrl: carrybeeBaseUrl.trim(),
        apiKey: carrybeeApiKey.trim(),
        secretKey: carrybeeSecretKey.trim(),
      });
      setCarrybeeSuccess(true);
      refreshCouriers();
      setTimeout(() => setCarrybeeSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to save CarryBee configuration');
    } finally {
      setIsSavingCarrybee(false);
    }
  };

  const handleTestCarrybee = async () => {
    setIsTestingCarrybee(true);
    setCarrybeeTestResult(null);
    try {
      const res = await testCarrybeeConnection({
        baseUrl: carrybeeBaseUrl.trim(),
        apiKey: carrybeeApiKey.trim(),
        secretKey: carrybeeSecretKey.trim(),
      });
      setCarrybeeTestResult(res);
    } catch (err: any) {
      setCarrybeeTestResult({ success: false, message: err.message });
    } finally {
      setIsTestingCarrybee(false);
    }
  };

  // --- Save & Test OpenRouter ---
  const handleSaveOpenRouter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openRouterKey.trim() && !openRouterStatus?.isConfigured) {
      setOpenRouterError('OpenRouter API Key is required.');
      return;
    }
    setIsSavingOpenRouter(true);
    setOpenRouterError(null);
    setOpenRouterSuccess(false);
    setOpenRouterTestResult(null);
    try {
      const res = await saveOpenRouterConfig(openRouterKey.trim(), openRouterModel.trim());
      setOpenRouterStatus(res);
      setOpenRouterSuccess(true);
      setOpenRouterKey('');
      setTimeout(() => setOpenRouterSuccess(false), 3000);
    } catch (err: any) {
      setOpenRouterError(err.message || 'Failed to save OpenRouter config.');
    } finally {
      setIsSavingOpenRouter(false);
    }
  };

  const handleTestOpenRouter = async () => {
    setIsTestingOpenRouter(true);
    setOpenRouterTestResult(null);
    try {
      const res = await testOpenRouterConnection(
        openRouterKey.trim() || undefined,
        openRouterModel.trim() || undefined
      );
      setOpenRouterTestResult(res);
    } catch (err: any) {
      setOpenRouterTestResult({ success: false, message: err.message });
    } finally {
      setIsTestingOpenRouter(false);
    }
  };

  const handleDownloadBackup = async () => {
    setIsBackingUp(true);
    setBackupMessage(null);
    try {
      const backup = await downloadUserBackup();
      setBackupMessage({
        type: 'ok',
        text: `Your shop backup downloaded (${backup.shop.counts?.orders ?? backup.shop.orders.length} orders, ${backup.shop.counts?.inventory ?? backup.shop.inventory.length} products, ${backup.teamMembers.length} team members).`,
      });
    } catch (err: any) {
      setBackupMessage({ type: 'err', text: err.message || 'Backup failed' });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const confirmed = window.confirm(
      'Restore will replace YOUR account team members and shop data (orders, inventory, API keys, branding). Other SaaS accounts are not touched. Continue?'
    );
    if (!confirmed) return;

    setIsRestoring(true);
    setBackupMessage(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = await restoreUserBackup(parsed);
      setBackupMessage({
        type: 'ok',
        text: `Restored your data: ${result.shop.orders} orders, ${result.shop.inventory} products, ${result.teamRestored} team members.`,
      });
      onDataRestored?.();
      setTimeout(() => window.location.reload(), 1200);
    } catch (err: any) {
      setBackupMessage({ type: 'err', text: err.message || 'Restore failed' });
    } finally {
      setIsRestoring(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-2">
            <Store className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base sm:text-lg">Application Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-3 pt-2 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('branding')}
            className={`pb-2.5 px-3.5 font-bold text-xs sm:text-sm border-b-2 transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'branding'
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-lg shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Branding</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('couriers')}
            className={`pb-2.5 px-3.5 font-bold text-xs sm:text-sm border-b-2 transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'couriers'
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-lg shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Courier Settings</span>
            {(couriersStatus?.steadfast.isConfigured ||
              couriersStatus?.pathao.isConfigured ||
              couriersStatus?.redx.isConfigured ||
              couriersStatus?.carrybee.isConfigured) && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('openrouter')}
            className={`pb-2.5 px-3.5 font-bold text-xs sm:text-sm border-b-2 transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'openrouter'
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-lg shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>OpenRouter AI</span>
            {openRouterStatus?.isConfigured && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            )}
          </button>

          {canUseUserBackup ? (
            <button
              type="button"
              onClick={() => setActiveTab('backup')}
              className={`pb-2.5 px-3.5 font-bold text-xs sm:text-sm border-b-2 transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'backup'
                  ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-lg shadow-xs'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>Backup</span>
            </button>
          ) : null}
        </div>

        {/* Modal Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* ========================================================= */}
          {/* TAB 1: BRANDING */}
          {/* ========================================================= */}
          {activeTab === 'branding' && (
            <form onSubmit={handleSaveBranding} className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h4 className="text-sm font-bold text-slate-800 mb-1">Business Identity</h4>
                <p className="text-xs text-slate-500">
                  Update your shop name and logo displayed across the header and cards.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Shop / Page Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={pageName}
                  onChange={(e) => setPageName(e.target.value)}
                  placeholder="e.g. Rifa Baby Shop"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Shop Logo
                </label>
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                    {pageLogo ? (
                      <img src={pageLogo} alt="Logo" className="w-full h-full object-contain p-1" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleLogoFileChange}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Logo</span>
                    </button>
                    {pageLogo && (
                      <button
                        type="button"
                        onClick={() => setPageLogo('')}
                        className="text-xs text-rose-600 hover:text-rose-700 block cursor-pointer"
                      >
                        Remove Logo
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {brandingError && (
                <div className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{brandingError}</span>
                </div>
              )}

              {brandingSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Branding updated successfully!</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSavingBranding}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center space-x-2 cursor-pointer"
              >
                {isSavingBranding ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>Save Branding</span>
              </button>
            </form>
          )}

          {/* ========================================================= */}
          {/* TAB 2: COURIER SETTINGS (STEADFAST | PATHAO | REDX | CARRYBEE) */}
          {/* ========================================================= */}
          {activeTab === 'couriers' && (
            <div className="space-y-4">
              {/* Courier selector sub-tabs */}
              <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-xl">
                {(['steadfast', 'pathao', 'redx', 'carrybee'] as const).map((c) => {
                  const isConf =
                    c === 'steadfast'
                      ? couriersStatus?.steadfast.isConfigured
                      : c === 'pathao'
                      ? couriersStatus?.pathao.isConfigured
                      : c === 'redx'
                      ? couriersStatus?.redx.isConfigured
                      : couriersStatus?.carrybee.isConfigured;

                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSelectedCourier(c)}
                      className={`py-2 px-1 text-center rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex flex-col items-center justify-center ${
                        selectedCourier === c
                          ? 'bg-white text-emerald-800 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span className="truncate">{c}</span>
                      <span
                        className={`w-1.5 h-1.5 rounded-full mt-1 ${
                          isConf ? 'bg-emerald-500' : 'bg-slate-300'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              {/* Courier 1: STEADFAST */}
              {selectedCourier === 'steadfast' && (
                <div className="space-y-4">
                  {/* STEADFAST MERCHANT ACCOUNT LOGIN SECTION */}
                  <div className="bg-gradient-to-br from-emerald-50 via-teal-50/70 to-slate-50 border border-emerald-200 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-sm shadow-xs">
                          ST
                        </div>
                        <div>
                          <h4 className="text-sm font-extrabold text-slate-900 tracking-tight">
                            STEADFAST MERCHANT ACCOUNT LOGIN
                          </h4>
                          <p className="text-[11px] text-slate-600">
                            Connect your official Steadfast merchant account to verify parcels & real customer ratings
                          </p>
                        </div>
                      </div>

                      {couriersStatus?.steadfast.isConfigured ? (
                        <span className="px-3 py-1 bg-emerald-600 text-white font-black text-xs rounded-full shadow-xs flex items-center space-x-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>Connected & Verified</span>
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-slate-200 text-slate-700 font-bold text-xs rounded-full">
                          Not Connected
                        </span>
                      )}
                    </div>

                    {/* Official Portal Access & Authentication Flow */}
                    <div className="pt-3 border-t border-emerald-200/60 space-y-2">
                      <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider block">
                        Official Steadfast Portal Login Flow
                      </span>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Log in to your official Steadfast merchant account in their secure portal to view your merchant dashboard and obtain your official <strong>API Key</strong> and <strong>Secret Key</strong>:
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <a
                          href="https://portal.steadfast.com.bd"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-xs"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Open Steadfast Portal (portal.steadfast.com.bd)</span>
                        </a>
                        <a
                          href="https://portal.packzy.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Open Packzy Portal (portal.packzy.com)</span>
                        </a>
                      </div>
                      <p className="text-[11px] text-emerald-800 font-medium pt-1">
                        In Steadfast Merchant Dashboard: Click <strong>Settings</strong> → <strong>API / Developer</strong> → Copy your <strong>API Key</strong> and <strong>Secret Key</strong> below.
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleSaveSteadfast} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Steadfast API Key <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={
                          couriersStatus?.steadfast.isConfigured
                            ? 'Enter new key to update'
                            : 'Enter Steadfast API Key'
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Steadfast Secret Key <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="password"
                        value={secretKey}
                        onChange={(e) => setSecretKey(e.target.value)}
                        placeholder={
                          couriersStatus?.steadfast.isConfigured
                            ? 'Enter new secret to update'
                            : 'Enter Steadfast Secret Key'
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                          Steadfast API Base URL
                        </label>
                        <span className="text-[10px] text-slate-500 font-mono">STEADFAST_BASE_URL</span>
                      </div>
                      <input
                        type="text"
                        value={steadfastBaseUrl}
                        onChange={(e) => setSteadfastBaseUrl(e.target.value)}
                        placeholder="https://portal.steadfast.com.bd/api/v1"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500"
                      />
                      <div className="flex flex-wrap gap-1 mt-1">
                        <button
                          type="button"
                          onClick={() => setSteadfastBaseUrl('https://portal.steadfast.com.bd/api/v1')}
                          className="text-[10px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono"
                        >
                          portal.steadfast.com.bd
                        </button>
                        <button
                          type="button"
                          onClick={() => setSteadfastBaseUrl('https://portal.packzy.com/api/v1')}
                          className="text-[10px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono"
                        >
                          portal.packzy.com
                        </button>
                      </div>
                    </div>

                    {/* Test button */}
                    <button
                      type="button"
                      onClick={handleTestSteadfast}
                      disabled={isTestingSteadfast}
                      className="w-full py-2 px-3 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl flex items-center justify-center space-x-2 transition-colors cursor-pointer"
                    >
                      {isTestingSteadfast ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Testing Connection...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Test Steadfast API Connection</span>
                        </>
                      )}
                    </button>

                    {testResult && (
                      <div
                        className={`p-2.5 rounded-xl text-xs flex items-start space-x-2 ${
                          testResult.success
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {testResult.success ? (
                          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        )}
                        <span>{testResult.message}</span>
                      </div>
                    )}

                    {steadfastSuccess && (
                      <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-xl text-xs flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Steadfast configuration saved successfully!</span>
                      </div>
                    )}

                    {/* Webhook Copy */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                      <span className="font-bold text-slate-700">Webhook URL:</span>
                      <div className="flex items-center space-x-2">
                        <input
                          readOnly
                          value={webhookUrl}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-[11px] font-mono text-slate-600"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(webhookUrl);
                            setCopiedWebhook(true);
                            setTimeout(() => setCopiedWebhook(false), 2000);
                          }}
                          className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded"
                        >
                          {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSavingSteadfast}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      Save Steadfast Settings
                    </button>
                  </form>
                </div>
              )}

              {/* Courier 2: PATHAO */}
              {selectedCourier === 'pathao' && (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Pathao Courier</h4>
                      <p className="text-[11px] text-slate-500">Official Merchant OAuth API integration</p>
                    </div>
                    {couriersStatus?.pathao.isConfigured ? (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded-full">
                        Connected ✓
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-600 font-bold text-[10px] rounded-full">
                        Not configured
                      </span>
                    )}
                  </div>

                  <form onSubmit={handleSavePathao} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Pathao Base URL
                      </label>
                      <input
                        type="text"
                        value={pathaoBaseUrl}
                        onChange={(e) => setPathaoBaseUrl(e.target.value)}
                        placeholder="https://api-hermes.pathao.com"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                          Client ID
                        </label>
                        <input
                          type="text"
                          value={pathaoClientId}
                          onChange={(e) => setPathaoClientId(e.target.value)}
                          placeholder={couriersStatus?.pathao.clientIdMasked || 'Pathao Client ID'}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                          Client Secret
                        </label>
                        <input
                          type="password"
                          value={pathaoClientSecret}
                          onChange={(e) => setPathaoClientSecret(e.target.value)}
                          placeholder="Client Secret"
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                          Username / Email
                        </label>
                        <input
                          type="text"
                          value={pathaoUsername}
                          onChange={(e) => setPathaoUsername(e.target.value)}
                          placeholder={couriersStatus?.pathao.usernameMasked || 'Pathao registered email'}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                          Password
                        </label>
                        <input
                          type="password"
                          value={pathaoPassword}
                          onChange={(e) => setPathaoPassword(e.target.value)}
                          placeholder="Pathao password"
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleTestPathao}
                      disabled={isTestingPathao}
                      className="w-full py-2 px-3 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl flex items-center justify-center space-x-2 transition-colors cursor-pointer"
                    >
                      {isTestingPathao ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Testing Pathao OAuth...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Test Pathao OAuth Connection</span>
                        </>
                      )}
                    </button>

                    {pathaoTestResult && (
                      <div
                        className={`p-2.5 rounded-xl text-xs flex items-start space-x-2 ${
                          pathaoTestResult.success
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {pathaoTestResult.success ? (
                          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        )}
                        <span>{pathaoTestResult.message}</span>
                      </div>
                    )}

                    {pathaoSuccess && (
                      <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-xl text-xs flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Pathao configuration saved successfully!</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSavingPathao}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      Save Pathao Settings
                    </button>
                  </form>
                </div>
              )}

              {/* Courier 3: REDX */}
              {selectedCourier === 'redx' && (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">RedX Courier</h4>
                      <p className="text-[11px] text-slate-500">Official Open API integration</p>
                    </div>
                    {couriersStatus?.redx.isConfigured ? (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded-full">
                        Connected ✓
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-600 font-bold text-[10px] rounded-full">
                        Not configured
                      </span>
                    )}
                  </div>

                  <form onSubmit={handleSaveRedx} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        RedX Base URL
                      </label>
                      <input
                        type="text"
                        value={redxBaseUrl}
                        onChange={(e) => setRedxBaseUrl(e.target.value)}
                        placeholder="https://openapi.redx.com.bd/v1.0.0-beta"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        RedX API Token
                      </label>
                      <input
                        type="password"
                        value={redxApiToken}
                        onChange={(e) => setRedxApiToken(e.target.value)}
                        placeholder={couriersStatus?.redx.tokenMasked || 'Enter RedX Bearer Token'}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleTestRedx}
                      disabled={isTestingRedx}
                      className="w-full py-2 px-3 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl flex items-center justify-center space-x-2 transition-colors cursor-pointer"
                    >
                      {isTestingRedx ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Testing RedX API...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Test RedX API Connection</span>
                        </>
                      )}
                    </button>

                    {redxTestResult && (
                      <div
                        className={`p-2.5 rounded-xl text-xs flex items-start space-x-2 ${
                          redxTestResult.success
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {redxTestResult.success ? (
                          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        )}
                        <span>{redxTestResult.message}</span>
                      </div>
                    )}

                    {redxSuccess && (
                      <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-xl text-xs flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>RedX configuration saved successfully!</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSavingRedx}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      Save RedX Settings
                    </button>
                  </form>
                </div>
              )}

              {/* Courier 4: CARRYBEE */}
              {selectedCourier === 'carrybee' && (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">CarryBee Courier</h4>
                      <p className="text-[11px] text-slate-500">Official API integration</p>
                    </div>
                    {couriersStatus?.carrybee.isConfigured ? (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded-full">
                        Connected ✓
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-600 font-bold text-[10px] rounded-full">
                        Not configured
                      </span>
                    )}
                  </div>

                  <form onSubmit={handleSaveCarrybee} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        CarryBee Base URL
                      </label>
                      <input
                        type="text"
                        value={carrybeeBaseUrl}
                        onChange={(e) => setCarrybeeBaseUrl(e.target.value)}
                        placeholder="https://api.carrybee.com"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        CarryBee API Key
                      </label>
                      <input
                        type="text"
                        value={carrybeeApiKey}
                        onChange={(e) => setCarrybeeApiKey(e.target.value)}
                        placeholder={couriersStatus?.carrybee.apiKeyMasked || 'CarryBee API Key'}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        CarryBee Secret Key
                      </label>
                      <input
                        type="password"
                        value={carrybeeSecretKey}
                        onChange={(e) => setCarrybeeSecretKey(e.target.value)}
                        placeholder="CarryBee Secret Key"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleTestCarrybee}
                      disabled={isTestingCarrybee}
                      className="w-full py-2 px-3 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl flex items-center justify-center space-x-2 transition-colors cursor-pointer"
                    >
                      {isTestingCarrybee ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Testing CarryBee API...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Test CarryBee API Connection</span>
                        </>
                      )}
                    </button>

                    {carrybeeTestResult && (
                      <div
                        className={`p-2.5 rounded-xl text-xs flex items-start space-x-2 ${
                          carrybeeTestResult.success
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {carrybeeTestResult.success ? (
                          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        )}
                        <span>{carrybeeTestResult.message}</span>
                      </div>
                    )}

                    {carrybeeSuccess && (
                      <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-xl text-xs flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>CarryBee configuration saved successfully!</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSavingCarrybee}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      Save CarryBee Settings
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: OPENROUTER AI */}
          {/* ========================================================= */}
          {activeTab === 'openrouter' && (
            <form onSubmit={handleSaveOpenRouter} className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h4 className="text-sm font-bold text-slate-800 mb-1">OpenRouter AI Model</h4>
                <p className="text-xs text-slate-500">
                  Optional OpenRouter fallback integration for order extraction.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  OpenRouter API Key <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  value={openRouterKey}
                  onChange={(e) => setOpenRouterKey(e.target.value)}
                  placeholder={openRouterStatus?.isConfigured ? 'Enter new key to update (or leave blank)' : 'sk-or-v1-...'}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500"
                  autoComplete="off"
                />
                {openRouterStatus?.isConfigured && openRouterStatus.apiKeyMasked && (
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    Current key: <span className="font-mono text-slate-700">{openRouterStatus.apiKeyMasked}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Model Identifier
                </label>
                <input
                  type="text"
                  value={openRouterModel}
                  onChange={(e) => setOpenRouterModel(e.target.value)}
                  placeholder="openai/gpt-4o-mini"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <button
                type="button"
                onClick={handleTestOpenRouter}
                disabled={isTestingOpenRouter}
                className="w-full py-2 px-3 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl flex items-center justify-center space-x-2 transition-colors cursor-pointer"
              >
                {isTestingOpenRouter ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Testing OpenRouter...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Test OpenRouter Connection</span>
                  </>
                )}
              </button>

              {openRouterTestResult && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-start space-x-2 ${
                    openRouterTestResult.success
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {openRouterTestResult.success ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <span>{openRouterTestResult.message}</span>
                </div>
              )}

              {openRouterSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>OpenRouter configuration saved successfully!</span>
                </div>
              )}

              {openRouterError && (
                <div className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs flex items-center space-x-2 border border-rose-200">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{openRouterError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSavingOpenRouter}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl transition-colors cursor-pointer"
              >
                {isSavingOpenRouter ? 'Saving...' : 'Save OpenRouter Settings'}
              </button>
            </form>
          )}

          {/* ========================================================= */}
          {/* TAB 4: FULL DATABASE BACKUP / RESTORE */}
          {/* ========================================================= */}
          {activeTab === 'backup' && canUseUserBackup && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h4 className="text-sm font-bold text-slate-800 mb-1 flex items-center space-x-2">
                  <Database className="w-4 h-4 text-emerald-600" />
                  <span>Your shop backup</span>
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Download or restore <strong>your</strong> account data only: team members, orders,
                  inventory, branding, and courier / OpenRouter settings. Other SaaS accounts are not
                  included. Full platform backups are Super Admin only.
                </p>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  disabled={isBackingUp || isRestoring}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl transition-colors cursor-pointer flex items-center justify-center space-x-2"
                >
                  {isBackingUp ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Preparing backup...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Download My Backup (.json)</span>
                    </>
                  )}
                </button>

                <input
                  ref={backupFileRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={handleRestoreBackupFile}
                />

                <button
                  type="button"
                  onClick={() => backupFileRef.current?.click()}
                  disabled={isBackingUp || isRestoring}
                  className="w-full py-3 px-4 border-2 border-amber-400 bg-amber-50 hover:bg-amber-100 disabled:opacity-60 text-amber-900 font-bold text-sm rounded-xl transition-colors cursor-pointer flex items-center justify-center space-x-2"
                >
                  {isRestoring ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Restoring your data...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Restore My Backup</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed">
                <strong>Warning:</strong> Restore replaces your team members and shop data. Keep the
                file safe — it can include API keys and order information.
              </div>

              {backupMessage && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-start space-x-2 border ${
                    backupMessage.type === 'ok'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  {backupMessage.type === 'ok' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <span>{backupMessage.text}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
