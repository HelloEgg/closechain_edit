import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, AlertCircle } from "lucide-react";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      status: {
        not_submitted: "bg-gray-100 text-gray-700 border border-gray-200",
        uploaded: "bg-amber-50 text-amber-700 border border-amber-200",
        approved: "bg-emerald-50 text-emerald-700 border border-emerald-200",
        active: "bg-blue-50 text-blue-700 border border-blue-200",
        archived: "bg-gray-100 text-gray-600 border border-gray-200",
      },
    },
    defaultVariants: {
      status: "not_submitted",
    },
  }
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  showIcon?: boolean;
  label?: string;
}

const statusLabels: Record<string, string> = {
  not_submitted: "Not Submitted",
  uploaded: "Pending Review",
  approved: "Approved",
  active: "Active",
  archived: "Archived",
};

export function StatusBadge({
  className,
  status,
  showIcon = true,
  label,
  ...props
}: StatusBadgeProps) {
  const displayLabel = label || (status ? statusLabels[status] : "Unknown");

  return (
    <div className={cn(badgeVariants({ status }), className)} {...props}>
      {showIcon && status === "not_submitted" && <AlertCircle className="w-3.5 h-3.5" />}
      {showIcon && status === "uploaded" && <Clock className="w-3.5 h-3.5" />}
      {showIcon && status === "approved" && <CheckCircle2 className="w-3.5 h-3.5" />}
      {showIcon && status === "active" && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
      {displayLabel}
    </div>
  );
}
