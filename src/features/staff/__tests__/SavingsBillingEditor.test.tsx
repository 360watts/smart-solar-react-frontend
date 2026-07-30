import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SavingsBillingEditor from '../SavingsBillingEditor';
import { apiService } from '../../../services/api';

jest.mock('../../../services/api');

const baseData = {
  id: 1,
  electricityBill: {
    amount: 4200,
    period: 'July 2026',
    billingMonths: 1,
    status: 'due',
    estimateAmount: null as number | null,
    actualAmount: null as number | null,
  },
  consumption: {
    totalUnitsWithoutSolar: 500,
    solarUnits: 300,
    ebImportUnits: 100,
    ebExportUnits: 50,
    evUnits: 0,
  },
  savings: {
    billWithoutSolar: 6000,
    savingsAmount: 1800,
    savingsPercentage: 30,
  },
  investment: {
    upfrontAmount: 200000,
    savedAmount: 15000,
    monthsToBreakEven: 24,
    breakEvenDate: null,
  },
  data_quality: {
    coverage_pct: 95,
    days_with_data: 29,
    days_in_period: 30,
    source: 'inverter' as const,
    estimate_status: 'estimated' as const,
  },
};

const mockGetSiteSavings = apiService.getSiteSavings as jest.Mock;

describe('SavingsBillingEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders bill amount and period', async () => {
    mockGetSiteSavings.mockResolvedValue(baseData);
    render(<SavingsBillingEditor siteId="coim_002" />);
    expect(await screen.findByText('July 2026')).toBeInTheDocument();
    expect(screen.getByText('₹4,200.00')).toBeInTheDocument();
  });

  test('shows amber Estimated pill when estimated and coverage >= 80', async () => {
    mockGetSiteSavings.mockResolvedValue(baseData);
    render(<SavingsBillingEditor siteId="coim_002" />);
    expect(await screen.findByText('Estimated')).toBeInTheDocument();
  });

  test('shows red Low data coverage pill when coverage < 80', async () => {
    mockGetSiteSavings.mockResolvedValue({
      ...baseData,
      data_quality: { ...baseData.data_quality, coverage_pct: 50 },
    });
    render(<SavingsBillingEditor siteId="coim_002" />);
    expect(await screen.findByText('Low data coverage')).toBeInTheDocument();
  });

  test('shows green Reconciled pill when reconciled', async () => {
    mockGetSiteSavings.mockResolvedValue({
      ...baseData,
      data_quality: { ...baseData.data_quality, estimate_status: 'reconciled' },
    });
    render(<SavingsBillingEditor siteId="coim_002" />);
    expect(await screen.findByText('Reconciled')).toBeInTheDocument();
  });

  test('clicking toggle reveals coverage/days/source detail', async () => {
    mockGetSiteSavings.mockResolvedValue(baseData);
    render(<SavingsBillingEditor siteId="coim_002" />);
    await screen.findByText('July 2026');

    expect(screen.queryByText(/Coverage:/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Data quality'));

    await waitFor(() => {
      expect(screen.getByText(/Coverage: 95/)).toBeInTheDocument();
      expect(screen.getByText(/29 \/ 30 days with data/)).toBeInTheDocument();
      expect(screen.getByText(/Source: inverter/)).toBeInTheDocument();
    });
  });

  test('renders variance caption only when both estimateAmount and actualAmount present', async () => {
    mockGetSiteSavings.mockResolvedValue(baseData);
    const { rerender } = render(<SavingsBillingEditor siteId="coim_002" />);
    await screen.findByText('July 2026');
    expect(screen.queryByText(/Est\. was/)).not.toBeInTheDocument();

    mockGetSiteSavings.mockResolvedValue({
      ...baseData,
      electricityBill: { ...baseData.electricityBill, estimateAmount: 4000, actualAmount: 4200 },
    });
    rerender(<SavingsBillingEditor siteId="coim_002-2" />);

    await waitFor(() => {
      expect(screen.getByText(/Est\. was ₹4,000\.00 · actual ₹4,200\.00 \(\+5\.0%\)/)).toBeInTheDocument();
    });
  });
});
