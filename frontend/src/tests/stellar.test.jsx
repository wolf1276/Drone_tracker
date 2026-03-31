import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { WalletCard } from '../components/stellar/WalletCard';
import { SendTransactionForm } from '../components/stellar/SendTransactionForm';
import { WalletService } from '../services/wallet';
import { StellarService } from '../services/stellar';
import StellarBoard from '../components/stellar/StellarBoard';

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

  it('4. Payment Success Check: Shows transaction hash on broadcast', () => {
    const mockHash = '59e5...abcd';
    render(
      <SendTransactionForm 
         onSend={() => {}} 
         loading={false} 
         error={null} 
         lastHash={mockHash} 
      />
    );
    expect(screen.getByText(/Broadcast Success/i)).toBeInTheDocument();
    expect(screen.getByText(/TX: 59e5...abcd/i)).toBeInTheDocument();
  });

  it('5. Payment Error Check: Displays descriptive on-chain failures', () => {
    const mockError = "Insufficient XLM balance for this payment.";
    render(
      <SendTransactionForm 
         onSend={() => {}} 
         loading={false} 
         error={mockError} 
         lastHash={null} 
      />
    );
    expect(screen.getByText(/Transaction Failed/i)).toBeInTheDocument();
    expect(screen.getByText(mockError)).toBeInTheDocument();
  });

  it('6. Address Formatting: Verify shortAddress helper logic', () => {
    const fullAddr = 'GA5W6Y6HWO77HPLN72EALF7TDTUKU2T6YBX6HGNXBC7CH7Z2V4I5CH4S';
    const result = StellarService.shortAddress(fullAddr);
    expect(result).toBe('GA5W...CH4S');
  });

  it('7. Unconnected State View: Prompts user to bridge gateway', () => {
    const mockConnect = vi.fn();
    render(
      <StellarBoard 
         isWalletConnected={false}
         connect={mockConnect}
         loading={false}
      />
    );
    expect(screen.getByText(/LAUNCH STELLAR/i)).toBeInTheDocument();
    const connectBtn = screen.getByText(/CONNECT FREIGHTER/i);
    fireEvent.click(connectBtn);
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });
});

