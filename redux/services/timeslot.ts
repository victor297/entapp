import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "./baseQueryWithReauth";

export interface TimeSlot {
  id: string;
  serviceId: string;
  serviceType: "CATERING" | "EVENTCENTER";
  bookingId: string | null;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  previousBookings: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
}

export interface CreateTimeSlotRequest {
  serviceId: string;
  serviceType: "CATERING" | "EVENTCENTER";
  createdBy: string;
  slots: {
    startTime: string;
    endTime: string;
  }[];
}
export interface TimeSlotResponse {
  count: number;
  data: TimeSlot[];
}
export const timeslotApi = createApi({
  reducerPath: "timeslotApi",
  tagTypes: ["TimeSlot"],
  baseQuery: baseQueryWithReauth,
  endpoints: (builder) => ({
    createTimeSlots: builder.mutation<TimeSlot[], CreateTimeSlotRequest>({
      query: (payload) => ({
        url: "/timeslot",
        method: "POST",
        body: payload,
        headers: {
          "Content-Type": "application/json",
        },
      }),
      invalidatesTags: ["TimeSlot"],
    }),
    getTimeSlotsByServiceProvider: builder.query<
      TimeSlotResponse,
      { serviceId: string; limit?: number; offset?: number; date?: string }
    >({
      query: ({ serviceId, limit = 10, offset = 0, date }) => {
        const params = new URLSearchParams({
          serviceId,
          limit: limit.toString(),
          offset: offset.toString(),
        });
        if (date) {
          params.append("date", date);
        }
        return {
          url: `/timeslot?${params.toString()}`,
          method: "GET",
        };
      },
      providesTags: ["TimeSlot"],
    }),
    deleteTimeSlot: builder.mutation<{ message: string }, string>({
      query: (id) => ({
        url: `/timeslot/${id}`,
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      }),
      invalidatesTags: ["TimeSlot"],
    }),
  }),
});

export const {
  useCreateTimeSlotsMutation,
  useGetTimeSlotsByServiceProviderQuery,
  useDeleteTimeSlotMutation,
} = timeslotApi;
