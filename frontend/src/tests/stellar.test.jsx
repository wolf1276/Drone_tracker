import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { WalletCard } from '../components/stellar/WalletCard';
import { SendTransactionForm } from '../components/stellar/SendTransactionForm';
import { WalletService } from '../services/wallet';
import { StellarService } from '../services/stellar';

// Mock Services
vi.mock('../services/wallet', () => ({
  WalletService: {
    connect: vi.fn(),
    isInstalled: vi.fn(),
    signTransaction: vi.fn()
  }
}));

vi.mock('../services/stellar', () => ({
  StellarService: {
    getBalance: vi.fn(),
    createPaymentTransaction: vi.fn(),
    submitSignedTransaction: vi.fn(),
    shortAddress: (addr) => addr ? `${addr.substring(0,4)}...${addr.substring(addr.length - 4)}` : ''
  }
}));

describe('Stellar dApp Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Wallet connection UI test: displays address and balance', () => {
    const mockAddr = 'GBABCD1234567890';
    const mockBal = '10.5000';
    
    render(
      <WalletCard 
        address={mockAddr} 
        balance={mockBal} 
        onDisconnect={() => {}} 
        onRefresh={() => {}} 
        loading={false} 
      />
    );
    
    expect(screen.getByText('10.5000')).toBeInTheDocument();
    expect(screen.getByText(/GBABCD.*7890/i)).toBeInTheDocument();
  });


  it('2. Balance fetch test: refreshes on button click', async () => {
    const mockRefresh = vi.fn();
    render(
      <WalletCard 
        address="GA..." 
        balance="5.0" 
        onDisconnect={() => {}} 
        onRefresh={mockRefresh} 
        loading={false} 
      />
    );

    const refreshBtn = screen.getByRole('button', { name: /refresh/i });
    fireEvent.click(refreshBtn);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('3. Transaction submission test: validates recipient and triggers onSend', async () => {
    const mockOnSend = vi.fn();
    render(
      <SendTransactionForm 
        onSend={mockOnSend} 
        loading={false} 
        error={null} 
        lastHash={null} 
      />
    );

    const recipientInput = screen.getByPlaceholderText('GABC...XYZ');
    const amountInput = screen.getByPlaceholderText('0.00');
    const submitBtn = screen.getByText(/BROADCAST TRANSACTION/i);

    // Invalid address
    fireEvent.change(recipientInput, { target: { value: 'short' } });
    fireEvent.change(amountInput, { target: { value: '10' } });
    fireEvent.click(submitBtn);
    
    expect(await screen.findByText(/Invalid recipient address/i)).toBeInTheDocument();
    expect(mockOnSend).not.toHaveBeenCalled();

    // Valid inputs
    const validAddr = 'GA5W6Y6HWO77HPLN72EALF7TDTUKU2T6YBX6HGNXBC7CH7Z2V4I5CH4S';
    fireEvent.change(recipientInput, { target: { value: validAddr } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockOnSend).toHaveBeenCalledWith(validAddr, '10');
    }, { timeout: 2000 });
  });
});

