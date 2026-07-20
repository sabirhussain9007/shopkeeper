"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

type ListResponse<T> = {
  items: T[];
  total: number;
  page: number;
  pages: number;
};

type CrudParams = {
  q?: string;
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
};

function buildQuery(params: CrudParams) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  if (params.status) search.set("status", params.status);
  if (params.category) search.set("category", params.category);
  const query = search.toString();
  return query ? `?${query}` : "";
}

export function useCrud<TInput, TItem extends { _id: string }>(resource: string, initialParams: CrudParams = {}) {
  const queryClient = useQueryClient();
  const [params, setParams] = useState<CrudParams>({ page: 1, limit: 20, ...initialParams });
  const queryString = useMemo(() => buildQuery(params), [params]);

  const list = useQuery({
    queryKey: [resource, params],
    queryFn: async () => {
      const response = await fetch(`/api/${resource}${queryString}`);
      if (!response.ok) throw new Error("Unable to load data");
      return response.json() as Promise<ListResponse<TItem>>;
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [resource] });

  const create = useMutation({
    mutationFn: async (input: TInput) => {
      const response = await fetch(`/api/${resource}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to save");
      return data as TItem;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<TInput> }) => {
      const response = await fetch(`/api/${resource}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to update");
      return data as TItem;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/${resource}/${id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to delete");
      return data;
    },
    onSuccess: invalidate,
  });

  return { list, create, update, remove, params, setParams };
}
