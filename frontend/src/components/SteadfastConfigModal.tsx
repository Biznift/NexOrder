import React, { useState } from 'react';
import { X, ShieldCheck, Key, Copy, CheckCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { SteadfastStatusInfo } from '../types/order';
import { saveSteadfastConfig, testSteadfastConnection } from '../api';

interface SteadfastConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  statusInfo: SteadfastStatusInfo | null;
  onUpdated: (status: SteadfastStatusInfo) => void;
}

export const SteadfastConfigModal: React.FC<SteadfastConfigModalProps> = ({
  isOpen,
  onClose,
  statusInfo,
  onUpdated,
}) => {
  if (!isOpen) return null;

  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const webhookUrl = `${window.location.origin}/api/steadfast/webhook`;

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      // Test either the currently entered keys or the already saved keys
      const keyToTest = apiKey.trim() || undefined;
      const secretToTest = secretKey.trim() || undefined;

      const result = await testSteadfastConnection(keyToTest, secretToTest);
      setTestResult(result);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Connection test failed',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || !secretKey.trim()) {
      setError('Please provide both Steadfast API Key and Steadfast Secret Key.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(false);
    setTestResult(null);

    try {
      const updated = await saveSteadfastConfig(apiKey.trim(), secretKey.trim());
      onUpdated(updated);
      setSuccess(true);
      setApiKey('');
      setSecretKey('');
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to save Steadfast credentials');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 my-auto">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Key className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base sm:text-lg">Steadfast Courier API Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto text-sm">
          {/* Status Badge */}
          <div
            className={`p-3.5 rounded-xl border flex items-start space-x-3 ${
              statusInfo?.isConfigured
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <ShieldCheck
              className={`w-5 h-5 shrink-0 mt-0.5 ${
                statusInfo?.isConfigured ? 'text-emerald-600' : 'text-amber-600'
              }`}
            />
            <div className="text-xs space-y-1">
              <div className="font-bold text-sm">
                {statusInfo?.isConfigured
                  ? 'Steadfast Credentials Configured'
                  : 'Steadfast Credentials Required'}
              </div>
              <p>
                {statusInfo?.isConfigured
                  ? `Active API Key: ${statusInfo.apiKeyMasked}. Orders will be sent directly to Steadfast Courier API.`
                  : 'To send orders directly to Steadfast Courier, please provide your real Steadfast API Key and Secret Key from your Steadfast merchant dashboard.'}
              </p>
            </div>
          </div>

          {/* Webhook Endpoint Information */}
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-2">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Steadfast Webhook URL
            </div>
            <p className="text-xs text-slate-500">
              Configure this Webhook URL in your Steadfast merchant dashboard to receive real-time pickup and delivery updates:
            </p>
            <div className="flex items-center space-x-2 bg-white border border-slate-300 rounded-lg p-2 font-mono text-xs text-slate-800 break-all">
              <span className="flex-1 truncate">{webhookUrl}</span>
              <button
                type="button"
                onClick={handleCopyWebhook}
                className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 shrink-0 font-sans text-xs flex items-center space-x-1"
              >
                {copiedWebhook ? (
                  <>
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Configuration Form */}
          <form onSubmit={handleSave} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Steadfast API Key <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={statusInfo?.isConfigured ? 'Enter new API Key to update' : 'Enter Steadfast API Key'}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500"
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
                placeholder={statusInfo?.isConfigured ? 'Enter new Secret Key to update' : 'Enter Steadfast Secret Key'}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Credentials are saved securely on the server and are never exposed to the frontend.
              </p>
            </div>

            {/* Test Connection Button */}
            {(statusInfo?.isConfigured || (apiKey && secretKey)) && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="w-full py-2 px-3 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl flex items-center justify-center space-x-2 transition-colors"
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Testing Steadfast API connection...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Test Steadfast API Connection</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {testResult && (
              <div
                className={`p-3 rounded-xl text-xs flex items-start space-x-2 ${
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

            {error && (
              <div className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Steadfast credentials saved securely!</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 active:bg-black disabled:bg-slate-300 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center space-x-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Credentials...</span>
                </>
              ) : (
                <span>Save Steadfast Credentials</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
