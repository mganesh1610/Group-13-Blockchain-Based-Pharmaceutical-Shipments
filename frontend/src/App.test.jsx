import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

describe("ColdChain Provenance app", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({})
      })
    );

    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn()
      }
    });
  });

  it("renders a launch-ready product shell without interim-demo wording", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /coldchain provenance/i })).toBeInTheDocument();
    expect(screen.getByText(/pharmaceutical cold chain/i)).toBeInTheDocument();
    expect(screen.queryByText(/interim demo/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connect stakeholder wallet/i })).toBeInTheDocument();
  });

  it("presents production stakeholder access before sandbox tooling", () => {
    render(<App />);

    const sidebar = screen.getByRole("complementary", { name: /control sidebar/i });

    expect(within(sidebar).getByText(/stakeholder access/i)).toBeInTheDocument();
    expect(within(sidebar).getByText(/no wallet connected/i)).toBeInTheDocument();
    expect(within(sidebar).getByRole("button", { name: /connect organization wallet/i })).toBeInTheDocument();
    expect(within(sidebar).getByLabelText(/batch id/i)).toHaveValue("BATCH001");
    expect(within(sidebar).queryByRole("link", { name: /manufacturer portal/i })).not.toBeInTheDocument();
    expect(within(sidebar).queryByRole("link", { name: /regulator review/i })).not.toBeInTheDocument();
    expect(within(sidebar).getByRole("link", { name: /consumer verification/i })).toBeInTheDocument();
    expect(within(sidebar).getByText(/developer sandbox/i)).toBeInTheDocument();
  });

  it("shows only public read-only pages before a stakeholder role is connected", () => {
    render(<App />);

    const nav = screen.getByRole("navigation", { name: /primary navigation/i });

    ["Dashboard", "Batch Trace", "Consumer Verify", "Tamper Check"].forEach((label) => {
      expect(within(nav).getByRole("link", { name: label })).toBeInTheDocument();
    });

    ["Admin Access", "Register Batch", "Transfer Custody", "Status Update", "Condition Logs", "Regulator Review"].forEach(
      (label) => {
        expect(within(nav).queryByRole("link", { name: label })).not.toBeInTheDocument();
      }
    );
  });

  it("blocks restricted workspaces until the connected wallet has the required role", () => {
    window.history.pushState({}, "", "/admin/access");
    render(<App />);

    expect(screen.getByRole("heading", { name: /admin access/i })).toBeInTheDocument();
    expect(screen.getByText(/restricted workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/required role: admin/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /connect stakeholder wallet/i }).length).toBeGreaterThan(0);
  });

  it("keeps MetaMask write forms behind role-specific access gates", () => {
    window.history.pushState({}, "", "/register");
    render(<App />);

    expect(screen.getByRole("heading", { name: /register batch/i })).toBeInTheDocument();
    expect(screen.getByText(/required role: manufacturer/i)).toBeInTheDocument();

    window.history.pushState({}, "", "/regulator");
    render(<App />);

    expect(screen.getByRole("heading", { name: /regulator review/i })).toBeInTheDocument();
    expect(screen.getByText(/required role: regulator/i)).toBeInTheDocument();
  });

  it("keeps consumer verification read-only and wallet-free", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("link", { name: "Consumer Verify" }));

    expect(screen.getByRole("heading", { name: /consumer batch check/i })).toBeInTheDocument();
    expect(screen.getByText(/does not require metamask/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /verify batch/i })).toBeInTheDocument();
  });

  it("shows the tamper-evidence verification panel", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("link", { name: "Tamper Check" }));

    expect(screen.getByRole("heading", { name: /verify off-chain log hash/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /run hash verification/i })).toBeInTheDocument();
    expect(screen.getByText(/compare a file against the anchored digest/i)).toBeInTheDocument();
  });
});
