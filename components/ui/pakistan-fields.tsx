"use client";

import { type ChangeEvent, type InputHTMLAttributes } from "react";
import { type FieldPath, type FieldValues, type UseFormRegister } from "react-hook-form";
import { Input } from "@/components/ui/input";
import {
  CNIC_PLACEHOLDER,
  MOBILE_PLACEHOLDER,
  formatCnicInput,
  formatMobileInput,
} from "@/lib/pakistan-validators";

function withFormattedChange(
  onChange: (event: ChangeEvent<HTMLInputElement>) => void,
  format: (value: string) => string,
) {
  return (event: ChangeEvent<HTMLInputElement>) => {
    event.target.value = format(event.target.value);
    onChange(event);
  };
}

export function bindCnicField<T extends FieldValues>(register: UseFormRegister<T>, name: FieldPath<T>) {
  const { onChange, ...rest } = register(name);
  return {
    ...rest,
    onChange: withFormattedChange(onChange, formatCnicInput),
  };
}

export function bindMobileField<T extends FieldValues>(register: UseFormRegister<T>, name: FieldPath<T>) {
  const { onChange, ...rest } = register(name);
  return {
    ...rest,
    onChange: withFormattedChange(onChange, formatMobileInput),
  };
}

export function CnicInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      spellCheck={false}
      placeholder={CNIC_PLACEHOLDER}
      maxLength={15}
      {...props}
    />
  );
}

export function MobileInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Input
      type="tel"
      inputMode="tel"
      autoComplete="tel-national"
      placeholder={MOBILE_PLACEHOLDER}
      maxLength={12}
      {...props}
    />
  );
}

export function formatMobileOnInput(event: ChangeEvent<HTMLInputElement>) {
  event.target.value = formatMobileInput(event.target.value);
}

export function formatCnicOnInput(event: ChangeEvent<HTMLInputElement>) {
  event.target.value = formatCnicInput(event.target.value);
}
