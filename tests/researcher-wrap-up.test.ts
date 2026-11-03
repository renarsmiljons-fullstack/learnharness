// The researcher's turn cap used to end a run mid-research with no brief
// ("the researcher produced no text"); now it gets one turn to write it.
import assert from "node:assert/strict";
import { it } from "node:test";
import { runResearcherAgent } from "../src/agent/subagents/researcher.ts";
import { createFauxCore, fauxAssistantMessage, fauxText, fauxToolCall, type FauxResponseStep } from "@earendil-works/pi-ai";

it("writes the brief from what it gathered when the turn cap cuts research short", async () => {
	const url = "https://example.com/source";
	const steps: FauxResponseStep[] = Array.from({ length: 24 }, (_, i) => () =>
		fauxAssistantMessage([fauxToolCall("web_fetch", { url }, { id: `fetch${i}` })], { stopReason: "toolUse" }),
	);
	steps.push((context) => {
		const last = context.messages.at(-1);
		assert.ok(last && last.role === "user", "the wrap-up arrives as a user turn");
		assert.match(JSON.stringify(last.content), /research step limit/);
		assert.ok(context.messages.some((m) => m.role === "toolResult" && m.toolCallId === "fetch23"), "it keeps what was gathered");
		return fauxAssistantMessage([fauxText(`## Summary\nFrom what was read. [Source](${url})`)]);
	});
	const faux = createFauxCore({});
	faux.setResponses(steps);
	const realFetch = globalThis.fetch;
	globalThis.fetch = (async () => new Response("Synthetic source", { headers: { "content-type": "text/plain" } })) as typeof fetch;
	try {
		const brief = await runResearcherAgent("A broad question", { engine: { model: faux.getModel(), streamFn: faux.streamSimple } });
		assert.match(brief, /From what was read/);
	} finally {
		globalThis.fetch = realFetch;
	}
});
