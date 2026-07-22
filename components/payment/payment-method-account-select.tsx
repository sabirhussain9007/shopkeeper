"use client";

import { Select } from "@/components/ui/select";
import {
  encodeAccountPaymentValue,
  formatShopPaymentAccountLabel,
  type ShopPaymentAccount,
} from "@/lib/payment-accounts";

type BaseMethod = {
  value: string;
  label: string;
};

type PaymentMethodAccountSelectProps = {
  id?: string;
  className?: string;
  value: string;
  onChange: (value: string) => void;
  accounts: ShopPaymentAccount[];
  accountsLoading?: boolean;
  baseMethods: BaseMethod[];
  accountsGroupLabel?: string;
  emptyAccountsHint?: string;
};

export function PaymentMethodAccountSelect({
  id,
  className,
  value,
  onChange,
  accounts,
  accountsLoading = false,
  baseMethods,
  accountsGroupLabel = "Shop accounts",
  emptyAccountsHint,
}: PaymentMethodAccountSelectProps) {
  return (
    <div>
      <Select id={id} className={className} value={value} onChange={(e) => onChange(e.target.value)}>
        {baseMethods.map((method) => (
          <option key={method.value} value={method.value}>
            {method.label}
          </option>
        ))}
        {accounts.length > 0 ? (
          <optgroup label={accountsGroupLabel}>
            {accounts.map((account) => (
              <option key={account._id} value={encodeAccountPaymentValue(account._id)}>
                {formatShopPaymentAccountLabel(account)}
              </option>
            ))}
          </optgroup>
        ) : null}
      </Select>
      {!accountsLoading && accounts.length === 0 && emptyAccountsHint ? (
        <p className="mt-1 text-xs text-amber-700">{emptyAccountsHint}</p>
      ) : null}
    </div>
  );
}

type PaymentAccountSelectProps = {
  id?: string;
  className?: string;
  value: string;
  onChange: (value: string) => void;
  accounts: ShopPaymentAccount[];
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  emptyAccountsHint?: string;
};

export function PaymentAccountSelect({
  id,
  className,
  value,
  onChange,
  accounts,
  placeholder = "Select account",
  allowEmpty = false,
  emptyLabel = "Select account",
  emptyAccountsHint,
}: PaymentAccountSelectProps) {
  return (
    <div>
      <Select id={id} className={className} value={value} onChange={(e) => onChange(e.target.value)}>
        {allowEmpty ? <option value="">{emptyLabel}</option> : null}
        {accounts.map((account) => (
          <option key={account._id} value={account._id}>
            {formatShopPaymentAccountLabel(account)}
          </option>
        ))}
      </Select>
      {accounts.length === 0 && emptyAccountsHint ? (
        <p className="mt-1 text-xs text-amber-700">{emptyAccountsHint}</p>
      ) : null}
      {accounts.length === 0 && placeholder && !emptyAccountsHint ? (
        <p className="mt-1 text-xs text-zinc-500">{placeholder}</p>
      ) : null}
    </div>
  );
}
