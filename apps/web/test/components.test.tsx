import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Board } from "@/components/Board";
import { TaskCard } from "@/components/TaskCard";
import { task } from "./fixtures";

const members = [{ id: "u1", email: "a@x.io", name: "Aziza", role: "member" as const }];

describe("TaskCard", () => {
  it("shows ref, priority and assignee", () => {
    render(<TaskCard task={task({ ref: "OPS-7", priority: "urgent", assigneeId: "u1" })} members={members} canEdit onMove={() => {}} />);
    const card = screen.getByRole("article", { name: /OPS-7/ });
    expect(within(card).getByText("urgent")).toBeInTheDocument();
    expect(within(card).getByText("Aziza")).toBeInTheDocument();
  });

  it("moves a task through the status select", async () => {
    const onMove = vi.fn();
    render(<TaskCard task={task({ ref: "OPS-1" })} members={members} canEdit onMove={onMove} />);
    await userEvent.selectOptions(screen.getByLabelText("Move OPS-1"), "in_review");
    expect(onMove).toHaveBeenCalledWith("in_review");
  });

  it("hides editing controls for read-only users", () => {
    render(<TaskCard task={task()} members={members} canEdit={false} onMove={() => {}} />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});

describe("Board", () => {
  it("renders columns with counts", () => {
    render(<Board tasks={[task({ status: "done" }), task({ status: "done" })]} members={[]} canEdit={false} onMove={() => {}} />);
    const done = screen.getByRole("region", { name: /Done/ });
    expect(within(done).getAllByRole("article")).toHaveLength(2);
    expect(within(screen.getByRole("region", { name: /To do/ })).getByText("No tasks")).toBeInTheDocument();
  });
});
