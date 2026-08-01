import React from 'react';
import { PaymentMethod } from '../../types/finance';
import { Smartphone, Banknote, CreditCard, Landmark, Wallet } from 'lucide-react';

interface Props {
  method: PaymentMethod;
  showLabel?: boolean;
}

export const PaymentMethodIcon: React.FC<Props> = ({ method, showLabel = true }) => {
  const getMethodDetails = (m: PaymentMethod) => {
    switch (m) {
      case 'UPI':
        return {
          icon: <Smartphone className="w-3.5 h-3.5 text-blue-600" />,
          label: 'UPI (Instant)',
          badgeBg: 'bg-blue-50 text-blue-800 border-blue-200'
        };
      case 'Cash':
        return {
          icon: <Banknote className="w-3.5 h-3.5 text-emerald-600" />,
          label: 'Cash',
          badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200'
        };
      case 'Credit Card':
        return {
          icon: <CreditCard className="w-3.5 h-3.5 text-purple-600" />,
          label: 'Credit Card',
          badgeBg: 'bg-purple-50 text-purple-800 border-purple-200'
        };
      case 'Debit Card':
        return {
          icon: <CreditCard className="w-3.5 h-3.5 text-indigo-600" />,
          label: 'Debit Card',
          badgeBg: 'bg-indigo-50 text-indigo-800 border-indigo-200'
        };
      case 'Bank Transfer':
        return {
          icon: <Landmark className="w-3.5 h-3.5 text-gray-700" />,
          label: 'Bank Direct',
          badgeBg: 'bg-gray-100 text-gray-800 border-gray-300'
        };
      default:
        return {
          icon: <Wallet className="w-3.5 h-3.5 text-gray-600" />,
          label: m,
          badgeBg: 'bg-gray-50 text-gray-700 border-gray-200'
        };
    }
  };

  const { icon, label, badgeBg } = getMethodDetails(method);

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${badgeBg} shadow-2xs`}>
      {icon}
      {showLabel && <span>{label}</span>}
    </span>
  );
};
