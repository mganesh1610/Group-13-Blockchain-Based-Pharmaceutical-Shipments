import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

describe("ColdChain Provenance app", () => {
  beforeEach(() => {
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

  it("presents production stakeholder access before local demo tooling", () => {
    render(<App />);

    const sidebar = screen.getByRole("complementary", { name: /control sidebar/i });

    expect(within(sidebar).getByText(/stakeholder access/i)).toBeInTheDocument();
    expect(within(sidebar).getByText(/no wallet connected/i)).toBeInTheDocument();
    expect(within(sidebar).getByRole("button", { name: /connect organization wallet/i })).toBeInTheDocument();
    expect(within(sidebar).getByLabelText(/batch id/i)).toHaveValue("BATCH001");
    expect(within(sidebar).getByRole("link", { name: /manufacturer portal/i })).toBeInTheDocument();
    expect(within(sidebar).getByRole("link", { name: /regulator review/i })).toBeInTheDocument();
    expect(within(sidebar).getByText(/local demo tools/i)).toBeInTheDocument();
  });

  it("exposes all final project pages through primary navigation", () => {
    render(<App />);

    const nav = screen.getByRole("navigation", { name: /primary navigation/i });

    [
      "Dashboard",
      "Register",
      "Transfer",
      "Status",
      "Conditions",
      "Regulator",
      "Batch Trace",
      "Consumer Verify",
      "Tamper Check",
      "Demo Flow"
    ].forEach((label) => {
      expect(within(nav).getByRole("link", { name: label })).toBeInTheDocument();
    });
  });

  it("renders MetaMask write forms for registration and regulator actions", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("link", { name: "Register" }));

    expect(screen.getByRole("heading", { name: /register batch/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /submit registerbatch/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Regulator" }));

    expect(screen.getByRole("heading", { name: /add verification/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /submit recallbatch/i })).toBeInTheDocument();
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
