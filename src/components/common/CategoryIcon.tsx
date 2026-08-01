import React from 'react';
import { Category } from '../../types/finance';
import { 
  Fuel, 
  UtensilsCrossed, 
  ShoppingBag, 
  Receipt, 
  Sparkles, 
  Navigation, 
  HeartPulse, 
  TrendingUp, 
  Briefcase, 
  ArrowLeftRight,
  IndianRupee
} from 'lucide-react';

interface Props {
  category: Category;
  size?: 'sm' | 'md' | 'lg';
}

export const CategoryIcon: React.FC<Props> = ({ category, size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base'
  }[size];

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  }[size];

  const getCategoryDetails = (cat: Category) => {
    switch (cat) {
      case 'Fuel':
        return {
          icon: <Fuel className={iconSizes} />,
          bg: 'bg-amber-100 text-amber-900 border-amber-200'
        };
      case 'Food & Drinks':
        return {
          icon: <UtensilsCrossed className={iconSizes} />,
          bg: 'bg-orange-100 text-orange-900 border-orange-200'
        };
      case 'Grocery':
        return {
          icon: <ShoppingBag className={iconSizes} />,
          bg: 'bg-emerald-100 text-emerald-900 border-emerald-200'
        };
      case 'Bills & Utilities':
        return {
          icon: <Receipt className={iconSizes} />,
          bg: 'bg-[#93E044] text-[#0D2E14] border-[#84D137]'
        };
      case 'Shopping':
        return {
          icon: <Sparkles className={iconSizes} />,
          bg: 'bg-purple-100 text-purple-900 border-purple-200'
        };
      case 'Travel':
        return {
          icon: <Navigation className={iconSizes} />,
          bg: 'bg-sky-100 text-sky-900 border-sky-200'
        };
      case 'Healthcare':
        return {
          icon: <HeartPulse className={iconSizes} />,
          bg: 'bg-rose-100 text-rose-900 border-rose-200'
        };
      case 'Investments':
        return {
          icon: <TrendingUp className={iconSizes} />,
          bg: 'bg-[#0D2E14] text-[#93E044] border-[#0D2E14]'
        };
      case 'Salary':
        return {
          icon: <Briefcase className={iconSizes} />,
          bg: 'bg-[#93E044] text-[#0D2E14] border-[#84D137]'
        };
      case 'Transfer/Settlement':
        return {
          icon: <ArrowLeftRight className={iconSizes} />,
          bg: 'bg-blue-100 text-blue-900 border-blue-200'
        };
      default:
        return {
          icon: <IndianRupee className={iconSizes} />,
          bg: 'bg-gray-100 text-[#0D2E14] border-gray-300'
        };
    }
  };

  const { icon, bg } = getCategoryDetails(category);

  return (
    <div className={`${sizeClasses} rounded-2xl ${bg} border flex items-center justify-center font-bold shadow-2xs flex-shrink-0 transition-transform hover:scale-105`}>
      {icon}
    </div>
  );
};
