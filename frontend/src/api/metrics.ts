import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { MetricsOverview, PendingReturnsCourse, StockRow, UsageRow } from '@/lib/apiTypes';

export interface Period {
  year?: number;
  semester?: number;
}

export function useOverview(period: Period) {
  return useQuery({
    queryKey: ['metrics', 'overview', period],
    queryFn: async () =>
      (await api.get<MetricsOverview>('/metrics/overview', { params: period })).data,
  });
}

export function useStock() {
  return useQuery({
    queryKey: ['metrics', 'stock'],
    queryFn: async () => (await api.get<StockRow[]>('/metrics/stock')).data,
  });
}

export function useUsage(period: Period) {
  return useQuery({
    queryKey: ['metrics', 'usage', period],
    queryFn: async () => (await api.get<UsageRow[]>('/metrics/usage', { params: period })).data,
  });
}

export function usePendingReturns(period: Period) {
  return useQuery({
    queryKey: ['metrics', 'pending-returns', period],
    queryFn: async () =>
      (await api.get<PendingReturnsCourse[]>('/metrics/pending-returns', { params: period })).data,
  });
}
