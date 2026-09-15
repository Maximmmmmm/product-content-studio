import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminProduct } from "@/lib/api";

const mockReplace = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, refresh: mockRefresh }),
}));

// Only the network call is mocked. LIMITS, PRODUCT_STATUSES and ApiError stay
// real, so the test exercises the same limits the server enforces rather than
// a copy that could drift.
const mockUpdate = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, updateAdminProduct: mockUpdate };
});

const { ProductEditor } =
  await import("@/app/admin/products/[id]/product-editor");
const { ApiError } = await import("@/lib/api");

const product: AdminProduct = {
  id: "product-1",
  slug: "aurora-wireless-headphones",
  name: "Aurora Wireless Headphones",
  characteristics: [{ label: "Battery life", value: "Up to 30 hours" }],
  description: "Original description.",
  seoTitle: "Original SEO title",
  seoDescription: "Original SEO description.",
  status: "published",
  updatedAt: new Date().toISOString(),
};

function saveButton() {
  return screen.getByRole("button", { name: /save changes/i });
}

describe("ProductEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the read-only facts as text, not as editable fields", () => {
    render(<ProductEditor product={product} />);

    expect(screen.getByText("Aurora Wireless Headphones")).toBeInTheDocument();
    expect(screen.getByText("Up to 30 hours")).toBeInTheDocument();
    // There must be no input holding the name — it is not editable here.
    expect(
      screen.queryByDisplayValue("Aurora Wireless Headphones"),
    ).not.toBeInTheDocument();
  });

  it("does not save anything until Save is pressed", async () => {
    const user = userEvent.setup();
    render(<ProductEditor product={product} />);

    await user.type(screen.getByLabelText(/^description$/i), " edited");

    // Typing alone must never persist: the assignment requires an explicit
    // save action.
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("disables Save until something changes", async () => {
    const user = userEvent.setup();
    render(<ProductEditor product={product} />);

    expect(saveButton()).toBeDisabled();

    await user.type(screen.getByLabelText(/^description$/i), "!");
    expect(saveButton()).toBeEnabled();
  });

  /**
   * The assignment's key requirement for this screen: a failed save must not
   * erase the user's edits and must not be presented as success.
   */
  it("keeps the typed input and shows an error when saving fails", async () => {
    const user = userEvent.setup();
    mockUpdate.mockRejectedValue(
      new ApiError("SEO title must be 60 characters or fewer.", 400),
    );

    render(<ProductEditor product={product} />);

    const description = screen.getByLabelText(/^description$/i);
    await user.clear(description);
    await user.type(description, "Carefully written copy that must survive.");

    await user.click(saveButton());

    // The error is surfaced to the user...
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "SEO title must be 60 characters or fewer.",
    );

    // ...the edit is still on screen, character for character...
    expect(description).toHaveValue(
      "Carefully written copy that must survive.",
    );

    // ...and nothing claims the save succeeded.
    expect(screen.queryByText(/^saved$/i)).not.toBeInTheDocument();

    // The user can retry without retyping.
    expect(saveButton()).toBeEnabled();
  });

  it("keeps the typed input when the server is unreachable", async () => {
    const user = userEvent.setup();
    mockUpdate.mockRejectedValue(
      new ApiError("Could not reach the server.", 0),
    );

    render(<ProductEditor product={product} />);

    const seoTitle = screen.getByLabelText(/seo title/i);
    await user.clear(seoTitle);
    await user.type(seoTitle, "Draft title kept after failure");

    await user.click(saveButton());

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(seoTitle).toHaveValue("Draft title kept after failure");
    expect(screen.queryByText(/^saved$/i)).not.toBeInTheDocument();
  });

  it("reports success only after the server confirms the write", async () => {
    const user = userEvent.setup();
    mockUpdate.mockResolvedValue({
      ...product,
      description: "Saved description.",
    });

    render(<ProductEditor product={product} />);

    const description = screen.getByLabelText(/^description$/i);
    await user.clear(description);
    await user.type(description, "Saved description.");

    // Not yet — the request has not happened.
    expect(screen.queryByText(/^saved$/i)).not.toBeInTheDocument();

    await user.click(saveButton());

    expect(await screen.findByText(/^saved$/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mockUpdate).toHaveBeenCalledWith("product-1", {
      description: "Saved description.",
      seoTitle: "Original SEO title",
      seoDescription: "Original SEO description.",
      status: "published",
    });
  });

  it("clears a previous success message once editing resumes", async () => {
    const user = userEvent.setup();
    mockUpdate.mockResolvedValue({ ...product, description: "One." });

    render(<ProductEditor product={product} />);

    const description = screen.getByLabelText(/^description$/i);
    await user.clear(description);
    await user.type(description, "One.");
    await user.click(saveButton());
    expect(await screen.findByText(/^saved$/i)).toBeInTheDocument();

    await user.type(description, " Two.");

    // A stale "Saved" must never sit next to unsaved edits.
    expect(screen.queryByText(/^saved$/i)).not.toBeInTheDocument();
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
  });

  it("blocks saving an empty required field", async () => {
    const user = userEvent.setup();
    render(<ProductEditor product={product} />);

    await user.clear(screen.getByLabelText(/^description$/i));

    expect(saveButton()).toBeDisabled();
    expect(screen.getByText(/description must not be empty/i)).toBeVisible();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("blocks saving an over-length SEO title and shows the count", async () => {
    const user = userEvent.setup();
    render(<ProductEditor product={product} />);

    const seoTitle = screen.getByLabelText(/seo title/i);
    await user.clear(seoTitle);
    await user.type(seoTitle, "a".repeat(61));

    await waitFor(() => expect(saveButton()).toBeDisabled());
    expect(screen.getByText("61 / 60")).toBeInTheDocument();
    expect(
      screen.getByText(/seo title must be 60 characters or fewer/i),
    ).toBeVisible();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("redirects to the login page when the session has expired", async () => {
    const user = userEvent.setup();
    mockUpdate.mockRejectedValue(new ApiError("Not authenticated.", 401));

    render(<ProductEditor product={product} />);

    await user.type(screen.getByLabelText(/^description$/i), "!");
    await user.click(saveButton());

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/admin/login"),
    );
  });
});
