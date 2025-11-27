// mitt - Tiny 200b functional event emitter / pubsub
// Source: https://github.com/developit/mitt
export default function mitt(all) {
	all = all || new Map();

	return {
		all,
		on(type, handler) {
			const handlers = all.get(type);
			const added = handlers && handlers.push(handler);
			if (!added) {
				all.set(type, [handler]);
			}
		},
		off(type, handler) {
			const handlers = all.get(type);
			if (handlers) {
				handlers.splice(handlers.indexOf(handler) >>> 0, 1);
			}
		},
		emit(type, evt) {
			Array.from(all.get(type) || [])
				.slice()
				.map((handler) => {
					handler(evt);
				});
			Array.from(all.get('*') || [])
				.slice()
				.map((handler) => {
					handler(type, evt);
				});
		},
	};
}
