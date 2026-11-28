import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.ts";
import { pageResult, paginate, parse, zPagination } from "../../lib/validate.ts";
import { requireAuth, userId } from "../../middleware/auth.ts";
import { emitToAdmins } from "../../realtime/socket.ts";

export const supportRouter = Router();
supportRouter.use(requireAuth);

const ticketSchema = z.object({
  type: z.enum(["SUPPORT", "FEEDBACK", "BUG"]),
  subject: z.string().trim().min(3, "Konu en az 3 karakter olmalı").max(120),
  message: z.string().trim().min(10, "Mesaj en az 10 karakter olmalı").max(5000),
  rating: z.number().int().min(1).max(5).optional(),
});

const serialize = (t: {
  id: string;
  type: string;
  subject: string;
  message: string;
  rating: number | null;
  status: string;
  createdAt: Date;
}) => ({
  id: t.id,
  type: t.type,
  subject: t.subject,
  message: t.message,
  rating: t.rating,
  status: t.status,
  createdAt: t.createdAt.toISOString(),
});

supportRouter.post("/tickets", async (req, res) => {
  const body = parse(ticketSchema, req.body);
  const ticket = await prisma.supportTicket.create({ data: { ...body, userId: userId(req) } });
  emitToAdmins("ticket.opened", `Yeni ${ticket.type === "FEEDBACK" ? "geri bildirim" : "destek talebi"}: ${ticket.subject}`);
  res.status(201).json({ ticket: serialize(ticket) });
});

supportRouter.get("/tickets", async (req, res) => {
  const uid = userId(req);
  const { page, pageSize } = parse(zPagination, req.query);
  const [rows, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where: { userId: uid },
      orderBy: { createdAt: "desc" },
      ...paginate(page, pageSize),
    }),
    prisma.supportTicket.count({ where: { userId: uid } }),
  ]);
  res.json(pageResult(rows.map(serialize), total, page, pageSize));
});
