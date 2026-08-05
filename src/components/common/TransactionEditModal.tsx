import React, { useState } from 'react';
import { Transaction, Category, PaymentMethod, TransactionType, CATEGORIES_LIST } from '../../types/finance';
import { useFinance } from '../../context/FinanceContext';
import { X, Save, Trash2, Calendar, Tag, CreditCard, User, FileText, Check } from 'lucide-react';

interface Props {
  transaction: Transaction;
  onClose: () => void;
}

const PAYMENT_METHOD_OPTIONS: PaymentMethod[] = [
  'UPI',
  'Cash',
  'Bank Transfer',
  'Credit Card',
  'Debit Card'
];

export const TransactionEditModal: React.FC<Props> = ({ transaction, onClose }) => {
  const { updateTransaction, deleteTransaction } = useFinance();

  const [title, setTitle] = useState(transaction.title || '');
  const [amount, setAmount] = useState<string>(String(transaction.amount || ''));
  const [type, setType] = useState<TransactionType>(transaction.type || 'expense');
  const [category, setCategory] = useState<Category>(transaction.category || 'Others');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(transaction.paymentMethod || 'UPI');
  const [date, setDate] = useState(transaction.date || new Date().toISOString().split('T')[0]);
  const [person, setPerson] = useState(transaction.person || '');
  const [notes, setNotes] = useState(transaction.notes || '');

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = parseFloat(amount) || 0;

    updateTransaction(transaction.id, {
      title: title.trim() || category,
      amount: numAmt,
      type,
      category,
      paymentMethod,
      date,
      person: person.trim() || undefined,
      notes: notes.trim() || title.trim(),
      isPending: false
    });

    setIsSaved(true);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    deleteTransaction(transaction.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn font-outfit">
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl border border-gray-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-white flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#0D2E14] text-white flex items-center justify-center font-bold text-xs">
              ✏️
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">Edit Entry</h3>
              <p className="text-[10px] text-gray-400 font-medium">Update details or remove entry from ledger</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSave} className="overflow-y-auto flex-1 p-4 space-y-3.5 no-scrollbar bg-gray-50/50">
          {/* Type Selector (Expense, Income, Lent) */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Transaction Type</label>
            <div className="flex bg-gray-200/70 p-1 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setType('expense')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  type === 'expense' ? 'bg-[#D93025] text-white shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Expense (Debit)
              </button>
              <button
                type="button"
                onClick={() => setType('income')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  type === 'income' ? 'bg-green-700 text-white shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Income (Credit)
              </button>
              <button
                type="button"
                onClick={() => setType('lent')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  type === 'lent' ? 'bg-amber-700 text-white shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Lent Out
              </button>
            </div>
          </div>

          {/* Description / Title Input */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Description / Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Petrol Refill, Swiggy Dinner..."
              className="w-full bg-white border border-gray-200 text-xs font-bold text-gray-900 rounded-xl p-2.5 outline-none focus:border-[#0D2E14] shadow-2xs transition-all"
            />
          </div>

          {/* Amount (₹) Input */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Amount (₹)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-gray-400">₹</span>
              <input
                type="number"
                step="any"
                required
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-white border border-gray-200 text-sm font-extrabold text-[#0D2E14] rounded-xl py-2 pl-7 pr-3 outline-none focus:border-[#0D2E14] shadow-2xs transition-all"
              />
            </div>
          </div>

          {/* Category & Payment Method Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Tag className="w-3 h-3" /> Category
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as Category)}
                className="w-full bg-white border border-gray-200 text-xs font-semibold text-gray-900 rounded-xl p-2.5 outline-none focus:border-[#0D2E14] shadow-2xs"
              >
                {CATEGORIES_LIST.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <CreditCard className="w-3 h-3" /> Method
              </label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full bg-white border border-gray-200 text-xs font-semibold text-gray-900 rounded-xl p-2.5 outline-none focus:border-[#0D2E14] shadow-2xs"
              >
                {PAYMENT_METHOD_OPTIONS.map(pm => (
                  <option key={pm} value={pm}>{pm}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Date & Person Optional */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Date
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full bg-white border border-gray-200 text-xs font-semibold text-gray-900 rounded-xl p-2 outline-none focus:border-[#0D2E14] shadow-2xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <User className="w-3 h-3" /> Person (Optional)
              </label>
              <input
                type="text"
                value={person}
                onChange={e => setPerson(e.target.value)}
                placeholder="e.g. Rahul"
                className="w-full bg-white border border-gray-200 text-xs font-semibold text-gray-900 rounded-xl p-2 outline-none focus:border-[#0D2E14] shadow-2xs"
              />
            </div>
          </div>

          {/* Notes Optional */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
              <FileText className="w-3 h-3" /> Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Additional notes..."
              className="w-full bg-white border border-gray-200 text-xs font-medium text-gray-800 rounded-xl p-2 outline-none focus:border-[#0D2E14] shadow-2xs"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col gap-2">
            <button
              type="submit"
              disabled={isSaved}
              className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 ${
                isSaved ? 'bg-emerald-600 text-white' : 'bg-[#0D2E14] hover:bg-black text-white'
              }`}
            >
              {isSaved ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Saved Changes!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDelete}
              className={`w-full py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                confirmDelete
                  ? 'bg-red-600 border-red-600 text-white animate-pulse'
                  : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{confirmDelete ? 'Confirm Permanent Delete?' : 'Delete Entry'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
