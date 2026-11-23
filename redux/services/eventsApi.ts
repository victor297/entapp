import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "./baseQueryWithReauth";

export enum ServiceType {
  EVENTCENTERS = "EVENTCENTERS",
  CATERING = "CATERING",
  ALL = "ALL",
}

export interface EventCenter {
  id: string;
  serviceProviderId: string;
  name: string;
  eventTypes: string[];
  discountPercentage: number;
  depositPercentage: number;
  description: string;
  pricingPerSlot: number;
  sittingCapacity: number;
  venueLayout: string;
  amenities: string[];
  images: string[];
  termsOfUse: string;
  cancellationPolicy: string;
  streetAddress: string;
  streetAddress2: string | null;
  city: string;
  location: string;
  postal: string;
  status: string;
  paymentRequired: boolean;
  subscriptionStatus?: string | null;
  subscriptionExpiry?: string | null;
  subscriptionPlanId?: string | null;
  rating: number | null;
  contact: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deletedBy: string | null;
}

export interface EventCentersResponse {
  count: number;
  data: EventCenter[];
}

export interface EventCenterQuery {
  limit: number;
  offset: number;
  city?: string;
  location?: string;
  search?: string;
  eventTypes?: string[];
  amenities?: string[];
  minCapacity?: number;
  maxPrice?: number;
}

export interface CreateEventCenterRequest {
  serviceProviderId: string;
  name: string;
  eventTypes: string[];
  discountPercentage?: number;
  depositPercentage: number;
  description: string;
  pricingPerSlot: number;
  sittingCapacity: number;
  venueLayout: string;
  amenities: string[];
  termsOfUse: string;
  cancellationPolicy: string;
  streetAddress: string;
  streetAddress2?: string | null;
  city: string;
  location: string;
  contact: string;
  postal: string;
  status: string;
  // ❌ no `images` here since upload handled separately
}
export interface Country {
  id: string;
  name: string;
  code: string;
  currency: string;
  currencyCode: string;
  currencySymbol: string;
}

export interface CountryResponse {
  count: number;
  docs: Country[];
}

export interface State {
  deletedAt?: string | null;
  id: string;
  name: string;
  code: string;
  countryId: string;
}

export interface StateResponse {
  count: number;
  docs: State[];
}
export const eventsApi = createApi({
  reducerPath: "eventsApi",
  tagTypes: ["EventCenter"],
  baseQuery: baseQueryWithReauth,
  endpoints: (builder) => ({
    getEventCenters: builder.query<
      EventCentersResponse,
      EventCenterQuery
    >({
      query: ({ eventTypes, amenities, ...params }) => ({
        url: "/event-centers",
        params: {
          ...params,
          eventTypes: eventTypes?.length ? eventTypes.join(",") : undefined,
          amenities: amenities?.length ? amenities.join(",") : undefined,
        },
        method: "GET",
      }),
      providesTags: (result) =>
        result
          ? [...result.data.map(({ id }) => ({ type: "EventCenter" as const, id })), { type: "EventCenter", id: "LIST" }]
          : [{ type: "EventCenter", id: "LIST" }],
    }),
    getEventCenterById: builder.query<EventCenter, string>({
      query: (id) => ({
        url: `/event-centers/${id}`,
        method: "GET",
      }),
      providesTags: (_result, _err, id) => [{ type: "EventCenter", id }],
    }),
    getEventCentersByServiceProvider: builder.query<
      EventCentersResponse,
      {
        serviceProviderId: string;
        limit: number;
        offset: number;
      }
    >({
      query: ({ serviceProviderId, limit, offset }) => ({
        url: `/event-centers?serviceProvider=${serviceProviderId}&limit=${limit}&offset=${offset}`,
        method: "GET",
      }),
      transformResponse: (response: EventCentersResponse) => ({
        ...response,
        data: [...response.data].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
      }),
      providesTags: (result) =>
        result
          ? [...result.data.map(({ id }) => ({ type: "EventCenter" as const, id })), { type: "EventCenter", id: "LIST" }]
          : [{ type: "EventCenter", id: "LIST" }],
    }),
    createEventCenter: builder.mutation<EventCenter, CreateEventCenterRequest>({
      query: (formData) => ({
        url: "/event-centers/create",
        method: "POST",
        body: formData,
        headers: {
          "Content-Type": "application/json",
        },
      }),
      invalidatesTags: [{ type: "EventCenter", id: "LIST" }],
    }),
    uploadEventCenterImages: builder.mutation<
      EventCenter,
      { eventCenterId: string; images: File[] }
    >({
      query: ({ eventCenterId, images }) => {
        const formData = new FormData();
        images.forEach((file) => {
          formData.append("imagefiles", file);
        });

        return {
          url: `/event-centers/${eventCenterId}`,
          method: "POST",
          body: formData,
        };
      },
      invalidatesTags: (_result, _err, { eventCenterId }) => [{ type: "EventCenter", id: eventCenterId }, { type: "EventCenter", id: "LIST" }],
    }),
    updateEventCenter: builder.mutation<
      EventCenter,
      Partial<EventCenter> & { id: string }
    >({
      query: ({ id, ...patch }) => ({
        url: `/event-centers/${id}`,
        method: "PATCH",
        body: patch,
        headers: {
          "Content-Type": "application/json",
        },
      }),
      invalidatesTags: (_result, _err, { id }) => [{ type: "EventCenter", id }, { type: "EventCenter", id: "LIST" }],
    }),
    deleteEventCenter: builder.mutation<void, string>({
      query: (id) => ({
        url: `/event-centers/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _err, id) => [{ type: "EventCenter", id }, { type: "EventCenter", id: "LIST" }],
    }),
    getCountries: builder.query<CountryResponse, { limit?: number; offset?: number }>({
      query: ({ limit = 10, offset = 0 }) => ({
        url: `/admin/country?limit=${limit}&offset=${offset}`,
        method: "GET",
      }),
    }),
    getStates: builder.query<StateResponse, { limit?: number; offset?: number; countryId?: string; search?: string }>({
      query: ({ limit = 10, offset = 0, countryId, search }) => ({
        url: "/admin/state",
        params: { limit, offset, countryId, search },
        method: "GET",
      }),
    }),
    getEventCentersByLocation: builder.query<EventCentersResponse, { locationId: string; limit?: number; offset?: number }>({
      query: ({ locationId, limit = 10, offset = 0 }) => ({
        url: `/event-centers?limit=${limit}&offset=${offset}&location=${locationId}`,
        method: "GET",
      }),
      providesTags: (result) =>
        result
          ? [...result.data.map(({ id }) => ({ type: "EventCenter" as const, id })), { type: "EventCenter", id: "LIST" }]
          : [{ type: "EventCenter", id: "LIST" }],
    }),
    getEventCentersByCity: builder.query<
      EventCentersResponse,
      { city: string; limit?: number; offset?: number }
    >({
      query: ({ city, limit = 10, offset = 0 }) => ({
        url: `/event-centers?city=${encodeURIComponent(city)}&limit=${limit}&offset=${offset}`,
        method: "GET",
      }),
      providesTags: (result) =>
        result
          ? [...result.data.map(({ id }) => ({ type: "EventCenter" as const, id })), { type: "EventCenter", id: "LIST" }]
          : [{ type: "EventCenter", id: "LIST" }],
    }),
  }),
});

export const {
  useGetEventCentersQuery,
  useGetEventCenterByIdQuery,
  useGetEventCentersByServiceProviderQuery,
  useCreateEventCenterMutation,
  useUploadEventCenterImagesMutation,
  useUpdateEventCenterMutation,
  useDeleteEventCenterMutation,
  useGetEventCentersByCityQuery,
  useGetCountriesQuery,
  useGetStatesQuery,
  useGetEventCentersByLocationQuery,
} = eventsApi;
