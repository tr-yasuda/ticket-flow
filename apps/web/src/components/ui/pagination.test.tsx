import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Pagination } from "./pagination.js";

describe("Pagination", () => {
  it("ページ数が 1 以下の場合は何も表示しない", () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={1} onPageChange={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("現在のページ番号を表示する", () => {
    render(
      <Pagination currentPage={2} totalPages={5} onPageChange={vi.fn()} />,
    );
    expect(screen.getByText("2 / 5")).toBeInTheDocument();
  });

  it("前へ・次へボタンを表示する", () => {
    render(
      <Pagination currentPage={2} totalPages={5} onPageChange={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "前へ" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "次へ" })).toBeInTheDocument();
  });

  it("最初のページでは前へボタンが無効", () => {
    render(
      <Pagination currentPage={1} totalPages={5} onPageChange={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "前へ" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "次へ" })).not.toBeDisabled();
  });

  it("最後のページでは次へボタンが無効", () => {
    render(
      <Pagination currentPage={5} totalPages={5} onPageChange={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "前へ" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "次へ" })).toBeDisabled();
  });

  it("前へボタンをクリックすると 1 ページ戻る", () => {
    const handlePageChange = vi.fn();
    render(
      <Pagination
        currentPage={3}
        totalPages={5}
        onPageChange={handlePageChange}
      />,
    );
    screen.getByRole("button", { name: "前へ" }).click();
    expect(handlePageChange).toHaveBeenCalledWith(2);
  });

  it("次へボタンをクリックすると 1 ページ進む", () => {
    const handlePageChange = vi.fn();
    render(
      <Pagination
        currentPage={3}
        totalPages={5}
        onPageChange={handlePageChange}
      />,
    );
    screen.getByRole("button", { name: "次へ" }).click();
    expect(handlePageChange).toHaveBeenCalledWith(4);
  });

  it("無効なボタンをクリックしても onPageChange が呼ばれない", () => {
    const handlePageChange = vi.fn();
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        onPageChange={handlePageChange}
      />,
    );
    screen.getByRole("button", { name: "前へ" }).click();
    expect(handlePageChange).not.toHaveBeenCalled();
  });
});
