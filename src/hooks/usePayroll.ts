import useSWR from "swr";
import { api } from "@/lib/api";

export function usePayroll() {
  const { data, error, mutate } = useSWR("/api/payroll/list", api);

  async function generatePayroll(year: number, month: number) {
    const res = await api(`/api/payroll/generate/${year}/${month}`, {
      method: "POST"
    });
    mutate();
    return res;
  }

  async function markPaid(id: number) {
    const res = await api(`/api/payroll/${id}/mark-paid`, {
      method: "PATCH"
    });
    mutate();
    return res;
  }

  return {
    payroll: data?.payrolls || [],
    loading: !data && !error,
    generatePayroll,
    markPaid
  };
}
