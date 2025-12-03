import useSWR from "swr";
import { api } from "@/lib/api";

export function useEmployees() {
  const { data, error, mutate } = useSWR("/api/employee/list", api);

  async function addEmployee(payload: any) {
    const res = await api("/api/employee", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    mutate();
    return res;
  }

  async function addBonus(employeeId: number, amount: number) {
    const res = await api(`/api/employee/${employeeId}/bonus`, {
      method: "POST",
      body: JSON.stringify({ amount }),
    });
    return res;
  }

  async function requestLeave(employeeId: number, payload: any) {
    return api(`/api/employee/${employeeId}/leave-request`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  return {
    employees: data?.employees || [],
    loading: !data && !error,
    addEmployee,
    addBonus,
    requestLeave
  };
}
