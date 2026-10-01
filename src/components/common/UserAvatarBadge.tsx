import React, { useState } from 'react';
import { useFinance } from '../../context/FinanceContext';

interface UserAvatarBadgeProps {
  userName?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export const UserAvatarBadge: React.FC<UserAvatarBadgeProps> = ({
  userName = 'Praveen',
  size = 'sm',
  className = ''
}) => {
  const [imgError, setImgError] = useState(false);
  const { settings } = useFinance();

  const cleanName = (userName || '').trim();
  const isSarthak = cleanName.toLowerCase().includes('sarthak');
  const displayName = isSarthak ? 'Sarthak' : (cleanName || 'Praveen');
  const initial = isSarthak ? 'S' : (cleanName ? cleanName.charAt(0).toUpperCase() : 'P');
  
  // Custom configurable avatar from settings, fallback to standard image
  const avatarSrc = isSarthak 
    ? (settings.sarthakAvatarUrl || '/avatars/sarthak.jpg')
    : (settings.praveenAvatarUrl || '/avatars/praveen.jpg');

  const sizeClasses = {
    xs: 'w-4 h-4 text-[9px]',
    sm: 'w-5 h-5 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm'
  }[size] || 'w-5 h-5 text-[10px]';

  const colorClasses = isSarthak
    ? 'border-indigo-400 bg-indigo-600 text-white'
    : 'border-emerald-500 bg-emerald-700 text-white';

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full overflow-hidden border shadow-2xs flex-shrink-0 select-none ${sizeClasses} ${colorClasses} ${className}`}
      title={`Initiated by ${displayName}`}
      aria-label={`Initiated by ${displayName}`}
    >
      {!imgError ? (
        <img
          src={avatarSrc}
          alt={displayName}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover rounded-full"
          loading="lazy"
        />
      ) : (
        <span className="font-black leading-none">{initial}</span>
      )}
    </div>
  );
};
