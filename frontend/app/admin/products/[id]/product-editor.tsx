"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  ApiError,
  LIMITS,
  PRODUCT_STATUSES,
  updateAdminProduct,
  type AdminProduct,
  type ProductStatus,
  type UpdateProductPayload,
} from "@/lib/api";

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

interface FormValues {
  description: string;
  seoTitle: string;
  seoDescription: string;
  status: ProductStatus;
}

function valuesOf(product: AdminProduct): FormValues {
  return {
    description: product.description,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    status: product.status,
  };
}

/** Mirrors the server's rules so the UI can flag problems before submitting. */
function fieldError(
  value: string,
  limit: number,
  label: string,
): string | null {
  if (value.trim().length === 0) return `${label} must not be empty.`;
  if (value.trim().length > limit)
    return `${label} must be ${limit} characters or fewer.`;
  return null;
}

export function ProductEditor({ product }: { product: AdminProduct }) {
  const router = useRouter();

  // The form owns its values. Nothing else may reset them — that is what makes
  // a failed save non-destructive.
  const [values, setValues] = useState<FormValues>(() => valuesOf(product));

  // What the server last confirmed as stored, used to detect unsaved changes.
  // Updated only after a successful save.
  const [savedValues, setSavedValues] = useState<FormValues>(() =>
    valuesOf(product),
  );

  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });

  const errors = {
    description: fieldError(
      values.description,
      LIMITS.description,
      "Description",
    ),
    seoTitle: fieldError(values.seoTitle, LIMITS.seoTitle, "SEO title"),
    seoDescription: fieldError(
      values.seoDescription,
      LIMITS.seoDescription,
      "SEO description",
    ),
  };
  const hasErrors = Object.values(errors).some(Boolean);

  const isDirty = (Object.keys(values) as (keyof FormValues)[]).some(
    (key) => values[key] !== savedValues[key],
  );

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    // Clear a previous outcome as soon as editing resumes, so a stale "Saved"
    // can never sit next to unsaved edits.
    setSaveState({ kind: "idle" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (hasErrors) return;

    setSaveState({ kind: "saving" });

    const payload: UpdateProductPayload = {
      description: values.description.trim(),
      seoTitle: values.seoTitle.trim(),
      seoDescription: values.seoDescription.trim(),
      status: values.status,
    };

    try {
      const updated = await updateAdminProduct(product.id, payload);

      // Only a confirmed save advances the baseline.
      setSavedValues(valuesOf(updated));
      setValues(valuesOf(updated));
      setSaveState({ kind: "saved" });
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiError && caught.isUnauthorized) {
        router.replace("/admin/login");
        return;
      }

      // Deliberately nothing here touches `values`: the user's edits stay on
      // screen so they can retry without retyping.
      setSaveState({
        kind: "error",
        message:
          caught instanceof ApiError
            ? caught.message
            : "Could not save. Please try again.",
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Product facts
        </h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Read-only. These come from the product catalogue and cannot be edited
          here.
        </p>

        <dl className="mt-4 space-y-3">
          <div>
            <dt className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
              Name
            </dt>
            <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-100">
              {product.name}
            </dd>
          </div>

          {product.characteristics.length > 0 ? (
            <div>
              <dt className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                Characteristics
              </dt>
              <dd className="mt-1.5">
                <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                  {product.characteristics.map((characteristic) => (
                    <li
                      key={characteristic.label}
                      className="flex flex-wrap justify-between gap-2 px-3 py-2 text-sm"
                    >
                      <span className="text-zinc-500 dark:text-zinc-400">
                        {characteristic.label}
                      </span>
                      <span className="text-zinc-900 dark:text-zinc-100">
                        {characteristic.value}
                      </span>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="space-y-5 rounded-xl border border-zinc-200 bg-white p-4 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Editable content
        </h2>

        <Field
          id="description"
          label="Description"
          error={errors.description}
          length={values.description.trim().length}
          limit={LIMITS.description}
        >
          <textarea
            id="description"
            rows={7}
            value={values.description}
            onChange={(e) => update("description", e.target.value)}
            className={inputClass(Boolean(errors.description))}
          />
        </Field>

        <Field
          id="seoTitle"
          label="SEO title"
          error={errors.seoTitle}
          length={values.seoTitle.trim().length}
          limit={LIMITS.seoTitle}
        >
          <input
            id="seoTitle"
            type="text"
            value={values.seoTitle}
            onChange={(e) => update("seoTitle", e.target.value)}
            className={inputClass(Boolean(errors.seoTitle))}
          />
        </Field>

        <Field
          id="seoDescription"
          label="SEO description"
          error={errors.seoDescription}
          length={values.seoDescription.trim().length}
          limit={LIMITS.seoDescription}
        >
          <textarea
            id="seoDescription"
            rows={3}
            value={values.seoDescription}
            onChange={(e) => update("seoDescription", e.target.value)}
            className={inputClass(Boolean(errors.seoDescription))}
          />
        </Field>

        <div>
          <label
            htmlFor="status"
            className="block text-sm font-medium text-zinc-800 dark:text-zinc-200"
          >
            Status
          </label>
          <select
            id="status"
            value={values.status}
            onChange={(e) => update("status", e.target.value as ProductStatus)}
            className={`${inputClass(false)} mt-1.5`}
          >
            {PRODUCT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status === "published" ? "Published" : "Draft"}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            Only published products appear in the public catalogue.
          </p>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saveState.kind === "saving" || hasErrors || !isDirty}
          className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {saveState.kind === "saving" ? "Saving…" : "Save changes"}
        </button>

        {/* Each outcome is distinct, and "Saved" appears only after the server
            confirms the write. */}
        {saveState.kind === "saved" ? (
          <span
            role="status"
            className="text-sm font-medium text-green-700 dark:text-green-400"
          >
            Saved
          </span>
        ) : null}

        {saveState.kind === "idle" && isDirty ? (
          <span className="text-sm text-amber-700 dark:text-amber-400">
            Unsaved changes
          </span>
        ) : null}
      </div>

      {saveState.kind === "error" ? (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300"
        >
          {saveState.message} Your changes are still here — you can try saving
          again.
        </p>
      ) : null}
    </form>
  );
}

function inputClass(hasError: boolean): string {
  const base =
    "w-full rounded-lg border bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-1 dark:bg-zinc-950 dark:text-zinc-100";
  return hasError
    ? `${base} border-red-400 focus:border-red-500 focus:ring-red-500`
    : `${base} border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-300 dark:focus:ring-zinc-300`;
}

function Field({
  id,
  label,
  error,
  length,
  limit,
  children,
}: {
  id: string;
  label: string;
  error: string | null;
  length: number;
  limit: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label
          htmlFor={id}
          className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
        >
          {label}
        </label>
        <span
          className={`text-xs tabular-nums ${
            length > limit
              ? "font-medium text-red-600 dark:text-red-400"
              : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          {length} / {limit}
        </span>
      </div>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </div>
  );
}
