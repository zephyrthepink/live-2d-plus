// Native listeners keep overlay gestures independent of React/Pixi event order.
export function attachModelGestures(root, {
    isDraggable,
    getPosition,
    onStart,
    onDragStart,
    onMove,
    onCommit,
    onEnd,
    onTap,
}) {
    const view = root.ownerDocument.defaultView;
    const supportsPointer = typeof view.PointerEvent === 'function';
    const listenerOptions = { capture: true, passive: false };
    let active = null;
    let lastTouchTime = 0;

    const preventDefault = (event) => {
        if (event.cancelable) event.preventDefault();
    };

    function start(event, point, id, type) {
        if (active || !root.contains(event.target)) return;
        const position = getPosition();
        active = {
            id, type,
            startClientX: point.clientX,
            startClientY: point.clientY,
            startX: position.x,
            startY: position.y,
            position,
            moved: false,
            dragging: false,
            target: event.target,
        };
        onStart?.();
        // Capture on the original canvas so Pixi still sees taps on its view.
        if (supportsPointer) {
            try { active.target.setPointerCapture?.(id); } catch { /* unsupported/detached target */ }
        }
    }

    function move(event, point, id) {
        if (!active || active.id !== id) return;
        const deltaX = point.clientX - active.startClientX;
        const deltaY = point.clientY - active.startClientY;
        const threshold = active.type === 'mouse' ? 4 : 8;
        if (!active.moved && Math.hypot(deltaX, deltaY) < threshold) return;
        active.moved = true;
        if (!isDraggable()) return;
        if (!active.dragging) {
            active.dragging = true;
            onDragStart?.();
        }
        preventDefault(event);
        active.position = {
            x: Math.min(100, Math.max(0, active.startX + deltaX / Math.max(view.innerWidth, 1) * 100)),
            y: Math.min(100, Math.max(0, active.startY + deltaY / Math.max(view.innerHeight, 1) * 100)),
        };
        onMove(active.position);
    }

    function finish(event, point, id, cancelled = false) {
        if (!active || active.id !== id) return;
        // Account for a final movement even if the browser coalesced move events.
        if (!cancelled && point) move(event, point, id);
        const gesture = active;
        active = null;
        onEnd?.({ moved: gesture.moved, cancelled });
        if (supportsPointer) {
            try {
                if (gesture.target.hasPointerCapture?.(id)) gesture.target.releasePointerCapture(id);
            } catch { /* target may have been removed during a model reload */ }
        }
        if (gesture.dragging) {
            if (event) preventDefault(event);
            onCommit?.({
                positionX: Number(gesture.position.x.toFixed(2)),
                positionY: Number(gesture.position.y.toFixed(2)),
            });
        } else if (!cancelled && !gesture.moved && point && root.contains(event.target)) {
            onTap?.(point);
        }
    }

    const pointerDown = (event) => {
        if (event.isPrimary === false || event.button !== 0) return;
        start(event, event, event.pointerId, event.pointerType);
    };
    const pointerMove = (event) => move(event, event, event.pointerId);
    const pointerUp = (event) => finish(event, event, event.pointerId);
    const pointerCancel = (event) => finish(event, null, event.pointerId, true);
    const touchStart = (event) => {
        lastTouchTime = Date.now();
        if (event.touches.length !== 1) return;
        const touch = event.changedTouches[0];
        if (touch) start(event, touch, touch.identifier, 'touch');
    };
    const touchMove = (event) => {
        for (let i = 0; i < event.changedTouches.length; i += 1) {
            const touch = event.changedTouches[i];
            move(event, touch, touch.identifier);
        }
    };
    const touchEnd = (event) => {
        lastTouchTime = Date.now();
        for (let i = 0; i < event.changedTouches.length; i += 1) {
            const touch = event.changedTouches[i];
            finish(event, touch, touch.identifier, event.type === 'touchcancel');
        }
    };
    const mouseDown = (event) => {
        // Older touch browsers synthesize mouse events after a touch release.
        if (event.button !== 0 || Date.now() - lastTouchTime < 800) return;
        start(event, event, 'mouse', 'mouse');
    };
    const mouseMove = (event) => move(event, event, 'mouse');
    const mouseUp = (event) => finish(event, event, 'mouse');
    const cancel = () => { if (active) finish(null, null, active.id, true); };
    const listeners = supportsPointer
        ? [['pointerdown', pointerDown], ['pointermove', pointerMove], ['pointerup', pointerUp],
            ['pointercancel', pointerCancel], ['lostpointercapture', pointerCancel]]
        : [['touchstart', touchStart], ['touchmove', touchMove], ['touchend', touchEnd],
            ['touchcancel', touchEnd], ['mousedown', mouseDown], ['mousemove', mouseMove], ['mouseup', mouseUp]];

    // Register before Pixi's window listeners: suppress a drag's tap and assign
    // its gesture ID before Pixi emits hit/pointertap/click for the release.
    for (const [type, listener] of listeners) view.addEventListener(type, listener, listenerOptions);
    view.addEventListener('blur', cancel);
    return () => {
        for (const [type, listener] of listeners) view.removeEventListener(type, listener, listenerOptions);
        view.removeEventListener('blur', cancel);
        // Unmounting should release capture without committing into React.
        const gesture = active;
        active = null;
        if (supportsPointer && gesture) {
            try { gesture.target.releasePointerCapture?.(gesture.id); } catch { /* noop */ }
        }
    };
}
