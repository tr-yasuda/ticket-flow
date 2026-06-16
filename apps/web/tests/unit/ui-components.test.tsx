import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

describe("UI components", () => {
  it("Badge が子要素のテキストを表示する", () => {
    render(<Badge>status badge</Badge>);

    expect(screen.getByText("status badge")).toBeInTheDocument();
  });

  it("Input と Label が連携して表示される", () => {
    render(
      <>
        <Label htmlFor="email">Email</Label>
        <Input id="email" placeholder="user@example.com" />
      </>,
    );

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("user@example.com")).toBeInTheDocument();
  });

  it("Textarea が placeholder と共に表示される", () => {
    render(<Textarea placeholder="詳細を入力" />);

    expect(screen.getByPlaceholderText("詳細を入力")).toBeInTheDocument();
  });

  it("Alert がタイトルと説明文を表示する", () => {
    render(
      <Alert>
        <AlertTitle>注意</AlertTitle>
        <AlertDescription>入力内容を確認してください</AlertDescription>
      </Alert>,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("注意")).toBeInTheDocument();
    expect(screen.getByText("入力内容を確認してください")).toBeInTheDocument();
  });

  it("Table が行とセルを表示する", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>名前</TableHead>
            <TableHead>状態</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>課題 A</TableCell>
            <TableCell>未対応</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("課題 A")).toBeInTheDocument();
    expect(screen.getByText("未対応")).toBeInTheDocument();
  });
});
