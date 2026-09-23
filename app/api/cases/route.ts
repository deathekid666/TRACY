import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const cases = await db.case.findMany({ orderBy: { updatedAt: "desc" } });
  return NextResponse.json(cases);
}

export async function POST(request: Request) {
  const body = await request.json();
  const title = String(body.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "Case title is required" }, { status: 400 });

  const investigation = await db.$transaction(async (tx) => {
    const created = await tx.case.create({
      data: { title, description: String(body.notes ?? "").trim() || null },
    });

    const candidates = [
      ["PERSON", body.fullName],
      ["USERNAME", body.username],
      ["EMAIL", body.email],
      ["PHONE", body.phone],
      ["ORGANIZATION", body.organization],
      ["DOMAIN", body.domain],
      ["LOCATION", body.location],
    ] as const;

    for (const [type, raw] of candidates) {
      const label = String(raw ?? "").trim();
      if (label) {
        await tx.entity.create({
          data: { caseId: created.id, type, label, canonical: label.toLowerCase() },
        });
      }
    }
    return created;
  });

  return NextResponse.json(investigation, { status: 201 });
}
