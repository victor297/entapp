interface ListingSubscriptionStatusProps {
  status?: string | null;
  expiry?: string | null;
}

export default function ListingSubscriptionStatus({ status, expiry }: ListingSubscriptionStatusProps) {
  const expiryTime = expiry ? Date.parse(expiry) : NaN;
  const hasExpiry = Number.isFinite(expiryTime);
  const subscriptionStatus = status?.toUpperCase();
  const expired = subscriptionStatus === "EXPIRED" || (subscriptionStatus === "ACTIVE" && hasExpiry && expiryTime <= Date.now());
  const currentStatus = expired ? "EXPIRED" : subscriptionStatus;
  const label = currentStatus === "ACTIVE" ? "Active"
    : currentStatus === "EXPIRED" ? "Expired"
    : currentStatus === "PENDING" ? "Pending"
    : currentStatus === "INACTIVE" ? "Inactive"
    : currentStatus ? "Status unavailable" : "No subscription";
  const color = currentStatus === "ACTIVE" ? "bg-green-50 text-green-700"
    : currentStatus === "EXPIRED" ? "bg-red-50 text-red-700"
    : currentStatus === "PENDING" ? "bg-amber-50 text-amber-800"
    : "bg-gray-100 text-gray-700";

  return (
    <div className="space-y-1">
      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${color}`}>{label}</span>
      {hasExpiry && (
        <p className="text-xs text-gray-500">
          {expired ? "Expired" : "Expires"} {new Date(expiryTime).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
        </p>
      )}
    </div>
  );
}
