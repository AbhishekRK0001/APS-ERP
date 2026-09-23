"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ApprovalActions({
  noticeId,
}: {
  noticeId: string;
}) {
  const router = useRouter();

  const [loading, setLoading] =
    useState<"APPROVE" | "REJECT" | null>(null);

  const [error, setError] = useState("");

  async function action(
    type: "APPROVE" | "REJECT"
  ) {
    setLoading(type);
    setError("");

    let reason = "";

    if (type === "REJECT") {
      reason =
        window.prompt(
          "Reason for rejection (optional):"
        ) || "";
    }

    try {
      const response = await fetch(
        `/api/notices/${noticeId}/approval`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            action: type,
            reason,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(
          data.message ||
            "Unable to process request."
        );

        return;
      }

      router.refresh();
    } catch {
      setError("Unable to process request.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="approval-actions">
      <button
        type="button"
        className="approve-button"
        disabled={loading !== null}
        onClick={() => action("APPROVE")}
      >
        {loading === "APPROVE"
          ? "Approving..."
          : "Approve"}
      </button>

      <button
        type="button"
        className="reject-button"
        disabled={loading !== null}
        onClick={() => action("REJECT")}
      >
        {loading === "REJECT"
          ? "Rejecting..."
          : "Reject"}
      </button>

      {error && (
        <p className="approval-error">
          {error}
        </p>
      )}
    </div>
  );
}
