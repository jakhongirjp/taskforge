import { describe, expect, it } from "vitest";
import { applyUpdate, buildBoard, progress } from "@/lib/board";
import { task } from "./fixtures";

describe("buildBoard", () => {
  it("creates every column even when empty", () => {
    expect(Object.keys(buildBoard([]))).toEqual(["todo", "in_progress", "in_review", "done"]);
  });

  it("orders by priority, then by ref number numerically", () => {
    const board = buildBoard([
      task({ ref: "WEB-10", priority: "low" }),
      task({ ref: "WEB-9", priority: "medium" }),
      task({ ref: "WEB-2", priority: "urgent" }),
      task({ ref: "WEB-11", priority: "medium" }),
      task({ ref: "WEB-3", status: "done" }),
    ]);
    expect(board.todo.map((t) => t.ref)).toEqual(["WEB-2", "WEB-9", "WEB-11", "WEB-10"]);
    expect(board.done.map((t) => t.ref)).toEqual(["WEB-3"]);
  });
});

describe("helpers", () => {
  it("replaces a task immutably", () => {
    const a = task();
    const list = [a, task()];
    const next = applyUpdate(list, { ...a, status: "done" });
    expect(next[0]!.status).toBe("done");
    expect(list[0]!.status).toBe("todo");
  });

  it("computes progress", () => {
    expect(progress([])).toBe(0);
    expect(progress([task({ status: "done" }), task(), task()])).toBe(33);
  });
});
