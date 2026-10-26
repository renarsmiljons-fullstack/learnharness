"use client";

import { useEffect, useRef, type RefObject } from "react";

export interface PinchStep {
	/** Scale change since the previous step (new finger distance / old). */
	factor: number;
	/** The midpoint between the fingers, relative to the element. */
	focus: { x: number; y: number };
	/** How far the midpoint moved since the previous step (two-finger pan). */
	dx: number;
	dy: number;
}

/**
 * Two-finger pinch on touch screens for the pan/zoom viewports (they set
 * touch-action: none, so the browser's own pinch never fires there). Native
 * touch listeners, non-passive so the page itself doesn't zoom. Returns a
 * ref that is true while a pinch is in progress, so a one-finger drag
 * handler can stand down instead of fighting it.
 */
export function usePinchZoom(
	ref: RefObject<HTMLElement | null>,
	handlers: { onStart?: () => void; onPinch: (step: PinchStep) => void; onEnd?: () => void },
): RefObject<boolean> {
	const pinching = useRef(false);
	const latest = useRef(handlers);
	latest.current = handlers;

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		let prev: { dist: number; x: number; y: number } | null = null;

		const read = (e: TouchEvent) => {
			const [a, b] = [e.touches[0]!, e.touches[1]!];
			const rect = el.getBoundingClientRect();
			return {
				dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
				x: (a.clientX + b.clientX) / 2 - rect.left,
				y: (a.clientY + b.clientY) / 2 - rect.top,
			};
		};
		const onStart = (e: TouchEvent) => {
			if (e.touches.length !== 2) return;
			e.preventDefault();
			prev = read(e);
			if (!pinching.current) {
				pinching.current = true;
				latest.current.onStart?.();
			}
		};
		const onMove = (e: TouchEvent) => {
			if (!pinching.current || e.touches.length !== 2 || !prev) return;
			e.preventDefault();
			const next = read(e);
			if (prev.dist > 0 && next.dist > 0) {
				latest.current.onPinch({
					factor: next.dist / prev.dist,
					focus: { x: next.x, y: next.y },
					dx: next.x - prev.x,
					dy: next.y - prev.y,
				});
			}
			prev = next;
		};
		const onEnd = (e: TouchEvent) => {
			if (!pinching.current || e.touches.length >= 2) return;
			pinching.current = false;
			prev = null;
			latest.current.onEnd?.();
		};

		el.addEventListener("touchstart", onStart, { passive: false });
		el.addEventListener("touchmove", onMove, { passive: false });
		el.addEventListener("touchend", onEnd);
		el.addEventListener("touchcancel", onEnd);
		return () => {
			el.removeEventListener("touchstart", onStart);
			el.removeEventListener("touchmove", onMove);
			el.removeEventListener("touchend", onEnd);
			el.removeEventListener("touchcancel", onEnd);
		};
	}, [ref]);

	return pinching;
}
