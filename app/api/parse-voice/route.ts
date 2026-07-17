import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const RequestSchema = z.object({
  transcript: z.string().trim().min(1).max(4000),
  contexto: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(160),
        unit: z.enum(["kg", "seconds", "meters", "intervals", "reps"]),
        loadOptions: z.array(z.number().finite()).max(100).optional(),
      })
    )
    .min(1)
    .max(100),
});

const VoiceSetSchema = z.object({
  exercise: z.string(),
  load_kg: z.number().nullable(),
  reps: z.number().nullable(),
  rpe: z.number().nullable(),
  reps_or_time: z.string().nullable().optional(),
});

const VoiceResultSchema = z.array(VoiceSetSchema);

export type VoiceParsedSet = z.infer<typeof VoiceSetSchema>;

const SYSTEM_PROMPT = `Interpretás transcripciones de voz en español rioplatense dictadas durante un entrenamiento de fuerza.
Recibís el transcripto y una lista de ejercicios válidos del día (contexto), cada uno con su unidad y, si aplica, las cargas reales disponibles.
Devolvé EXCLUSIVAMENTE un array JSON (sin markdown, sin texto adicional) con un objeto por cada serie mencionada:
[{ "exercise": string, "load_kg": number|null, "reps": number|null, "rpe": number|null, "reps_or_time": string|null }]
- "exercise" debe ser exactamente el nombre de uno de los ejercicios del contexto (el más parecido al mencionado).
- "load_kg" solo aplica a ejercicios con unit "kg"; para otras unidades usá null y completá "reps_or_time" si corresponde.
- "rpe" es el esfuerzo percibido 6-10 (admite medios puntos), o null si no se menciona.
- Si no podés interpretar nada útil, devolvé un array vacío [].
- No inventés valores que no se mencionaron.`;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "ANTHROPIC_API_KEY no configurada en el servidor." }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const parsedRequest = RequestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return Response.json({ error: "Body inválido.", issues: parsedRequest.error.issues }, { status: 400 });
  }

  const { transcript, contexto } = parsedRequest.data;

  const anthropic = new Anthropic({ apiKey });
  let raw: string;
  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: JSON.stringify({ transcript, contexto }),
        },
      ],
    });
    const textBlock = message.content.find((block) => block.type === "text");
    raw = textBlock?.text ?? "";
  } catch {
    return Response.json({ error: "Error al llamar a la API de Claude." }, { status: 502 });
  }

  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");

  let json: unknown;
  try {
    json = JSON.parse(cleaned);
  } catch {
    return Response.json({ error: "La respuesta de Claude no es JSON válido.", raw }, { status: 422 });
  }

  const parsedResult = VoiceResultSchema.safeParse(json);
  if (!parsedResult.success) {
    return Response.json(
      { error: "La respuesta no matchea el formato esperado.", issues: parsedResult.error.issues },
      { status: 422 }
    );
  }

  const validNames = new Set(contexto.map((c) => c.name));
  const sets = parsedResult.data.filter((s) => validNames.has(s.exercise));

  return Response.json({ sets });
}
