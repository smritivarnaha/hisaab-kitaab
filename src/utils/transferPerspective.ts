import { Transaction } from '../types/finance';

export interface PartnerTransferPerspective {
  label: string;
  type: 'borrowed' | 'lent';
  badgeStyle: string;
  amountColor: string;
  partnerName: string;
}

/**
 * Calculates the partner transfer perspective based on the current logged-in user.
 * 
 * If Sarthak gave money to Praveen:
 * - Praveen's view shows: "🤝 Borrowed from Sarthak" (purple chip, purple amount)
 * - Sarthak's view shows: "🤝 Lent to Praveen" (blue chip, blue amount)
 * 
 * If Praveen gave money to Sarthak:
 * - Praveen's view shows: "🤝 Lent to Sarthak" (blue chip, blue amount)
 * - Sarthak's view shows: "🤝 Borrowed from Praveen" (purple chip, purple amount)
 */
export function getPartnerTransferPerspective(
  tx: Pick<Transaction, 'type' | 'enteredBy'>,
  currentUserName?: string
): PartnerTransferPerspective {
  const isViewerPraveen = (currentUserName || 'Praveen').toLowerCase().includes('praveen');
  const isEnteredPraveen = !tx.enteredBy || (tx.enteredBy || '').toLowerCase().includes('praveen');
  const partnerName = isViewerPraveen ? 'Sarthak' : 'Praveen';
  
  // Did the viewer initiate/record this entry?
  const isViewerTheCreator = (isViewerPraveen && isEnteredPraveen) || (!isViewerPraveen && !isEnteredPraveen);

  // If viewer is the creator:
  //   tx.type === 'lent'     => Viewer lent to partner
  //   tx.type === 'borrowed' => Viewer borrowed from partner
  // If viewer is the other partner:
  //   tx.type === 'lent'     => Creator lent to viewer => Viewer borrowed!
  //   tx.type === 'borrowed' => Creator borrowed from viewer => Viewer lent!
  const effectiveType: 'borrowed' | 'lent' = isViewerTheCreator
    ? (tx.type === 'borrowed' ? 'borrowed' : 'lent')
    : (tx.type === 'borrowed' ? 'lent' : 'borrowed');

  if (effectiveType === 'lent') {
    return {
      label: `🤝 Lent to ${partnerName}`,
      type: 'lent',
      badgeStyle: 'bg-blue-100 text-blue-900 border-blue-200',
      amountColor: 'text-blue-700',
      partnerName
    };
  } else {
    return {
      label: `🤝 Borrowed from ${partnerName}`,
      type: 'borrowed',
      badgeStyle: 'bg-purple-100 text-purple-900 border-purple-200',
      amountColor: 'text-purple-700',
      partnerName
    };
  }
}
