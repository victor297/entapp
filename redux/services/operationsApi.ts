import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "./baseQueryWithReauth";
import { type ApiRecord } from "@/lib/operations";
import { fetchScopedRecords, fetchCustomerBookings, operationError } from "@/lib/scoped-records";

type Query = { resource: string; params?: Record<string, string | number | undefined> };
export const operationsApi = createApi({
  reducerPath: "operationsApi", tagTypes: ["Operations"],
  baseQuery: baseQueryWithReauth,
  endpoints: builder => ({
    providerInvoices: builder.query<ApiRecord[], string>({
      async queryFn(userId, _api, _extra, baseQuery) {
        try {
          const bookings = await fetchScopedRecords(baseQuery, "/booking", { serviceProvider: userId });
          const rows: ApiRecord[] = await fetchScopedRecords(baseQuery, "/invoice", { userId });
          for (const booking of bookings.filter(row => row.serviceProvider === userId)) rows.push(...await fetchScopedRecords(baseQuery, "/invoice", { bookingId: booking.id }));
          return { data: [...new Map(rows.map(row => [row.id, row])).values()] };
        } catch (error) { return { error: operationError(error) }; }
      }, providesTags: ["Operations"],
    }),
    operationList: builder.query<ApiRecord[], Query>({
      async queryFn({ resource, params }, _api, _extra, baseQuery) {
        try { return { data: await fetchScopedRecords(baseQuery, resource, params) }; }
        catch (error) { return { error: operationError(error) }; }
      }, providesTags: ["Operations"],
    }),
    operationRecord: builder.query<ApiRecord, string>({ query: url => url, providesTags: ["Operations"] }),
    operationMutation: builder.mutation<ApiRecord, { url: string; method: "POST" | "PATCH" | "DELETE"; body?: unknown }>({
      query: args => ({ ...args, responseHandler: "content-type" }), invalidatesTags: ["Operations"],
    }),
    customerBookings: builder.query<ApiRecord[], string>({
      async queryFn(userId, _api, _extra, baseQuery) {
        try { return { data: await fetchCustomerBookings(baseQuery, userId) }; }
        catch (error) { return { error: operationError(error) }; }
      }, providesTags: ["Operations"],
    }),
  }),
});
export const { useOperationListQuery, useOperationRecordQuery, useOperationMutationMutation, useCustomerBookingsQuery, useProviderInvoicesQuery } = operationsApi;
