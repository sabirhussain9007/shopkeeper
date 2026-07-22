"use client";

import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/card";
import { BlockLoader } from "@/components/ui/loader";
import { currency, formatPakistanDate } from "@/lib/utils";
import type { EmployeeInput } from "@/types";

type Employee = EmployeeInput & {
  _id: string;
  employeeId?: string;
  dateOfBirth?: string | Date | null;
  joiningDate?: string | Date;
};

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 font-medium capitalize text-zinc-900 dark:text-zinc-100">{value}</p>
    </div>
  );
}

export function EmployeeProfile({ employeeId }: { employeeId: string }) {
  const profile = useQuery({
    queryKey: ["employees", employeeId],
    queryFn: async () => {
      const response = await fetch(`/api/employees/${employeeId}`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Unable to load employee");
      }
      return response.json() as Promise<Employee>;
    },
  });

  if (profile.isLoading) {
    return (
      <Surface>
        <BlockLoader label="Loading employee profile..." />
      </Surface>
    );
  }

  if (profile.isError || !profile.data) {
    return (
      <Surface>
        <p className="py-8 text-center text-zinc-500">{profile.error instanceof Error ? profile.error.message : "Employee not found."}</p>
        <div className="flex justify-center">
          <Button asChild variant="secondary">
            <Link href="/employees">
              <ArrowLeft className="h-4 w-4" />
              Back to Employees
            </Link>
          </Button>
        </div>
      </Surface>
    );
  }

  const employee = profile.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">{employee.fullName}</h2>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            {employee.employeeId ? `Employee ID: ${employee.employeeId}` : "Staff profile"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href="/employees">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
          <Button asChild>
            <Link href="/employees">
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          </Button>
        </div>
      </div>

      <Surface>
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          {employee.profileImage ? (
            <img src={employee.profileImage} alt={employee.fullName} className="h-28 w-28 rounded-2xl object-cover" />
          ) : (
            <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-zinc-100 text-2xl font-semibold text-zinc-400 dark:bg-zinc-800">
              {employee.fullName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="flex-1 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={employee.status === "active" ? "success" : "default"}>{employee.status}</Badge>
              <span className="text-sm capitalize text-zinc-500">{employee.employmentType.replaceAll("_", " ")}</span>
              <span className="text-sm capitalize text-zinc-500">{employee.shift} shift</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <ProfileField label="CNIC" value={employee.cnic} />
              <ProfileField label="Phone" value={employee.phone} />
              <ProfileField label="Email" value={employee.email || "—"} />
              <ProfileField label="Department" value={employee.department} />
              <ProfileField label="Designation" value={employee.designation} />
              <ProfileField label="Salary" value={currency(employee.salary)} />
              <ProfileField label="Date of Birth" value={formatPakistanDate(employee.dateOfBirth)} />
              <ProfileField label="Joining Date" value={formatPakistanDate(employee.joiningDate)} />
              <ProfileField label="Emergency Contact" value={employee.emergencyContact || "—"} />
            </div>
            <ProfileField label="Address" value={employee.address || "—"} />
            <ProfileField label="Notes" value={employee.notes || "—"} />
          </div>
        </div>
      </Surface>
    </div>
  );
}
