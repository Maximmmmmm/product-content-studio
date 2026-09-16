const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const LIMITS = {
  description: 1000,
  seoTitle: 60,
  seoDescription: 160,
} as const;

export const PRODUCT_STATUSES = ["draft", "published"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export interface Characteristic {
  label: string;
  value: string;
}

export interface AdminProductListItem {
  id: string;
  name: string;
  status: ProductStatus;
}

export interface AdminProduct {
  id: string;
  slug: string;
  name: string;
  characteristics: Characteristic[];
  description: string;
  seoTitle: string;
  seoDescription: string;
  status: ProductStatus;
  updatedAt: string;
}

export interface PublicProductListItem {
  slug: string;
  name: string;
  seoDescription: string;
}

export interface PublicProduct {
  slug: string;
  name: string;
  characteristics: Characteristic[];
  description: string;
  seoTitle: string;
  seoDescription: string;
}

export interface Admin {
  id: string;
  email: string;
}

export interface UpdateProductPayload {
  description: string;
  seoTitle: string;
  seoDescription: string;
  status: ProductStatus;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

interface NestErrorBody {
  message?: string | string[];
  error?: string;
}

function readErrorMessage(body: unknown, status: number): string {
  const parsed = body as NestErrorBody | null;
  const message = parsed?.message;

  if (Array.isArray(message) && message.length > 0) return message.join(" ");
  if (typeof message === "string" && message.length > 0) return message;
  if (status === 401) return "Your session has expired. Please sign in again.";

  return `Request failed (${status}).`;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(
      "Could not reach the server. Check that the API is running and try again.",
      0,
    );
  }

  if (!response.ok) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // Non-JSON error body; the status code below still gives a usable message.
    }
    throw new ApiError(
      readErrorMessage(body, response.status),
      response.status,
    );
  }

  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}

export function login(email: string, password: string): Promise<Admin> {
  return request<Admin>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function logout(): Promise<{ success: true }> {
  return request<{ success: true }>("/auth/logout", { method: "POST" });
}

export function getCurrentAdmin(): Promise<Admin> {
  return request<Admin>("/auth/me");
}

export function listAdminProducts(): Promise<AdminProductListItem[]> {
  return request<AdminProductListItem[]>("/admin/products");
}

export function getAdminProduct(id: string): Promise<AdminProduct> {
  return request<AdminProduct>(`/admin/products/${encodeURIComponent(id)}`);
}

export function updateAdminProduct(
  id: string,
  payload: UpdateProductPayload,
): Promise<AdminProduct> {
  return request<AdminProduct>(`/admin/products/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function listPublicProducts(): Promise<PublicProductListItem[]> {
  return request<PublicProductListItem[]>("/products");
}

export function getPublicProduct(slug: string): Promise<PublicProduct> {
  return request<PublicProduct>(`/products/${encodeURIComponent(slug)}`);
}
