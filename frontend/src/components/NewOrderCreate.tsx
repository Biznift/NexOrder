import React, { useState } from 'react';
import { NewOrderInputPage } from './NewOrderInputPage';
import { OrderReviewPage } from './OrderReviewPage';

interface NewOrderCreateProps {
  onOrderConfirmed: () => void;
  onBack: () => void;
}

export const NewOrderCreate: React.FC<NewOrderCreateProps> = ({ onOrderConfirmed, onBack }) => {
  // Step 1: Input Page | Step 2: Order Review Page
  const [currentPage, setCurrentPage] = useState<'input' | 'review'>('input');
  const [customerText, setCustomerText] = useState('');

  const handleProcessOrder = (text: string) => {
    setCustomerText(text);
    // DO NOT stay on the same page! Immediately navigate to SECOND ORDER REVIEW PAGE
    setCurrentPage('review');
  };

  const handleBackToInput = () => {
    setCurrentPage('input');
  };

  if (currentPage === 'review') {
    return (
      <OrderReviewPage
        rawText={customerText}
        onOrderConfirmed={onOrderConfirmed}
        onBackToInput={handleBackToInput}
      />
    );
  }

  // FIRST PAGE — NEW ORDER
  // When NEW ORDER CREATE is opened, show ONLY ONE LARGE EMPTY TEXT BOX and OK / PROCESS ORDER button.
  return <NewOrderInputPage onProcessOrder={handleProcessOrder} onBack={onBack} />;
};
