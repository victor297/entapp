"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useOperationMutationMutation, useOperationRecordQuery } from "@/redux/services/operationsApi";
import { ApiError, buttonClass, fieldClass, Message } from "@/components/operations/Workspace";

type RefundPolicyTier = {
  id?: string;
  minDaysBeforeEvent: number;
  deductionPercentage: number;
  description?: string | null;
};

type RefundPolicy = {
  allowRefunds: boolean;
  refundWindowDays: number;
  tiers: RefundPolicyTier[];
};

type PolicyTierForm = {
  minDaysBeforeEvent: string;
  deductionPercentage: string;
  description: string;
};

const emptyTier = (): PolicyTierForm => ({
  minDaysBeforeEvent: "0",
  deductionPercentage: "0",
  description: "",
});

export default function RefundPolicySection({
  serviceId,
  serviceType,
  serviceProviderId,
}: {
  serviceId: string;
  serviceType: "event-center" | "catering";
  serviceProviderId: string;
}) {
  const { user } = useCurrentUser();
  const resource = serviceType === "catering" ? "catering" : "event-centers";
  const result = useOperationRecordQuery(
    `/${resource}/${encodeURIComponent(serviceId)}/refund-policy`,
    { skip: !serviceId },
  );
  const [mutate, mutation] = useOperationMutationMutation();
  const policy = result.data as RefundPolicy | undefined;
  const canManage = Boolean(
    user &&
      (user.userType === "ADMIN" ||
        (user.userType === "SERVICE_PROVIDER" && user.id === serviceProviderId)),
  );
  const [allowRefunds, setAllowRefunds] = useState(true);
  const [refundWindowDays, setRefundWindowDays] = useState("3");
  const [tiers, setTiers] = useState<PolicyTierForm[]>([emptyTier()]);
  const [notice, setNotice] = useState("");
  const [saveError, setSaveError] = useState<unknown>();

  useEffect(() => {
    if (!policy) return;
    setAllowRefunds(policy.allowRefunds);
    setRefundWindowDays(String(policy.refundWindowDays));
    setTiers(
      policy.tiers.length
        ? policy.tiers.map((tier) => ({
            minDaysBeforeEvent: String(tier.minDaysBeforeEvent),
            deductionPercentage: String(tier.deductionPercentage),
            description: tier.description ?? "",
          }))
        : [],
    );
  }, [policy]);

  async function savePolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setSaveError(undefined);
    const body = {
      allowRefunds,
      refundWindowDays: Number(refundWindowDays),
      tiers: tiers.map((tier) => ({
        minDaysBeforeEvent: Number(tier.minDaysBeforeEvent),
        deductionPercentage: Number(tier.deductionPercentage),
        description: tier.description.trim() || undefined,
      })),
    };
    try {
      await mutate({
        url: `/${resource}/${encodeURIComponent(serviceId)}/refund-policy`,
        method: "POST",
        body,
      }).unwrap();
      await result.refetch();
      setNotice("Refund policy saved.");
    } catch (error) {
      setSaveError(error);
    }
  }

  return (
    <section className="my-6 rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
      <h2 className="text-xl font-semibold text-gray-900">Refund policy</h2>
      {result.isFetching && <Message>Loading refund policy…</Message>}
      {result.error && <ApiError error={result.error} retry={result.refetch} />}
      {!result.error && policy && (
        <div className="mt-4 space-y-3 text-sm text-gray-700">
          {policy.allowRefunds ? (
            <>
              <p>
                Refunds are available when requested at least{" "}
                <strong>{policy.refundWindowDays} days</strong> before the event.
              </p>
              {policy.tiers.length ? (
                <ul className="list-disc space-y-2 pl-5">
                  {[...policy.tiers]
                    .sort((a, b) => b.minDaysBeforeEvent - a.minDaysBeforeEvent)
                    .map((tier, index) => (
                      <li key={tier.id ?? `${tier.minDaysBeforeEvent}-${index}`}>
                        At least {tier.minDaysBeforeEvent} days before the event:
                        {" "}{tier.deductionPercentage}% deducted from the refund.
                        {tier.description ? ` ${tier.description}` : ""}
                      </li>
                    ))}
                </ul>
              ) : (
                <p>No tiered refund deductions are specified.</p>
              )}
            </>
          ) : (
            <p>Refunds are not offered for this service.</p>
          )}
        </div>
      )}
      {!result.isFetching && !result.error && !policy && (
        <p className="mt-3 text-sm text-gray-600">
          No refund policy has been published for this service.
        </p>
      )}

      {canManage && (
        <form onSubmit={savePolicy} className="mt-6 space-y-4 border-t pt-5">
          <h3 className="font-semibold text-gray-900">
            {policy ? "Update refund policy" : "Set a refund policy"}
          </h3>
          {notice && <Message>{notice}</Message>}
          {Boolean(saveError) && <ApiError error={saveError} />}
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={allowRefunds}
              onChange={(event) => setAllowRefunds(event.target.checked)}
            />
            Allow refunds
          </label>
          {allowRefunds && (
            <>
              <label className="block text-sm text-gray-700">
                Minimum notice for a refund (days)
                <input
                  className={`${fieldClass} mt-1`}
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={refundWindowDays}
                  onChange={(event) => setRefundWindowDays(event.target.value)}
                />
              </label>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-medium text-gray-800">Refund tiers</h4>
                  <button
                    type="button"
                    className="text-sm font-medium text-blue-800 underline"
                    onClick={() => setTiers((current) => [...current, emptyTier()])}
                  >
                    Add tier
                  </button>
                </div>
                {tiers.map((tier, index) => (
                  <div
                    className="grid gap-3 rounded-lg border border-gray-200 p-3 sm:grid-cols-2"
                    key={index}
                  >
                    <label className="text-sm text-gray-700">
                      Minimum days before event
                      <input
                        className={`${fieldClass} mt-1`}
                        type="number"
                        min="0"
                        step="1"
                        required
                        value={tier.minDaysBeforeEvent}
                        onChange={(event) =>
                          setTiers((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, minDaysBeforeEvent: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </label>
                    <label className="text-sm text-gray-700">
                      Refund deduction (%)
                      <input
                        className={`${fieldClass} mt-1`}
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        required
                        value={tier.deductionPercentage}
                        onChange={(event) =>
                          setTiers((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, deductionPercentage: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </label>
                    <label className="text-sm text-gray-700 sm:col-span-2">
                      Description (optional)
                      <input
                        className={`${fieldClass} mt-1`}
                        maxLength={500}
                        value={tier.description}
                        onChange={(event) =>
                          setTiers((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, description: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="text-left text-sm text-red-700 underline sm:col-span-2"
                      onClick={() =>
                        setTiers((current) => current.filter((_, itemIndex) => itemIndex !== index))
                      }
                    >
                      Remove tier
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          <button className={buttonClass} disabled={mutation.isLoading}>
            {mutation.isLoading ? "Saving…" : "Save refund policy"}
          </button>
        </form>
      )}
    </section>
  );
}
