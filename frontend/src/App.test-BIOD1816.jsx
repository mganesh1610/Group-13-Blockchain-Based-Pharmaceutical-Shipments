import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

describe("App shell", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false
      })
    );

    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn()
      }
    });
  });

  it("shows a launch-ready product header and keeps editable connection controls in the sidebar", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /coldchain provenance/i })).toBeInTheDocument();
    expect(screen.queryByText(/interim demo ui/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connect network/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /grant demo roles/i })).toBeInTheDocument();
    expect(screen.getByText(/edit connection details/i)).toBeInTheDocument();
  });

  it("keeps control center and provenance timeline together on the demo home view", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /control center/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /shipment overview/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /provenance timeline/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /connection details/i })).not.toBeInTheDocument();
    expect(screen.getByText(/edit connection details/i)).toBeInTheDocument();
  });

  it("places the register batch action directly after the batch id field", () => {
    render(<App />);

    const batchIdField = screen.getByLabelText(/batch id/i).closest("label");
    const registerButton = screen.getByRole("button", { name: /register batch/i });

    expect(batchIdField).not.toBeNull();
    expect(batchIdField.compareDocumentPosition(registerButton)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("renders the demo workspace as a fixed sidebar with the header and tabs in the content pane", () => {
    render(<App />);

    const sidebar = screen.getByRole("complementary", { name: /control sidebar/i });
    const contentPane = screen.getByRole("region", { name: /app content/i });

    expect(sidebar).toBeInTheDocument();
    expect(contentPane).toBeInTheDocument();
    expect(within(contentPane).getByRole("heading", { name: /coldchain provenance/i })).toBeInTheDocument();
    expect(within(contentPane).getByRole("tab", { name: /demo/i })).toBeInTheDocument();
  });

  it("moves bootstrap actions into the header and keeps the left rail focused on the batch workflow", () => {
    render(<App />);

    const sidebar = screen.getByRole("complementary", { name: /control sidebar/i });
    const contentPane = screen.getByRole("region", { name: /app content/i });
    const hero = within(contentPane).getByRole("banner");
    const shipmentOverview = within(contentPane).getByRole("heading", { name: /shipment overview/i }).closest("section");

    expect(within(hero).getByRole("button", { name: /connect network/i })).toBeInTheDocument();
    expect(within(hero).getByRole("button", { name: /grant demo roles/i })).toBeInTheDocument();
    expect(within(sidebar).queryByRole("button", { name: /connect network/i })).not.toBeInTheDocument();
    expect(within(sidebar).queryByRole("button", { name: /grant demo roles/i })).not.toBeInTheDocument();
    expect(within(contentPane).queryByText(/^network$/i)).not.toBeInTheDocument();
    expect(within(contentPane).queryByText(/^contract$/i)).not.toBeInTheDocument();

    const batchIdField = within(sidebar).getByLabelText(/batch id/i).closest("label");
    const registerButton = within(sidebar).getByRole("button", { name: /register batch/i });
    const sendToDistributorButton = within(sidebar).getByRole("button", { name: /send to distributor/i });
    const deliverAndVerifyButton = within(sidebar).getByRole("button", { name: /deliver .* verify/i });

    expect(batchIdField.compareDocumentPosition(registerButton)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(registerButton.compareDocumentPosition(sendToDistributorButton)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(sendToDistributorButton.compareDocumentPosition(deliverAndVerifyButton)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(shipmentOverview).not.toBeNull();
    expect(within(shipmentOverview).getByText(/active batch/i)).toBeInTheDocument();
    expect(within(shipmentOverview).getByText(/batchui001/i)).toBeInTheDocument();
  });

  it("labels workflow buttons with the acting stakeholders", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: /connect network \(admin\)/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /grant demo roles \(admin\)/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /register batch \(manufacturer\)/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send to distributor \(manufacturer -> distributor\)/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /deliver & verify \(retailer \+ regulator\)/i })).toBeInTheDocument();
  });

  it("supports top-level navigation between demo, batch tracking, and history views", () => {
    render(<App />);

    expect(screen.getByRole("tab", { name: /demo/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /batch tracking/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /history/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /history/i }));

    expect(screen.getByRole("heading", { name: /ledger history/i })).toBeInTheDocument();
  });
});
