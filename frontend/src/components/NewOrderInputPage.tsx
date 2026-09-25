import React, { useState } from 'react';
import { Sparkles, ArrowLeft, AlertCircle } from 'lucide-react';

interface NewOrderInputPageProps {
  onProcessOrder: (text: string) => void;
  onBack: () => void;
}

export const NewOrderInputPage: React.FC<NewOrderInputPageProps> = ({
  onProcessOrder,
  onBack,
}) => {
  // Must be completely empty for every new order
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!text.trim()) {
      setError('অনুগ্রহ করে কাস্টমারের মেসেজ পেস্ট করুন। (Please paste customer message first)');
      return;
    }
    setError(null);
    // DO NOT stay on the same page! Immediately navigate to review page
    onProcessOrder(text.trim());
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Top Bar with Back button */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          type="button"
          className="flex items-center text-sm font-medium text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back
        </button>
        <h2 className="text-lg sm:text-xl font-bold text-slate-800">NEW ORDER CREATE</h2>
        <div className="w-16" />
      </div>

      {/* FIRST PAGE: ONLY ONE LARGE EMPTY TEXT BOX AND OK / PROCESS ORDER BUTTON */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-sm space-y-4">
        <div>
          <textarea
            rows={10}
            autoFocus
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (error) setError(null);
            }}
            placeholder={`কাস্টমারের মেসেজ এখানে পেস্ট করুন...\n\nউদাহরণ:\nনাম রহিম\nঠিকানা গাজীপুর চৌরাস্তা\n01711223344\nবেবি নকশি কাঁথা ২ পিস\nনীল কালার\n৫০০ টাকা\nনোট: বাসায় দিয়ে যাবেন`}
            className="w-full text-base sm:text-lg p-4 border-2 border-slate-300 rounded-2xl focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 font-sans resize-y transition-all placeholder:text-slate-400 leading-relaxed"
          />
        </div>

        {error && (
          <div className="flex items-center space-x-2 text-rose-600 bg-rose-50 p-3 rounded-xl text-sm font-medium">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* OK / PROCESS ORDER BUTTON */}
        <button
          type="button"
          onClick={() => handleSubmit()}
          disabled={!text.trim()}
          className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-extrabold text-lg sm:text-xl rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center space-x-2.5 group cursor-pointer"
        >
          <Sparkles className="w-6 h-6 text-emerald-200 group-hover:rotate-12 transition-transform" />
          <span>OK / PROCESS ORDER</span>
        </button>
      </div>
    </div>
  );
};
