import { Request, Response } from "express";
import { prisma } from "../database/prisma";
import { Prisma } from "@prisma/client";

export function buildPropertyWhere(
  req: Request
): Prisma.PropertyWhereInput | undefined {
  const { searchText } = req.query;

  if (typeof searchText !== "string") {
    return undefined;
  }

  if (!searchText || searchText.trim().length === 0) {
    return undefined;
  }

  const query = searchText.trim();

  return {
    OR: [
      { name: { contains: query } },
      { city: { contains: query } },
      { state: { contains: query } },
    ],
  };
}

export const getProperties = async (req: Request, res: Response) => {
  try {
    const properties = await prisma.property.findMany({
      take: 20,
      where: buildPropertyWhere(req),
    });

    return res.json(properties);
  } catch (error) {
    console.error("Error fetching properties:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
