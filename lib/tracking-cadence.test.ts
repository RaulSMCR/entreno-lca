import { describe, expect, it } from "vitest";
import { statusFromLastDone } from "./tracking-cadence";

describe("statusFromLastDone", () => {
  it("devuelve overdue si nunca se hizo", () => {
    const status = statusFromLastDone("body_weight", 7, null);
    expect(status.urgency).toBe("overdue");
    expect(status.nextDueAt).toBeNull();
  });

  it("devuelve ok si falta más de 3 días para el próximo vencimiento", () => {
    const lastDoneAt = new Date().toISOString();
    const status = statusFromLastDone("body_weight", 7, lastDoneAt);
    expect(status.urgency).toBe("ok");
  });

  it("devuelve due_soon dentro de la ventana de 3 días", () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const status = statusFromLastDone("inbody_scan", 7, fiveDaysAgo);
    expect(status.urgency).toBe("due_soon");
  });

  it("devuelve overdue si ya pasó la fecha de vencimiento", () => {
    const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
    const status = statusFromLastDone("rm_retest", 7, twentyDaysAgo);
    expect(status.urgency).toBe("overdue");
  });
});
