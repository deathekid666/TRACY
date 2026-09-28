import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ db: {} }));
import { studentRecordIdNearName } from "@/lib/academic-intelligence";

describe("student record provenance", () => {
  it("does not extract a profile URL number", () => {
    expect(studentRecordIdNearName("Jamie Example URL Source: https://www.linkedin.com/posts/jamie-example-b325221a9_activity-123456789", "Jamie Example")).toBeUndefined();
  });
  it("does not attribute neighboring table rows or unlabelled digits", () => {
    expect(studentRecordIdNearName("12345678 Other Person 87654321 Jamie Example 11223344 Another Person", "Jamie Example")).toBeUndefined();
    expect(studentRecordIdNearName("Jamie Example Other Person Student ID: 12345678", "Jamie Example")).toBeUndefined();
  });
  it("retains explicitly labelled numbers adjacent to the matching name", () => {
    expect(studentRecordIdNearName("Jamie Example | Student ID: 12345678", "Jamie Example")).toBe("12345678");
    expect(studentRecordIdNearName("Code étudiant: 12345678 | Example Jamie", "Jamie Example")).toBe("12345678");
  });
});
