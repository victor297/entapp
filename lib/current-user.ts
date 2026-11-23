import type { UserResponse } from "@/redux/services/authApi";

export type CurrentUser = Pick<UserResponse, "id" | "firstName" | "lastName" | "email" | "userType" | "status" | "isEmailVerified" | "serviceProvider">;
export function persistCurrentUser(user: UserResponse) {
  if (typeof window === "undefined") return;
  const profile: CurrentUser = {
    id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email,
    userType: user.userType, status: user.status, isEmailVerified: user.isEmailVerified,
    serviceProvider: user.serviceProvider ? {
      id: user.serviceProvider.id, businessName: user.serviceProvider.businessName,
      serviceType: user.serviceProvider.serviceType, businessLogo: user.serviceProvider.businessLogo,
      pricingInfo: user.serviceProvider.pricingInfo, regulations: user.serviceProvider.regulations,
      additionalInformation: user.serviceProvider.additionalInformation, workingHours: user.serviceProvider.workingHours,
      createdAt: user.serviceProvider.createdAt, updatedAt: user.serviceProvider.updatedAt,
    } : null,
  };
  localStorage.setItem(`current-user:${user.id}`, JSON.stringify(profile));
  window.dispatchEvent?.(new Event("auth-change"));
}

export function currentUserSnapshot(): string {
  const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
  const id = localStorage.getItem("user_id") || sessionStorage.getItem("user_id");
  if (!token || !id) return "";
  return JSON.stringify({ id, profile: localStorage.getItem(`current-user:${id}`) });
}
